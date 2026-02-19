import { test, expect } from '@playwright/test';

test('@weekly localStorage corruption does not crash app', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // Set up student profile to bypass role selection
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
    window.localStorage.setItem('sql-learning-interactions', '{broken-json');
    window.localStorage.setItem('sql-learning-profiles', '{broken-json');
    window.localStorage.setItem('sql-learning-textbook', '{broken-json');
  });

  await page.goto('/practice');
  // After profile seeding, should be on practice page
  await expect(page).toHaveURL(/\/practice$/, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 15000 });
});
