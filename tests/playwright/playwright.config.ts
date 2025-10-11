import { defineConfig, devices, type PlaywrightTestConfig } from '@playwright/test';

const DEFAULT_BASE_URL = 'http://127.0.0.1:5173';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL;

const webServer = process.env.PLAYWRIGHT_BASE_URL
  ? undefined
  : {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: DEFAULT_BASE_URL,
      reuseExistingServer: true,
      stdout: 'pipe' as const,
      stderr: 'pipe' as const,
      timeout: 120_000,
      env: {
        DISABLE_AUTOPREFIXER: 'true',
        NODE_ENV: 'test',
      },
    };

const config: PlaywrightTestConfig = {
  testDir: './specs',
  fullyParallel: true,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [['html', { outputFolder: 'artifacts/phase10/playwright/html' }], ['list']],
  outputDir: 'artifacts/phase10/playwright/results',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 13'], locale: 'en-US' },
    },
  ],
  webServer,
};

export default defineConfig(config);
