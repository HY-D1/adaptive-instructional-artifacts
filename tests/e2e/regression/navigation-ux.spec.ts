import { test, expect } from '@playwright/test';

test.describe('Navigation UX @hardening', () => {
  test('next problem button visible after correct answer', async ({ page }) => {
    await page.goto('/');
    // Execute correct query
    await page.locator('.monaco-editor').click();
    await page.keyboard.type('SELECT 1 as test;');
    await page.keyboard.press('Control+Enter');
    // Verify "Next Problem" link appears
    await expect(page.getByText('Next Problem')).toBeVisible();
  });

  test('prev/next buttons have text labels', async ({ page }) => {
    await page.goto('/');
    // Check that buttons contain text
    await expect(page.getByRole('button', { name: /previous/i })).toContainText('Prev');
    await expect(page.getByRole('button', { name: /next/i })).toContainText('Next');
  });
});
