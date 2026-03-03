import { test, expect } from '@playwright/test';

test.describe('SettingsPage Screenshots', () => {
  test('instructor settings with debug panel', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Take screenshot of full page
    await page.screenshot({ 
      path: 'test-results/settings-instructor-full.png',
      fullPage: true 
    });
    
    // Take screenshot of debug panel only
    const debugPanel = page.locator('[data-testid="week5-debug-controls"]');
    await debugPanel.screenshot({ 
      path: 'test-results/settings-debug-panel.png' 
    });
  });

  test('student settings without debug panel', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-student',
        name: 'Test Student',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
    
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    await page.screenshot({ 
      path: 'test-results/settings-student-full.png',
      fullPage: true 
    });
  });
});
