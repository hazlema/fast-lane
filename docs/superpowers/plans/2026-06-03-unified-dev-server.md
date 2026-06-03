# Unified Dev Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `bun run dev` launch a single Vite process that serves the Svelte game (with HMR) at `/` and the existing tools at `/tools` and `/validate`, with all tool APIs mounted as Vite middleware.

**Architecture:** `tools/index.ts` stops being a standalone `Bun.serve` and instead exports a pure `handleToolsRequest(req: Request): Promise<Response | null>`. A local Vite plugin (`tools/vite-tools-plugin.ts`) adapts each incoming Node request to a web `Request`, calls that handler, and streams any `Response` back — falling through to Vite (the game + HMR) when the handler returns `null`. No proxy, no second process, no second port.

**Tech Stack:** Bun (runtime + test runner), Vite 8, vite-plugin-svelte, connect middleware, Web `Request`/`Response`/`ReadableStream`.

---

## File Structure

- **Modify `tools/index.ts`** — remove top-level `Bun.serve`; export `handleToolsRequest`; rename page routes (`/`→`/tools`, `/svg-check`→`/validate`); return `null` for unmatched paths. Keep all `/api/*`, `/board.svg`, `/generated/*` logic and the `batchRunning` SSE guard. Add an `import.meta.main` guard so the file can still be run directly without affecting imports.
- **Create `tools/index.test.ts`** — unit tests for `handleToolsRequest` route behavior.
- **Create `tools/vite-tools-plugin.ts`** — the Vite plugin + connect↔web adapters (`toWebRequest`, `writeWebResponse`).
- **Create `tools/vite-tools-plugin.test.ts`** — unit test for `toWebRequest`.
- **Modify `vite.config.ts`** — register the plugin.
- **Modify `package.json`** — `dev` → `vite`; drop redundant `ui:dev` and `start`.

---

## Task 1: Refactor `tools/index.ts` into an exported handler

**Files:**
- Modify: `tools/index.ts`
- Test: `tools/index.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tools/index.test.ts`:

```ts
import { test, expect } from "bun:test";
import { handleToolsRequest } from "./index";

test("serves /api/board-data as JSON", async () => {
  const res = await handleToolsRequest(new Request("http://localhost/api/board-data"));
  expect(res).not.toBeNull();
  expect(res!.status).toBe(200);
  const data = await res!.json();
  expect(data.boardSize).toBeDefined();
  expect(Array.isArray(data.buildings)).toBe(true);
});

test("serves the /tools page as html", async () => {
  const res = await handleToolsRequest(new Request("http://localhost/tools"));
  expect(res!.status).toBe(200);
  expect(res!.headers.get("content-type")).toContain("text/html");
});

test("serves the /validate page as html", async () => {
  const res = await handleToolsRequest(new Request("http://localhost/validate"));
  expect(res!.status).toBe(200);
  expect(res!.headers.get("content-type")).toContain("text/html");
});

test("returns null for paths it does not own", async () => {
  const res = await handleToolsRequest(new Request("http://localhost/some/game/route"));
  expect(res).toBeNull();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/index.test.ts`
Expected: FAIL — `handleToolsRequest` is not exported / not a function (and importing the old file would also try to start a server).

- [ ] **Step 3: Refactor `tools/index.ts`**

Change the function signature: replace the `Bun.serve({ ... async fetch(req) {` opening so the body becomes an exported standalone function.

Replace this opening:

```ts
Bun.serve({
  port: 3000,
  // Long-running batch streams; don't time the request out.
  idleTimeout: 255,

  async fetch(req) {
    const url = new URL(req.url);
```

with:

```ts
export async function handleToolsRequest(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
```

Rename the layout page route. Replace:

```ts
    // Layout is the default page.
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/layout")) {
      return serveHtml();
    }
```

with:

```ts
    // Asset Foundry / layout editor.
    if (req.method === "GET" && url.pathname === "/tools") {
      return serveHtml();
    }
```

Rename the validator route. Replace:

```ts
    // SVG structure tester: renders board.svg with overlays + validates it against game data.
    if (req.method === "GET" && url.pathname === "/svg-check") {
```

with:

```ts
    // SVG structure tester: renders board.svg with overlays + validates it against game data.
    if (req.method === "GET" && url.pathname === "/validate") {
```

Change the closing of the function. Replace:

```ts
    return new Response("Not found", { status: 404 });
  }
});

console.log("Asset Foundry running at http://localhost:3000");
```

with:

```ts
    // Not a tools route — let the caller (Vite) handle it.
    return null;
}

// Allow running this file directly as a standalone server (not used by `bun run dev`).
if (import.meta.main) {
  Bun.serve({
    port: 3000,
    idleTimeout: 255,
    async fetch(req) {
      return (await handleToolsRequest(req)) ?? new Response("Not found", { status: 404 });
    }
  });
  console.log("Asset Foundry (standalone) running at http://localhost:3000");
}
```

> Note: the inner `return ...` / `if` route bodies between the opening and closing edits stay exactly as they are. Indentation of the function body is unchanged (it was already indented one level inside `fetch`).

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tools/index.test.ts`
Expected: PASS (4 tests). No "Asset Foundry running" log should appear (the server no longer starts on import).

- [ ] **Step 5: Commit**

```bash
git add tools/index.ts tools/index.test.ts
git commit -m "refactor(tools): export handleToolsRequest; drop always-on Bun.serve

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Vite plugin + connect↔web adapter

**Files:**
- Create: `tools/vite-tools-plugin.ts`
- Test: `tools/vite-tools-plugin.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tools/vite-tools-plugin.test.ts`:

```ts
import { test, expect } from "bun:test";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { toWebRequest } from "./vite-tools-plugin";

test("builds a web Request from a GET node request", async () => {
  const fake = { url: "/tools", method: "GET", headers: { host: "localhost" } } as unknown as IncomingMessage;
  const request = await toWebRequest(fake);
  expect(request.method).toBe("GET");
  expect(new URL(request.url).pathname).toBe("/tools");
});

test("captures the body of a POST node request", async () => {
  const stream = Readable.from([Buffer.from("hello world")]) as unknown as IncomingMessage;
  stream.url = "/api/batch";
  stream.method = "POST";
  stream.headers = { host: "localhost", "content-type": "text/plain" };
  const request = await toWebRequest(stream);
  expect(request.method).toBe("POST");
  expect(await request.text()).toBe("hello world");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test tools/vite-tools-plugin.test.ts`
Expected: FAIL — cannot find module / `toWebRequest` is not exported.

- [ ] **Step 3: Write the plugin and adapters**

Create `tools/vite-tools-plugin.ts`:

```ts
import type { Plugin } from "vite";
import type { IncomingMessage, ServerResponse } from "node:http";
import { handleToolsRequest } from "./index";

/** Convert a Node IncomingMessage into a web Request (buffering any body). */
export async function toWebRequest(req: IncomingMessage): Promise<Request> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((v) => headers.append(key, v));
    else if (value != null) headers.set(key, value);
  }
  const method = req.method ?? "GET";
  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = Buffer.concat(chunks);
  }
  return new Request(url, { method, headers, body });
}

/** Stream a web Response into a Node ServerResponse (keeps SSE flushing live). */
export async function writeWebResponse(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => { headers[key] = value; });
  res.writeHead(response.status, headers);
  if (!response.body) { res.end(); return; }
  const reader = response.body.getReader();
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
  } finally {
    res.end();
  }
}

/** Mounts the tools/validate/api routes inside the Vite dev server. */
export function toolsServer(): Plugin {
  return {
    name: "tools-server",
    configureServer(server) {
      // Registered directly so it runs before Vite's SPA fallback.
      server.middlewares.use(async (req, res, next) => {
        try {
          const request = await toWebRequest(req as IncomingMessage);
          const response = await handleToolsRequest(request);
          if (!response) { next(); return; }
          await writeWebResponse(res as ServerResponse, response);
        } catch (err) {
          res.statusCode = 500;
          res.end(err instanceof Error ? err.message : String(err));
        }
      });
    }
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test tools/vite-tools-plugin.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add tools/vite-tools-plugin.ts tools/vite-tools-plugin.test.ts
git commit -m "feat(tools): Vite plugin mounting tools routes as middleware

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Wire the plugin into Vite and simplify scripts

**Files:**
- Modify: `vite.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Register the plugin in `vite.config.ts`**

Replace the file contents with:

```ts
import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { toolsServer } from "./tools/vite-tools-plugin";

// Vite root is the repo root; index.html lives there and loads game/ui/main.ts.
// The toolsServer plugin mounts /tools, /validate, /api/*, /board.svg and
// /generated/* in-process so `bun run dev` serves the whole project on one port.
export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() }), toolsServer()],
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173 },
});
```

- [ ] **Step 2: Update `package.json` scripts**

In `package.json`, change the `dev` script and remove `ui:dev` and `start`. The `scripts` block becomes:

```json
  "scripts": {
    "dev": "vite",
    "batch": "bun tools/batch.ts",
    "export": "bun tools/export-layout.ts",
    "test": "bun test",
    "ui:build": "vite build",
    "ui:check": "svelte-check --tsconfig ./game/ui/tsconfig.json",
    "test:logic": "bun test game/engine/tests/gameplay.test.ts",
    "sim": "bun tools/sim/run.ts"
  },
```

- [ ] **Step 3: Run the full test suite**

Run: `bun test`
Expected: PASS — all existing engine/audio tests plus the 6 new tests from Tasks 1–2. No "Asset Foundry running" log.

- [ ] **Step 4: Commit**

```bash
git add vite.config.ts package.json
git commit -m "feat(dev): unify dev server — bun run dev serves game + /tools + /validate

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Browser verification

**Files:** none (verification only).

- [ ] **Step 1: Start the unified dev server**

Run (background): `bun run dev`
Expected: Vite starts on `http://localhost:5173`. No second port, no "Asset Foundry running" line.

- [ ] **Step 2: Verify the game + HMR at `/`**

Navigate to `http://localhost:5173/`. Confirm the game board renders. Edit a string in `game/ui/Hud.svelte`, save, and confirm the browser updates without a full reload (HMR intact). Revert the edit.

- [ ] **Step 3: Verify `/tools`**

Navigate to `http://localhost:5173/tools`. Confirm the Asset Foundry / layout editor renders. Confirm `GET /api/batch` and `GET /api/images` return without error (the page populates its controls).

- [ ] **Step 4: Verify `/validate`**

Navigate to `http://localhost:5173/validate`. Confirm the SVG checker renders the board with overlays, that `GET /api/board-data` and `GET /board.svg` succeed, and the validation summary shows (no fetch errors in the console).

> Do **not** trigger `POST /api/generate` or `GET /api/batch/run` — those make paid OpenAI calls.

- [ ] **Step 5: Stop the server**

Stop the background `bun run dev` process.

---

## Self-Review

- **Spec coverage:** single Vite process (Tasks 1–3 ✓); route table `/`,`/tools`,`/validate`,`/api/*`,`/board.svg`,`/generated/*` (Task 1 renames + null fallthrough ✓); middleware adapter with SSE streaming (Task 2 `writeWebResponse` ✓); `package.json` `dev`→`vite`, drop `ui:dev`/`start` (Task 3 ✓); verification incl. HMR and no paid calls (Task 4 ✓). No gaps.
- **Placeholder scan:** none — all code is concrete; refactor edits show exact before/after.
- **Type consistency:** `handleToolsRequest(req: Request): Promise<Response | null>` defined in Task 1 and consumed identically in Task 2; `toWebRequest` signature matches its test; `toolsServer()` matches the import in Task 3.
