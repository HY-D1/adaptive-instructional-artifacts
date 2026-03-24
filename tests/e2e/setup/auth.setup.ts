/**
 * @auth-setup  Playwright auth state capture
 *
 * Creates two storageState snapshots that contain the JWT cookie set by the
 * backend plus the localStorage profile written by AuthContext:
 *
 *   playwright/.auth/student.json      — logged-in student
 *   playwright/.auth/instructor.json   — logged-in instructor
 *
 * This setup is strict for launch proof:
 * - backend must be reachable
 * - persistence mode must be neon
 * - resolvedEnvSource must be non-null
 * - auth routes must be reachable
 *
 * Env vars:
 *   PLAYWRIGHT_API_BASE_URL  preferred backend API URL for split frontend/backend proofs
 *   VITE_API_BASE_URL        fallback backend API URL
 *   E2E_STUDENT_EMAIL        default: e2e-student-<ts>@sql-adapt.test
 *   E2E_STUDENT_PASSWORD     default: E2eTestPass!123
 *   E2E_STUDENT_CLASS_CODE   optional: section signup code (auto-provisioned if missing)
 *   E2E_INSTRUCTOR_EMAIL     default: e2e-instructor-<ts>@sql-adapt.test
 *   E2E_INSTRUCTOR_PASSWORD  default: E2eInstrPass!123
 *   E2E_INSTRUCTOR_CODE      default: TeachSQL2024
 */

import { test as setup, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  createApiContext,
  resolveApiBaseUrl,
  resolveFrontendBaseUrl,
  runNeonPreflight,
} from '../helpers/auth-env';

export const STUDENT_AUTH_FILE = path.resolve('playwright/.auth/student.json');
export const INSTRUCTOR_AUTH_FILE = path.resolve('playwright/.auth/instructor.json');

const API_BASE_URL = resolveApiBaseUrl();

const TS = Date.now();

const STUDENT_NAME = 'E2E Student';
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL ?? `e2e-student-${TS}@sql-adapt.test`;
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD ?? 'E2eTestPass!123';
const STUDENT_CLASS_CODE = process.env.E2E_STUDENT_CLASS_CODE;

const INSTRUCTOR_NAME = 'E2E Instructor';
const INSTRUCTOR_EMAIL = process.env.E2E_INSTRUCTOR_EMAIL ?? `e2e-instructor-${TS}@sql-adapt.test`;
const INSTRUCTOR_PASSWORD = process.env.E2E_INSTRUCTOR_PASSWORD ?? 'E2eInstrPass!123';
const INSTRUCTOR_CODE = process.env.E2E_INSTRUCTOR_CODE ?? process.env.VITE_INSTRUCTOR_PASSCODE ?? 'TeachSQL2024';

function assertAuthCookieSaved(filePath: string, label: string): void {
  const state = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    cookies?: Array<{ name?: string }>;
  };
  const hasJwtCookie = Array.isArray(state.cookies) && state.cookies.some((cookie) => cookie.name === 'sql_adapt_auth');
  if (!hasJwtCookie) {
    throw new Error(`[auth-setup] ${label} auth state is missing sql_adapt_auth cookie (${filePath})`);
  }
}

async function assertAuthUiAvailable(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-welcome-disabled', 'true');
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const unavailable = await page
    .getByText(/Account system not available/i)
    .isVisible({ timeout: 5_000 })
    .catch(() => false);

  if (unavailable) {
    throw new Error(
      '[auth-setup] Frontend auth UI is disabled (Account system not available). ' +
      'Ensure frontend is built with VITE_API_BASE_URL pointing to backend.',
    );
  }

  await expect(page.locator('#login-email')).toBeVisible({ timeout: 10_000 });
}

async function signupOrLogin(
  page: Page,
  name: string,
  email: string,
  password: string,
  role: 'student' | 'instructor',
  classCode?: string,
  instructorCode?: string,
): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-welcome-disabled', 'true');
  });

  await page.goto('/login?tab=signup', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#signup-name')).toBeVisible({ timeout: 10_000 });

  await page.fill('#signup-name', name);
  await page.fill('#signup-email', email);
  await page.fill('#signup-password', password);

  const roleLabel = role === 'student' ? 'Student' : 'Instructor';
  await page
    .locator('button[type="button"]')
    .filter({ hasText: new RegExp(`^${roleLabel}$`, 'i') })
    .click();

  if (role === 'student' && classCode) {
    await expect(page.locator('#signup-code')).toBeVisible({ timeout: 3_000 });
    await page.fill('#signup-code', classCode);
  }

  if (role === 'instructor' && instructorCode) {
    await expect(page.locator('#signup-code')).toBeVisible({ timeout: 3_000 });
    await page.fill('#signup-code', instructorCode);
  }

  const submitBtn = page.getByRole('button', { name: /Create Account/i }).last();
  await submitBtn.click();

  const outcome = await Promise.race([
    page
      .waitForURL(/\/(practice|instructor-dashboard)/, { timeout: 15_000 })
      .then(() => 'redirected' as const),
    page
      .locator('[role="alert"]')
      .first()
      .waitFor({ timeout: 15_000 })
      .then(() => 'error' as const),
  ]).catch(() => 'timeout' as const);

  if (outcome === 'redirected') return;

  console.log(`[auth-setup] signup returned ${outcome} — falling back to login for ${email}`);

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login-email')).toBeVisible({ timeout: 10_000 });

  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.getByRole('button', { name: /^Sign In$/i }).click();

  await page.waitForURL(/\/(practice|instructor-dashboard)/, { timeout: 15_000 });
}

setup.describe('@auth-setup', () => {
  setup.beforeAll(async () => {
    const preflight = await runNeonPreflight(API_BASE_URL);
    const frontendBaseUrl = resolveFrontendBaseUrl();
    console.log(
      `[auth-setup] frontendBaseUrl=${frontendBaseUrl} apiBaseUrl=${API_BASE_URL} ` +
      `dbMode=${String(preflight.persistenceStatus.dbMode)} ` +
      `resolvedEnvSource=${String(preflight.persistenceStatus.resolvedEnvSource)}`,
    );
  });

  setup('capture student auth state', async ({ page, playwright }) => {
    fs.mkdirSync(path.dirname(STUDENT_AUTH_FILE), { recursive: true });
    await assertAuthUiAvailable(page);

    let studentClassCode = STUDENT_CLASS_CODE;
    const apiContext = await createApiContext(playwright, API_BASE_URL);
    try {
      if (!studentClassCode) {
        const provisionEmail = `e2e-classcode-${Date.now()}@sql-adapt.test`;
        const provisionPassword = 'E2eCodeProvision!123';
        const provisionResponse = await apiContext.post('/api/auth/signup', {
          data: {
            name: 'E2E ClassCode Provisioner',
            email: provisionEmail,
            password: provisionPassword,
            role: 'instructor',
            instructorCode: INSTRUCTOR_CODE,
          },
        });
        const provisionBody = await provisionResponse.json().catch(() => null);
        if (provisionResponse.ok() && provisionBody?.user?.ownedSections?.[0]?.studentSignupCode) {
          studentClassCode = provisionBody.user.ownedSections[0].studentSignupCode;
        }
      }
    } finally {
      await apiContext.dispose();
    }

    if (!studentClassCode) {
      throw new Error(
        '[auth-setup] Missing student class code and failed to auto-provision one from backend signup.',
      );
    }

    await signupOrLogin(
      page,
      STUDENT_NAME,
      STUDENT_EMAIL,
      STUDENT_PASSWORD,
      'student',
      studentClassCode,
    );

    await expect(page).toHaveURL(/\/practice/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 20_000 });

    await page.context().storageState({ path: STUDENT_AUTH_FILE });
    assertAuthCookieSaved(STUDENT_AUTH_FILE, 'student');
    console.log(`[auth-setup] Student auth state saved → ${STUDENT_AUTH_FILE}`);
  });

  setup('capture instructor auth state', async ({ page }) => {
    fs.mkdirSync(path.dirname(INSTRUCTOR_AUTH_FILE), { recursive: true });
    await assertAuthUiAvailable(page);

    await signupOrLogin(
      page,
      INSTRUCTOR_NAME,
      INSTRUCTOR_EMAIL,
      INSTRUCTOR_PASSWORD,
      'instructor',
      undefined,
      INSTRUCTOR_CODE,
    );

    await expect(page).toHaveURL(/\/(instructor-dashboard|practice)/, { timeout: 15_000 });

    await page.context().storageState({ path: INSTRUCTOR_AUTH_FILE });
    assertAuthCookieSaved(INSTRUCTOR_AUTH_FILE, 'instructor');
    console.log(`[auth-setup] Instructor auth state saved → ${INSTRUCTOR_AUTH_FILE}`);
  });
});
