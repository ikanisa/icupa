// @ts-check
const { defineConfig, devices } = require('@playwright/test');

const DEFAULT_BASE_URL = 'http://127.0.0.1:3000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;
const parsedBase = new URL(baseURL);
const port = parsedBase.port || '3000';
const workspaceDir = __dirname;

/** @type {import('@playwright/test').PlaywrightTestConfig} */
const config = defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        cwd: workspaceDir,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          ...process.env,
          PORT: port,
          SKIP_ENV_VALIDATION: process.env.SKIP_ENV_VALIDATION ?? 'true',
        },
      },
});

module.exports = config;
