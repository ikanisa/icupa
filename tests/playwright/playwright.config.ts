import { defineConfig, devices, type PlaywrightTestConfig } from "@playwright/test";
import { availableParallelism } from "node:os";

const DEFAULT_BASE_URL = "http://127.0.0.1:5173";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;
const testSeed = Number.parseInt(process.env.PLAYWRIGHT_SEED ?? "20250203", 10);
const hostWorkers = Math.max(
  2,
  typeof availableParallelism === "function" ? availableParallelism() : 4,
);
const workers = process.env.CI ? Math.max(2, Math.floor(hostWorkers / 2)) : undefined;

const webServer = process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : {
      command: "npm run dev -- --host 127.0.0.1 --port 5173",
      url: DEFAULT_BASE_URL,
      reuseExistingServer: true,
      stdout: "pipe" as const,
      stderr: "pipe" as const,
      timeout: 120_000,
      env: {
        DISABLE_AUTOPREFIXER: "true",
        NODE_ENV: "test",
      },
    };

const config: PlaywrightTestConfig = {
  testDir: "./specs",
  fullyParallel: true,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    timezoneId: "UTC",
    locale: "en-US",
  },
  metadata: {
    seed: testSeed,
  },
  workers,
  reportSlowTests: {
    max: 5,
    threshold: 60_000,
  },
  reporter: [["html", { outputFolder: "artifacts/phase10/playwright/html" }], ["list"]],
  outputDir: "artifacts/phase10/playwright/results",
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-safari",
      use: { ...devices["iPhone 13"], locale: "en-US" },
    },
  ],
  webServer,
};

export default defineConfig(config);
