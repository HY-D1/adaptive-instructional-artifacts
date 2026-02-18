/**
 * Week 3 Ask My Textbook Chat Tests
 * 
 * Covers: D7 (Chat UI), D8 (Chat Events)
 */

import { expect, test } from '@playwright/test';

test.describe('@weekly Week 3 Ask My Textbook', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
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
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    await expect(page.getByRole('button', { name: 'Explain my last error' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show a minimal example' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'What concept is this?' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Give me a hint' })).toBeVisible();
  });

  test('explain my last error - detects SQL errors', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

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
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    await page.getByRole('button', { name: 'What concept is this?' }).click();

    const response = page.locator('.bg-white.border').last();
    await expect(response).toBeVisible();
  });

  test('give me a hint - provides contextual hint', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    await page.getByRole('button', { name: 'Give me a hint' }).click();

    const response = page.locator('.bg-white.border').last();
    await expect(response).toBeVisible();
  });

  test('chat interaction events logged', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    await page.getByRole('button', { name: 'What concept is this?' }).click();

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
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
    });
    await page.reload();

    await page.getByRole('button', { name: 'What concept is this?' }).click();

    await expect(page.getByRole('button', { name: /Save to My Notes/ }).first()).toBeVisible();
  });
});
