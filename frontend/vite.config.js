import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    target: "es2022",
    chunkSizeWarningLimit: 900,
    // One CSS bundle — avoids stale /assets/map-*.css preload crashes when index.js and chunks drift
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/lightweight-charts")) return "chart";
          if (
            id.includes("node_modules/react") ||
            id.includes("node_modules/react-dom") ||
            id.includes("node_modules/react-router-dom") ||
            id.includes("node_modules/@tanstack/react-query")
          ) {
            return "vendor";
          }
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": "http://localhost:8000",
      "/ws": { target: "ws://localhost:8000", ws: true },
      "/healthz": "http://localhost:8000",
      "/readyz": "http://localhost:8000",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/mocks/setup.ts"],
    globals: true,
  },
});
