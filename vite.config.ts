import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// In dev, API calls go to `wrangler dev` (port 8787).
export default defineConfig({
  plugins: [react()],
  root: "src/client",
  publicDir: "../../public",
  build: { outDir: "../../dist", emptyOutDir: true, chunkSizeWarningLimit: 1500 },
  server: { proxy: { "/api": "http://127.0.0.1:8787" } },
});
