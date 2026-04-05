/**
 * Debug test to understand the learnerId mismatch issue
 */

import { expect, test } from '@playwright/test';
import { replaceEditorText, getTextbookUnits } from '../../helpers/test-helpers';

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

test('Debug: Check learnerId and textbook state', async ({ page }) => {
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

  // DEBUG: Get the actual learnerId from the page's localStorage
  const profileFromPage = await page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-adapt-user-profile');
    return raw ? JSON.parse(raw) : null;
  });
  console.log('Profile from page:', profileFromPage);

  // DEBUG: Get the actual textbook data
  const textbookData = await page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-textbook');
    return raw ? JSON.parse(raw) : {};
  });
  console.log('Textbook data:', JSON.stringify(textbookData, null, 2));

  // DEBUG: Get learnerId that would be used by TextbookPage
  const learnerIdFromProfile = profileFromPage?.id;
  console.log('learnerId from profile:', learnerIdFromProfile);

  // Check if units exist for this learnerId
  const unitsForLearner = textbookData[learnerIdFromProfile] || [];
  console.log(`Units for learner ${learnerIdFromProfile}:`, unitsForLearner.length);

  // Navigate to textbook
  await page.getByRole('link', { name: 'My Textbook' }).first().click();
  await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });
  await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });

  // DEBUG: Check what's on the textbook page
  const pageContent = await page.content();
  console.log('Page content snippet:', pageContent.substring(0, 2000));

  // DEBUG: Check what the storage.getTextbook() returns on the page
  const unitsFromStorage = await page.evaluate((id) => {
    // Access the storage module through the window object if available
    // or directly read localStorage and parse the same way storage.ts does
    const raw = window.localStorage.getItem('sql-learning-textbook');
    if (!raw) return { error: 'No textbook key found', units: [] };
    try {
      const parsed = JSON.parse(raw);
      const units = parsed[id] || [];
      return {
        learnerId: id,
        textbookKeys: Object.keys(parsed),
        unitCount: units.length,
        firstUnit: units[0] ? { id: units[0].id, title: units[0].title, conceptId: units[0].conceptId } : null
      };
    } catch (e) {
      return { error: String(e), units: [] };
    }
  }, learnerIdFromProfile);
  console.log('Units from storage evaluation:', unitsFromStorage);

  // DEBUG: Check if AdaptiveTextbook component has any units
  const adaptiveTextbookState = await page.evaluate(() => {
    // Look for the component's rendered content - check for empty state or unit content
    const pageText = document.body.innerText;
    const hasEmptyState = pageText.includes('Your Textbook is Empty');
    const hasUnitContent = pageText.includes('Missing Comma') || pageText.includes('notes') || pageText.includes('concepts');
    const cardTitles = Array.from(document.querySelectorAll('h3')).map(h => h.textContent);
    return {
      hasEmptyState,
      hasUnitContent,
      cardTitles,
      pageTextSnippet: pageText.substring(0, 500)
    };
  });
  console.log('AdaptiveTextbook state:', adaptiveTextbookState);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-textbook.png', fullPage: true });
});
