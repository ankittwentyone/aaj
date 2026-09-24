import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}", "src/**/__tests__/**/*.{ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    css: true,
    testTimeout: 10000,
    reporters: process.env.CI ? ["verbose"] : ["default"],
    environmentOptions: {
      jsdom: {
        pretendToBeVisual: true,
      },
    },
  },
});
