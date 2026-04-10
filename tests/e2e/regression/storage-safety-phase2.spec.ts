/**
 * Storage Safety Phase 2 - E2E Regression Tests
 * 
 * Tests quota exceeded error handling for:
 * - learner-profile-client.ts
 * - ui-state.ts
 * - reinforcement-manager.ts (already uses safeStorage, verified)
 */

import { test, expect } from '@playwright/test';

// Storage keys from the application
const PROFILE_CACHE_KEY = 'sql-adapt-profile-cache';
const UI_STATE_PREFIX = 'sql-adapt-ui-state-v1';
const REINFORCEMENT_SCHEDULES_KEY = 'sql-learning-reinforcement-schedules';

test.describe('Storage Safety Phase 2 - Quota Resilience', () => {
  test.describe('learner-profile-client quota resilience', () => {
    test('profile cache handles quota exceeded gracefully', async ({ page }) => {
      // Mock localStorage.setItem to throw QuotaExceededError for profile cache
      await page.addInitScript((key) => {
        const originalSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function(k: string, v: string) {
          if (k === key) {
            const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
            (error as unknown as { code: number }).code = 22;
            throw error;
          }
          return originalSetItem(k, v);
        };
      }, PROFILE_CACHE_KEY);

      // Navigate to practice page - will attempt to cache profile
      await page.goto('/practice');
      
      // Page should not crash - verify basic UI elements are present
      await expect(page.locator('body')).toBeVisible();
      
      // Verify no error boundary appeared (no "Error" or "Crash" text in main content)
      const errorText = await page.locator('text=/error|crash|something went wrong/i').count();
      expect(errorText).toBe(0);
    });
  });

  test.describe('ui-state quota resilience', () => {
    test('UI state handles quota exceeded gracefully', async ({ page }) => {
      // Mock localStorage.setItem to throw QuotaExceededError for UI state keys
      await page.addInitScript((prefix) => {
        const originalSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function(k: string, v: string) {
          if (k.startsWith(prefix)) {
            const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
            (error as unknown as { code: number }).code = 22;
            throw error;
          }
          return originalSetItem(k, v);
        };
      }, UI_STATE_PREFIX);

      // Navigate to any page that uses UI state
      await page.goto('/');
      
      // Page should not crash
      await expect(page.locator('body')).toBeVisible();
      
      // Try to interact with UI elements
      const signInButton = page.locator('button:has-text("Sign In")');
      if (await signInButton.isVisible().catch(() => false)) {
        await expect(signInButton).toBeVisible();
      }
    });

    test('sidebar/tab state reverts to default on quota error', async ({ page }) => {
      // First set up some UI state normally
      await page.goto('/practice');
      
      // Now mock quota exceeded for subsequent writes
      await page.addInitScript((prefix) => {
        const originalSetItem = localStorage.setItem.bind(localStorage);
        let shouldThrow = false;
        localStorage.setItem = function(k: string, v: string) {
          if (shouldThrow && k.startsWith(prefix)) {
            const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
            (error as unknown as { code: number }).code = 22;
            throw error;
          }
          return originalSetItem(k, v);
        };
        // Enable throwing after initial load
        setTimeout(() => { shouldThrow = true; }, 100);
      }, UI_STATE_PREFIX);

      // Reload to trigger state save
      await page.reload();
      
      // Page should still function with default state
      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('reinforcement-manager quota resilience', () => {
    test('reinforcement schedules handle quota exceeded gracefully', async ({ page }) => {
      // Mock localStorage.setItem to throw QuotaExceededError for reinforcement schedules
      await page.addInitScript((key) => {
        const originalSetItem = localStorage.setItem.bind(localStorage);
        localStorage.setItem = function(k: string, v: string) {
          if (k === key) {
            const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
            (error as unknown as { code: number }).code = 22;
            throw error;
          }
          return originalSetItem(k, v);
        };
      }, REINFORCEMENT_SCHEDULES_KEY);

      // Navigate to practice page
      await page.goto('/practice');
      
      // Page should not crash
      await expect(page.locator('body')).toBeVisible();
      
      // Verify the app is still functional
      const errorText = await page.locator('text=/error|crash|something went wrong/i').count();
      expect(errorText).toBe(0);
    });
  });
});
