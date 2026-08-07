import { expect, test, type Page } from '@playwright/test';

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((next) => {
    document.documentElement.classList.toggle('dark', next === 'dark');
  }, theme);
}

async function setupStudentProfile(page: Page, name: string) {
  await page.addInitScript((userName) => {
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: `student-${userName.toLowerCase().replace(/\s+/g, '-')}`,
      name: userName,
      role: 'student',
      createdAt: Date.now(),
    }));
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
  }, name);
}

async function goToPractice(page: Page) {
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });
}

test.describe('@no-external Login + Practice Minimal Terminal polish', () => {
  test('practice problem header uses the atlas label style inside a bordered panel', async ({ page }) => {
    await setupStudentProfile(page, 'MinimalTerminalTester');
    await goToPractice(page);

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      const label = page.locator('.atlas-label', { hasText: /Problem \d+ of \d+/ });
      await expect(label).toBeVisible();
      const panel = page.locator('.atlas-panel-border').first();
      await expect(panel).toBeVisible();
    }
  });
});
