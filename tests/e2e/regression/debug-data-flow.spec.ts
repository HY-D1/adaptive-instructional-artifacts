/**
 * Debug test to trace data flow from localStorage to UI rendering
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

test('Debug: Trace data flow from storage to UI', async ({ page }) => {
  // Capture browser console logs
  const consoleLogs: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('buildTextbookInsights') || text.includes('AdaptiveTextbook')) {
      consoleLogs.push(`[${msg.type()}] ${text}`);
    }
  });
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

  // DEBUG: Check storage state immediately after save
  const storageAfterSave = await page.evaluate(() => {
    const profileRaw = window.localStorage.getItem('sql-adapt-user-profile');
    const textbookRaw = window.localStorage.getItem('sql-learning-textbook');
    const profile = profileRaw ? JSON.parse(profileRaw) : null;
    const textbook = textbookRaw ? JSON.parse(textbookRaw) : {};
    const learnerId = profile?.id;
    const units = learnerId ? (textbook[learnerId] || []) : [];

    return {
      learnerId,
      textbookKeys: Object.keys(textbook),
      unitCount: units.length,
      firstUnit: units[0] ? {
        id: units[0].id,
        title: units[0].title,
        conceptId: units[0].conceptId,
        type: units[0].type,
        status: units[0].status
      } : null
    };
  });
  console.log('Storage after save:', storageAfterSave);

  // Navigate to textbook via SPA link
  await page.getByRole('link', { name: 'My Textbook' }).first().click();
  await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });

  // Wait for component to mount and load
  await page.waitForTimeout(2000);

  // DEBUG: Check storage state after navigation
  const storageAfterNav = await page.evaluate(() => {
    const profileRaw = window.localStorage.getItem('sql-adapt-user-profile');
    const textbookRaw = window.localStorage.getItem('sql-learning-textbook');
    const profile = profileRaw ? JSON.parse(profileRaw) : null;
    const textbook = textbookRaw ? JSON.parse(textbookRaw) : {};
    const learnerId = profile?.id;
    const units = learnerId ? (textbook[learnerId] || []) : [];

    return {
      learnerId,
      textbookKeys: Object.keys(textbook),
      unitCount: units.length,
      firstUnit: units[0] ? {
        id: units[0].id,
        title: units[0].title,
        conceptId: units[0].conceptId,
        type: units[0].type,
        status: units[0].status
      } : null
    };
  });
  console.log('Storage after nav:', storageAfterNav);

  // DEBUG: Check what the AdaptiveTextbook component sees
  const componentState = await page.evaluate(() => {
    // Check if there are any React component props or state we can access
    // Look for the textbook container
    const container = document.querySelector('[data-testid="adaptive-textbook"]')
      || document.querySelector('.adaptive-textbook')
      || document.querySelector('.textbook-container');

    // Get all h3 elements (unit titles)
    const h3Elements = Array.from(document.querySelectorAll('h3')).map(h => h.textContent);

    // Check for empty state
    const bodyText = document.body.innerText;
    const hasEmptyState = bodyText.includes('Your Textbook is Empty');
    const hasUnitContent = h3Elements.some(t => t?.includes('Missing Comma'));

    return {
      containerFound: !!container,
      h3Elements,
      hasEmptyState,
      hasUnitContent,
      bodyTextSnippet: bodyText.substring(0, 1000)
    };
  });
  console.log('Component state:', componentState);

  // DEBUG: Check if TextbookPage is passing correct learnerId
  const textbookPageState = await page.evaluate(() => {
    // Try to find any debug info from the page
    const profileRaw = window.localStorage.getItem('sql-adapt-user-profile');
    const profile = profileRaw ? JSON.parse(profileRaw) : null;

    return {
      profileLearnerId: profile?.id,
      profileExists: !!profile,
      profileRole: profile?.role
    };
  });
  console.log('TextbookPage state:', textbookPageState);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-data-flow.png', fullPage: true });

  // DEBUG: Output captured console logs
  console.log('\\n=== Browser Console Logs ===');
  consoleLogs.forEach(log => console.log(log));
  console.log('=== End Console Logs ===\\n');

  // Assertions
  expect(storageAfterNav.unitCount).toBeGreaterThan(0);
  expect(storageAfterNav.learnerId).toBe(LEARNER_ID);
});
