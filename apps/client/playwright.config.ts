import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  fullyParallel: false,
  use: {
    browserName: "chromium",
    headless: true,
    ignoreHTTPSErrors: true,
  },
  reporter: [["list"]],
});
