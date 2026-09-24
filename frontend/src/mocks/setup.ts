// Vitest / Playwright setup — MSW only in test env. Never imported in production main.jsx.
// Usage: add to vitest.config or vite test.setupFiles: ["src/mocks/setup.ts"]
// Main app hits real /api and /ws via Vite proxy to :8000; mocks are isolated to tests.
import { beforeAll, afterEach, afterAll } from "vitest";
import { worker } from "./browser";

beforeAll(async () => {
  // Only start when Vitest is running (import.meta.env.VITEST is true in vitest)
  if (typeof window !== "undefined") {
    await worker.start({ onUnhandledRequest: "bypass" });
  }
});

afterEach(() => worker.resetHandlers());
afterAll(() => worker.stop());
