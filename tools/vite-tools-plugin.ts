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
