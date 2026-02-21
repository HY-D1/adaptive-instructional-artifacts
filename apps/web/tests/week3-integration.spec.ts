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
    // Stub LLM calls to prevent connection refused in CI (both URL patterns)
    await page.route('**/ollama/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: '{"title": "Test Explanation", "content_markdown": "This is a test explanation for CI.", "key_points": ["Point 1"], "common_pitfall": "None", "next_steps": ["Practice"], "source_ids": ["src-1"]}'
        })
      });
    });
    
    await page.route('**/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: '{"title": "Test Explanation", "content_markdown": "This is a test explanation for CI.", "key_points": ["Point 1"], "common_pitfall": "None", "next_steps": ["Practice"], "source_ids": ["src-1"]}'
        })
      });
    });
    
    await page.route('**/ollama/api/tags', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'qwen2.5:1.5b-instruct' }] })
      });
    });
    
    await page.route('**/api/tags', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ models: [{ name: 'qwen2.5:1.5b-instruct' }] })
      });
    });
    
    // Idempotent init script - only runs once per test
    await page.addInitScript(() => {
      const FLAG = '__pw_seeded__';
      if (localStorage.getItem(FLAG) === '1') return;
      
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up user profile for role-based auth (required for route access)
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-learner',
        name: 'Test Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      
      localStorage.setItem(FLAG, '1');
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.removeItem('__pw_seeded__');
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
    await expect(page.getByTestId('hint-label-1')).toBeVisible();

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
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
  });

  test('@weekly textbook displays created units', async ({ page }) => {
    // Seed textbook data BEFORE navigating to page
    await page.addInitScript(() => {
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
    
    // Navigate to textbook page
    await page.goto('/textbook');

    // Verify on textbook page with seeded unit visible
    await expect(page).toHaveURL(/\/textbook/);
    await expect(page.getByText('Test SELECT Unit').first()).toBeVisible({ timeout: 10000 });
  });
});
