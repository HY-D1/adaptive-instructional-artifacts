/**
 * SettingsPage UI Tests
 * 
 * Comprehensive tests for SettingsPage UI changes including:
 * - ConfirmDialog functionality
 * - Toast notifications
 * - HDI Clear flow
 * - Button states
 * - Error handling
 * - Debug panel visibility
 * - Responsive design
 * - Accessibility
 * 
 * @module settings-page-tests
 */

import { expect, test } from '@playwright/test';

// Test tags:
// @weekly - Part of weekly regression
// @no-external - No external services needed

const TEST_USER = {
  id: 'test-settings-user',
  name: 'Test Settings User',
  role: 'instructor',
  createdAt: Date.now()
};

const STUDENT_USER = {
  id: 'test-student-user',
  name: 'Test Student User',
  role: 'student',
  createdAt: Date.now()
};

/**
 * Helper to create mock HDI events
 */
function createMockHDIEvent(learnerId: string, hdi: number, timestamp: number = Date.now()) {
  return {
    id: `mock-hdi-${timestamp}`,
    learnerId,
    timestamp,
    eventType: 'hdi_calculated',
    problemId: 'mock-problem',
    hdi,
    hdiLevel: hdi > 0.6 ? 'high' : hdi > 0.3 ? 'medium' : 'low',
    policyVersion: 'hdi-debug-mock-v1',
  };
}

/**
 * Helper to setup instructor user with optional HDI events
 */
async function setupInstructorUser(page: any, hdiEvents: any[] = []) {
  await page.addInitScript(({ user, events }: { user: typeof TEST_USER, events: any[] }) => {
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify(user));
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
    
    if (events.length > 0) {
      localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
    }
  }, { user: TEST_USER, events: hdiEvents });
}

/**
 * Helper to setup student user
 */
async function setupStudentUser(page: any) {
  await page.addInitScript(({ user }: { user: typeof STUDENT_USER }) => {
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify(user));
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
  }, { user: STUDENT_USER });
}

test.describe('@weekly SettingsPage UI Tests', () => {
  
  test.describe('Import Verification', () => {
    test('@no-external ConfirmDialog component is available', async ({ page }) => {
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      await page.goto('/settings');
      
      // Click the HDI clear button to trigger dialog
      await page.getByTestId('hdi-clear-button').click();
      
      // Verify dialog appears with correct structure
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Clear HDI History')).toBeVisible();
    });

    test('@no-external useToast hook provides toast notifications', async ({ page }) => {
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      await page.goto('/settings');
      
      // Trigger an action that shows toast
      await page.getByTestId('hdi-clear-button').click();
      await page.getByRole('button', { name: /clear history/i }).click();
      
      // Verify toast appears
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText('HDI History Cleared')).toBeVisible();
    });
  });

  test.describe('State Verification', () => {
    test('@no-external HDI state displays correctly with events', async ({ page }) => {
      const hdiEvents = [
        createMockHDIEvent(TEST_USER.id, 0.75, Date.now() - 1000),
        createMockHDIEvent(TEST_USER.id, 0.80, Date.now()),
      ];
      await setupInstructorUser(page, hdiEvents);
      await page.goto('/settings');
      
      // Wait for debug controls to be visible
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Verify HDI score shows latest value
      const scoreText = await page.getByTestId('hdi-score').textContent();
      expect(scoreText).toBe('0.800');
      
      // Verify event count
      const eventCount = await page.getByTestId('hdi-event-count').textContent();
      expect(eventCount).toBe('2');
    });

    test('@no-external HDI state shows N/A without events', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      // Wait for debug controls to be visible
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Verify HDI score shows N/A
      const scoreText = await page.getByTestId('hdi-score').textContent();
      expect(scoreText).toBe('N/A');
      
      // Verify event count is 0
      const eventCount = await page.getByTestId('hdi-event-count').textContent();
      expect(eventCount).toBe('0');
    });
  });

  test.describe('HDI Clear Flow', () => {
    test('@no-external HDI clear with confirmation - full flow', async ({ page }) => {
      const hdiEvents = [
        createMockHDIEvent(TEST_USER.id, 0.75),
        createMockHDIEvent(TEST_USER.id, 0.80, Date.now() + 100),
      ];
      await setupInstructorUser(page, hdiEvents);
      await page.goto('/settings');
      
      // Wait for debug controls
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // 1. Click Clear HDI History button
      await page.getByTestId('hdi-clear-button').click();
      
      // 2. Verify confirmation dialog appears with correct content
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText('Clear HDI History')).toBeVisible();
      await expect(page.getByText(/permanently delete/)).toBeVisible();
      await expect(page.getByText(/2 HDI-related event/i)).toBeVisible();
      
      // 3. Click Cancel - dialog should close
      await page.getByRole('button', { name: /cancel/i }).click();
      await expect(page.getByRole('dialog')).not.toBeVisible();
      
      // 4. Verify data still exists
      const scoreBefore = await page.getByTestId('hdi-score').textContent();
      expect(scoreBefore).toBe('0.800');
      
      // 5. Click Clear HDI History again
      await page.getByTestId('hdi-clear-button').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // 6. Click Confirm
      await page.getByRole('button', { name: /clear history/i }).click();
      
      // 7. Verify dialog closes
      await expect(page.getByRole('dialog')).not.toBeVisible();
      
      // 8. Verify success toast appears
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText('HDI History Cleared')).toBeVisible();
      
      // 9. Verify HDI data is cleared
      await expect(page.getByTestId('hdi-score')).toHaveText('N/A');
      await expect(page.getByTestId('hdi-event-count')).toHaveText('0');
      
      // 10. Verify button is now disabled
      await expect(page.getByTestId('hdi-clear-button')).toBeDisabled();
    });

    test('@no-external Cancel button closes dialog without clearing', async ({ page }) => {
      const hdiEvents = [createMockHDIEvent(TEST_USER.id, 0.75)];
      await setupInstructorUser(page, hdiEvents);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Open dialog
      await page.getByTestId('hdi-clear-button').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // Press Escape to close
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
      
      // Verify data is still there
      await expect(page.getByTestId('hdi-score')).not.toHaveText('N/A');
    });
  });

  test.describe('Button State Testing', () => {
    test('@no-external HDI clear button disabled when no events', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Verify button is disabled
      const button = page.getByTestId('hdi-clear-button');
      await expect(button).toBeDisabled();
      
      // Verify visual indication (destructive variant but disabled)
      await expect(button).toHaveAttribute('disabled');
    });

    test('@no-external HDI clear button enabled when events exist', async ({ page }) => {
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Verify button is enabled
      const button = page.getByTestId('hdi-clear-button');
      await expect(button).toBeEnabled();
      await expect(button).not.toHaveAttribute('disabled');
    });
  });

  test.describe('Error Handling', () => {
    test('@no-external Error toast appears on localStorage failure', async ({ page }) => {
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      
      // Inject script to mock localStorage failure
      await page.addInitScript(() => {
        const originalSetItem = localStorage.setItem;
        (window as any)._originalSetItem = originalSetItem;
        
        // Override setItem to throw error after dialog opens
        let callCount = 0;
        localStorage.setItem = function(key: string, value: string) {
          callCount++;
          // Fail on the 3rd call (which should be the HDI clear)
          if (callCount > 2 && key === 'sql-learning-interactions') {
            throw new Error('QuotaExceededError: Storage quota exceeded');
          }
          return originalSetItem.call(localStorage, key, value);
        };
      });
      
      await page.goto('/settings');
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Try to clear HDI
      await page.getByTestId('hdi-clear-button').click();
      await page.getByRole('button', { name: /clear history/i }).click();
      
      // Verify error toast appears
      await expect(page.getByRole('alert')).toBeVisible();
      await expect(page.getByText(/failed to clear/i)).toBeVisible();
    });
  });

  test.describe('Debug Panel Visibility', () => {
    test('@no-external Debug panel visible to instructors in DEV mode', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      // Should see Week 5 Testing Controls
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      await expect(page.getByText('Week 5 Testing Controls')).toBeVisible();
    });

    test('@no-external Debug panel hidden from students', async ({ page }) => {
      await setupStudentUser(page);
      await page.goto('/settings');
      
      // Should NOT see Week 5 Testing Controls
      await expect(page.getByTestId('week5-debug-controls')).not.toBeVisible();
      await expect(page.getByText('Week 5 Testing Controls')).not.toBeVisible();
    });

    test('@no-external Profile override section visible', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      await expect(page.getByTestId('profile-override-section')).toBeVisible();
    });

    test('@no-external Assignment strategy section visible', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      await expect(page.getByTestId('assignment-strategy-section')).toBeVisible();
    });

    test('@no-external HDI section visible', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      await expect(page.getByTestId('hdi-section')).toBeVisible();
    });

    test('@no-external Bandit panel visible', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      await expect(page.getByTestId('bandit-panel')).toBeVisible();
    });
  });

  test.describe('Profile Override Functionality', () => {
    test('@no-external Profile override select works', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Click on profile override select
      await page.getByTestId('profile-override-select').click();
      
      // Select 'Fast Escalator'
      await page.getByText('Fast Escalator').click();
      
      // Verify selection was made
      await expect(page.getByTestId('profile-override-select')).toContainText('Fast Escalator');
    });

    test('@no-external Profile override reset works', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Change profile override
      await page.getByTestId('profile-override-select').click();
      await page.getByText('Fast Escalator').click();
      
      // Click reset
      await page.getByTestId('profile-override-reset').click();
      
      // Verify back to Auto
      await expect(page.getByTestId('profile-override-select')).toContainText('Auto');
      
      // Verify reset button is disabled
      await expect(page.getByTestId('profile-override-reset')).toBeDisabled();
    });
  });

  test.describe('Assignment Strategy Functionality', () => {
    test('@no-external Assignment strategy radio buttons work', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Select different strategies
      const strategies = ['static', 'diagnostic', 'bandit'];
      
      for (const strategy of strategies) {
        await page.locator(`#strategy-${strategy}`).click();
        await expect(page.locator(`#strategy-${strategy}`)).toBeChecked();
      }
    });
  });

  test.describe('Bandit Panel Functionality', () => {
    test('@no-external Bandit refresh button works', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Click refresh
      await page.getByTestId('bandit-refresh').click();
      
      // Verify no errors occur (table should still be visible)
      await expect(page.getByTestId('bandit-arm-stats')).toBeVisible();
    });

    test('@no-external Force arm selection works', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Select an arm
      await page.getByTestId('force-arm-select').click();
      await page.getByText('Fast Escalator').first().click();
      
      // Click apply
      await page.getByTestId('force-arm-apply').click();
      
      // Verify no errors
      await expect(page.getByTestId('bandit-panel')).toBeVisible();
    });
  });

  test.describe('Responsive Design', () => {
    test('@no-external Settings page responsive on mobile', async ({ page }) => {
      await setupInstructorUser(page, []);
      
      // Test mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto('/settings');
      
      // Verify page loads without horizontal scroll
      const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
      const viewportWidth = await page.evaluate(() => window.innerWidth);
      expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 20); // Allow small tolerance
      
      // Verify settings content is visible
      await expect(page.getByText('Settings')).toBeVisible();
    });

    test('@no-external Settings page responsive on tablet', async ({ page }) => {
      await setupInstructorUser(page, []);
      
      // Test tablet viewport
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.goto('/settings');
      
      // Verify settings content is visible
      await expect(page.getByText('Settings')).toBeVisible();
      await expect(page.getByText('LLM Configuration')).toBeVisible();
    });

    test('@no-external Settings page responsive on desktop', async ({ page }) => {
      await setupInstructorUser(page, []);
      
      // Test desktop viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.goto('/settings');
      
      // Verify settings content is visible
      await expect(page.getByText('Settings')).toBeVisible();
      await expect(page.getByText('PDF Textbook Upload')).toBeVisible();
    });
  });

  test.describe('Accessibility', () => {
    test('@no-external Settings page has proper headings', async ({ page }) => {
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      // Verify main heading
      await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
      
      // Verify section headings
      await expect(page.getByRole('heading', { name: 'PDF Textbook Upload' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'LLM Configuration' })).toBeVisible();
    });

    test('@no-external HDI clear button has accessible label', async ({ page }) => {
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      await page.goto('/settings');
      
      const button = page.getByTestId('hdi-clear-button');
      
      // Verify button has accessible name
      await expect(button).toHaveAccessibleName(/clear hdi history/i);
    });

    test('@no-external Dialog has proper ARIA attributes', async ({ page }) => {
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      await page.goto('/settings');
      
      // Open dialog
      await page.getByTestId('hdi-clear-button').click();
      
      // Verify dialog has proper role
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    test('@no-external Toast notifications have proper ARIA attributes', async ({ page }) => {
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      await page.goto('/settings');
      
      // Trigger toast
      await page.getByTestId('hdi-clear-button').click();
      await page.getByRole('button', { name: /clear history/i }).click();
      
      // Verify toast has proper role
      const toast = page.getByRole('alert');
      await expect(toast).toBeVisible();
      await expect(toast).toHaveAttribute('aria-live', 'polite');
    });

    test('@no-external Keyboard navigation works', async ({ page }) => {
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      await page.goto('/settings');
      
      // Tab to HDI clear button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Open dialog with Enter
      await page.keyboard.press('Enter');
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // Tab to Cancel button
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Close with Escape
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Console Error Checking', () => {
    test('@no-external No console errors on settings page load', async ({ page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await setupInstructorUser(page, []);
      await page.goto('/settings');
      
      // Wait for page to fully load
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Give time for any async errors
      await page.waitForTimeout(500);
      
      // Check no errors (except known acceptable ones)
      const filteredErrors = errors.filter(e => 
        !e.includes('source map') && 
        !e.includes('favicon')
      );
      
      expect(filteredErrors).toHaveLength(0);
    });

    test('@no-external No console errors during HDI clear flow', async ({ page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Perform HDI clear flow
      await page.getByTestId('hdi-clear-button').click();
      await page.getByRole('button', { name: /clear history/i }).click();
      
      // Wait for toast
      await expect(page.getByRole('alert')).toBeVisible();
      
      // Check no errors
      const filteredErrors = errors.filter(e => 
        !e.includes('source map') && 
        !e.includes('favicon')
      );
      
      expect(filteredErrors).toHaveLength(0);
    });
  });

  test.describe('Visual Regression', () => {
    test('@no-external Settings page visual check @snapshot', async ({ page }) => {
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Take screenshot of full page
      await expect(page).toHaveScreenshot('settings-page-desktop.png', {
        fullPage: true
      });
    });

    test('@no-external HDI dialog visual check @snapshot', async ({ page }) => {
      await setupInstructorUser(page, [createMockHDIEvent(TEST_USER.id, 0.75)]);
      await page.goto('/settings');
      
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Open dialog
      await page.getByTestId('hdi-clear-button').click();
      await expect(page.getByRole('dialog')).toBeVisible();
      
      // Take screenshot
      await expect(page).toHaveScreenshot('hdi-clear-dialog.png');
    });
  });

  test.describe('Performance', () => {
    test('@no-external Settings page loads within acceptable time', async ({ page }) => {
      await setupInstructorUser(page, []);
      
      const startTime = Date.now();
      await page.goto('/settings');
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      const loadTime = Date.now() - startTime;
      
      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);
    });

    test('@no-external HDI clear operation completes quickly', async ({ page }) => {
      // Create many HDI events
      const hdiEvents = Array.from({ length: 100 }, (_, i) => 
        createMockHDIEvent(TEST_USER.id, 0.5 + i * 0.001, Date.now() + i)
      );
      
      await setupInstructorUser(page, hdiEvents);
      await page.goto('/settings');
      await expect(page.getByTestId('week5-debug-controls')).toBeVisible();
      
      // Measure clear operation time
      const startTime = Date.now();
      
      await page.getByTestId('hdi-clear-button').click();
      await page.getByRole('button', { name: /clear history/i }).click();
      await expect(page.getByRole('alert')).toBeVisible();
      
      const clearTime = Date.now() - startTime;
      
      // Should complete within 2 seconds
      expect(clearTime).toBeLessThan(2000);
    });
  });
});
