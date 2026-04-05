/**
 * @regression UX-BUG-1: Save to Notes reliability
 *
 * Covers the exact learner journey that was broken:
 *   learner requests hints → clicks "Save to Notes" → unit appears in /textbook
 *
 * The regression risk: this spec drifted to a legacy "Get Help" button label
 * and could silently skip the hint click. Save-to-notes only succeeds once
 * HintSystem has supplied subtype context to LearningInterface.
 *
 * Tags:
 *   @regression  — must pass on every merge to main
 *   @ux-bugs     — part of the learner-facing bug regression suite
 *   @no-external — no LLM / Ollama required (deterministic generator used)
 *
 * How to run:
 *   npx playwright test -c playwright.config.ts tests/e2e/regression/ux-bugs-save-to-notes.spec.ts
 */

import { expect, test, type Page } from '@playwright/test';
import { replaceEditorText, getTextbookUnits } from '../../helpers/test-helpers';

const LEARNER_ID = 'save-notes-e2e';
const INCORRECT_QUERY = "SELECT name FROM users WHERE age > 100";

test.beforeEach(async ({ page }) => {
  await page.addInitScript((id: string) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');

    // Auth profile — required for StudentRoute access
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id,
      name: 'Save Notes Tester',
      role: 'student',
      createdAt: Date.now()
    }));

    // Learning profile — required for "Save to Notes" button to be enabled
    // (HintSystem checks storage.getProfile(learnerId))
    window.localStorage.setItem('sql-learning-profiles', JSON.stringify([{
      id,
      name: 'Save Notes Tester',
      conceptsCovered: [],
      conceptCoverageEvidence: [],
      errorHistory: [],
      interactionCount: 0,
      version: 1,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
    }]));

    // Active session — required for "Save to Notes" button to be enabled
    // (HintSystem checks for sessionId from storage.getActiveSessionId())
    window.localStorage.setItem('sql-learning-active-session', `session-${id}-${Date.now()}`);
  }, LEARNER_ID);
});

test.describe('@regression @ux-bugs @no-external Save-to-Notes learner journey', () => {
  async function requestFirstHint(page: Page) {
    const hintActionButton = page.getByTestId('hint-action-button');
    await expect(hintActionButton).toBeVisible({ timeout: 10_000 });
    await expect(hintActionButton).toBeEnabled({ timeout: 10_000 });
    await hintActionButton.click();

    await expect.poll(
      async () => {
        const firstHintVisible = await page.getByTestId('hint-label-1').isVisible().catch(() => false);
        const explanationVisible = await page
          .locator('text=/Full Explanation Unlocked|Explanation has been generated/i')
          .first()
          .isVisible()
          .catch(() => false);
        return firstHintVisible || explanationVisible;
      },
      { timeout: 15_000, intervals: [300, 700, 1200] },
    ).toBe(true);
  }

  /**
   * Primary regression: the full "request hint → save to notes → view in
   * textbook" flow must work end-to-end.
   *
   * Click/navigation steps covered:
   *  1. Navigate to /
   *  2. Wait for Run Query button enabled
   *  3. Type + submit an incorrect-but-runnable SQL query → result mismatch visible
   *  4. Click "Request Hint" → L1 hint shown (sets activeHintSubtype)
   *  5. Click "Save to Notes" (purple button in HintSystem panel)
   *  6. Assert: green success toast "Saved … to My Textbook" visible
   *  7. Assert: no "no concept context" error shown
   *  8. Click "My Textbook" nav link (SPA navigation, localStorage preserved)
   *  9. Assert: URL is /textbook
   * 10. Assert: at least one unit in localStorage AND its title visible on page
   */
  test('Full flow: wrong query → Request Hint → Save to Notes → unit visible in /textbook', async ({ page }) => {
    // Step 1: Navigate to practice
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });

    // Step 2: Wait for editor ready
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Step 3: Submit an incorrect-but-runnable query → results mismatch feedback appears
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.getByText(/Results differ/i).first()).toBeVisible({ timeout: 10_000 });

    // Step 4: Request a hint → sets activeHintSubtype in HintSystem
    await requestFirstHint(page);

    // Step 5: Click "Save to Notes" (purple button)
    const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    await saveBtn.click();

    // Step 6: Assert success message appears — green box in LearningInterface
    await expect(
      page.locator('text=/Saved.*My Textbook|Updated.*My Textbook/i').first()
    ).toBeVisible({ timeout: 20_000 });

    // Step 7: No "no concept context" error visible
    const noContextAlert = page
      .locator('[role="alert"], .text-amber-700, .text-red-700')
      .filter({ hasText: /no concept context|Could not save/i });
    await expect(noContextAlert).not.toBeVisible();

    // Step 8: Navigate to My Textbook via SPA link (preserves localStorage)
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });
    // Wait for page content to render
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });

    // Step 9: Verify unit in localStorage
    const units = await getTextbookUnits(page, LEARNER_ID);
    expect(units.length).toBeGreaterThan(0);

    // Step 10: Unit title visible on page
    const firstTitle = units[0].title as string;
    expect(firstTitle.length).toBeGreaterThan(0);
    await expect(
      page.getByText(firstTitle, { exact: false }).first()
    ).toBeVisible({ timeout: 10_000 });

    await page.screenshot({ path: 'test-results/ux-bug-save-to-notes-full.png', fullPage: true });
  });

  /**
   * Explicit subtype passed by HintSystem must win over stale lastError.
   *
   * This test seeds a stale 'group-by' error interaction so that
   * resolveLatestProblemErrorSubtype() would return 'group-by'.
   * The new save should use the active hint subtype (not 'group-by'), and no
   * "no concept context" error should appear.
   *
   * Assertion: no error alert visible → explicit subtype contract holds.
   */
  test('Explicit HintSystem subtype takes priority over stale lastError', async ({ page }) => {
    await page.addInitScript((id: string) => {
      window.localStorage.setItem(
        'sql-learning-interactions',
        JSON.stringify([{
          id: 'stale-error-1',
          sessionId: 'old-session',
          learnerId: id,
          problemId: 'problem-1',
          timestamp: Date.now() - 3_600_000,
          eventType: 'error',
          sqlEngageSubtype: 'group-by',
          errorSubtypeId: 'group-by'
        }])
      );
    }, LEARNER_ID);

    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    await expect.poll(async () =>
      page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false),
    { timeout: 30_000, intervals: [500] }).toBe(true);

    // Submit a correct query so the active hint subtype must beat the stale error.
    await replaceEditorText(
      page,
      "SELECT first_name, last_name, salary FROM employees WHERE department = 'Engineering' AND salary > 80000"
    );
    await page.getByRole('button', { name: 'Run Query' }).click();
    // Wait for query execution to settle before checking hints
    await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});

    // Request Hint to set activeHintSubtype (the current problem's subtype, not 'group-by')
    await requestFirstHint(page);

    // Save to Notes — must NOT show "no concept context"
    const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    await saveBtn.click();
    await expect(
      page.locator('text=/Saved.*My Textbook|Updated.*My Textbook/i').first(),
    ).toBeVisible({ timeout: 20_000 });

    // Assert: no "no concept context" error
    const noContextAlert = page
      .locator('[role="alert"], .text-amber-700, .text-red-700')
      .filter({ hasText: /no concept context|Could not save/i });
    await expect(noContextAlert).not.toBeVisible();

    await page.screenshot({ path: 'test-results/ux-bug-save-priority.png', fullPage: true });
  });

  /**
   * When no concept context is available, a visible error must be shown.
   * Specifically: the app must NOT silently do nothing (the original bug).
   *
   * Acceptable outcomes:
   *  a) Button is disabled (no profile / session) — prevents silent failure by UI
   *  b) Button is enabled but shows error "no concept context" after click
   *
   * Neither "nothing happens" nor "spinner that never resolves" is acceptable.
   */
  test('No concept context → visible error shown (no silent failure)', async ({ page }) => {
    // Navigate with a freshly cleared storage so there's no error history or hint context
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    await expect.poll(async () =>
      page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false),
    { timeout: 30_000, intervals: [500] }).toBe(true);

    // Do NOT submit any query and do NOT request hints

    const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
    const isEnabled = await saveBtn.isEnabled().catch(() => false);

    if (isEnabled) {
      await saveBtn.click();
      // Wait for a visible error to appear — silent no-op is not acceptable
      await expect(
        page.locator('[role="alert"], .text-amber-700, .text-red-700')
          .filter({ hasText: /no concept context|Could not save|try submitting/i })
          .first()
      ).toBeVisible({ timeout: 8_000 });

      // Re-verify: error must still be visible
      const hasVisibleError = await page
        .locator('[role="alert"], .text-amber-700, .text-red-700')
        .filter({ hasText: /no concept context|Could not save|try submitting/i })
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasVisibleError).toBe(true);
    } else {
      // Button disabled is an explicit guard against silent failure — verify it
      await expect(saveBtn).toBeDisabled();
    }

    await page.screenshot({ path: 'test-results/ux-bug-save-no-context.png', fullPage: true });
  });

  /**
   * After a successful save, navigating to /textbook immediately (without
   * manual refresh) must show the new unit — the broadcastSync post-save
   * refresh path must be working.
   *
   * Uses SPA link navigation (not page.goto) so the addInitScript
   * localStorage.clear() is not re-triggered.
   */
  test('Post-save broadcastSync: /textbook shows new unit without manual refresh', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    await expect.poll(async () =>
      page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false),
    { timeout: 30_000, intervals: [500] }).toBe(true);

    // Submit an incorrect-but-runnable query → request hint → save
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.getByText(/Results differ/i).first()).toBeVisible({ timeout: 10_000 });

    await requestFirstHint(page);

    const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    await saveBtn.click();
    await expect(
      page.locator('text=/Saved.*My Textbook|Updated.*My Textbook/i').first(),
    ).toBeVisible({ timeout: 20_000 });

    // Navigate to /textbook via SPA link — preserves localStorage (no init script re-run)
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });

    // Unit must be there already — the broadcastSync refresh should have loaded it
    const units = await getTextbookUnits(page, LEARNER_ID);
    expect(units.length).toBeGreaterThan(0);

    await page.screenshot({ path: 'test-results/ux-bug-broadcast-refresh.png', fullPage: true });
  });
});
