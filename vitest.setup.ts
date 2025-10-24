import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

const DEFAULT_TEST_SEED = Number.parseInt(process.env.VITEST_SEED ?? "20250203", 10);

function createSeededRandom(seed: number) {
  let state = seed % 2147483647;
  if (state <= 0) {
    state += 2147483646;
  }

  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

const seededRandom = createSeededRandom(DEFAULT_TEST_SEED);

if (typeof HTMLCanvasElement !== "undefined") {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: () => null,
    writable: true,
  });
}

beforeAll(() => {
  vi.spyOn(Math, "random").mockImplementation(seededRandom);
  vi.useRealTimers();
  vi.setSystemTime(new Date("2024-01-01T00:00:00.000Z"));
});

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  vi.resetModules();
});

afterAll(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

beforeAll(() => {
  if (typeof window !== "undefined" && !("matchMedia" in window)) {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onchange: null,
      }),
    });
  }

  if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
    class ResizeObserver {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      value: ResizeObserver,
    });
  }
  // No-op: canvas getContext fallback already patched above for test environments
});
