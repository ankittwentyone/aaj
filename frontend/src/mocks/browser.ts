// TEST ONLY — MSW browser worker for vitest/playwright. Never imported in production main.jsx.
// Main routes hit real backend APIs via /api proxy. To use in tests:
//   import { worker } from "@/mocks/browser"; await worker.start({ onUnhandledRequest: "bypass" })
// This file must NOT be imported or started outside Vitest/Mock env.
import { setupWorker } from "msw/browser";
import { handlers } from "./handlers";

export const worker = setupWorker(...handlers);
