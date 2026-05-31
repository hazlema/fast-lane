import path from "node:path";
import { readdir, writeFile } from "node:fs/promises";
import { generateAsset, slugify, SOURCE_DIR, CROPPED_DIR } from "./generate";
import { runBatch, DEFAULTS, type BatchFile } from "./batch-core";
import { BOARD, NODE_XY, BOARD_SIZE } from "../game/data/board";
import { BUILDINGS } from "../game/data/buildings";

const ROOT = import.meta.dir;
const BATCH_FILE = path.join(ROOT, "batch.json");
const LAYOUT_FILE = path.join(ROOT, "layout.json");

// Guards against a second run (e.g. an EventSource reconnect) firing a parallel
// paid batch while one is already in flight.
let batchRunning = false;

function serveHtml() {
  return new Response(Bun.file(path.join(ROOT, "layout.html")), {
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

async function servePng(dir: string, pathname: string) {
  const file = Bun.file(path.join(dir, path.basename(pathname)));
  if (!(await file.exists())) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(file, { headers: { "content-type": "image/png" } });
}

Bun.serve({
  port: 3000,
  // Long-running batch streams; don't time the request out.
  idleTimeout: 255,

  async fetch(req) {
    const url = new URL(req.url);

    // Layout is the default page.
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/layout")) {
      return serveHtml();
    }

    // SVG structure tester: renders board.svg with overlays + validates it against game data.
    if (req.method === "GET" && url.pathname === "/svg-check") {
      return new Response(Bun.file(path.join(ROOT, "svg-check.html")), {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }
    // Serve a board SVG for the tester. ?file=board2.svg lets us validate a new
    // export without overwriting the known-good board.svg; defaults to board.svg.
    // Sanitized to a basename within assets/, .svg only.
    if (req.method === "GET" && url.pathname === "/board.svg") {
      const requested = url.searchParams.get("file") || "board.svg";
      const name = path.basename(requested);
      if (!name.toLowerCase().endsWith(".svg")) {
        return new Response("Only .svg files", { status: 400 });
      }
      const file = Bun.file(path.join(ROOT, "..", "assets", name));
      if (!(await file.exists())) {
        return new Response(`Not found: assets/${name}`, { status: 404 });
      }
      return new Response(file, { headers: { "content-type": "image/svg+xml; charset=utf-8" } });
    }
    // The game's board data, for the tester to validate the SVG against.
    if (req.method === "GET" && url.pathname === "/api/board-data") {
      return Response.json({
        boardSize: BOARD_SIZE,
        nodes: BOARD.nodes,
        nodeXY: NODE_XY,
        buildings: BUILDINGS.map((b) => ({
          id: b.id,
          name: b.name,
          hitBoxId: b.hitBoxId,
          node: b.node,
          services: b.services.map((s) => s.kind)
        }))
      });
    }

    // List available source images for the picker.
    if (req.method === "GET" && url.pathname === "/api/images") {
      const entries = await readdir(SOURCE_DIR, { withFileTypes: true });
      const images = entries
        .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".png"))
        .map((e) => `/generated/source/${e.name}`)
        .sort();
      return Response.json({ images });
    }

    // Serve generated images.
    if (req.method === "GET" && url.pathname.startsWith("/generated/source/")) {
      return servePng(SOURCE_DIR, url.pathname);
    }
    if (req.method === "GET" && url.pathname.startsWith("/generated/cropped/")) {
      return servePng(CROPPED_DIR, url.pathname);
    }

    // Single-asset generation (used by the Generate Single modal).
    if (req.method === "POST" && url.pathname === "/api/generate") {
      try {
        const body = await req.json();
        const assetName = String(body.assetName ?? "asset");
        const result = await generateAsset({
          assetName,
          signText: String(body.signText ?? assetName),
          description: String(body.description ?? ""),
          model: String(body.model ?? "gpt-image-1.5"),
          size: String(body.size ?? "1024x1024"),
          quality: String(body.quality ?? "high"),
          kind: String(body.kind ?? "building")
        });
        return Response.json({ ok: true, ...result });
      } catch (err) {
        return Response.json(
          { error: err instanceof Error ? err.message : String(err) },
          { status: 500 }
        );
      }
    }

    // Read the batch file (raw text, so the editor keeps formatting).
    if (req.method === "GET" && url.pathname === "/api/batch") {
      const file = Bun.file(BATCH_FILE);
      const text = (await file.exists())
        ? await file.text()
        : JSON.stringify({ defaults: { ...DEFAULTS }, items: [] }, null, 2);
      return new Response(text, {
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }

    // Save the batch file (validate it parses first).
    if (req.method === "POST" && url.pathname === "/api/batch") {
      const text = await req.text();
      try {
        JSON.parse(text);
      } catch (err) {
        return Response.json(
          { error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}` },
          { status: 400 }
        );
      }
      await writeFile(BATCH_FILE, text, "utf8");
      return Response.json({ ok: true });
    }

    // Run the batch, streaming progress as Server-Sent Events.
    if (req.method === "GET" && url.pathname === "/api/batch/run") {
      const eventStreamHeaders = {
        "content-type": "text/event-stream",
        "cache-control": "no-cache"
      };

      if (batchRunning) {
        return new Response(
          `event: error\ndata: ${JSON.stringify({ message: "A batch is already running." })}\n\n`,
          { headers: eventStreamHeaders }
        );
      }
      batchRunning = true;

      const stream = new ReadableStream({
        async start(controller) {
          const enc = new TextEncoder();
          const send = (event: string, data: unknown) =>
            controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          // Heartbeat: a single gpt-image-2 generation can exceed the connection
          // idle timeout; periodic comments keep the stream alive between items.
          const ping = setInterval(() => {
            try { controller.enqueue(enc.encode(": ping\n\n")); } catch {}
          }, 20000);

          try {
            const file = Bun.file(BATCH_FILE);
            if (!(await file.exists())) {
              send("error", { message: "batch.json not found. Edit the batch first." });
              return;
            }
            let batch: BatchFile;
            try {
              batch = await file.json();
            } catch (err) {
              send("error", { message: `batch.json is not valid JSON: ${err instanceof Error ? err.message : String(err)}` });
              return;
            }
            const result = await runBatch(batch, (p) => send("progress", p));
            send("done", result);
          } catch (err) {
            send("error", { message: err instanceof Error ? err.message : String(err) });
          } finally {
            clearInterval(ping);
            batchRunning = false;
            controller.close();
          }
        }
      });
      return new Response(stream, { headers: eventStreamHeaders });
    }

    // Read / write the saved layout.
    if (req.method === "GET" && url.pathname === "/api/layout") {
      const file = Bun.file(LAYOUT_FILE);
      if (!(await file.exists())) {
        return Response.json({ cells: null });
      }
      return new Response(file, {
        headers: { "content-type": "application/json; charset=utf-8" }
      });
    }
    if (req.method === "POST" && url.pathname === "/api/layout") {
      const text = await req.text();
      try {
        JSON.parse(text);
      } catch {
        return Response.json({ error: "Invalid layout JSON" }, { status: 400 });
      }
      await writeFile(LAYOUT_FILE, text, "utf8");
      return Response.json({ ok: true });
    }

    // Save a client-cropped PNG and return its URL.
    if (req.method === "POST" && url.pathname === "/api/crop") {
      const name = url.searchParams.get("name") || "crop";
      const bytes = Buffer.from(await req.arrayBuffer());
      if (bytes.length === 0) {
        return Response.json({ error: "Empty image data" }, { status: 400 });
      }
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `${slugify(name)}_crop_${stamp}.png`;
      await writeFile(path.join(CROPPED_DIR, filename), bytes);
      return Response.json({ ok: true, imageUrl: `/generated/cropped/${filename}` });
    }

    return new Response("Not found", { status: 404 });
  }
});

console.log("Asset Foundry running at http://localhost:3000");
