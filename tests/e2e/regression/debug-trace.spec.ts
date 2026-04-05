/**
 * Debug test to understand why units don't appear in AdaptiveTextbook
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

test('Debug: Trace why units are not visible', async ({ page }) => {
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

  // DEBUG: Check what's happening inside the component
  const debugInfo = await page.evaluate(() => {
    // Get the actual learnerId from profile
    const profileRaw = window.localStorage.getItem('sql-adapt-user-profile');
    const profile = profileRaw ? JSON.parse(profileRaw) : null;
    const learnerId = profile?.id;

    // Get textbook data
    const textbookRaw = window.localStorage.getItem('sql-learning-textbook');
    const textbook = textbookRaw ? JSON.parse(textbookRaw) : {};
    const units = learnerId ? (textbook[learnerId] || []) : [];

    // Get interactions
    const interactionsRaw = window.localStorage.getItem('sql-learning-interactions');
    const interactions = interactionsRaw ? JSON.parse(interactionsRaw) : [];
    const learnerInteractions = interactions.filter((i: any) => i.learnerId === learnerId);

    // Get profiles
    const profilesRaw = window.localStorage.getItem('sql-learning-profiles');
    const profiles = profilesRaw ? JSON.parse(profilesRaw) : [];
    const learnerProfile = profiles.find((p: any) => p.id === learnerId);

    return {
      learnerId,
      unitCount: units.length,
      firstUnitTitle: units[0]?.title,
      interactionCount: learnerInteractions.length,
      hasProfile: !!learnerProfile,
      profileConceptsCovered: learnerProfile?.conceptsCovered?.length || 0,
      textbookKeys: Object.keys(textbook)
    };
  });

  console.log('Debug info:', debugInfo);

  // Wait a bit for the component to load
  await page.waitForTimeout(2000);

  // Check the actual rendered content
  const renderedContent = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    return {
      hasEmptyText: bodyText.includes('Your Textbook is Empty'),
      hasUnitTitle: bodyText.includes('Missing Comma'),
      hasNotesCount: bodyText.includes('1 notes'),
      bodyText: bodyText.substring(0, 800)
    };
  });

  console.log('Rendered content:', renderedContent);

  // Take screenshot
  await page.screenshot({ path: 'test-results/debug-trace.png', fullPage: true });

  // The key assertion: the unit should be visible
  expect(debugInfo.unitCount).toBeGreaterThan(0);
  expect(debugInfo.learnerId).toBe(LEARNER_ID);
});
