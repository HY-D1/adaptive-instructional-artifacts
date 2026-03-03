import { test, expect, type Page } from '@playwright/test';

/**
 * Cross-Tab Synchronization Tests for Preview Mode
 * 
 * These tests verify that preview mode state is synchronized
 * across browser tabs using the StorageEvent API.
 * 
 * Test Scenarios:
 * 1. Enable preview mode in tab 1, verify tab 2 receives it
 * 2. Disable preview mode in tab 2, verify tab 1 updates
 * 3. Close and reopen tab, verify state persists
 * 4. Rapid toggles don't cause infinite loops
 */

test.describe('@weekly Cross-Tab Preview Mode Sync', () => {
  // Helper to set up instructor auth
  const setupInstructorAuth = async (page: Page) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
    });
  };

  // Helper to check preview mode state
  const getPreviewModeState = async (page: Page): Promise<boolean> => {
    return page.evaluate(() => {
      return localStorage.getItem('sql-adapt-preview-mode') === 'true';
    });
  };

  test.beforeEach(async ({ page }) => {
    // Clear any existing preview mode state
    await page.addInitScript(() => {
      localStorage.removeItem('sql-adapt-preview-mode');
      localStorage.removeItem('sql-adapt-debug-profile');
      localStorage.removeItem('sql-adapt-debug-strategy');
    });
  });

  test('enabling preview mode in settings syncs to learning interface tab', async ({ browser }) => {
    // Create two contexts to simulate different tabs
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const settingsPage = await context1.newPage();
    const learningPage = await context2.newPage();

    try {
      // Set up instructor auth in both contexts
      await setupInstructorAuth(settingsPage);
      await setupInstructorAuth(learningPage);

      // Open settings page in tab 1
      await settingsPage.goto('/settings');
      await settingsPage.waitForSelector('[data-testid="preview-mode-section"]');

      // Open learning interface in tab 2
      await learningPage.goto('/practice');
      await learningPage.waitForSelector('[data-testid="learning-interface"]');

      // Initially preview mode should be off in both tabs
      expect(await getPreviewModeState(settingsPage)).toBe(false);
      expect(await getPreviewModeState(learningPage)).toBe(false);

      // Enable preview mode in settings tab
      const toggle = settingsPage.locator('[data-testid="preview-mode-toggle"]');
      await toggle.click();

      // Wait a moment for StorageEvent to propagate
      await settingsPage.waitForTimeout(100);

      // Verify both tabs have preview mode enabled
      expect(await getPreviewModeState(settingsPage)).toBe(true);
      expect(await getPreviewModeState(learningPage)).toBe(true);

      // Verify learning interface shows preview mode UI
      const previewBanner = learningPage.locator('[data-testid="preview-mode-banner"]');
      await expect(previewBanner).toBeVisible();

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('disabling preview mode syncs across all tabs', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const settingsPage = await context1.newPage();
    const learningPage = await context2.newPage();

    try {
      // Set up instructor auth with preview mode already enabled
      await settingsPage.addInitScript(() => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-instructor',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      await learningPage.addInitScript(() => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-instructor',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      // Open both pages
      await settingsPage.goto('/settings');
      await learningPage.goto('/practice');

      // Verify preview mode is initially enabled
      expect(await getPreviewModeState(settingsPage)).toBe(true);
      expect(await getPreviewModeState(learningPage)).toBe(true);

      // Disable preview mode in settings tab
      const toggle = settingsPage.locator('[data-testid="preview-mode-toggle"]');
      await toggle.click();

      // Wait for sync
      await settingsPage.waitForTimeout(100);

      // Verify both tabs have preview mode disabled
      expect(await getPreviewModeState(settingsPage)).toBe(false);
      expect(await getPreviewModeState(learningPage)).toBe(false);

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('preview mode state persists after tab close and reopen', async ({ browser }) => {
    const context = await browser.newContext();
    
    try {
      // Set up instructor with preview mode enabled
      const page = await context.newPage();
      await page.addInitScript(() => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-instructor',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      // Open settings
      await page.goto('/settings');
      await page.waitForSelector('[data-testid="preview-mode-section"]');

      // Verify toggle is checked
      const toggle = page.locator('[data-testid="preview-mode-toggle"] input');
      await expect(toggle).toBeChecked();

      // Close and reopen page
      await page.close();
      const newPage = await context.newPage();
      
      // Open learning interface
      await newPage.goto('/practice');
      await newPage.waitForSelector('[data-testid="learning-interface"]');

      // Verify preview mode is still enabled
      expect(await getPreviewModeState(newPage)).toBe(true);

      // Verify preview banner is visible
      const previewBanner = newPage.locator('[data-testid="preview-mode-banner"]');
      await expect(previewBanner).toBeVisible();

    } finally {
      await context.close();
    }
  });

  test('rapid toggle changes do not cause infinite loops', async ({ page }) => {
    await setupInstructorAuth(page);
    await page.goto('/settings');
    await page.waitForSelector('[data-testid="preview-mode-section"]');

    const toggle = page.locator('[data-testid="preview-mode-toggle"]');
    
    // Rapidly toggle preview mode multiple times
    for (let i = 0; i < 5; i++) {
      await toggle.click();
      await page.waitForTimeout(50);
    }

    // Wait for any potential sync issues to manifest
    await page.waitForTimeout(500);

    // Verify page is still responsive
    await expect(toggle).toBeVisible();
    
    // Verify localStorage state is consistent
    const finalState = await getPreviewModeState(page);
    // State should be deterministic (odd number of clicks = enabled)
    expect(finalState).toBe(true);
  });

  test('sync only affects preview mode key, not other storage', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    try {
      // Set up instructor auth with additional data
      await page1.addInitScript(() => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-instructor',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
        localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
        localStorage.setItem('custom-data', 'should-not-change');
      });

      await page2.addInitScript(() => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-instructor',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
        localStorage.setItem('sql-adapt-debug-strategy', 'static');
        localStorage.setItem('custom-data', 'original-value');
      });

      // Open settings on both pages
      await page1.goto('/settings');
      await page2.goto('/settings');

      // Enable preview mode on page 1
      const toggle = page1.locator('[data-testid="preview-mode-toggle"]');
      await toggle.click();
      await page1.waitForTimeout(100);

      // Verify page 2 received preview mode change
      expect(await getPreviewModeState(page2)).toBe(true);

      // Verify other storage values were NOT synced
      const strategy1 = await page1.evaluate(() => 
        localStorage.getItem('sql-adapt-debug-strategy')
      );
      const strategy2 = await page2.evaluate(() => 
        localStorage.getItem('sql-adapt-debug-strategy')
      );
      const custom1 = await page1.evaluate(() => 
        localStorage.getItem('custom-data')
      );
      const custom2 = await page2.evaluate(() => 
        localStorage.getItem('custom-data')
      );

      // Strategies should remain different
      expect(strategy1).toBe('bandit');
      expect(strategy2).toBe('static');
      
      // Custom data should remain unchanged
      expect(custom1).toBe('should-not-change');
      expect(custom2).toBe('original-value');

    } finally {
      await context1.close();
      await context2.close();
    }
  });

  test('student tabs do not show preview mode controls', async ({ page }) => {
    // Set up student auth
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-student',
        name: 'Test Student',
        role: 'student',
        createdAt: Date.now()
      }));
    });

    await page.goto('/settings');

    // Verify preview mode section is not visible
    const previewSection = page.locator('[data-testid="preview-mode-section"]');
    await expect(previewSection).not.toBeVisible();
  });

  test('instructor dashboard start preview broadcasts to other tabs', async ({ browser }) => {
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    
    const dashboardPage = await context1.newPage();
    const learningPage = await context2.newPage();

    try {
      // Set up instructor auth in both
      await dashboardPage.addInitScript(() => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-instructor',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
      });

      await learningPage.addInitScript(() => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-instructor',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
      });

      // Open learning interface first
      await learningPage.goto('/practice');
      await learningPage.waitForSelector('[data-testid="learning-interface"]');

      // Initially no preview mode
      expect(await getPreviewModeState(learningPage)).toBe(false);

      // Open instructor dashboard and start preview
      await dashboardPage.goto('/instructor-dashboard');
      await dashboardPage.waitForSelector('[data-testid="student-preview-button"]');
      
      // Click preview button to open modal
      await dashboardPage.locator('[data-testid="student-preview-button"]').click();
      await dashboardPage.waitForSelector('[data-testid="preview-modal"]');

      // Start preview
      await dashboardPage.locator('[data-testid="start-preview-button"]').click();

      // Wait for sync (preview mode is set before navigation)
      await dashboardPage.waitForTimeout(200);

      // Verify learning interface tab received the sync
      expect(await getPreviewModeState(learningPage)).toBe(true);

    } finally {
      await context1.close();
      await context2.close();
    }
  });
});
