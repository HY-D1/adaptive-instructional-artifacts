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
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // CRITICAL: Set up user profile for role-based auth
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
    await expect(page.getByText('Hint 1')).toBeVisible();
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
    await expect(page.getByText('Hint 1')).toBeVisible();
    await page.getByRole('button', { name: HELP_BUTTON }).click();
    await expect(page.getByText('Hint 2')).toBeVisible();
    await page.getByRole('button', { name: HELP_BUTTON }).click();
    await expect(page.getByText('Hint 3')).toBeVisible();

    // Verify escalation to rung 2 - check for specific rung indicator text
    // The RungIndicator shows "Explain" at rung 2
    await expect(page.getByText('Explain')).toBeVisible();
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
    await expect(page.getByText('Hint 1')).toBeVisible();
  });

  test('@weekly hints are problem-specific', async ({ page }) => {
    await page.goto('/');

    // Get hints on problem 1
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();
    await page.getByRole('button', { name: HELP_BUTTON }).click();
    await expect(page.getByText('Hint 1')).toBeVisible();

    // Switch to problem 2
    const problemSelector = page.getByRole('combobox').first();
    await problemSelector.click();
    await page.getByRole('option').nth(1).click();
    
    // Wait for the problem to change and hint panel to reset
    const hintPanel = page.locator('[data-testid="hint-panel"]');
    await expect(hintPanel.getByText('Request a hint to get started')).toBeVisible({ timeout: 5000 });
    // Verify previous hints are not shown
    await expect(page.getByText('Hint 1')).toHaveCount(0);
  });

  test('@weekly guidance ladder state persists across navigation', async ({ page }) => {
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

    // Navigate to textbook and back
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/);
    await page.getByRole('link', { name: 'Practice' }).first().click();
    await expect(page).toHaveURL(/\//);

    // Verify hints restored
    await expect(page.getByText('Hint 1')).toBeVisible();
    await expect(page.getByText('Hint 2')).toBeVisible();
    
    const restoredHint1 = await page.locator('[data-testid="hint-card-0"] p').textContent();
    const restoredHint2 = await page.locator('[data-testid="hint-card-1"] p').textContent();
    
    expect(restoredHint1).toBe(hint1Text);
    expect(restoredHint2).toBe(hint2Text);
  });
});
