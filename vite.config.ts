import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      manifest: false,
      injectRegister: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff2}"],
      },
      includeAssets: ["favicon.ico", "placeholder.svg", "icons/icon-192.png", "icons/icon-512.png"],
      devOptions: {
        enabled: true,
        type: "module",
      },
    }),
    mode === "development" && componentTagger(),
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
    ],
  },
}));
