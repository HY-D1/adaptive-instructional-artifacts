/**
 * Debug test to check timing issues with AdaptiveTextbook
 */

import { expect, test } from '@playwright/test';
import { replaceEditorText } from '../../helpers/test-helpers';

const LEARNER_ID = 'save-notes-e2e';

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
    window.localStorage.setItem('sql-learning-active-session', `session-${id}-${Date.now()}`);
  }, LEARNER_ID);
});

test('Debug: Check if refresh fixes the issue', async ({ page }) => {
  // Navigate to practice
  await page.goto('/');
  await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });

  // Wait for editor ready
  await expect.poll(async () => {
    return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
  }, { timeout: 30_000, intervals: [500] }).toBe(true);

  // Submit an incorrect-but-runnable query
  await replaceEditorText(page, 'SELECT name FROM users WHERE age > 100');
  await page.getByRole('button', { name: 'Run Query' }).click();
  await expect(page.getByText(/Results differ/i).first()).toBeVisible({ timeout: 10_000 });

  // Request Hint
  const helpButton = page.getByTestId('hint-action-button');
  await expect(helpButton).toBeEnabled({ timeout: 10_000 });
  await helpButton.click();
  await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 15_000 });

  // Save to Notes
  const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
  await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
  await saveBtn.click();

  // Wait for success
  await expect(
    page.locator('text=/Saved.*My Textbook|Updated.*My Textbook/i').first()
  ).toBeVisible({ timeout: 20_000 });

  // Navigate to textbook
  await page.getByRole('link', { name: 'My Textbook' }).first().click();
  await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });

  // Check initial state
  const initialState = await page.evaluate(() => {
    return {
      hasEmptyText: document.body.innerText.includes('Your Textbook is Empty'),
      hasUnitTitle: document.body.innerText.includes('Missing Comma')
    };
  });
  console.log('Initial state:', initialState);

  // Wait for polling interval (3 seconds) + buffer
  await page.waitForTimeout(4000);

  // Check after polling
  const afterPollState = await page.evaluate(() => {
    return {
      hasEmptyText: document.body.innerText.includes('Your Textbook is Empty'),
      hasUnitTitle: document.body.innerText.includes('Missing Comma')
    };
  });
  console.log('After poll state:', afterPollState);

  // Trigger a manual refresh by focusing the window
  await page.evaluate(() => {
    window.dispatchEvent(new Event('focus'));
  });
  await page.waitForTimeout(500);

  // Check after focus
  const afterFocusState = await page.evaluate(() => {
    return {
      hasEmptyText: document.body.innerText.includes('Your Textbook is Empty'),
      hasUnitTitle: document.body.innerText.includes('Missing Comma')
    };
  });
  console.log('After focus state:', afterFocusState);

  // Take screenshot before reload
  await page.screenshot({ path: 'test-results/debug-timing-before-reload.png', fullPage: true });

  // Now reload the page to see if the unit appears
  await page.reload();
  await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Check after reload
  const afterReloadState = await page.evaluate(() => {
    return {
      hasEmptyText: document.body.innerText.includes('Your Textbook is Empty'),
      hasUnitTitle: document.body.innerText.includes('Missing Comma')
    };
  });
  console.log('After reload state:', afterReloadState);

  // Take screenshot after reload
  await page.screenshot({ path: 'test-results/debug-timing-after-reload.png', fullPage: true });

  // The unit should be visible after reload
  expect(afterReloadState.hasUnitTitle).toBe(true);
});
