import { Browser, expect, Locator, Page, test } from '@playwright/test';

const INTERACTIONS_KEY = 'sql-learning-interactions';
const REPLAY_MODE_KEY = 'sql-learning-policy-replay-mode';

type NormalizedDecisionEvent = {
  eventType: 'hint_view' | 'explanation_view';
  problemId: string;
  ruleFired: string | null;
  hintLevel: number | null;
  sqlEngageSubtype: string | null;
  sqlEngageRowId: string | null;
};

async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount}\\s+error(s)?\\b`));

  for (let i = 0; i < 24; i += 1) {
    await runQueryButton.click();
    // Use expect.poll for reliable waiting instead of fixed timeout
    try {
      await expect.poll(async () => {
        return await marker.first().isVisible().catch(() => false);
      }, { timeout: 2000, intervals: [100] }).toBe(true);
      return;
    } catch {
      // Continue trying
    }
  }

  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

async function collectDecisionTrace(page: Page): Promise<NormalizedDecisionEvent[]> {
  return page.evaluate((storageKey) => {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((event) => event?.eventType === 'hint_view' || event?.eventType === 'explanation_view')
      .map((event) => ({
        eventType: event.eventType,
        problemId: event.problemId || 'unknown-problem',
        ruleFired: event.ruleFired || null,
        hintLevel: typeof event.hintLevel === 'number' ? event.hintLevel : null,
        sqlEngageSubtype: event.sqlEngageSubtype || event.errorSubtypeId || null,
        sqlEngageRowId: event.sqlEngageRowId || null
      }));
  }, INTERACTIONS_KEY);
}

async function runScenario(browser: Browser, replayMode: boolean): Promise<NormalizedDecisionEvent[]> {
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.addInitScript((mode) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-learning-policy-replay-mode', JSON.stringify(mode));
    // Set up student profile to bypass StartPage role selection
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
  }, replayMode);

  await page.goto('/');
  // After profile seeding, should redirect to practice page
  await expect(page).toHaveURL(/\/(practice)?$/, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 15000 });

  await replaceEditorText(page, 'SELECT FROM users;');
  await runUntilErrorCount(page, runQueryButton, 1);

  await page.getByRole('button', { name: 'Request Hint' }).click();
  await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByText('Hint 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByText('Hint 3', { exact: true })).toBeVisible();
  await expect.poll(async () => (
    page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return 0;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return 0;
      return parsed.filter((event) => event?.eventType === 'explanation_view').length;
    }, INTERACTIONS_KEY)
  )).toBe(1);

  const replayModeStored = await page.evaluate((replayModeKey) => (
    window.localStorage.getItem(replayModeKey)
  ), REPLAY_MODE_KEY);
  expect(replayModeStored).toBe(JSON.stringify(replayMode));

  const trace = await collectDecisionTrace(page);
  // Small delay to allow Playwright trace to finish writing before closing context
  // This prevents race conditions in trace file handling
  await page.waitForFunction(() => true, { timeout: 300 });
  await context.close();
  return trace;
}

test('@weekly parity: policy decision trace is unchanged when replay mode toggles LLM path', async ({ browser }) => {
  const normalModeTrace = await runScenario(browser, false);
  const replayModeTrace = await runScenario(browser, true);

  expect(normalModeTrace.length).toBeGreaterThan(0);
  expect(replayModeTrace).toEqual(normalModeTrace);
});
