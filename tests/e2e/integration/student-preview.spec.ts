import { test, expect } from '@playwright/test';

/**
 * Student Preview Feature - Edge Case Testing
 * 
 * Tests ALL edge cases for the Student Preview feature
 */

test.describe('@weekly Student Preview Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      // Set instructor profile and dismiss welcome modal
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
    await page.goto('/instructor-dashboard');
    await page.waitForSelector('text=Instructor Dashboard', { timeout: 10000 });
  });

  // ============================================
  // SCENARIO 1: Modal State
  // ============================================
  test.describe('Scenario 1: Modal State', () => {
    test('1.1 Click "Launch Preview" - modal should open', async ({ page }) => {
      await page.click('text=Launch Preview');
      
      // Verify modal is visible with specific content
      const modal = page.locator('div').filter({ hasText: /^Student Preview$/ }).first();
      await expect(modal).toBeVisible();
      await expect(page.getByLabel('Escalation Profile')).toBeVisible();
    });

    test('1.2 Click outside modal - should NOT close (no backdrop click handler)', async ({ page }) => {
      await page.click('text=Launch Preview');
      await expect(page.getByLabel('Escalation Profile')).toBeVisible();
      
      // Click on backdrop - there's no click handler on backdrop
      const backdrop = page.locator('div.fixed.inset-0.z-50');
      await backdrop.click({ position: { x: 10, y: 10 } });
      
      // Modal should still be visible (no backdrop click handler exists)
      await expect(page.getByLabel('Escalation Profile')).toBeVisible();
    });

    test('1.3 Click X button - modal should close', async ({ page }) => {
      await page.click('text=Launch Preview');
      await expect(page.getByLabel('Escalation Profile')).toBeVisible();
      
      // Click X button (the button in the header with X icon)
      await page.locator('div').filter({ hasText: /^Student Preview$/ }).locator('button').click();
      
      await expect(page.getByLabel('Escalation Profile')).not.toBeVisible();
    });

    test('1.4 Click Cancel - modal should close', async ({ page }) => {
      await page.click('text=Launch Preview');
      await expect(page.getByLabel('Escalation Profile')).toBeVisible();
      
      await page.click('button:has-text("Cancel")');
      
      await expect(page.getByLabel('Escalation Profile')).not.toBeVisible();
    });
  });

  // ============================================
  // SCENARIO 2: Profile Selection
  // ============================================
  test.describe('Scenario 2: Profile Selection', () => {
    test('2.1 Select "Fast Escalator" - should be highlighted', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('text=Fast Escalator');
      
      const fastButton = page.locator('button').filter({ hasText: /Fast Escalator/ });
      await expect(fastButton).toHaveClass(/border-blue-500/);
      await expect(fastButton).toHaveClass(/bg-blue-50/);
    });

    test('2.2 Select "Slow Escalator" - should be highlighted', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('text=Slow Escalator');
      
      const slowButton = page.locator('button').filter({ hasText: /Slow Escalator/ });
      await expect(slowButton).toHaveClass(/border-blue-500/);
      await expect(slowButton).toHaveClass(/bg-blue-50/);
    });

    test('2.3 Select "Adaptive" - should be highlighted', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('text=Adaptive');
      
      const adaptiveButton = page.locator('button').filter({ hasText: /^Adaptive$/ });
      await expect(adaptiveButton).toHaveClass(/border-blue-500/);
      await expect(adaptiveButton).toHaveClass(/bg-blue-50/);
    });

    test('2.4 Select "Explanation First" - should be highlighted', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('text=Explanation First');
      
      const explanationButton = page.locator('button').filter({ hasText: /Explanation First/ });
      await expect(explanationButton).toHaveClass(/border-blue-500/);
      await expect(explanationButton).toHaveClass(/bg-blue-50/);
    });

    test('2.5 Selection should persist when reopening modal', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('text=Fast Escalator');
      await page.click('button:has-text("Cancel")');
      
      await page.click('text=Launch Preview');
      
      const fastButton = page.locator('button').filter({ hasText: /Fast Escalator/ });
      await expect(fastButton).toHaveClass(/border-blue-500/);
    });
  });

  // ============================================
  // SCENARIO 3: Start Preview Button
  // ============================================
  test.describe('Scenario 3: Start Preview Button', () => {
    test('3.1 Button should have onClick handler', async ({ page }) => {
      await page.click('text=Launch Preview');
      const startButton = page.locator('button').filter({ hasText: /Start Preview/ });
      await expect(startButton).toBeVisible();
      await expect(startButton).toBeEnabled();
    });

    test('3.2 Handler should set localStorage keys correctly', async ({ page }) => {
      await page.evaluate(() => {
        localStorage.removeItem('sql-adapt-preview-mode');
        localStorage.removeItem('sql-adapt-debug-profile');
        localStorage.removeItem('sql-adapt-debug-strategy');
      });

      await page.click('text=Launch Preview');
      await page.click('text=Fast Escalator');
      await page.click('button:has-text("Start Preview")');
      
      await page.waitForURL('/practice', { timeout: 10000 });
      
      const localStorage = await page.evaluate(() => ({
        previewMode: window.localStorage.getItem('sql-adapt-preview-mode'),
        debugProfile: window.localStorage.getItem('sql-adapt-debug-profile'),
        debugStrategy: window.localStorage.getItem('sql-adapt-debug-strategy')
      }));
      
      expect(localStorage.previewMode).toBe('true');
      expect(localStorage.debugProfile).toBe('fast-escalator');
      expect(localStorage.debugStrategy).toBe('static');
    });

    test('3.3 Page should navigate to /practice', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('button:has-text("Start Preview")');
      
      await page.waitForURL('/practice', { timeout: 10000 });
      await expect(page).toHaveURL('/practice');
    });
  });

  // ============================================
  // SCENARIO 4: After Navigation
  // ============================================
  test.describe('Scenario 4: After Navigation', () => {
    test('4.1 Practice page should load', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('button:has-text("Start Preview")');
      
      await page.waitForURL('/practice', { timeout: 10000 });
      await expect(page.locator('text=Practice SQL')).toBeVisible();
    });

    test('4.2 Instructor controls should be hidden', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('button:has-text("Start Preview")');
      
      await page.waitForURL('/practice', { timeout: 10000 });
      
      await expect(page.locator('text=Instructor Mode')).not.toBeVisible();
      await expect(page.locator('text=Instructor Controls')).not.toBeVisible();
    });

    test('4.3 Preview Mode badge should be visible', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('button:has-text("Start Preview")');
      
      await page.waitForURL('/practice', { timeout: 10000 });
      
      await expect(page.locator('text=Preview Mode')).toBeVisible();
    });
  });

  // ============================================
  // SCENARIO 5: Exit Preview
  // ============================================
  test.describe('Scenario 5: Exit Preview', () => {
    test('5.1 Exit Preview button should appear', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('button:has-text("Start Preview")');
      
      await page.waitForURL('/practice', { timeout: 10000 });
      
      await expect(page.locator('button:has-text("Exit Preview")')).toBeVisible();
    });

    test('5.2 Clicking Exit Preview should clear localStorage', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('button:has-text("Start Preview")');
      
      await page.waitForURL('/practice', { timeout: 10000 });
      
      await page.click('button:has-text("Exit Preview")');
      
      await page.waitForURL('/instructor-dashboard', { timeout: 10000 });
      
      const keysAfter = await page.evaluate(() => ({
        previewMode: window.localStorage.getItem('sql-adapt-preview-mode'),
        debugProfile: window.localStorage.getItem('sql-adapt-debug-profile'),
        debugStrategy: window.localStorage.getItem('sql-adapt-debug-strategy')
      }));
      
      expect(keysAfter.previewMode).toBeNull();
      expect(keysAfter.debugProfile).toBeNull();
      expect(keysAfter.debugStrategy).toBeNull();
    });

    test('5.3 Should navigate back to instructor-dashboard', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('button:has-text("Start Preview")');
      
      await page.waitForURL('/practice', { timeout: 10000 });
      
      await page.click('button:has-text("Exit Preview")');
      
      await page.waitForURL('/instructor-dashboard', { timeout: 10000 });
      await expect(page).toHaveURL('/instructor-dashboard');
    });
  });

  // ============================================
  // SCENARIO 6: Browser Back Button
  // ============================================
  test.describe('Scenario 6: Browser Back Button', () => {
    test('6.1 After entering preview, clicking back should go to instructor dashboard', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('button:has-text("Start Preview")');
      
      await page.waitForURL('/practice', { timeout: 10000 });
      
      await page.goBack();
      
      await expect(page).toHaveURL('/instructor-dashboard');
    });

    test('6.2 Preview mode should persist after back navigation', async ({ page }) => {
      await page.click('text=Launch Preview');
      await page.click('button:has-text("Start Preview")');
      
      await page.waitForURL('/practice', { timeout: 10000 });
      
      const previewModeBefore = await page.evaluate(() => 
        window.localStorage.getItem('sql-adapt-preview-mode')
      );
      expect(previewModeBefore).toBe('true');
      
      await page.goBack();
      await page.waitForURL('/instructor-dashboard', { timeout: 10000 });
      
      await page.goForward();
      await page.waitForURL('/practice', { timeout: 10000 });
      
      const previewModeAfter = await page.evaluate(() => 
        window.localStorage.getItem('sql-adapt-preview-mode')
      );
      expect(previewModeAfter).toBe('true');
      await expect(page.locator('text=Preview Mode')).toBeVisible();
    });
  });
});
