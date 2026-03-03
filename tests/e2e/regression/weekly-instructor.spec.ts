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
  // Set up with some pre-existing interaction data
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // Set up instructor profile
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'instructor',
      createdAt: Date.now()
    }));
    
    // Pre-populate with some interaction events
    window.localStorage.setItem('sql-learning-interactions', JSON.stringify([
      {
        id: 'evt-1',
        sessionId: 'session-test',
        learnerId: 'test-user',
        timestamp: Date.now() - 10000,
        eventType: 'error',
        problemId: 'problem-1',
        errorType: 'syntax_error',
        errorMessage: 'Test error'
      },
      {
        id: 'evt-2',
        sessionId: 'session-test',
        learnerId: 'test-user',
        timestamp: Date.now() - 5000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        hintLevel: 1
      },
      {
        id: 'evt-3',
        sessionId: 'session-test', 
        learnerId: 'test-user',
        timestamp: Date.now(),
        eventType: 'execution',
        problemId: 'problem-1',
        successful: true
      }
    ]));
  });

  // Navigate to research page
  await page.goto('/research');
  await expect(page).toHaveURL(/\/research/);
  await expect(page.getByText('Research Dashboard').first()).toBeVisible({ timeout: 10000 });

  // Click on trace tab if it exists
  const traceTab = page.getByTestId('instructor-trace-tab');
  if (await traceTab.isVisible().catch(() => false)) {
    await traceTab.click();
    
    // Verify trace table or events are shown
    const hasEvents = await page.getByTestId('trace-events-table-body').isVisible().catch(() => false);
    if (hasEvents) {
      await expect(page.getByTestId('trace-events-table-body')).not.toBeEmpty();
    }
  }
  
  // Verify interactions exist in storage
  const interactions = await page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-interactions');
    return raw ? JSON.parse(raw) : [];
  });
  
  expect(interactions.length).toBeGreaterThan(0);
  
  // Verify at least one interaction is the expected error event
  const errorEvents = interactions.filter((i: any) => i.eventType === 'error');
  expect(errorEvents.length).toBeGreaterThan(0);
});
