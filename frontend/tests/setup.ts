import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, afterAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom lacks matchMedia, ResizeObserver, IntersectionObserver
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }
  if (!window.ResizeObserver) {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as any).ResizeObserver = ResizeObserver;
    (global as any).ResizeObserver = ResizeObserver;
  }
  // jsdom doesn't have IntersectionObserver
  if (!(window as any).IntersectionObserver) {
    class IntersectionObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    (window as any).IntersectionObserver = IntersectionObserver as any;
    (global as any).IntersectionObserver = IntersectionObserver as any;
  }
  // crypto.randomUUID polyfill for tests
  if (!global.crypto) {
    (global as any).crypto = {
      randomUUID: () => "test-uuid-" + Math.random().toString(36).slice(2, 10),
      getRandomValues: (arr: any) => arr,
    };
  } else if (!crypto.randomUUID) {
    (crypto as any).randomUUID = () => "test-uuid-" + Math.random().toString(36).slice(2, 10);
  }
}

// Silence framer-motion import errors in jsdom
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => {
      const React = require("react");
      return React.createElement("div", props, children);
    },
  },
  AnimatePresence: ({ children }: any) => children,
}));

// lightweight-charts mock for jsdom (canvas heavy) — mirrors v5 API
vi.mock("lightweight-charts", () => ({
  createChart: () => ({
    applyOptions: vi.fn(),
    remove: vi.fn(),
    timeScale: () => ({ fitContent: vi.fn(), visible: false }),
    addSeries: () => ({ setData: vi.fn() }),
  }),
  ColorType: { Solid: "solid" },
  AreaSeries: "AreaSeries",
  HistogramSeries: "HistogramSeries",
}));

// maplibre-gl heavy — mock
vi.mock("maplibre-gl", () => ({
  default: class Map {},
}));

// fetch fallback for msw tests that call fetch inside handlers
afterEach(() => {
  cleanup();
  vi.clearAllTimers();
  vi.useRealTimers();
});
