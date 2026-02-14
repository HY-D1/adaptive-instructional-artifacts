import { test, expect } from '@playwright/test';

test('@week2 localStorage corruption does not crash app', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-learning-interactions', '{broken-json');
    window.localStorage.setItem('sql-learning-profiles', '{broken-json');
    window.localStorage.setItem('sql-learning-textbook', '{broken-json');
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();
});
