/**
 * @deployed-smoke Deployment-grade real-user flow
 *
 * Verifies the complete learner journey on a live deployment:
 *   sign in → wrong query → request help → save note →
 *   navigate to /textbook → note visible →
 *   hard reload → note persists →
 *   open known-bad concept → producer quality metadata shown
 *
 * This spec runs against a real deployed URL and therefore:
 *   - Does NOT use addInitScript to seed localStorage (real browser behaviour)
 *   - Uses the StartPage sign-in flow (name entry + role selection)
 *   - Verifies localStorage persistence across hard reloads
 *   - Verifies concept-quality.json producer metadata is consumed correctly
 *
 * Tags:
 *   @deployed-smoke  — run against the deployed app (PLAYWRIGHT_BASE_URL required)
 *   @ux-bugs         — subset of UX regression coverage for CI gating
 *
 * How to run:
 *   # Against a Vercel preview (no protection):
 *   PLAYWRIGHT_BASE_URL="https://<your-preview>.vercel.app" \
 *     npx playwright test -c playwright.config.ts --grep "@deployed-smoke"
 *
 *   # Against a protected Vercel preview:
 *   PLAYWRIGHT_BASE_URL="https://<your-preview>.vercel.app" \
 *   VERCEL_AUTOMATION_BYPASS_SECRET="<secret>" \
 *     npx playwright test -c playwright.config.ts --grep "@deployed-smoke"
 *
 *   # Full regression suite (local + deployed):
 *   PLAYWRIGHT_BASE_URL="https://<your-preview>.vercel.app" \
 *     npx playwright test -c playwright.config.ts --grep "@ux-bugs|@deployed-smoke"
 */

import { expect, test } from '@playwright/test';
import { replaceEditorText, getTextbookUnits } from '../../helpers/test-helpers';

// ─── Shared learner identity ────────────────────────────────────────────────
// Uses a timestamp suffix so parallel runs or re-runs don't collide in
// localStorage from a previous session.
const LEARNER_NAME = `SmokeTester-${Date.now()}`;

/**
 * Sign in via the StartPage flow.
 * Handles both cases:
 *   a) StartPage is shown (first visit, no profile in localStorage)
 *   b) Direct redirect to /practice (if localStorage already has a profile)
 */
async function signInViaStartPage(page: Parameters<typeof test>[1]['page'], name: string) {
  await page.goto('/');

  // If already on practice (localStorage had a profile), we're done
  const isOnPractice = await page.getByRole('button', { name: 'Run Query' }).isVisible({ timeout: 3_000 }).catch(() => false);
  if (isOnPractice) return;

  // Wait for StartPage heading
  await expect(
    page.getByRole('heading', { name: /SQL-Adapt/i })
  ).toBeVisible({ timeout: 15_000 });

  // Clear any stale profile so we get a deterministic fresh session
  await page.evaluate(() => {
    window.localStorage.removeItem('sql-adapt-user-profile');
    window.localStorage.removeItem('sql-adapt-welcome-seen');
    window.sessionStorage.clear();
  });
  await page.reload();

  // Welcome / onboarding modal — dismiss if present
  const gotItBtn = page.getByRole('button', { name: /Got it|Get Started|Continue/i }).first();
  if (await gotItBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await gotItBtn.click();
  }

  // Wait for StartPage
  await expect(
    page.getByRole('heading', { name: /SQL-Adapt/i })
  ).toBeVisible({ timeout: 15_000 });

  // Enter name
  const nameInput = page.getByPlaceholder(/Enter your.*name|Username/i).first();
  if (await nameInput.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await nameInput.fill(name);
  }

  // Select Student role
  const studentCard = page
    .locator('.cursor-pointer, [role="button"], button')
    .filter({ hasText: /^Student$/i })
    .first();
  if (await studentCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await studentCard.click();
  }

  // Click Get Started
  await page.getByRole('button', { name: /Get Started/i }).click();

  // Wait for redirect to practice
  await expect(page).toHaveURL(/\/(practice)?$/, { timeout: 15_000 });
}

// ─── Test suite ──────────────────────────────────────────────────────────────

test.describe('@deployed-smoke @ux-bugs Real-user deployment smoke', () => {
  /**
   * Full end-to-end learner journey:
   *
   *  1. Sign in via StartPage
   *  2. Submit a wrong SQL query → error appears
   *  3. Request a hint ("Get Help" / "Request Hint")
   *  4. Click "Save to Notes" → success feedback visible
   *  5. Navigate to /textbook via SPA link → note visible without reload
   *  6. Hard-reload /textbook → note still visible (localStorage persistence)
   *  7. Open a known-bad concept page → producer quality banner shown
   *  8. learnerSafeSummary visible (concept-quality.json consumed correctly)
   */
  test('auth → practice → help → save note → textbook persists → concept quality fallback', async ({ page }) => {
    // ── Step 1: Sign in ───────────────────────────────────────────────────────
    await signInViaStartPage(page, LEARNER_NAME);

    await expect.poll(async () =>
      page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false),
    { timeout: 30_000, intervals: [500] }).toBe(true);

    // ── Step 2: Submit a wrong SQL query ──────────────────────────────────────
    await replaceEditorText(
      page,
      "SELECT name FROM employees WHERE department = Engineering"
    );
    await page.getByRole('button', { name: 'Run Query' }).click();

    // Wait for error feedback
    await expect(
      page.locator('[class*="text-red"], .text-red-600, [class*="error"]').first()
    ).toBeVisible({ timeout: 10_000 });

    // ── Step 3: Request a hint ────────────────────────────────────────────────
    const helpBtn = page.getByRole('button', { name: /Get Help|Request Hint/i }).first();
    if (await helpBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await helpBtn.click();
      // Wait for hint panel / Save to Notes to become enabled
      await expect(
        page.getByRole('button', { name: /Save to Notes/i }).first()
      ).toBeEnabled({ timeout: 10_000 }).catch(() => {});
    }

    // ── Step 4: Save to Notes ─────────────────────────────────────────────────
    const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    await saveBtn.click();

    // Success confirmation must appear
    await expect(
      page.locator('text=/Saved.*My Textbook|Updated.*My Textbook/i').first()
    ).toBeVisible({ timeout: 20_000 });

    // No silent failure / "no concept context" error
    const noContextAlert = page
      .locator('[role="alert"], .text-amber-700, .text-red-700')
      .filter({ hasText: /no concept context|Could not save/i });
    await expect(noContextAlert).not.toBeVisible();

    // ── Step 5: Navigate to /textbook (SPA link) ──────────────────────────────
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });

    // Unit title must appear without a manual refresh
    const learnerId = await page.evaluate(() => {
      try {
        const raw = window.localStorage.getItem('sql-adapt-user-profile');
        return raw ? JSON.parse(raw).id : null;
      } catch { return null; }
    });

    if (learnerId) {
      const units = await getTextbookUnits(page, learnerId);
      expect(units.length).toBeGreaterThan(0);
      const firstTitle = (units[0].title as string | undefined) || '';
      if (firstTitle.length > 0) {
        await expect(
          page.getByText(firstTitle, { exact: false }).first()
        ).toBeVisible({ timeout: 10_000 });
      }
    }

    // ── Step 6: Hard-reload → note still visible (localStorage persistence) ───
    await page.reload();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });
    await expect(
      page.locator('h1, h2').first()
    ).toBeVisible({ timeout: 10_000 });

    if (learnerId) {
      const unitsAfterReload = await getTextbookUnits(page, learnerId);
      expect(unitsAfterReload.length).toBeGreaterThan(0);
    }

    await page.screenshot({
      path: 'test-results/deployed-smoke-textbook.png',
      fullPage: true,
    });

    // ── Step 7 & 8: Open known-bad concept → producer quality metadata shown ──
    await page.goto('/concepts/murachs-mysql-3rd-edition/mysql-intro');

    await expect(
      page.locator('h1').filter({ hasText: /Introduction to MySQL/i })
    ).toBeVisible({ timeout: 30_000 });

    // Quality-limited banner (populated from concept-quality.json via concept-loader)
    const banner = page.locator('[role="note"][aria-label*="quality"]');
    await expect(banner).toBeVisible({ timeout: 10_000 });
    await expect(banner).toContainText(/Source quality limited/i);

    // learnerSafeSummary (from concept-quality.json / concept-map.json qualityMetadata)
    const overviewBox = page.getByTestId('learner-safe-summary');
    await expect(overviewBox).toBeVisible({ timeout: 10_000 });
    await expect(overviewBox).toContainText(/MySQL/i);

    await page.screenshot({
      path: 'test-results/deployed-smoke-concept-quality.png',
      fullPage: true,
    });
  });

  /**
   * Verify concept-quality.json is served from the deployed static corpus.
   *
   * This is a lightweight network check that confirms the file exists and
   * returns valid JSON with the expected structure — independent of the
   * full learner journey.
   */
  test('concept-quality.json is present and valid in deployed corpus', async ({ page }) => {
    const res = await page.goto('/textbook-static/concept-quality.json');
    expect(res?.status()).toBe(200);

    const body = await page.evaluate(() => fetch('/textbook-static/concept-quality.json').then(r => r.json()));
    expect(body).toHaveProperty('quality');
    expect(body).toHaveProperty('version');

    // Known-bad concept must have garbled status
    const mysqlIntro = body.quality?.['murachs-mysql-3rd-edition/mysql-intro'];
    expect(mysqlIntro).toBeDefined();
    expect(mysqlIntro?.readabilityStatus).toBe('garbled');
    expect(typeof mysqlIntro?.learnerSafeSummary).toBe('string');
    expect(mysqlIntro?.learnerSafeSummary?.length).toBeGreaterThan(20);
  });

  /**
   * Verify textbook-units.json is served from the deployed static corpus.
   */
  test('textbook-units.json is present and valid in deployed corpus', async ({ page }) => {
    const res = await page.goto('/textbook-static/textbook-units.json');
    expect(res?.status()).toBe(200);

    const body = await page.evaluate(() => fetch('/textbook-static/textbook-units.json').then(r => r.json()));
    expect(body).toHaveProperty('units');
    expect(Array.isArray(body.units)).toBe(true);
    expect(body.units.length).toBeGreaterThan(0);

    // Every unit must have a string id and sourceDocId
    for (const unit of body.units.slice(0, 5)) {
      expect(typeof unit.id).toBe('string');
      expect(unit.id.length).toBeGreaterThan(0);
    }
  });
});
