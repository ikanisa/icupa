import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

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
      includeAssets: ["offline.html"],
      manifest: false,
      workbox: {
        navigateFallback: "/offline.html",
        globPatterns: ["**/*.{js,css,html,svg,png,webp,woff2}", "offline.html"],
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === "navigate",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "icupa-app-shell",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24,
              },
            },
          },
          {
            urlPattern: ({ url }) => {
              const sameOrigin = typeof self !== "undefined" ? url.origin === self.location.origin : true;
              return sameOrigin && url.pathname.startsWith("/api");
            },
            handler: "NetworkFirst",
            options: {
              cacheName: "icupa-api",
              networkTimeoutSeconds: 5,
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: ({ request }) => request.destination === "image" || request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "icupa-static-assets",
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 60 * 24 * 7,
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
        suppressWarnings: true,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@icupa/ingestion-utils": path.resolve(__dirname, "./packages/ingestion-utils/src"),
      "@icupa/data-access": path.resolve(__dirname, "./packages/data-access/src"),
      "@icupa/ui": path.resolve(__dirname, "./packages/ui/src"),
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
      "libs/**/*.{test,spec}.{ts,tsx}",
      "tests/**/*.{test,spec}.{ts,tsx}",
      "supabase/functions/**/*.{test,spec}.{ts,tsx}",
      "ai/**/*.{test,spec}.{ts,tsx}",
      "apps/ecotrips/apps/admin/**/*.{test,spec}.{ts,tsx}",
    ],
    environmentMatchGlobs: [
      ["supabase/functions/**", "node"],
      ["ai/**", "node"],
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/.{git,github}/**",
        "**/coverage/**",
        "**/tests/**",
        "**/*.config.{ts,js}",
        "**/vitest.setup.ts",
      ],
      include: [
        "src/**/*.{ts,tsx}",
        "packages/**/*.{ts,tsx}",
        "supabase/functions/**/*.{ts,tsx}",
        "ai/**/*.{ts,tsx}",
        "apps/ecotrips/apps/admin/**/*.{ts,tsx}",
      ],
      all: true,
      lines: 70,
      functions: 70,
      branches: 70,
      statements: 70,
    },
  },
}));
