/**
 * Week 3 Ask My Textbook Chat Tests
 * 
 * Covers: D7 (Chat UI), D8 (Chat Events)
 * - Chat panel with quick action chips
 * - Error explanation via chat
 * - Concept queries
 * - Contextual hints
 * - Chat interaction event logging
 * - Save to notes functionality
 * 
 * @module Week3AskMyTextbookTests
 * @weekly
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

  test('@weekly chat panel opens and shows quick chips', async ({ page }) => {
    await page.goto('/practice');
    
    // Wait for chat buttons to be rendered
    await expect(page.getByRole('button', { name: 'Explain my last error' })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Show a minimal example' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'What concept is this?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible();
  });

  test('@weekly explain my last error - detects SQL errors', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.locator('.monaco-editor .view-lines').first()).toBeVisible({ timeout: 5000 });

    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    await page.getByRole('button', { name: 'Explain my last error' }).click();

    const response = page.locator('.bg-white.border').last();
    await expect(response).toBeVisible();
  });

  test('@weekly what concept - shows current problem concepts', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'What concept is this?' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'What concept is this?' }).click();

    const response = page.locator('.bg-white.border').last();
    await expect(response).toBeVisible();
  });

  test('@weekly give me a hint - provides contextual hint', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'Give me a hint' }).click();

    const response = page.locator('.bg-white.border').last();
    await expect(response).toBeVisible();
  });

  test('@weekly chat interaction events logged', async ({ page }) => {
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'What concept is this?' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'What concept is this?' }).click();
    
    // Wait for the response to be generated and event to be logged
    await expect.poll(async () => {
      const events = await page.evaluate(() => {
        const interactions = JSON.parse(
          window.localStorage.getItem('sql-learning-interactions') || '[]'
        );
        return interactions.filter((e: any) => e.eventType === 'chat_interaction').length;
      });
      return events;
    }, { timeout: 5000 }).toBeGreaterThanOrEqual(1);

    const events = await page.evaluate(() => {
      const interactions = JSON.parse(
        window.localStorage.getItem('sql-learning-interactions') || '[]'
      );
      return interactions.filter((e: any) => e.eventType === 'chat_interaction');
    });
    
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  test('@weekly save to notes button appears on responses', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'What concept is this?' })).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: 'What concept is this?' }).click();

    await expect(page.getByRole('button', { name: /Save to My Notes/ }).first()).toBeVisible();
  });
});
