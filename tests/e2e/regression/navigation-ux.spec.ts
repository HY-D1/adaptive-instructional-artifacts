import { test, expect } from '@playwright/test';
import { waitForEditorReady } from '../../helpers/test-helpers';

test.describe('Navigation UX @hardening', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'nav-ux-e2e',
        name: 'Navigation UX Tester',
        role: 'student',
        createdAt: Date.now()
      }));
    });
  });

  test('next problem button visible after correct answer', async ({ page }) => {
    await page.goto('/practice');
    await waitForEditorReady(page);
    // Execute the correct query for problem 1 ("Select All Users")
    await page.locator('.monaco-editor textarea').focus();
    await page.keyboard.type('SELECT * FROM users;');
    await page.keyboard.press('Control+Enter');
    // Wait for results to appear, then verify the next-problem navigation button is enabled
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: /next problem/i })).toBeEnabled({ timeout: 15000 });
  });

  test('prev/next buttons have text labels', async ({ page }) => {
    await page.goto('/practice');
    // Check that buttons contain text
    await expect(page.getByRole('button', { name: /previous/i })).toContainText('Prev');
    await expect(page.getByRole('button', { name: /next/i })).toContainText('Next');
  });
});
