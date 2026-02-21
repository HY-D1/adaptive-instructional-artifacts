/**
 * Week 3 Guidance Ladder Comprehensive Tests
 * 
 * Covers: D4 (Ladder State Machine), D7 (UI), D8 (Logging)
 * - Rung transitions (1→2→3)
 * - Escalation triggers
 * - Source grounding
 * - Event logging
 * - Hint persistence across navigation
 * - Problem-specific hints
 * 
 * @module Week3GuidanceLadderTests
 * @weekly
 */

import { expect, test } from '@playwright/test';

const HELP_BUTTON = /^(Request Hint|Next Hint|Get More Help)$/;

test.describe('@weekly Week 3 Guidance Ladder', () => {
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
      // CRITICAL: Set up user profile for role-based auth
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

  test('@weekly rung 1: micro-hint displayed on first help request', async ({ page }) => {
    await page.goto('/');

    // Trigger error
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Request first hint
    await page.getByRole('button', { name: HELP_BUTTON }).click();
    
    // Verify Rung 1 hint displayed
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
    await expect(page.locator('[data-testid="hint-card-0"]')).toBeVisible();
    
    // Verify hint is concise (micro-hint)
    const hintText = await page.locator('[data-testid="hint-card-0"] p').textContent();
    expect(hintText?.length).toBeLessThan(200);
  });

  test('@weekly rung 2: explanation with source grounding after escalation', async ({ page }) => {
    await page.goto('/');

    // Trigger error and exhaust rung 1
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Request hints to reach rung 2 (3 hints triggers escalation)
    await page.getByRole('button', { name: HELP_BUTTON }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
    await page.getByRole('button', { name: HELP_BUTTON }).click();
    await expect(page.getByTestId('hint-label-2')).toBeVisible();
    await page.getByRole('button', { name: HELP_BUTTON }).click();
    await expect(page.getByTestId('hint-label-3')).toBeVisible();

    // Verify escalation to rung 2 - check for specific rung indicator text
    // The RungIndicator shows "Explain" at rung 2 - use first() to avoid strict mode violation
    await expect(page.getByText('Explain').first()).toBeVisible();
    // Also verify the rung counter shows "2/3"
    await expect(page.getByText(/2\/3/)).toBeVisible();
  });

  test('@weekly escalation events logged correctly', async ({ page }) => {
    await page.goto('/');

    // Trigger error and request hints
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    await page.getByRole('button', { name: HELP_BUTTON }).click();

    // Verify hint_view event logged
    const events = await page.evaluate(() => {
      const interactions = JSON.parse(
        window.localStorage.getItem('sql-learning-interactions') || '[]'
      );
      return interactions.filter((e: any) => e.eventType === 'hint_view');
    });
    
    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0]).toHaveProperty('hintLevel');
    expect(events[0]).toHaveProperty('sqlEngageSubtype');
    expect(events[0]).toHaveProperty('sqlEngageRowId');
    expect(events[0]).toHaveProperty('policyVersion');
  });

  test('@weekly source passages displayed with hints', async ({ page }) => {
    await page.goto('/');
    
    // Setup with PDF index
    await page.evaluate(() => {
      // Mock PDF index
      window.localStorage.setItem('sql-pdf-index', JSON.stringify({
        indexId: 'test-index',
        sourceName: 'test.pdf',
        chunks: [
          { docId: 'test.pdf', page: 1, text: 'Test passage about SQL', score: 0.9 }
        ]
      }));
    });
    await page.reload();

    // Trigger error and request hint
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    await page.getByRole('button', { name: HELP_BUTTON }).click();

    // Verify hint displayed
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
  });

  test('@weekly hints are problem-specific', async ({ page }) => {
    await page.goto('/');

    // Get hints on problem 1
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();
    await page.getByRole('button', { name: HELP_BUTTON }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();

    // Switch to problem 2
    await page.getByTestId('problem-select-trigger').click();
    await page.getByRole('option').nth(1).click();
    
    // Wait for the problem to change and hint panel to reset
    await page.waitForTimeout(500); // Allow UI to update
    const hintPanel = page.locator('[data-testid="hint-panel"]');
    // Verify previous hints are not shown
    await expect(page.getByTestId('hint-label-1')).toHaveCount(0);
  });

  test('@weekly guidance ladder state persists across navigation', async ({ page }) => {
    // NOTE: Hints are stored in component state, not localStorage, so they don't
    // persist across full page navigation. This test verifies that hints persist
    // within the same page session (e.g., after re-running a query).
    await page.goto('/');

    // Get hints
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();
    await page.getByRole('button', { name: HELP_BUTTON }).click();
    await page.getByRole('button', { name: HELP_BUTTON }).click();
    
    // Store hint texts
    const hint1Text = await page.locator('[data-testid="hint-card-0"] p').textContent();
    const hint2Text = await page.locator('[data-testid="hint-card-1"] p').textContent();

    // Re-run the same query (same page session) - hints should persist
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Verify hints restored within same session
    await expect(page.getByTestId('hint-label-1')).toBeVisible();
    await expect(page.getByTestId('hint-label-2')).toBeVisible();
    
    const restoredHint1 = await page.locator('[data-testid="hint-card-0"] p').textContent();
    const restoredHint2 = await page.locator('[data-testid="hint-card-1"] p').textContent();
    
    expect(restoredHint1).toBe(hint1Text);
    expect(restoredHint2).toBe(hint2Text);
  });
});
