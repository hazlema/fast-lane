import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";

// Vite root is the repo root; index.html lives there and loads game/ui/main.ts.
export default defineConfig({
  plugins: [svelte({ preprocess: vitePreprocess() })],
  build: { outDir: "dist", emptyOutDir: true },
  server: { port: 5173 },
});
