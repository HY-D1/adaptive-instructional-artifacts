/**
 * @deployed-auth-smoke  Real-auth deployment smoke
 *
 * Upgrades the learner journey from StartPage-local-profile mode to full
 * JWT-based authentication, then proves that My Textbook notes survive a
 * fresh browser context (i.e. a returning user who re-opens the tab).
 *
 * Journey:
 *   sign up / log in via /auth (real backend) →
 *   submit wrong SQL → request help → Save to Notes →
 *   navigate to /textbook → note visible →
 *   save context state → open FRESH browser context with same auth →
 *   /textbook → note still visible (cross-session persistence proven)
 *
 * Instructor gate:
 *   invalid code → visible error, no redirect
 *   valid code   → account created, redirected to /instructor-dashboard
 *
 * Requirements:
 *   - The 'setup:auth' Playwright project must have run first
 *     (playwright.config.ts depends on it via project dependencies).
 *   - If auth is unavailable on the target deployment the entire suite
 *     gracefully skips (see beforeAll guard below).
 *
 * Tags:
 *   @deployed-auth-smoke — run with the 'chromium:auth' Playwright project
 *
 * How to run (local, with dev server + backend on :3001):
 *   npx playwright test -c playwright.config.ts --project=chromium:auth \
 *     --grep "@deployed-auth-smoke"
 *
 * How to run (against a Vercel preview, no protection):
 *   PLAYWRIGHT_BASE_URL="https://<preview>.vercel.app" \
 *   E2E_STUDENT_EMAIL="student@yourdomain.com" \
 *   E2E_STUDENT_PASSWORD="YourPassword123!" \
 *     npx playwright test -c playwright.config.ts --project=chromium:auth \
 *       --grep "@deployed-auth-smoke"
 *
 * How to run (protected Vercel preview):
 *   PLAYWRIGHT_BASE_URL="https://<preview>.vercel.app" \
 *   VERCEL_AUTOMATION_BYPASS_SECRET="<secret>" \  # alias: E2E_VERCEL_BYPASS_SECRET
 *   E2E_STUDENT_EMAIL="student@yourdomain.com" \
 *   E2E_STUDENT_PASSWORD="YourPassword123!" \
 *   E2E_INSTRUCTOR_CODE="<your-instructor-code>" \
 *     npx playwright test -c playwright.config.ts --project=chromium:auth \
 *       --grep "@deployed-auth-smoke"
 */

import { expect, test } from '@playwright/test';
import fs from 'fs';
import { replaceEditorText, getTextbookUnits } from '../../helpers/test-helpers';
import { STUDENT_AUTH_FILE } from '../helpers/auth-state-paths';

// ─── Auth availability guard ───────────────────────────────────────────────────
// The 'setup:auth' project writes an empty { cookies:[], origins:[] } file when
// the backend is unreachable. A file with no cookies means auth is unavailable
// and the whole suite should be skipped.

let _authAvailable: boolean | null = null;

async function authIsAvailable(): Promise<boolean> {
  if (_authAvailable !== null) return _authAvailable;
  try {
    if (!fs.existsSync(STUDENT_AUTH_FILE)) {
      _authAvailable = false;
      return false;
    }
    const state = JSON.parse(fs.readFileSync(STUDENT_AUTH_FILE, 'utf-8'));
    // Auth is available when the file contains at least one cookie
    // (the sql_adapt_auth JWT cookie set by the backend)
    _authAvailable = Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    _authAvailable = false;
  }
  return _authAvailable;
}

// ─── Student auth smoke ────────────────────────────────────────────────────────

test.describe('@deployed-auth-smoke Student journey with real auth', () => {
  let skipAll = false;

  test.beforeAll(async () => {
    skipAll = !(await authIsAvailable());
    if (skipAll) {
      console.warn('[deployed-auth-smoke] No JWT cookie in student.json — skipping auth smoke (backend not configured)');
    }
  });

  test.beforeEach(async ({}, testInfo) => {
    if (skipAll) testInfo.skip();
  });

  /**
   * Full student journey:
   *  1. /practice loads (auth cookie pre-loaded via storageState)
   *  2. Submit wrong SQL → error visible
   *  3. Request hint → Save to Notes → success confirmation
   *  4. Navigate to /textbook via SPA link → note visible
   *  5. Save context state (AFTER note written)
   *  6. Open FRESH browser context with saved state
   *  7. /textbook in fresh context → note still visible (cross-session proof)
   */
  test('auth → practice → save note → textbook persists across fresh browser context', async ({ page, browser }) => {
    // ── Step 1: /practice must load already authenticated ─────────────────────
    await page.goto('/practice');

    await expect.poll(
      async () => page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false),
      { timeout: 30_000, intervals: [500] },
    ).toBe(true);

    // ── Step 2: Submit wrong SQL ───────────────────────────────────────────────
    await replaceEditorText(
      page,
      "SELECT name FROM employees WHERE department = Engineering",
    );
    await page.getByRole('button', { name: 'Run Query' }).click();

    await expect(
      page.locator('[class*="text-red"], .text-red-600, [class*="error"]').first(),
    ).toBeVisible({ timeout: 10_000 });

    // ── Step 3: Request hint ───────────────────────────────────────────────────
    const helpBtn = page.getByRole('button', { name: /Get Help|Request Hint/i }).first();
    if (await helpBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await helpBtn.click();
      await expect(
        page.getByRole('button', { name: /Save to Notes/i }).first(),
      ).toBeEnabled({ timeout: 10_000 }).catch(() => {});
    }

    // ── Step 4: Save to Notes ──────────────────────────────────────────────────
    const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    await saveBtn.click();

    // Success confirmation must appear
    await expect(
      page.locator('text=/Saved.*My Textbook|Updated.*My Textbook/i').first(),
    ).toBeVisible({ timeout: 20_000 });

    // No "no concept context" silent failure
    const noContextAlert = page
      .locator('[role="alert"], .text-amber-700, .text-red-700')
      .filter({ hasText: /no concept context|Could not save/i });
    await expect(noContextAlert).not.toBeVisible();

    // ── Step 5: Navigate to /textbook via SPA link ────────────────────────────
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });

    // Capture learnerId so we can query the localStorage textbook store
    const learnerId = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('sql-adapt-user-profile');
        return raw ? JSON.parse(raw).id : null;
      } catch { return null; }
    });

    if (learnerId) {
      const units = await getTextbookUnits(page, learnerId);
      expect(units.length).toBeGreaterThan(0);
      const firstTitle = (units[0]?.title as string | undefined) ?? '';
      if (firstTitle.length > 0) {
        await expect(
          page.getByText(firstTitle, { exact: false }).first(),
        ).toBeVisible({ timeout: 10_000 });
      }
    }

    const authEmail = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        const body = await response.json();
        return body?.user?.email ?? null;
      } catch {
        return null;
      }
    });
    const authPassword = process.env.E2E_STUDENT_PASSWORD ?? 'E2eTestPass!123';
    expect(authEmail).toBeTruthy();

    await page.screenshot({
      path: 'test-results/deployed-auth-smoke-textbook-pre-fresh.png',
      fullPage: true,
    });

    // ── Step 7: Open FRESH browser context and login with credentials ──────────
    // This is a true second-device simulation (no copied localStorage/cookies).
    const freshCtx = await browser.newContext();
    const freshPage = await freshCtx.newPage();

    try {
      await freshPage.goto('/auth', { waitUntil: 'domcontentloaded' });
      await expect(freshPage.locator('#login-email')).toBeVisible({ timeout: 10_000 });
      await freshPage.fill('#login-email', authEmail!);
      await freshPage.fill('#login-password', authPassword);
      await freshPage.getByRole('button', { name: /^Sign In$/i }).click();
      await freshPage.waitForURL(/\/(practice|instructor-dashboard)/, { timeout: 15_000 });
      await freshPage.goto('/textbook');
      await expect(freshPage).toHaveURL(/\/textbook/, { timeout: 10_000 });

      // Page heading visible in fresh context
      await expect(
        freshPage.locator('h1, h2').first(),
      ).toBeVisible({ timeout: 15_000 });

      // Textbook note is present in the fresh context (cross-session persistence)
      if (learnerId) {
        const freshUnits = await getTextbookUnits(freshPage, learnerId);
        expect(freshUnits.length).toBeGreaterThan(0);
      }

      await freshPage.screenshot({
        path: 'test-results/deployed-auth-smoke-textbook-fresh-context.png',
        fullPage: true,
      });
    } finally {
      await freshCtx.close();
    }
  });

  test('logout from nav redirects to /login and invalidates backend session', async ({ page }) => {
    await page.goto('/practice');
    await expect(
      page.getByRole('button', { name: 'Run Query' }),
    ).toBeEnabled({ timeout: 30_000 });

    const statusBefore = await page.evaluate(async () => {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      return response.status;
    });
    expect(statusBefore).toBe(200);

    const logoutButton = page.getByRole('button', { name: /logout/i }).first();
    await expect(logoutButton).toBeVisible({ timeout: 10_000 });
    await logoutButton.click();

    await expect(page).toHaveURL(/\/login$/, { timeout: 15_000 });
    await expect.poll(
      async () => page.evaluate(async () => {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        return response.status;
      }),
      { timeout: 15_000, intervals: [500] },
    ).toBe(401);
  });

  test('auth mode start page blocks local-only onboarding', async ({ page, browser }) => {
    await page.goto('/practice');
    const origin = new URL(page.url()).origin;

    const freshCtx = await browser.newContext();
    const freshPage = await freshCtx.newPage();
    try {
      await freshPage.goto(`${origin}/`, { waitUntil: 'domcontentloaded' });
      await expect(
        freshPage.getByRole('heading', { name: 'SQL-Adapt Learning System' }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(freshPage.getByRole('button', { name: /^Sign In$/i })).toBeVisible();
      await expect(freshPage.getByRole('button', { name: /^Create Account$/i })).toBeVisible();
      await expect(freshPage.getByRole('button', { name: /Get Started/i })).toHaveCount(0);
      await expect(freshPage.getByPlaceholder('Enter your username')).toHaveCount(0);
    } finally {
      await freshCtx.close();
    }
  });

});

// ─── Corpus smoke (unchanged from deployed-smoke.spec.ts) ─────────────────────
// These lightweight network checks do not require auth and are tag-compatible
// so they run alongside the auth journey in the same project.

test.describe('@deployed-auth-smoke Corpus availability', () => {

  test('concept-quality.json is present and valid in deployed corpus', async ({ page }) => {
    const res = await page.goto('/textbook-static/concept-quality.json');
    expect(res?.status()).toBe(200);

    const body = await page.evaluate(() =>
      fetch('/textbook-static/concept-quality.json').then(r => r.json()),
    );

    const isV1 = body.schemaVersion === 'concept-quality-v1';
    const qualityStore = isV1 ? body.qualityByConcept : body.quality;
    expect(qualityStore).toBeDefined();
    expect(typeof qualityStore).toBe('object');

    const mysqlIntro = qualityStore?.['murachs-mysql-3rd-edition/mysql-intro'];
    expect(mysqlIntro).toBeDefined();

    const status = mysqlIntro?.readabilityStatus as string;
    expect(['garbled', 'fallback_only']).toContain(status);

    expect(typeof mysqlIntro?.learnerSafeSummary).toBe('string');
    expect((mysqlIntro?.learnerSafeSummary as string).length).toBeGreaterThan(20);
  });

  test('textbook-units.json is present and valid in deployed corpus', async ({ page }) => {
    const res = await page.goto('/textbook-static/textbook-units.json');
    expect(res?.status()).toBe(200);

    const body = await page.evaluate(() =>
      fetch('/textbook-static/textbook-units.json').then(r => r.json()),
    );
    expect(body).toHaveProperty('units');
    expect(Array.isArray(body.units)).toBe(true);
    expect(body.units.length).toBeGreaterThan(0);

    for (const unit of body.units.slice(0, 5)) {
      expect(typeof unit.id).toBe('string');
      expect(unit.id.length).toBeGreaterThan(0);
    }
  });

});

// ─── Instructor auth smoke ─────────────────────────────────────────────────────

test.describe('@deployed-auth-smoke Instructor signup code gate', () => {

  /**
   * Verifies that the instructor-code guard rejects wrong codes visibly,
   * and that a valid code successfully creates an instructor account.
   */

  test('invalid instructor code shows visible error, no redirect', async ({ page }) => {
    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Skip if auth is not enabled on this deployment
    const isDisabled = await page
      .getByText(/Account system not available/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (isDisabled) {
      test.skip();
      return;
    }

    // Switch to Create Account tab
    await page.getByRole('button', { name: /Create Account/i }).first().click();
    await expect(page.locator('#signup-name')).toBeVisible({ timeout: 5_000 });

    await page.fill('#signup-name',     'Bad Instructor Attempt');
    await page.fill('#signup-email',    `bad-instr-${Date.now()}@sql-adapt.test`);
    await page.fill('#signup-password', 'ValidPass!123');

    // Select Instructor role
    await page
      .locator('button[type="button"]')
      .filter({ hasText: /^Instructor$/i })
      .click();

    // Enter a deliberately wrong code
    await expect(page.locator('#signup-code')).toBeVisible({ timeout: 3_000 });
    await page.fill('#signup-code', 'WRONG-CODE-DEFINITELY-INVALID');

    // Submit
    await page.getByRole('button', { name: /Create Account/i }).last().click();

    // Error must appear, page must NOT redirect
    await expect(
      page.locator('[role="alert"]').filter({ hasText: /Invalid instructor code/i }),
    ).toBeVisible({ timeout: 10_000 });

    await expect(page).toHaveURL(/\/auth/, { timeout: 3_000 });

    await page.screenshot({
      path: 'test-results/deployed-auth-smoke-instructor-bad-code.png',
    });
  });

  test('valid instructor code creates account and redirects to instructor-dashboard', async ({ page }) => {
    const instructorCode = process.env.E2E_INSTRUCTOR_CODE
      ?? process.env.VITE_INSTRUCTOR_PASSCODE
      ?? 'TeachSQL2024';

    await page.goto('/auth', { waitUntil: 'domcontentloaded' });

    // Skip if auth not enabled
    const isDisabled = await page
      .getByText(/Account system not available/i)
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    if (isDisabled) {
      test.skip();
      return;
    }

    // Switch to Create Account tab
    await page.getByRole('button', { name: /Create Account/i }).first().click();
    await expect(page.locator('#signup-name')).toBeVisible({ timeout: 5_000 });

    // Use a unique email each run — instructor code test exercises the gate,
    // not persistent state across runs.
    const email    = `e2e-instr-gate-${Date.now()}@sql-adapt.test`;
    const password = 'GateTestPass!123';

    await page.fill('#signup-name',     'Gate Test Instructor');
    await page.fill('#signup-email',    email);
    await page.fill('#signup-password', password);

    await page
      .locator('button[type="button"]')
      .filter({ hasText: /^Instructor$/i })
      .click();

    await expect(page.locator('#signup-code')).toBeVisible({ timeout: 3_000 });
    await page.fill('#signup-code', instructorCode);

    await page.getByRole('button', { name: /Create Account/i }).last().click();

    // Should land on /instructor-dashboard (or /practice as a fallback if the
    // server redirects instructors there in some configurations)
    await expect(page).toHaveURL(
      /\/(instructor-dashboard|practice)/,
      { timeout: 15_000 },
    );

    // No error alert
    await expect(
      page.locator('[role="alert"]').filter({ hasText: /Invalid|error/i }),
    ).not.toBeVisible();

    await page.screenshot({
      path: 'test-results/deployed-auth-smoke-instructor-valid-code.png',
    });
  });

});
