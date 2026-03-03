import { expect, test } from '@playwright/test';

/**
 * SettingsPage Debug Panel Test Suite
 * 
 * Tests the Week 5 debug controls for escalation profiles, bandit, and HDI
 */

test.describe('@weekly SettingsPage Debug Panel', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Create instructor profile and bypass welcome screen
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
  });

  test.describe('Debug Panel Visibility', () => {
    test('debug panel is visible in DEV mode for instructors', async ({ page }) => {
      await page.goto('/settings');
      
      // Wait for page to fully load
      await page.waitForLoadState('networkidle');
      
      // Wait for the debug panel to be visible
      const debugPanel = page.locator('[data-testid="week5-debug-controls"]');
      await expect(debugPanel).toBeVisible({ timeout: 10000 });
      
      // Verify it contains the expected sections
      await expect(page.locator('[data-testid="profile-override-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="assignment-strategy-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="hdi-section"]')).toBeVisible();
      await expect(page.locator('[data-testid="bandit-panel"]')).toBeVisible();
    });

    test('debug panel shows DEV badge', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      const badge = page.locator('text=DEV Mode');
      await expect(badge).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Profile Override Selector', () => {
    test('profile override dropdown exists and is clickable', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Verify select component wrapper exists
      const selectWrapper = page.locator('[data-testid="profile-override-select"]');
      await expect(selectWrapper).toBeVisible({ timeout: 10000 });
      
      // Get the trigger button within the select
      const trigger = selectWrapper.locator('button[role="combobox"]').first();
      await expect(trigger).toBeVisible();
      
      // Click to open the dropdown
      await trigger.click();
      
      // Wait for the dropdown portal to appear
      const dropdown = page.locator('[role="listbox"]').first();
      await expect(dropdown).toBeVisible();
      
      // Verify options are present
      await expect(page.getByRole('option', { name: /Auto/ })).toBeVisible();
      await expect(page.getByRole('option', { name: /Fast Escalator/ })).toBeVisible();
      await expect(page.getByRole('option', { name: /Slow Escalator/ })).toBeVisible();
      await expect(page.getByRole('option', { name: /^Adaptive$/ })).toBeVisible();
    });

    test('selecting profile override updates localStorage', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      const selectWrapper = page.locator('[data-testid="profile-override-select"]');
      const trigger = selectWrapper.locator('button[role="combobox"]').first();
      
      // Open dropdown
      await trigger.click();
      
      // Wait for dropdown and select Fast Escalator
      const fastOption = page.getByRole('option', { name: /Fast Escalator/ });
      await expect(fastOption).toBeVisible();
      await fastOption.click();
      
      // Verify localStorage was updated
      const profileOverride = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-debug-profile');
      });
      expect(profileOverride).toBe('fast-escalator');
    });

    test('reset button clears profile override', async ({ page }) => {
      // First set a profile override via localStorage before navigation
      await page.addInitScript(() => {
        localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
      });
      
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Click reset button
      const resetButton = page.locator('[data-testid="profile-override-reset"]');
      await expect(resetButton).toBeEnabled();
      await resetButton.click();
      
      // Verify localStorage was cleared
      const profileOverride = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-debug-profile');
      });
      expect(profileOverride).toBeNull();
    });

    test('reset button is disabled when auto is selected', async ({ page }) => {
      // Make sure no override is set
      await page.addInitScript(() => {
        localStorage.removeItem('sql-adapt-debug-profile');
      });
      
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Verify reset button is disabled
      const resetButton = page.locator('[data-testid="profile-override-reset"]');
      await expect(resetButton).toBeDisabled();
    });
  });

  test.describe('Assignment Strategy Selector', () => {
    test('assignment strategy radio buttons exist', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      const radioGroup = page.locator('[data-testid="assignment-strategy-radio"]');
      await expect(radioGroup).toBeVisible({ timeout: 10000 });
      
      // Check for all three radio inputs by label
      await expect(page.locator('label', { hasText: 'Static' })).toBeVisible();
      await expect(page.locator('label', { hasText: 'Diagnostic' })).toBeVisible();
      await expect(page.locator('label', { hasText: 'Bandit' })).toBeVisible();
    });

    test('selecting strategy updates localStorage', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Select "static" strategy by clicking the label
      await page.locator('label', { hasText: 'Static' }).click();
      
      // Verify localStorage
      const strategy = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-debug-strategy');
      });
      expect(strategy).toBe('static');
      
      // Select "diagnostic" strategy
      await page.locator('label', { hasText: 'Diagnostic' }).click();
      
      const strategy2 = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-debug-strategy');
      });
      expect(strategy2).toBe('diagnostic');
    });

    test('strategy persists after page reload', async ({ page }) => {
      // Set strategy via localStorage directly before navigation
      await page.addInitScript(() => {
        localStorage.setItem('sql-adapt-debug-strategy', 'static');
      });
      
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Verify "Static" radio is selected (checked) - use id selector for Radix RadioGroup
      const staticRadio = page.locator('#strategy-static');
      await expect(staticRadio).toBeChecked();
    });
  });

  test.describe('HDI Section', () => {
    test('HDI section displays score and event count', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('[data-testid="hdi-score"]')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('[data-testid="hdi-event-count"]')).toBeVisible();
      await expect(page.locator('[data-testid="hdi-clear-button"]')).toBeVisible();
    });

    test('HDI clear button is disabled when no events', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // When no events, button should be disabled
      const clearButton = page.locator('[data-testid="hdi-clear-button"]');
      
      // Check if button state reflects no events
      const eventCountText = await page.locator('[data-testid="hdi-event-count"]').textContent();
      const eventCount = parseInt(eventCountText || '0', 10);
      
      if (eventCount === 0) {
        await expect(clearButton).toBeDisabled();
      }
    });

    test('HDI clear button clears HDI history', async ({ page }) => {
      // First, add some mock HDI events before navigation
      await page.addInitScript(() => {
        const events = [
          {
            id: 'test-hdi-1',
            learnerId: 'test-instructor',
            timestamp: Date.now(),
            eventType: 'hdi_calculated',
            problemId: 'test',
            hdi: 0.5,
          },
          {
            id: 'test-hdi-2',
            learnerId: 'test-instructor',
            timestamp: Date.now(),
            eventType: 'hdi_trajectory_updated',
            problemId: 'test',
            hdi: 0.6,
          }
        ];
        localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      });
      
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Verify events are counted
      await expect(page.locator('[data-testid="hdi-event-count"]')).toHaveText('2');
      
      // Clear HDI history
      const clearButton = page.locator('[data-testid="hdi-clear-button"]');
      await expect(clearButton).toBeEnabled();
      await clearButton.click();
      
      // Verify events were cleared
      const events = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      });
      
      const hdiEvents = events.filter((e: { eventType: string }) => 
        e.eventType?.includes('hdi') || 
        e.eventType === 'hdi_calculated' || 
        e.eventType === 'hdi_trajectory_updated' ||
        e.eventType === 'dependency_intervention_triggered'
      );
      expect(hdiEvents.length).toBe(0);
    });
  });

  test.describe('Bandit Debug Panel', () => {
    test('bandit arm stats table is visible', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      await expect(page.locator('[data-testid="bandit-arm-stats"]')).toBeVisible({ timeout: 10000 });
    });

    test('bandit refresh button works', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      const refreshButton = page.locator('[data-testid="bandit-refresh"]');
      await expect(refreshButton).toBeVisible();
      await refreshButton.click();
      
      // Should not cause any errors
      await expect(page.locator('[data-testid="bandit-arm-stats"]')).toBeVisible();
    });

    test('force arm selection dropdown exists', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      const armSelectWrapper = page.locator('[data-testid="force-arm-select"]');
      await expect(armSelectWrapper).toBeVisible();
      
      // Open dropdown
      const trigger = armSelectWrapper.locator('button[role="combobox"]').first();
      await trigger.click();
      
      // Should show dropdown
      const dropdown = page.locator('[role="listbox"]').first();
      await expect(dropdown).toBeVisible();
    });

    test('force arm apply button is clickable', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      const applyButton = page.locator('[data-testid="force-arm-apply"]');
      await expect(applyButton).toBeVisible();
      await expect(applyButton).toBeEnabled();
    });
  });

  test.describe('Invalid State Recovery', () => {
    test('handles corrupted profile override gracefully', async ({ page }) => {
      // Set invalid profile value before navigation
      await page.addInitScript(() => {
        localStorage.setItem('sql-adapt-debug-profile', 'invalid-profile');
      });
      
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Page should still load without errors
      await expect(page.locator('[data-testid="week5-debug-controls"]')).toBeVisible({ timeout: 10000 });
      
      // Should fall back to 'auto' (reset button disabled)
      const resetButton = page.locator('[data-testid="profile-override-reset"]');
      await expect(resetButton).toBeDisabled();
    });

    test('handles corrupted strategy gracefully', async ({ page }) => {
      // Set invalid strategy value before navigation
      await page.addInitScript(() => {
        localStorage.setItem('sql-adapt-debug-strategy', 'invalid-strategy');
      });
      
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Page should still load
      await expect(page.locator('[data-testid="week5-debug-controls"]')).toBeVisible({ timeout: 10000 });
    });

    test('handles missing localStorage gracefully', async ({ page }) => {
      // No special setup needed - just navigate
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Page should still load with defaults
      await expect(page.locator('[data-testid="week5-debug-controls"]')).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Student Role Restrictions', () => {
    test('students do not see debug panel', async ({ page }) => {
      // Setup student role
      await page.addInitScript(() => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-student',
          name: 'Test Student',
          role: 'student',
          createdAt: Date.now()
        }));
      });
      
      await page.goto('/settings');
      await page.waitForLoadState('networkidle');
      
      // Debug panel should not be visible (debug panel requires instructor role)
      await expect(page.locator('[data-testid="week5-debug-controls"]')).not.toBeVisible();
      
      // But the settings page itself should still be visible
      await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible();
    });
  });
});

test.describe('@weekly SettingsPage General', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
  });

  test('page loads with correct title', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('h1', { hasText: 'Settings' })).toBeVisible();
  });

  test('LLM Configuration section is visible', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'LLM Configuration' })).toBeVisible();
  });

  test('About These Settings section is visible', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=About These Settings')).toBeVisible();
  });

  test('students do not see PDF Upload section', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('text=PDF Textbook Upload')).not.toBeVisible();
  });
});
