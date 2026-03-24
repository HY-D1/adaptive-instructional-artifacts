/**
 * @auth-setup  Playwright auth state capture
 *
 * Creates two storageState snapshots that contain the JWT cookie set by the
 * backend plus the localStorage profile written by AuthContext:
 *
 *   playwright/.auth/student.json     — logged-in student
 *   playwright/.auth/instructor.json  — logged-in instructor
 *
 * Subsequent test projects reference these files via `storageState` so they
 * start already authenticated — no UI login required in each test.
 *
 * Graceful degradation:
 *   If auth is unavailable (no backend / SQLite mode / AUTH_ENABLED=false),
 *   the setup writes minimal empty storageState files and logs a warning.
 *   Downstream tests using those files will detect the missing auth cookie
 *   and skip themselves via their own `beforeAll` guard.
 *
 * Env vars (all optional — sensible defaults for local dev):
 *   E2E_STUDENT_EMAIL      default: e2e-student-<ts>@sql-adapt.test
 *   E2E_STUDENT_PASSWORD   default: E2eTestPass!123
 *   E2E_INSTRUCTOR_EMAIL   default: e2e-instructor-<ts>@sql-adapt.test
 *   E2E_INSTRUCTOR_PASSWORD default: E2eInstrPass!123
 *   E2E_INSTRUCTOR_CODE    default: TeachSQL2024 (matches dev server default)
 *
 * Tags:
 *   @auth-setup — targeted by the 'setup:auth' Playwright project
 */

import { test as setup, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';

// ─── Auth state output paths ──────────────────────────────────────────────────

export const STUDENT_AUTH_FILE   = path.resolve('playwright/.auth/student.json');
export const INSTRUCTOR_AUTH_FILE = path.resolve('playwright/.auth/instructor.json');

// ─── Test credentials ─────────────────────────────────────────────────────────
// Unique per-run to avoid duplicate-email conflicts when not overridden.

const TS = Date.now();

const STUDENT_NAME      = 'E2E Student';
const STUDENT_EMAIL     = process.env.E2E_STUDENT_EMAIL     ?? `e2e-student-${TS}@sql-adapt.test`;
const STUDENT_PASSWORD  = process.env.E2E_STUDENT_PASSWORD  ?? 'E2eTestPass!123';

const INSTRUCTOR_NAME     = 'E2E Instructor';
const INSTRUCTOR_EMAIL    = process.env.E2E_INSTRUCTOR_EMAIL    ?? `e2e-instructor-${TS}@sql-adapt.test`;
const INSTRUCTOR_PASSWORD = process.env.E2E_INSTRUCTOR_PASSWORD ?? 'E2eInstrPass!123';
const INSTRUCTOR_CODE     = process.env.E2E_INSTRUCTOR_CODE     ?? process.env.VITE_INSTRUCTOR_PASSCODE ?? 'TeachSQL2024';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Write a minimal valid storageState file so downstream projects don't crash. */
function writeEmptyAuthState(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify({ cookies: [], origins: [] }, null, 2));
}

/**
 * Check whether account-based auth is enabled on the current deployment.
 * Returns false when the /auth page renders the "Account system not available"
 * message (which the frontend shows when VITE_API_BASE_URL is not set).
 */
async function isAuthEnabled(page: Page): Promise<boolean> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  const disabled = await page
    .getByText(/Account system not available/i)
    .isVisible({ timeout: 5_000 })
    .catch(() => false);
  return !disabled;
}

/**
 * Attempt signup; if the email already exists, fall back to login.
 *
 * Returns the URL the page lands on after successful auth.
 */
async function signupOrLogin(
  page: Page,
  name: string,
  email: string,
  password: string,
  role: 'student' | 'instructor',
  instructorCode?: string,
): Promise<void> {
  // ── Signup path ─────────────────────────────────────────────────────────────
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });

  // Switch to "Create Account" tab
  await page.getByRole('button', { name: /Create Account/i }).first().click();
  await expect(page.locator('#signup-name')).toBeVisible({ timeout: 5_000 });

  await page.fill('#signup-name',     name);
  await page.fill('#signup-email',    email);
  await page.fill('#signup-password', password);

  // Role card — matches the visible label text exactly
  const roleLabel = role === 'student' ? 'Student' : 'Instructor';
  await page
    .locator('button[type="button"]')
    .filter({ hasText: new RegExp(`^${roleLabel}$`, 'i') })
    .click();

  if (role === 'instructor' && instructorCode) {
    await expect(page.locator('#signup-code')).toBeVisible({ timeout: 3_000 });
    await page.fill('#signup-code', instructorCode);
  }

  // Click "Create Account" submit button (the last one in the form)
  const submitBtn = page.getByRole('button', { name: /Create Account/i }).last();
  await submitBtn.click();

  // Wait for either a redirect (success) or an error alert (e.g. duplicate email)
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

  // ── Login fallback (handles duplicate email from prior runs) ────────────────
  console.log(`[auth-setup] signup returned ${outcome} — falling back to login for ${email}`);

  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login-email')).toBeVisible({ timeout: 5_000 });

  await page.fill('#login-email',    email);
  await page.fill('#login-password', password);
  await page.getByRole('button', { name: /^Sign In$/i }).click();

  await page.waitForURL(/\/(practice|instructor-dashboard)/, { timeout: 15_000 });
}

// ─── Setup tests ──────────────────────────────────────────────────────────────

setup.describe('@auth-setup', () => {

  setup('capture student auth state', async ({ page }) => {
    // Ensure output directory exists
    fs.mkdirSync(path.dirname(STUDENT_AUTH_FILE), { recursive: true });

    const authEnabled = await isAuthEnabled(page);
    if (!authEnabled) {
      console.warn('[auth-setup] Auth not available on this deployment — writing empty student state');
      writeEmptyAuthState(STUDENT_AUTH_FILE);
      return;
    }

    await signupOrLogin(page, STUDENT_NAME, STUDENT_EMAIL, STUDENT_PASSWORD, 'student');

    // Must land on /practice
    await expect(page).toHaveURL(/\/practice/, { timeout: 15_000 });
    // Run Query button must be ready
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 20_000 });

    await page.context().storageState({ path: STUDENT_AUTH_FILE });
    console.log(`[auth-setup] Student auth state saved → ${STUDENT_AUTH_FILE}`);
  });

  setup('capture instructor auth state', async ({ page }) => {
    fs.mkdirSync(path.dirname(INSTRUCTOR_AUTH_FILE), { recursive: true });

    const authEnabled = await isAuthEnabled(page);
    if (!authEnabled) {
      console.warn('[auth-setup] Auth not available on this deployment — writing empty instructor state');
      writeEmptyAuthState(INSTRUCTOR_AUTH_FILE);
      return;
    }

    await signupOrLogin(
      page,
      INSTRUCTOR_NAME,
      INSTRUCTOR_EMAIL,
      INSTRUCTOR_PASSWORD,
      'instructor',
      INSTRUCTOR_CODE,
    );

    // Instructors land on /instructor-dashboard
    await expect(page).toHaveURL(/\/(instructor-dashboard|practice)/, { timeout: 15_000 });

    await page.context().storageState({ path: INSTRUCTOR_AUTH_FILE });
    console.log(`[auth-setup] Instructor auth state saved → ${INSTRUCTOR_AUTH_FILE}`);
  });

});
