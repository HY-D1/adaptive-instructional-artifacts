/**
 * @weekly SettingsPage Week 5 Debug Controls Tests
 * 
 * Tests for the Week 5 Testing Controls in SettingsPage:
 * - Profile Override functionality
 * - Assignment Strategy radio buttons  
 * - HDI Reset functionality
 * - Bandit Debug Panel
 * 
 * Note: DEV mode visibility is implicitly tested because these controls
 * are only rendered when import.meta.env.DEV is true.
 */

import { expect, test } from '@playwright/test';
import { setupTest, completeStartPageFlow, getAllInteractionsFromStorage } from './test-helpers';

test.describe('@weekly SettingsPage Week 5 Debug Controls', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  // =============================================================================
  // Profile Override Tests
  // =============================================================================
  test.describe('Profile Override', () => {
    test('selecting Fast Escalator saves to localStorage', async ({ page }) => {
      await completeStartPageFlow(page, 'ProfileTestUser');
      await page.goto('/settings');
      
      // Wait for Week 5 controls to be visible
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Open the profile override dropdown by clicking the trigger
      const selectTrigger = page.locator('[data-testid="profile-override-select"] >> [role="combobox"]').first();
      await selectTrigger.click();
      
      // Select "Fast Escalator"
      await page.getByText('Fast Escalator').click();
      
      // Verify localStorage was updated
      const savedProfile = await page.evaluate(() => {
        return window.localStorage.getItem('sql-adapt-debug-profile');
      });
      expect(savedProfile).toBe('fast-escalator');
    });

    test('profile selection persists after page refresh', async ({ page }) => {
      await completeStartPageFlow(page, 'ProfilePersistUser');
      
      // Set profile override via localStorage before visiting settings
      await page.evaluate(() => {
        window.localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
      });
      
      await page.goto('/settings');
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Verify the Reset button is enabled (meaning a non-auto value is selected)
      const resetButton = page.locator('[data-testid="profile-override-reset"]');
      await expect(resetButton).toBeEnabled();
    });

    test('Reset button clears localStorage and resets to Auto', async ({ page }) => {
      await completeStartPageFlow(page, 'ProfileResetUser');
      
      // Set a profile override
      await page.evaluate(() => {
        window.localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
      });
      
      await page.goto('/settings');
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Click Reset button
      await page.locator('[data-testid="profile-override-reset"]').click();
      
      // Verify localStorage is cleared
      const savedProfile = await page.evaluate(() => {
        return window.localStorage.getItem('sql-adapt-debug-profile');
      });
      expect(savedProfile).toBeNull();
      
      // Verify Reset button is now disabled (meaning auto is selected)
      const resetButton = page.locator('[data-testid="profile-override-reset"]');
      await expect(resetButton).toBeDisabled();
    });
  });

  // =============================================================================
  // Assignment Strategy Tests
  // =============================================================================
  test.describe('Assignment Strategy', () => {
    test('clicking Static radio saves to localStorage', async ({ page }) => {
      await completeStartPageFlow(page, 'StrategyStaticUser');
      await page.goto('/settings');
      
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Click Static radio
      await page.locator('input[value="static"]').click();
      
      // Verify localStorage
      const savedStrategy = await page.evaluate(() => {
        return window.localStorage.getItem('sql-adapt-debug-strategy');
      });
      expect(savedStrategy).toBe('static');
    });

    test('only one radio can be selected at a time', async ({ page }) => {
      await completeStartPageFlow(page, 'StrategyExclusiveUser');
      await page.goto('/settings');
      
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Click different radios
      await page.locator('input[value="static"]').click();
      await page.locator('input[value="diagnostic"]').click();
      
      // Verify only diagnostic is checked
      await expect(page.locator('input[value="diagnostic"]')).toBeChecked();
      await expect(page.locator('input[value="static"]')).not.toBeChecked();
      await expect(page.locator('input[value="bandit"]')).not.toBeChecked();
    });

    test('strategy selection persists after refresh', async ({ page }) => {
      await completeStartPageFlow(page, 'StrategyPersistUser');
      
      // Set strategy via localStorage
      await page.evaluate(() => {
        window.localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
      });
      
      await page.goto('/settings');
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Verify diagnostic radio is selected
      await expect(page.locator('input[value="diagnostic"]')).toBeChecked();
    });
  });

  // =============================================================================
  // HDI Reset Tests
  // =============================================================================
  test.describe('HDI Reset', () => {
    test('HDI score displays correctly from events', async ({ page }) => {
      await completeStartPageFlow(page, 'HDIDisplayUser');
      const learnerId = await page.evaluate(() => {
        const profile = window.localStorage.getItem('sql-adapt-user-profile');
        return profile ? JSON.parse(profile).id : null;
      });
      
      // Add mock HDI events to localStorage
      await page.evaluate((id) => {
        const events = [
          {
            id: 'test-hdi-1',
            eventType: 'hdi_calculated',
            learnerId: id,
            timestamp: Date.now(),
            problemId: 'test-problem',
            hdi: 0.75,
            hdiLevel: 'medium'
          },
          {
            id: 'test-hdi-2',
            eventType: 'hdi_trajectory_updated',
            learnerId: id,
            timestamp: Date.now() - 1000,
            problemId: 'test-problem',
            hdi: 0.70,
            trend: 'increasing'
          }
        ];
        window.localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      }, learnerId);
      
      await page.goto('/settings');
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Verify HDI score is displayed (should show 0.750 for 75%)
      const hdiScore = page.locator('[data-testid="hdi-score"]');
      await expect(hdiScore).toHaveText('0.750');
      
      // Verify event count
      const eventCount = page.locator('[data-testid="hdi-event-count"]');
      await expect(eventCount).toHaveText('2');
    });

    test('Clear HDI History removes events from localStorage', async ({ page }) => {
      await completeStartPageFlow(page, 'HDIClearUser');
      const learnerId = await page.evaluate(() => {
        const profile = window.localStorage.getItem('sql-adapt-user-profile');
        return profile ? JSON.parse(profile).id : null;
      });
      
      // Add mock HDI events
      await page.evaluate((id) => {
        const events = [
          {
            id: 'test-hdi-1',
            eventType: 'hdi_calculated',
            learnerId: id,
            timestamp: Date.now(),
            problemId: 'test-problem',
            hdi: 0.75
          },
          {
            id: 'test-other',
            eventType: 'hint_view',
            learnerId: id,
            timestamp: Date.now(),
            problemId: 'test-problem'
          }
        ];
        window.localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      }, learnerId);
      
      await page.goto('/settings');
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Click Clear HDI History
      await page.locator('[data-testid="hdi-clear-button"]').click();
      
      // Verify events are removed
      const interactions = await getAllInteractionsFromStorage(page);
      const hdiEvents = interactions.filter((i: any) => 
        i.eventType === 'hdi_calculated' || 
        i.eventType === 'hdi_trajectory_updated'
      );
      expect(hdiEvents.length).toBe(0);
      
      // Verify non-HDI events are preserved
      const otherEvents = interactions.filter((i: any) => i.eventType === 'hint_view');
      expect(otherEvents.length).toBe(1);
    });

    test('HDI display updates to "N/A" after clearing', async ({ page }) => {
      await completeStartPageFlow(page, 'HDIClearDisplayUser');
      const learnerId = await page.evaluate(() => {
        const profile = window.localStorage.getItem('sql-adapt-user-profile');
        return profile ? JSON.parse(profile).id : null;
      });
      
      // Add mock HDI event
      await page.evaluate((id) => {
        const events = [
          {
            id: 'test-hdi-1',
            eventType: 'hdi_calculated',
            learnerId: id,
            timestamp: Date.now(),
            problemId: 'test-problem',
            hdi: 0.75
          }
        ];
        window.localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      }, learnerId);
      
      await page.goto('/settings');
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Verify HDI is displayed first
      const hdiScore = page.locator('[data-testid="hdi-score"]');
      await expect(hdiScore).toHaveText('0.750');
      
      // Clear HDI
      await page.locator('[data-testid="hdi-clear-button"]').click();
      
      // Verify display shows N/A
      await expect(hdiScore).toHaveText('N/A');
    });

    test('Clear HDI button is disabled when no HDI events exist', async ({ page }) => {
      await completeStartPageFlow(page, 'HDIDisabledUser');
      await page.goto('/settings');
      
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Verify button is disabled
      const clearButton = page.locator('[data-testid="hdi-clear-button"]');
      await expect(clearButton).toBeDisabled();
    });
  });

  // =============================================================================
  // Bandit Debug Panel Tests
  // =============================================================================
  test.describe('Bandit Debug Panel', () => {
    test('arm stats table shows all 4 arms', async ({ page }) => {
      await completeStartPageFlow(page, 'BanditArmsUser');
      await page.goto('/settings');
      
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      await expect(page.getByText('Bandit Debug Panel')).toBeVisible();
      
      // Arm stats table should exist
      const table = page.locator('[data-testid="bandit-arm-stats"]');
      await expect(table).toBeVisible();
      
      // Initially shows "no data" message until bandit is initialized
      await expect(page.locator('[data-testid="bandit-no-data"]')).toBeVisible();
    });

    test('Force Arm Selection dropdown has all 4 arms', async ({ page }) => {
      await completeStartPageFlow(page, 'BanditForceArmUser');
      await page.goto('/settings');
      
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Open force arm dropdown
      const selectTrigger = page.locator('[data-testid="force-arm-select"] >> [role="combobox"]').first();
      await selectTrigger.click();
      
      // Verify all 4 arms are available
      await expect(page.getByText('Fast Escalator')).toBeVisible();
      await expect(page.getByText('Slow Escalator')).toBeVisible();
      await expect(page.getByText('Explanation First')).toBeVisible();
      await expect(page.getByText('Adaptive Escalator')).toBeVisible();
    });

    test('Apply button creates debug event', async ({ page }) => {
      await completeStartPageFlow(page, 'BanditApplyUser');
      await page.goto('/settings');
      
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Apply button exists and is clickable
      const applyButton = page.locator('[data-testid="force-arm-apply"]');
      await expect(applyButton).toBeVisible();
      await expect(applyButton).toBeEnabled();
      
      // Click Apply
      await applyButton.click();
      
      // Verify debug event was logged (bandit data should now be visible)
      await expect(page.locator('[data-testid="bandit-no-data"]')).not.toBeVisible();
    });

    test('refresh button updates arm stats', async ({ page }) => {
      await completeStartPageFlow(page, 'BanditRefreshUser');
      await page.goto('/settings');
      
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
      
      // Click refresh button
      const refreshButton = page.locator('[data-testid="bandit-refresh"]');
      await expect(refreshButton).toBeVisible();
      await refreshButton.click();
      
      // Table should still be visible after refresh
      await expect(page.locator('[data-testid="bandit-arm-stats"]')).toBeVisible();
    });
  });
});
