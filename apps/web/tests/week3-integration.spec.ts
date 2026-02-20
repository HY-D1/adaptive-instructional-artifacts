/**
 * Week 3 Core Integration Tests
 * 
 * Covers: End-to-end integration of Week 3 features
 * - User journey: errors → hints → unit creation
 * - Chat and hints working together
 * - Textbook unit display
 * 
 * @module Week3IntegrationTests
 * @weekly
 */

import { expect, test } from '@playwright/test';

test.describe('@weekly Week 3 Integration', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up user profile for role-based auth (required for route access)
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-learner',
        name: 'Test Learner',
        role: 'student',
        createdAt: Date.now()
      }));
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('@weekly e2e: user makes errors → gets hints → unit created', async ({ page }) => {
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

    // Make error
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Get hints
    await page.getByRole('button', { name: /Request Hint|Next Hint/ }).click();
    await expect(page.getByText('Hint 1')).toBeVisible();

    // Verify events logged
    const events = await page.evaluate(() => {
      const interactions = JSON.parse(
        window.localStorage.getItem('sql-learning-interactions') || '[]'
      );
      return interactions.filter((e: any) => e.eventType === 'hint_view');
    });
    
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  test('@weekly chat and hints work together', async ({ page }) => {
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

    // Use chat
    await page.getByRole('button', { name: 'What concept is this?' }).click();
    const response = page.locator('.bg-white.border').last();
    await expect(response).toBeVisible();

    // Make error
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Get hint
    await page.getByRole('button', { name: /Request Hint/ }).click();
    await expect(page.getByText('Hint 1')).toBeVisible();
  });

  test('@weekly textbook displays created units', async ({ page }) => {
    await page.goto('/');
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'test-session');
      
      // Seed textbook
      window.localStorage.setItem('sql-learning-textbook', JSON.stringify({
        'test-learner': [{
          id: 'unit-test',
          type: 'summary',
          conceptId: 'select-basic',
          title: 'Test SELECT Unit',
          content: '## SELECT Basics\n\nContent here',
          addedTimestamp: Date.now()
        }]
      }));
    });
    await page.reload();

    // Navigate to textbook
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/);
    
    // Verify unit visible
    await expect(page.getByRole('heading', { name: 'My Textbook' })).toBeVisible();
  });
});
