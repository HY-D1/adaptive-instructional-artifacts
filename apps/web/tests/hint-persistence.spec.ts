import { expect, test } from '@playwright/test';

const PRIMARY_HELP_BUTTON_NAME = /^(Request Hint|Next Hint|Get More Help)$/;

test.describe('@weekly Hint Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Stub LLM calls to prevent ECONNREFUSED errors
    await page.route('**/ollama/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: '{"title": "Test", "content_markdown": "Test content", "key_points": [], "common_pitfall": "", "next_steps": [], "source_ids": []}'
        })
      });
    });
    await page.route('**/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: '{"title": "Test", "content_markdown": "Test content", "key_points": [], "common_pitfall": "", "next_steps": [], "source_ids": []}'
        })
      });
    });

    await page.addInitScript(() => {
      // Only run once per test - prevents clearing on navigation
      if (window.localStorage.getItem('__pw_seeded__')) return;

      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      
      // Set up user profile to bypass StartPage role selection
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      // Set up learner profile for LearningInterface
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        currentStrategy: 'adaptive-medium',
        createdAt: Date.now(),
        interactionCount: 0,
        conceptsCovered: [],
        conceptCoverageEvidence: []
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'session-persistence-test');
      
      // Mark as seeded so we don't clear again on navigation
      window.localStorage.setItem('__pw_seeded__', 'true');
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.removeItem('__pw_seeded__');
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('hints are problem-specific and do not leak between problems', async ({ page }) => {
    await page.goto('/practice', { timeout: 30000 });

    // Wait for SQL engine to initialize
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 10000 });

    // Get hints on first problem
    await page.locator('.monaco-editor .view-lines').first().click({ position: { x: 8, y: 8 } });
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 5000 });

    // Switch to second problem using the problem selector
    await page.getByTestId('problem-select-trigger').click();
    
    // Select a different problem (second option in the dropdown)
    await page.locator('[role="option"]').nth(1).click();

    // Wait for the problem to switch
    await page.waitForTimeout(500);

    // Verify hints are reset for new problem (should see empty state)
    await expect(page.getByTestId('hint-empty-state')).toBeVisible({ timeout: 5000 });

    // Verify hint flow works on new problem
    await page.locator('.monaco-editor .view-lines').first().click({ position: { x: 8, y: 8 } });
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 5000 });
  });

  test('hint system initializes correctly with seeded profile', async ({ page }) => {
    await page.goto('/practice', { timeout: 30000 });

    // Wait for SQL engine to initialize
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 10000 });
    await expect(page.locator('.monaco-editor .view-lines')).toBeVisible({ timeout: 10000 });

    // Verify hint system is in empty state initially
    await expect(page.getByTestId('hint-empty-state')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Request Hint' })).toBeVisible();

    // Trigger an error and request a hint
    await page.locator('.monaco-editor .view-lines').first().click({ position: { x: 8, y: 8 } });
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });

    // Request first hint
    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 5000 });

    // Request second hint
    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByTestId('hint-label-2')).toBeVisible({ timeout: 5000 });

    // Request third hint (L3 - max level)
    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByTestId('hint-label-3')).toBeVisible({ timeout: 5000 });

    // Request fourth help (triggers escalation to explanation after L3)
    await page.getByRole('button', { name: 'Get More Help' }).click();

    // Verify explanation was generated (auto-escalation after L3 hint)
    await expect(page.getByText('Full Explanation Unlocked')).toBeVisible({ timeout: 5000 });
  });

  test('@flaky hints remain visible within same problem session', async ({ page }) => {
    await page.goto('/practice', { timeout: 30000 });

    // Wait for SQL engine to initialize
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 10000 });

    // Trigger an error and get hints
    await page.locator('.monaco-editor .view-lines').first().click({ position: { x: 8, y: 8 } });
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });

    // Request 2 hints
    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByTestId('hint-label-2')).toBeVisible({ timeout: 5000 });

    // Store hint texts
    const hint1Text = await page.locator('[data-testid="hint-card-0"] p').textContent();
    const hint2Text = await page.locator('[data-testid="hint-card-1"] p').textContent();

    // Run another query (same error) - hints should persist
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });

    // Verify hints are still visible
    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('hint-label-2')).toBeVisible({ timeout: 5000 });

    // Verify hint content is preserved
    const currentHint1 = await page.locator('[data-testid="hint-card-0"] p').textContent();
    const currentHint2 = await page.locator('[data-testid="hint-card-1"] p').textContent();
    
    expect(currentHint1).toBe(hint1Text);
    expect(currentHint2).toBe(hint2Text);
  });
});
