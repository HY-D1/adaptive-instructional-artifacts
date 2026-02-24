import { expect, Locator, Page, test } from '@playwright/test';

async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount} errors\\b`));

  for (let i = 0; i < 12; i += 1) {
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

async function selectRadixOption(page: Page, triggerTestId: string, optionLabel: string) {
  await page.getByTestId(triggerTestId).click();
  await page.getByRole('option', { name: optionLabel, exact: true }).click();
}

async function expectNumericValue(locator: Locator, expected: number) {
  await expect(locator).toHaveText(String(expected));
}

test('@weekly instructor: trace table shows events and policy knob changes decisions', async ({ page }) => {
  // Single init script with sentinel flag - runs once per test
  await page.addInitScript(() => {
    if (window.localStorage.getItem('__pw_seeded__')) return;
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // Set up student profile to access Practice page
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
    window.localStorage.setItem('__pw_seeded__', '1');
  });

  // Step 1: Generate trace data as student
  await page.goto('/practice');
  // Should be on practice page
  await expect(page).toHaveURL(/\/practice$/, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 15000 });

  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await expect(runQueryButton).toBeVisible();

  // Build a deterministic trace slice with enough failed attempts for adaptive divergence.
  await runUntilErrorCount(page, runQueryButton, 4);

  // Step 2: Switch to instructor role using evaluate (not another init script!)
  await page.evaluate(() => {
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'instructor',
      createdAt: Date.now()
    }));
  });
  await page.goto('/research');
  await expect(page).toHaveURL(/\/research/);
  await expect(page.getByRole('heading', { name: 'Research Dashboard' }).first()).toBeVisible();

  await page.getByTestId('instructor-trace-tab').click();
  await page.getByTestId('trace-replay-button').click();

  // Wait for trace replay to complete and events to be populated
  const tableBodyRows = page.locator('[data-testid="trace-events-table-body"] tr');
  await expect(tableBodyRows.first()).toBeVisible({ timeout: 15000 });
  // Ensure events are fully loaded before assertions
  await expect(page.getByTestId('trace-events-table-body')).not.toBeEmpty({ timeout: 10000 });

  // Adaptive baseline validation.
  await expectNumericValue(page.getByTestId('trace-threshold-escalate'), 3);
  await expectNumericValue(page.getByTestId('trace-threshold-aggregate'), 6);
  await expect(page.getByTestId('trace-policy-version')).toContainText(/sql-engage-index-v\d+-/);
  await expect(page.getByTestId('trace-policy-semantics-version')).toContainText('orchestrator-auto-escalation-variant-v2');

  const adaptiveChangedDecisionCount = Number((await page.getByTestId('trace-changed-decision-count').textContent())?.trim() || '0');
  expect(adaptiveChangedDecisionCount).toBeGreaterThan(0);
  await expect(page.getByTestId('trace-events-table-body').getByText('escalation-threshold-met').first()).toBeVisible();

  // Switch to hint-only and replay same trace slice; decision differences should collapse.
  await selectRadixOption(page, 'trace-policy-strategy-select', 'Hint-only baseline');
  await page.getByTestId('trace-replay-button').click();
  await expect(page.getByTestId('trace-threshold-escalate')).toHaveText('never', { timeout: 5000 });
  await expect(page.getByTestId('trace-threshold-aggregate')).toHaveText('never');
  await expect(page.getByTestId('trace-changed-decision-count')).toHaveText('0');
  await expect(page.getByTestId('trace-events-table-body').getByText('escalation-threshold-met')).toHaveCount(0);

  // Switch back to adaptive to confirm immediate policy effect reappears on the same slice.
  await selectRadixOption(page, 'trace-policy-strategy-select', 'Adaptive textbook policy');
  await page.getByTestId('trace-replay-button').click();
  await expectNumericValue(page.getByTestId('trace-threshold-escalate'), 3);
  await expect(page.getByTestId('trace-events-table-body').getByText('escalation-threshold-met').first()).toBeVisible();
  const changedAfterSwitchBack = Number((await page.getByTestId('trace-changed-decision-count').textContent())?.trim() || '0');
  expect(changedAfterSwitchBack).toBeGreaterThan(0);

  // Auto-escalation mode is explicit and replayable.
  await selectRadixOption(page, 'trace-auto-escalation-mode-select', 'Threshold-gated auto escalation');
  await page.getByTestId('trace-replay-button').click();
  await expect(page.getByTestId('trace-policy-semantics-version')).toContainText('threshold-gated', { timeout: 5000 });
  await expect(tableBodyRows.first()).toBeVisible({ timeout: 15000 });
});
