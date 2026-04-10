import { test, expect } from '@playwright/test';

test.describe('Keyboard Shortcuts @hardening', () => {
  test('Ctrl+Enter runs query from editor', async ({ page }) => {
    await page.goto('/');
    // Navigate to a problem and click into Monaco editor
    await page.locator('.monaco-editor').click();
    await page.keyboard.type('SELECT 1;');
    await page.keyboard.press('Control+Enter');
    // Verify results panel appears
    await expect(page.locator('[data-testid="query-results"]')).toBeVisible({ timeout: 10000 });
  });

  test('Cmd+Enter runs query (Mac)', async ({ page }) => {
    await page.goto('/');
    await page.locator('.monaco-editor').click();
    await page.keyboard.type('SELECT 1;');
    await page.keyboard.press('Meta+Enter');
    await expect(page.locator('[data-testid="query-results"]')).toBeVisible({ timeout: 10000 });
  });
});
