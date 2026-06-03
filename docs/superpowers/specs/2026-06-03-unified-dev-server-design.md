# Unified Dev Server — Design

**Date:** 2026-06-03
**Status:** Approved (pending spec review)

## Problem

The project runs two separate dev servers:

- **Vite** (`bun run ui:dev`, port 5173) serves the Svelte game with HMR.
- **Bun** (`bun run dev` → `tools/index.ts`, port 3000) serves the Asset
  Foundry (`/`), the SVG validator (`/svg-check`), and their JSON/image APIs.

Two ports, two commands. We want one: `bun run dev` launches everything, with
`/tools` for the foundry and `/validate` for the SVG checker, all under a single
URL — without losing the game's hot reload.

## Decision

Make **Vite the single process and front door**. Fold the tools server into
Vite as middleware (not a proxied child process). The game is served natively by
Vite, so HMR is completely untouched. The tools endpoints are handled by reusing
the existing request-handling logic from `tools/index.ts`, mounted as a Vite
dev-server middleware.

Considered and rejected:

- **Vite proxies to a separate Bun child process** — keeps `tools/index.ts`
  byte-for-byte but leaves a hidden second process and port. Rejected in favor
  of a genuinely single process ("one roof").
- **Bun compiles Svelte itself, no Vite** — loses real HMR. Rejected.

## Routes

| Path | Served by | What |
|---|---|---|
| `/` and all unmatched paths | Vite (native) | the Svelte game, with HMR |
| `/tools` | tools middleware | Asset Foundry / layout editor (`layout.html`) |
| `/validate` | tools middleware | SVG checker (`svg-check.html`) |
| `/api/*` | tools middleware | board-data, images, generate, batch, batch/run (SSE), layout, crop |
| `/board.svg` | tools middleware | board SVG for the validator (`?file=` selects an alt export) |
| `/generated/source/*`, `/generated/cropped/*` | tools middleware | generated PNGs |

## Architecture

Single process: `bun run dev` runs `vite`. A local Vite plugin registers a
connect middleware that adapts each request to the existing tools handler.

```
browser ──▶ Vite dev server (:5173, one process, under bun)
              ├─ tools middleware (runs first)
              │     matches /tools, /validate, /api/*, /board.svg, /generated/* ?
              │       yes ─▶ handleToolsRequest(req) ─▶ stream Response to res
              │       no  ─▶ next()
              └─ Vite's own middleware ─▶ Svelte game + HMR
```

### Components

1. **`tools/index.ts` (refactor)** — Remove the top-level `Bun.serve(...)`.
   Extract the existing inline `fetch(req)` body into an exported
   `handleToolsRequest(req: Request): Promise<Response | null>`. It returns a
   `Response` for any path it owns, and `null` for anything it doesn't (replacing
   the final `new Response("Not found", 404)`), so unmatched requests fall
   through to Vite. Page routes renamed: `/` & `/layout` → `/tools`;
   `/svg-check` → `/validate`. All `/api/*`, `/board.svg`, `/generated/*`
   handlers are unchanged. Paths still resolve relative to `import.meta.dir`
   (the file stays in `tools/`). The `batchRunning` guard and SSE logic are
   preserved. Bun-runtime APIs (`Bun.file`, `Bun.serve`-free) still work because
   Vite is invoked via `bun`.

2. **`tools/vite-tools-plugin.ts` (new)** — A Vite `Plugin` whose
   `configureServer(server)` calls `server.middlewares.use(...)` (registered
   directly so it runs *before* Vite's SPA fallback). The middleware:
   - Builds a web `Request` from the connect `req` (method, headers, URL via
     `new URL(req.url, "http://localhost")`). For methods with a body (POST),
     buffers the incoming Node stream into the `Request` body.
   - Calls `handleToolsRequest(request)`.
   - If `null`, calls `next()` (Vite serves the game).
   - Otherwise writes the `Response` to the Node `res`: status + headers, then
     **streams** the web `ReadableStream` body chunk-by-chunk via a reader loop
     (`res.write` per chunk, `res.end` on done). Streaming — not buffering — is
     required so the `/api/batch/run` Server-Sent Events flush live.
   - Wraps everything in try/catch → `500` on error.

3. **`vite.config.ts` (edit)** — Add the tools plugin to `plugins`. No `proxy`
   block is needed (single process). `server.port` stays 5173.

4. **`package.json` (edit)** — `dev` becomes `vite`. `ui:dev` and `start`
   (the old Bun server entrypoints) are removed as redundant. `batch`, `export`,
   `sim`, `test`, `test:logic`, `ui:build`, `ui:check` are unchanged. (Verified
   no file imports `tools/index.ts`, and the CLI scripts `batch.ts`,
   `export-layout.ts`, `sim/run.ts` don't depend on the removed server.)

## Data flow notes

- The tools HTML pages fetch only `/api/*` and `/board.svg` (absolute paths) and
  have no page-to-page `href` links, so route renames don't break them.
- The game UI makes no calls to the tools API, so there is no path collision
  between the game and the intercepted prefixes.
- `/board.svg` is only requested by the validator; the game imports its SVG as a
  Vite asset, not via that path.

## Error handling

- Middleware try/catch returns `500` with the error message; unmatched paths
  fall through cleanly to Vite.
- The existing `batchRunning` guard still prevents a second paid batch from
  running concurrently.
- SSE stream errors close the response without taking down Vite.

## Testing / verification

- `bun test` must stay green (engine + audio tests; unaffected by this change).
- Boot `bun run dev` and browser-verify:
  - `/` loads the game and HMR works (edit a Svelte file → live update).
  - `/tools` renders the Asset Foundry; `/api/images` and `/api/batch` (GET)
    respond through the middleware.
  - `/validate` renders the SVG checker; `/api/board-data` and `/board.svg`
    respond and the overlay validates.
- Do **not** trigger `/api/batch/run` or `/api/generate` during verification —
  those make paid OpenAI calls.
