import { test, expect } from '@playwright/test';
import { waitForEditorReady } from '../../helpers/test-helpers';

test.describe('Keyboard Shortcuts @hardening', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'kb-shortcuts-e2e',
        name: 'Keyboard Shortcuts Tester',
        role: 'student',
        createdAt: Date.now()
      }));
    });
  });

  test('Ctrl+Enter runs query from editor', async ({ page }) => {
    await page.goto('/practice');
    await waitForEditorReady(page);
    // Focus Monaco editor and type a simple query
    await page.locator('.monaco-editor textarea').focus();
    await page.keyboard.type('SELECT 1;');
    await page.keyboard.press('Control+Enter');
    // Verify results appear (look for the Results heading or result table)
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 10000 });
  });

  test('Cmd+Enter runs query (Mac)', async ({ page }) => {
    await page.goto('/practice');
    await waitForEditorReady(page);
    await page.locator('.monaco-editor textarea').focus();
    await page.keyboard.type('SELECT 1;');
    await page.keyboard.press('Meta+Enter');
    await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 10000 });
  });
});
