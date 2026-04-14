import { test, expect } from '@playwright/test';
import { waitForEditorReady } from '../../helpers/test-helpers';

test('debug next problem', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'nav-ux-e2e', name: 'Navigation UX Tester', role: 'student', createdAt: Date.now()
    }));
  });
  await page.goto('/practice');
  await waitForEditorReady(page);
  await page.locator('.monaco-editor textarea').focus();
  await page.keyboard.type('SELECT * FROM users;');
  await page.keyboard.press('Control+Enter');
  
  // Wait for results
  await expect(page.getByRole('heading', { name: 'Results' })).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(2000);
  
  const allText = await page.locator('body').innerText();
  console.log('Body text preview:', allText.substring(0, 800));
  
  // Check if "Solved" badge is present
  const solvedBadge = page.locator('text=Solved').first();
  console.log('Solved badge visible:', await solvedBadge.isVisible().catch(() => false));
  
  // Check innerHTML around problem title
  const problemArea = await page.locator('h2').first().evaluate(el => el.parentElement?.innerHTML);
  console.log('Problem area HTML:', problemArea?.substring(0, 500));
});
