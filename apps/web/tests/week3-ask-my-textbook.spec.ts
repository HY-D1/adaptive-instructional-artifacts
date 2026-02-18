/**
 * Week 3 Ask My Textbook Chat Tests
 * 
 * Covers: D7 (Chat UI), D8 (Chat Events)
 */

import { expect, test } from '@playwright/test';

test.describe('@weekly Week 3 Ask My Textbook', () => {
  test.beforeEach(async ({ page }) => {
    // Set up localStorage BEFORE page loads using addInitScript
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      
      // Set up NEW format profile for authentication (Required by ProtectedRoute)
      const userProfile = {
        id: 'learner-1',
        name: 'Test Learner',
        role: 'student',
        createdAt: Date.now()
      };
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify(userProfile));
      
      // Set up OLD format profile for LearningInterface data
      const profiles = [{
        id: 'learner-1',
        name: 'Test Learner',
        currentStrategy: 'adaptive-medium',
        createdAt: Date.now(),
        interactionCount: 0,
        conceptsCovered: [],
        conceptCoverageEvidence: [],
        errorHistory: []
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      
      // Session ID must follow format: session-${learnerId}-${timestamp}
      window.localStorage.setItem('sql-learning-active-session', 'session-learner-1-1234567890');
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('chat panel opens and shows quick chips', async ({ page }) => {
    await page.goto('/');
    
    // Wait for React to render
    await page.waitForTimeout(1000);

    await expect(page.getByRole('button', { name: 'Explain my last error' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show a minimal example' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'What concept is this?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible();
  });

  test('explain my last error - detects SQL errors', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    await page.getByRole('button', { name: 'Explain my last error' }).click();

    const response = page.locator('.bg-white.border').last();
    await expect(response).toBeVisible();
  });

  test('what concept - shows current problem concepts', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'What concept is this?' }).click();

    const response = page.locator('.bg-white.border').last();
    await expect(response).toBeVisible();
  });

  test('give me a hint - provides contextual hint', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'Give me a hint' }).click();

    const response = page.locator('.bg-white.border').last();
    await expect(response).toBeVisible();
  });

  test('chat interaction events logged', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'What concept is this?' }).click();
    
    // Wait for the response to be generated and event to be logged
    await page.waitForTimeout(1000);

    const events = await page.evaluate(() => {
      const interactions = JSON.parse(
        window.localStorage.getItem('sql-learning-interactions') || '[]'
      );
      return interactions.filter((e: any) => e.eventType === 'chat_interaction');
    });
    
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  test('save to notes button appears on responses', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'What concept is this?' }).click();

    await expect(page.getByRole('button', { name: /Save to My Notes/ }).first()).toBeVisible();
  });
});
