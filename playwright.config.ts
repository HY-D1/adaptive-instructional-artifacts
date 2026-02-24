import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;
const HOST = '127.0.0.1';
const BASE_URL = `http://${HOST}:${PORT}`;
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: './apps/web/tests',
  timeout: 60_000,
  globalTimeout: 600_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  workers: IS_CI ? 1 : undefined,
  retries: IS_CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: {
    // Build first, then use preview server for stability in CI
    command: IS_CI 
      ? `npm run build && npx vite preview --config apps/web/vite.config.ts --host ${HOST} --port ${PORT} --outDir ../../dist/app`
      : `npm run dev -- --host ${HOST} --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !IS_CI,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
