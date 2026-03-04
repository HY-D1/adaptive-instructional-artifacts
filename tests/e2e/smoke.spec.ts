import { test, expect } from '@playwright/test';

/**
 * Smoke Test - Verify the test environment works
 */
test.describe('@weekly Smoke Tests', () => {
  
  test('page loads successfully', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Adaptive SQL|SQL-Adapt/i);
  });

  test('localStorage operations work', async ({ page }) => {
    await page.goto('/');
    
    // Set a value
    await page.evaluate(() => {
      localStorage.setItem('test-key', 'test-value');
    });
    
    // Read it back
    const value = await page.evaluate(() => {
      return localStorage.getItem('test-key');
    });
    
    expect(value).toBe('test-value');
  });
});
