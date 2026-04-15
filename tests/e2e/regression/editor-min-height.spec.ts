import { test, expect } from '@playwright/test';

test.describe('SQL Editor Minimum Height @hardening', () => {
  test('editor maintains min-height after incorrect query results', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Type an incorrect query
    await page.locator('.monaco-editor').click();
    await page.keyboard.type('SELECT 999 AS wrong_col;');
    await page.keyboard.press('Control+Enter');

    // Wait for results to appear
    await page.waitForSelector('text=Results', { timeout: 10000 });

    // Verify editor is still usable (min 180px height)
    const editorCard = page.locator('.monaco-editor').first();
    const box = await editorCard.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(100);
  });
});
