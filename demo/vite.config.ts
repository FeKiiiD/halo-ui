import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// Builds the demo into ONE self-contained .html so it opens straight from disk
// — no server, no localhost. That is the whole point: the sheet has to be
// reviewable from a remote session with no port forwarding.
//
// Run from this directory (`vite build -c demo/vite.config.ts` sets root here),
// so `root` is left implicit rather than reaching for __dirname, which does not
// exist in an ESM config.
export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss(), viteSingleFile()],
  build: {
    outDir: "../demo-dist",
    emptyOutDir: true,
    // Inline everything; only the Fontshare stylesheet stays remote.
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
  },
});
