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
