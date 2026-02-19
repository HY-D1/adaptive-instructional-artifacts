import { expect, test } from '@playwright/test';

const PRIMARY_HELP_BUTTON_NAME = /^(Request Hint|Next Hint|Get More Help)$/;

test.describe('@weekly Hint Persistence Across Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
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
    });
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('hints persist when navigating to textbook and back', async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    
    // Set up profile and session
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'session-persistence-test');
    });

    await page.reload({ timeout: 30000 });

    // Trigger an error and request hints
    await page.locator('.monaco-editor .view-lines').first().click({ position: { x: 8, y: 8 } });
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });

    // Request 2 hints
    const requestHintButton = page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME });
    await requestHintButton.click();
    await expect(page.getByText('Hint 1')).toBeVisible({ timeout: 5000 });
    await requestHintButton.click();

    // Verify both hints are visible
    await expect(page.getByText('Hint 1')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Hint 2')).toBeVisible({ timeout: 5000 });

    // Store hint texts for comparison (using data-testid for stability)
    const hint1Text = await page.locator('[data-testid="hint-card-0"] p').textContent();
    const hint2Text = await page.locator('[data-testid="hint-card-1"] p').textContent();

    // Navigate to My Textbook
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10000 });

    // Navigate back to Practice
    await page.getByRole('link', { name: 'Practice' }).first().click();
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

    // Verify hints are restored (not showing "Need help? Request a hint...")
    const needHelpText = page.getByText('Request a hint to get started');
    await expect(needHelpText).not.toBeVisible();

    // Verify both hints are still visible
    await expect(page.getByText('Hint 1')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Hint 2')).toBeVisible({ timeout: 5000 });

    // Verify hint content is preserved (using data-testid for stability)
    const restoredHint1 = await page.locator('[data-testid="hint-card-0"] p').textContent();
    const restoredHint2 = await page.locator('[data-testid="hint-card-1"] p').textContent();
    
    expect(restoredHint1).toBe(hint1Text);
    expect(restoredHint2).toBe(hint2Text);
  });

  test('explanation state persists when navigating to textbook and back', async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'session-explanation-test');
    });

    await page.reload({ timeout: 30000 });

    // Trigger error and request hints until escalation
    await page.locator('.monaco-editor .view-lines').first().click({ position: { x: 8, y: 8 } });
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });

    // Request 3 hints (should trigger auto-escalation)
    const requestHintButton = page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME });
    for (let i = 0; i < 3; i++) {
      await requestHintButton.click();
      await expect(page.getByText(`Hint ${i + 1}`)).toBeVisible({ timeout: 5000 });
    }

    // Verify explanation was generated
    await expect(page.getByText('Explanation has been generated')).toBeVisible({ timeout: 5000 });

    // Navigate to My Textbook and back
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10000 });
    await page.getByRole('link', { name: 'Practice' }).first().click();
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

    // Verify explanation state is preserved
    await expect(page.getByText('Explanation has been generated')).toBeVisible({ timeout: 5000 });
  });

  test('hint flow remains usable after page reload', async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'session-reload-test');
    });

    await page.reload({ timeout: 30000 });

    // Get hints
    await page.locator('.monaco-editor .view-lines').first().click({ position: { x: 8, y: 8 } });
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });

    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByText(/^Hint 1$/)).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByText(/^Hint 2$/)).toBeVisible({ timeout: 5000 });

    // Reload page
    await page.reload({ timeout: 30000 });

    // Current UI only persists hint history within live navigation, not hard reload.
    await expect(page.getByText('Request a hint to get started')).toBeVisible({ timeout: 5000 });

    // Verify hint flow still works after reload.
    await page.locator('.monaco-editor .view-lines').first().click({ position: { x: 8, y: 8 } });
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByText(/^Hint 1$/)).toBeVisible({ timeout: 5000 });
  });

  test('hints are problem-specific and do not leak between problems', async ({ page }) => {
    await page.goto('/', { timeout: 30000 });
    
    await page.evaluate(() => {
      const profiles = [{
        id: 'test-learner',
        name: 'Test Learner',
        createdAt: Date.now()
      }];
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify(profiles));
      window.localStorage.setItem('sql-learning-active-session', 'session-specific-test');
    });

    await page.reload({ timeout: 30000 });

    // Get hints on first problem
    await page.locator('.monaco-editor .view-lines').first().click({ position: { x: 8, y: 8 } });
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible({ timeout: 5000 });
    await page.getByRole('button', { name: PRIMARY_HELP_BUTTON_NAME }).click();
    await expect(page.getByText(/^Hint 1$/)).toBeVisible({ timeout: 5000 });

    // Switch to second problem
    const problemSelector = page.getByRole('combobox').filter({ hasText: /solved/ }).first();
    await problemSelector.click();
    await page.getByRole('option', { name: /Filter Users by Age/ }).click();

    // Verify hints are reset for new problem
    await expect(page.getByText('Request a hint to get started')).toBeVisible({ timeout: 5000 });
    await expect(page.getByText(/^Hint 1$/)).not.toBeVisible();

    // Switch back to first problem
    await problemSelector.click();
    await page.getByRole('option', { name: /Select All Users/ }).click();

    // Verify hints are restored for first problem
    await expect(page.getByText(/^Hint 1$/)).toBeVisible({ timeout: 5000 });
  });
});
