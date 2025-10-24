import { resolve } from "node:path";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "next/link": resolve(__dirname, "test/stubs/next-link.tsx"),
      "next/navigation": resolve(__dirname, "test/stubs/next-navigation.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    css: true,
    globals: true,
  },
});
