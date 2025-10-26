import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@icupa/ingestion-utils": path.resolve(__dirname, "./packages/ingestion-utils/src"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: [path.resolve(__dirname, "vitest.setup.ts")],
    css: true,
    pool: "threads",
    maxConcurrency: 5,
    sequence: {
      shuffle: false,
      seed: Number.parseInt(process.env.VITEST_SEED ?? "20250203", 10),
    },
    exclude: ["tests/playwright/**", "tests/k6/**", "**/node_modules/**"],
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "packages/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
      "supabase/functions/**/*.{test,spec}.{ts,tsx}",
    ],
    environmentMatchGlobs: [
      ["supabase/functions/**", "node"],
    ],
  },
}));
