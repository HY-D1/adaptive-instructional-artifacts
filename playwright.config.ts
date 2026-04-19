import fs from 'fs';
import { defineConfig, devices, chromium, webkit, firefox } from '@playwright/test';

function isBrowserInstalled(browser: typeof chromium) {
  try {
    return fs.existsSync(browser.executablePath());
  } catch {
    return false;
  }
}

const IS_CHROMIUM_INSTALLED = isBrowserInstalled(chromium);
const IS_WEBKIT_INSTALLED = isBrowserInstalled(webkit);
const IS_FIREFOX_INSTALLED = isBrowserInstalled(firefox);

const PORT = 4173;
const HOST = '127.0.0.1';
const LOCAL_BASE_URL = `http://${HOST}:${PORT}`;
const IS_CI = !!process.env.CI;

/**
 * PLAYWRIGHT_BASE_URL — override to run tests against a deployed URL.
 *
 * Examples:
 *   PLAYWRIGHT_BASE_URL="https://my-preview.vercel.app" npx playwright test --grep "@deployed-smoke"
 *
 * When set, webServer is skipped (no local server needed for remote targets).
 */
const DEPLOYED_BASE_URL = process.env.PLAYWRIGHT_BASE_URL;
const BASE_URL = DEPLOYED_BASE_URL || LOCAL_BASE_URL;
const HAS_DEPLOYED_API_BASE = Boolean(
  process.env.PLAYWRIGHT_API_BASE_URL?.trim() || process.env.VITE_API_BASE_URL?.trim(),
);
const ENABLE_AUTH_PROJECTS = !DEPLOYED_BASE_URL || HAS_DEPLOYED_API_BASE;

/**
 * VERCEL_AUTOMATION_BYPASS_SECRET — required to access Vercel Preview
 * deployments that have deployment protection enabled.
 * E2E_VERCEL_BYPASS_SECRET is supported as a backward-compatible alias.
 *
 * Passed as the x-vercel-protection-bypass HTTP header on every request.
 * See: https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection
 */
const VERCEL_BYPASS_SECRET =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? process.env.E2E_VERCEL_BYPASS_SECRET;

// ─── Auth state file paths ────────────────────────────────────────────────────
// Created by the 'setup:auth' project via tests/e2e/setup/auth.setup.ts.
// Consumed by the 'chromium:auth' and 'chromium:instructor' projects.
export const STUDENT_AUTH_FILE = 'playwright/.auth/student.json';
export const INSTRUCTOR_AUTH_FILE = 'playwright/.auth/instructor.json';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  globalTimeout: 600_000,
  expect: {
    timeout: 15_000
  },
  fullyParallel: false,
  workers: 1, // Single worker to avoid shared localStorage state issues
  retries: IS_CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Inject Vercel bypass header when running against protected preview deployments
    ...(VERCEL_BYPASS_SECRET
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': VERCEL_BYPASS_SECRET,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
  },
  // Skip webServer when running against a remote deployed URL
  ...(DEPLOYED_BASE_URL
    ? {}
    : {
        webServer: {
          // In CI: use preview server with existing build (build done in workflow)
          // Local: use dev server
          command: IS_CI
            ? `npx vite preview --config apps/web/vite.config.ts --host ${HOST} --port ${PORT} --outDir ../../dist/app`
            : `npm run dev -- --host ${HOST} --port ${PORT}`,
          url: LOCAL_BASE_URL,
          reuseExistingServer: !IS_CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
          env: {
            // Enable instructor mode in CI for role-system tests
            VITE_INSTRUCTOR_PASSCODE: process.env.VITE_INSTRUCTOR_PASSCODE || 'TestPasscode2024',
            // Bypass research-unsafe blocking for E2E tests
            VITE_TEST_MODE: 'true',
          },
        },
      }),
  projects: [
    // ── Auth setup ─────────────────────────────────────────────────────────────
    // Runs once before any auth-dependent project.
    // Creates playwright/.auth/student.json and playwright/.auth/instructor.json.
    // Fails fast when backend/auth prerequisites are missing for launch-proof runs.
    ...(ENABLE_AUTH_PROJECTS
      ? [
          {
            name: 'setup:auth',
            testMatch: '**/setup/auth.setup.ts',
            use: {
              ...devices['Desktop Chrome'],
              // Enable third-party cookies for cross-origin auth between preview deployments
              // Chromium flags to disable cookie restrictions in headless/incognito mode
              launchOptions: {
                args: [
                  '--disable-web-security',
                  '--disable-features=IsolateOrigins,site-per-process,SameSiteByDefaultCookies,CookiesWithoutSameSiteMustBeSecure,ImprovedCookieControls,ImprovedCookieControlsForThirdPartyCookieBlocking',
                ],
              },
              contextOptions: {
                bypassCSP: true,
                ignoreHTTPSErrors: true,
              },
            },
          },
        ]
      : []),

    // ── Main test suite (no auth dependency) ────────────────────────────────────
    // Runs all specs EXCEPT the auth setup and the auth-dependent smoke.
    // These tests seed auth via addInitScript / StartPage flow.
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: [
        '**/setup/**',
        '**/deployed-auth-smoke.spec.ts',
        '**/student-multi-device-persistence.spec.ts',
        '**/instructor-section-scope.spec.ts',
        '**/instructor-dashboard-error-states.spec.ts',
        '**/instructor-dashboard-profiles.spec.ts',
        '**/api-authz.spec.ts',
        '**/hint-stability-beta.spec.ts',
      ],
    },

    // Cross-browser smoke tests (Safari + Firefox) — only when browsers are installed
    ...(IS_WEBKIT_INSTALLED
      ? [
          {
            name: 'webkit',
            use: { ...devices['Desktop Safari'] },
            testMatch: [
              '**/regression/*-smoke.spec.ts',
              '**/regression/keyboard-shortcuts.spec.ts',
              '**/regression/navigation-ux.spec.ts',
              '**/regression/storage-quota-resilience.spec.ts',
            ],
          },
        ]
      : []),
    ...(IS_FIREFOX_INSTALLED
      ? [
          {
            name: 'firefox',
            use: { ...devices['Desktop Firefox'] },
            testMatch: [
              '**/regression/*-smoke.spec.ts',
              '**/regression/keyboard-shortcuts.spec.ts',
              '**/regression/navigation-ux.spec.ts',
              '**/regression/storage-quota-resilience.spec.ts',
            ],
          },
        ]
      : []),

    // ── Auth-backed deployed smoke (student) ───────────────────────────────────
    // Runs AFTER setup:auth. Each test context starts with the student JWT
    // cookie + localStorage profile pre-loaded — no UI login needed per test.
    // Tests self-skip when the auth file contains no cookies (backend absent).
    ...(ENABLE_AUTH_PROJECTS
      ? [
          {
            name: 'chromium:auth',
            testMatch: [
              '**/deployed-auth-smoke.spec.ts',
              '**/student-multi-device-persistence.spec.ts',
              '**/student-script-production.spec.ts',
              '**/instructor-section-scope.spec.ts',
              '**/api-authz.spec.ts',
              '**/hint-stability-beta.spec.ts',
            ],
            dependencies: ['setup:auth'],
            use: {
              ...devices['Desktop Chrome'],
              storageState: STUDENT_AUTH_FILE,
            },
          },
        ]
      : []),

    // ── Auth-backed instructor tests ────────────────────────────────────────────
    // Runs AFTER setup:auth. Uses instructor JWT for instructor-only routes.
    ...(ENABLE_AUTH_PROJECTS
      ? [
          {
            name: 'chromium:instructor',
            testMatch: [
              '**/instructor-dashboard-error-states.spec.ts',
              '**/instructor-dashboard-profiles.spec.ts',
            ],
            dependencies: ['setup:auth'],
            use: {
              ...devices['Desktop Chrome'],
              storageState: INSTRUCTOR_AUTH_FILE,
            },
          },
        ]
      : []),
  ]
});
