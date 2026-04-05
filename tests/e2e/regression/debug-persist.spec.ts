/**
 * Debug test to check if data persists after reload
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

test('Debug: Check data persistence after reload', async ({ page }) => {
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

  // Check data BEFORE navigating to textbook
  const dataBeforeNavigate = await page.evaluate(() => {
    const textbookRaw = window.localStorage.getItem('sql-learning-textbook');
    const profileRaw = window.localStorage.getItem('sql-adapt-user-profile');
    return {
      textbookExists: !!textbookRaw,
      textbookLength: textbookRaw?.length || 0,
      profileExists: !!profileRaw,
      learnerId: profileRaw ? JSON.parse(profileRaw).id : null
    };
  });
  console.log('Data before navigate:', dataBeforeNavigate);

  // Navigate to textbook
  await page.getByRole('link', { name: 'My Textbook' }).first().click();
  await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Check data AFTER navigating to textbook
  const dataAfterNavigate = await page.evaluate(() => {
    const textbookRaw = window.localStorage.getItem('sql-learning-textbook');
    const profileRaw = window.localStorage.getItem('sql-adapt-user-profile');
    const textbook = textbookRaw ? JSON.parse(textbookRaw) : {};
    const learnerId = profileRaw ? JSON.parse(profileRaw).id : null;
    const units = learnerId ? (textbook[learnerId] || []) : [];
    return {
      textbookExists: !!textbookRaw,
      textbookLength: textbookRaw?.length || 0,
      profileExists: !!profileRaw,
      learnerId,
      unitCount: units.length,
      firstUnitTitle: units[0]?.title
    };
  });
  console.log('Data after navigate:', dataAfterNavigate);

  // Check UI state
  const uiState = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    return {
      hasEmptyText: bodyText.includes('Your Textbook is Empty'),
      hasUnitTitle: bodyText.includes('Missing Comma'),
      hasNotesCount: bodyText.includes('notes')
    };
  });
  console.log('UI state:', uiState);

  // Now reload and check again
  await page.reload();
  await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });
  await page.waitForTimeout(2000);

  // Check data AFTER reload
  const dataAfterReload = await page.evaluate(() => {
    const textbookRaw = window.localStorage.getItem('sql-learning-textbook');
    const profileRaw = window.localStorage.getItem('sql-adapt-user-profile');
    const textbook = textbookRaw ? JSON.parse(textbookRaw) : {};
    const learnerId = profileRaw ? JSON.parse(profileRaw).id : null;
    const units = learnerId ? (textbook[learnerId] || []) : [];
    return {
      textbookExists: !!textbookRaw,
      textbookLength: textbookRaw?.length || 0,
      profileExists: !!profileRaw,
      learnerId,
      unitCount: units.length,
      firstUnitTitle: units[0]?.title,
      textbookKeys: Object.keys(textbook)
    };
  });
  console.log('Data after reload:', dataAfterReload);

  // Check UI state after reload
  const uiStateAfterReload = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    return {
      hasEmptyText: bodyText.includes('Your Textbook is Empty'),
      hasUnitTitle: bodyText.includes('Missing Comma'),
      hasNotesCount: bodyText.includes('notes')
    };
  });
  console.log('UI state after reload:', uiStateAfterReload);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-persist.png', fullPage: true });

  // Data should persist
  expect(dataAfterReload.unitCount).toBeGreaterThan(0);
});
