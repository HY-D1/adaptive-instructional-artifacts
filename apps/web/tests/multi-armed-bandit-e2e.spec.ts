import { expect, test } from '@playwright/test';
import { setupTest, completeStartPageFlow, replaceEditorText } from './test-helpers';

/**
 * Multi-Armed Bandit E2E Tests
 *
 * Tests the MAB integration for adaptive escalation profile selection.
 * These tests verify:
 * - Bandit arm display and selection
 * - Initialization state
 * - Force arm selection
 * - Reward observation and stats updates
 * - Persistence across page refreshes
 *
 * Tag: @no-external - No external services (Ollama) needed
 * Environment: DEV mode required for debug panel visibility
 */

// Expected bandit arm configurations
const EXPECTED_ARMS = [
  { id: 'aggressive', name: 'Fast Escalator' },
  { id: 'conservative', name: 'Slow Escalator' },
  { id: 'explanation-first', name: 'Explanation First' },
  { id: 'adaptive', name: 'Adaptive Escalator' },
] as const;

// localStorage keys
const DEBUG_PROFILE_KEY = 'sql-adapt-debug-profile';
const DEBUG_STRATEGY_KEY = 'sql-adapt-debug-strategy';
const USER_PROFILE_KEY = 'sql-adapt-user-profile';
const INTERACTIONS_KEY = 'sql-learning-interactions';

test.describe('@no-external Multi-Armed Bandit E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('bandit arm selection: 4 arms exist with correct names', async ({ page }) => {
    // Set up student profile
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'test-learner',
          name: 'Test Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
    });

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    // Check if Week 5 debug controls are present (DEV mode only)
    const debugControls = page.locator('[data-testid="week5-debug-controls"]');
    const count = await debugControls.count();
    
    if (count === 0) {
      // Skip test if not in DEV mode - debug controls not rendered
      console.log('Skipping test: Week 5 debug controls not present - not in DEV mode');
      return;
    }

    // Verify bandit panel is visible
    const banditPanel = page.getByTestId('bandit-panel');
    await expect(banditPanel).toBeVisible();

    // Verify arm stats table exists
    const armStatsTable = page.getByTestId('bandit-arm-stats');
    await expect(armStatsTable).toBeVisible();

    // Verify all 4 arms are displayed in the force arm dropdown
    // Use more specific selector for the select trigger
    await page.locator('[data-testid="force-arm-select"] >> [role="combobox"]').first().click();
    for (const arm of EXPECTED_ARMS) {
      await expect(page.getByRole('option', { name: arm.name })).toBeVisible();
    }

    // Close dropdown
    await page.keyboard.press('Escape');
  });

  test('bandit initialization: shows no data initially, then data after interaction', async ({
    page,
  }) => {
    const learnerId = 'new-learner-' + Date.now();

    // Set up new learner profile
    await page.addInitScript((id) => {
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'New Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
    }, learnerId);

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    // Check if Week 5 debug controls are present (DEV mode only)
    const debugControls = page.locator('[data-testid="week5-debug-controls"]');
    const count = await debugControls.count();
    
    if (count === 0) {
      console.log('Skipping test: Week 5 debug controls not present - not in DEV mode');
      return;
    }

    // Verify "no data" message is shown initially
    const noDataMessage = page.getByTestId('bandit-no-data');
    await expect(noDataMessage).toBeVisible();
    await expect(noDataMessage).toContainText('No bandit data available');

    // Simulate bandit interaction by adding a bandit_updated event
    await page.evaluate((id) => {
      const event = {
        id: `debug-arm-force-${Date.now()}`,
        learnerId: id,
        timestamp: Date.now(),
        eventType: 'bandit_updated',
        problemId: 'debug',
        selectedArm: 'adaptive',
        policyVersion: 'debug-panel-v1',
      };
      const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
      interactions.push(event);
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, learnerId);

    // Refresh to pick up the new state
    await page.reload();

    // After page reload, force arm selection to populate stats
    await page.locator('[data-testid="force-arm-select"] >> [role="combobox"]').first().click();
    await page.getByRole('option', { name: 'Adaptive Escalator' }).click();
    await page.getByTestId('force-arm-apply').click();

    // Refresh again to see updated stats
    await page.getByTestId('bandit-refresh').click();

    // Verify arm stats table now shows data (not the "no data" message)
    await expect(page.getByTestId('bandit-no-data')).not.toBeVisible();

    // Verify the arm stat row for adaptive is visible
    await expect(page.getByTestId('arm-stat-adaptive')).toBeVisible();
  });

  test('force arm selection: select specific arm and verify application', async ({ page }) => {
    const learnerId = 'force-arm-learner';

    // Set up learner profile
    await page.addInitScript((id) => {
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Force Arm Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
    }, learnerId);

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    // Check if Week 5 debug controls are present (DEV mode only)
    const debugControls = page.locator('[data-testid="week5-debug-controls"]');
    const count = await debugControls.count();
    
    if (count === 0) {
      console.log('Skipping test: Week 5 debug controls not present - not in DEV mode');
      return;
    }

    // Select "Fast Escalator" from the force arm dropdown
    await page.locator('[data-testid="force-arm-select"] >> [role="combobox"]').first().click();
    await page.getByRole('option', { name: 'Fast Escalator' }).click();

    // Click Apply button
    await page.getByTestId('force-arm-apply').click();

    // Verify bandit_updated event was logged to localStorage
    const interactions = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });

    const banditEvents = interactions.filter((i: any) => i.eventType === 'bandit_updated');
    expect(banditEvents.length).toBeGreaterThanOrEqual(1);
    expect(banditEvents[banditEvents.length - 1].selectedArm).toBe('aggressive');

    // Verify arm stats updated (refresh to see changes)
    await page.getByTestId('bandit-refresh').click();
    await expect(page.getByTestId('arm-stat-aggressive')).toBeVisible();
  });

  test('bandit reward observation: complete problem and verify stats update', async ({ page }) => {
    const learnerId = 'reward-test-learner';

    // Set up learner with initial bandit state
    await page.addInitScript((id) => {
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Reward Test Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );

      // Seed some interactions to simulate past activity
      const now = Date.now();
      const interactions = [
        {
          id: 'evt-1',
          sessionId: 'session-1',
          learnerId: id,
          timestamp: now - 60000,
          eventType: 'bandit_updated',
          problemId: 'debug',
          selectedArm: 'adaptive',
          policyVersion: 'debug-panel-v1',
        },
      ];
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, learnerId);

    // Navigate to settings first to verify initial state
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    // Check if Week 5 debug controls are present (DEV mode only)
    const debugControls = page.locator('[data-testid="week5-debug-controls"]');
    const hasDebugControls = await debugControls.count() > 0;

    if (hasDebugControls) {
      // Get initial stats by applying the arm
      await page.locator('[data-testid="force-arm-select"] >> [role="combobox"]').first().click();
      await page.getByRole('option', { name: 'Adaptive Escalator' }).click();
      await page.getByTestId('force-arm-apply').click();
      await page.getByTestId('bandit-refresh').click();

      // Verify arm stats table is visible
      await expect(page.getByTestId('arm-stat-adaptive')).toBeVisible();
    }

    // Navigate to practice and complete a problem
    await page.goto('/practice');
    await expect(page).toHaveURL(/\/practice/);

    // Wait for SQL editor to be ready
    await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 30000 });
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 30000 });

    // Solve a simple problem (Problem 1: Retrieve all users)
    await replaceEditorText(page, 'SELECT * FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();

    // Wait for success indicator - use more specific selector
    await expect(page.locator('[data-testid="execution-success"], [data-testid="success-message"]').first()).toBeVisible({ timeout: 10000 });

    // Navigate back to settings
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    if (hasDebugControls) {
      // Verify bandit panel still shows data
      await expect(page.getByTestId('bandit-panel')).toBeVisible();

      // The arm stats should still be present (may have updated values)
      const armStatsTable = page.getByTestId('bandit-arm-stats');
      await expect(armStatsTable).toBeVisible();
    }
  });

  test('bandit persistence: arm selection persists after page refresh', async ({ page }) => {
    const learnerId = 'persistence-test-learner';

    // Set up learner profile
    await page.addInitScript((id) => {
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Persistence Test Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
    }, learnerId);

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    // Check if Week 5 debug controls are present (DEV mode only)
    const debugControls = page.locator('[data-testid="week5-debug-controls"]');
    const count = await debugControls.count();
    
    if (count === 0) {
      console.log('Skipping test: Week 5 debug controls not present - not in DEV mode');
      return;
    }

    // Select "Slow Escalator" and apply
    await page.locator('[data-testid="force-arm-select"] >> [role="combobox"]').first().click();
    await page.getByRole('option', { name: 'Slow Escalator' }).click();
    await page.getByTestId('force-arm-apply').click();

    // Verify the selection was applied
    let interactions = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });

    const eventsBeforeRefresh = interactions.filter((i: any) => i.eventType === 'bandit_updated');
    expect(eventsBeforeRefresh.length).toBeGreaterThanOrEqual(1);

    // Store the last selected arm before refresh
    const lastArmBeforeRefresh = eventsBeforeRefresh[eventsBeforeRefresh.length - 1].selectedArm;
    expect(lastArmBeforeRefresh).toBe('conservative');

    // Refresh the page
    await page.reload();

    // Verify settings page is still accessible
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByTestId('week5-debug-controls')).toBeVisible();

    // Verify bandit panel is still visible
    await expect(page.getByTestId('bandit-panel')).toBeVisible();

    // Verify arm stats are still present (refresh to ensure data is loaded)
    await page.getByTestId('bandit-refresh').click();
    await expect(page.getByTestId('arm-stat-conservative')).toBeVisible();

    // Verify the force arm dropdown still has all options
    await page.locator('[data-testid="force-arm-select"] >> [role="combobox"]').first().click();
    for (const arm of EXPECTED_ARMS) {
      await expect(page.getByRole('option', { name: arm.name })).toBeVisible();
    }
  });

  test('arm stats display: verify all 4 arms shown with correct columns', async ({ page }) => {
    const learnerId = 'stats-display-learner';

    // Set up learner with bandit interactions to populate stats
    await page.addInitScript((id) => {
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Stats Display Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );

      // Add multiple bandit interactions for different arms
      const now = Date.now();
      const interactions = [
        {
          id: 'evt-1',
          sessionId: 'session-1',
          learnerId: id,
          timestamp: now - 120000,
          eventType: 'bandit_updated',
          problemId: 'debug',
          selectedArm: 'aggressive',
          policyVersion: 'debug-panel-v1',
        },
        {
          id: 'evt-2',
          sessionId: 'session-1',
          learnerId: id,
          timestamp: now - 60000,
          eventType: 'bandit_updated',
          problemId: 'debug',
          selectedArm: 'adaptive',
          policyVersion: 'debug-panel-v1',
        },
      ];
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, learnerId);

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    // Check if Week 5 debug controls are present (DEV mode only)
    const debugControls = page.locator('[data-testid="week5-debug-controls"]');
    const count = await debugControls.count();
    
    if (count === 0) {
      console.log('Skipping test: Week 5 debug controls not present - not in DEV mode');
      return;
    }

    // Trigger stats population by applying an arm
    await page.locator('[data-testid="force-arm-select"] >> [role="combobox"]').first().click();
    await page.getByRole('option', { name: 'Adaptive Escalator' }).click();
    await page.getByTestId('force-arm-apply').click();

    // Refresh to load stats
    await page.getByTestId('bandit-refresh').click();

    // Verify arm stats table
    const armStatsTable = page.getByTestId('bandit-arm-stats');
    await expect(armStatsTable).toBeVisible();

    // Verify table headers
    const headers = armStatsTable.locator('thead th');
    await expect(headers).toHaveCount(4);
    await expect(headers.nth(0)).toHaveText('Arm');
    await expect(headers.nth(1)).toHaveText('Profile');
    await expect(headers.nth(2)).toHaveText('Mean Reward');
    await expect(headers.nth(3)).toHaveText('Pulls');

    // Verify all 4 arm rows are present
    for (const arm of EXPECTED_ARMS) {
      const armRow = page.getByTestId(`arm-stat-${arm.id}`);
      await expect(armRow).toBeVisible();

      // Verify the row contains the profile name
      await expect(armRow).toContainText(arm.name);
    }

    // Verify numeric columns show valid data
    const rows = armStatsTable.locator('tbody tr');
    const rowCount = await rows.count();
    expect(rowCount).toBe(4);

    for (let i = 0; i < rowCount; i++) {
      const row = rows.nth(i);
      // Verify Mean Reward column shows a number (formatted to 3 decimal places)
      const meanRewardCell = row.locator('td').nth(2);
      const meanRewardText = await meanRewardCell.textContent();
      expect(meanRewardText).toMatch(/^\d+\.\d{3}$/);

      // Verify Pulls column shows a number
      const pullsCell = row.locator('td').nth(3);
      const pullsText = await pullsCell.textContent();
      expect(pullsText).toMatch(/^\d+$/);
    }
  });

  test('profile override: select bandit profile via override dropdown', async ({ page }) => {
    const learnerId = 'profile-override-learner';

    // Set up learner profile
    await page.addInitScript((id) => {
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Profile Override Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
    }, learnerId);

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    // Check if Week 5 debug controls are present (DEV mode only)
    const debugControls = page.locator('[data-testid="week5-debug-controls"]');
    const count = await debugControls.count();
    
    if (count === 0) {
      console.log('Skipping test: Week 5 debug controls not present - not in DEV mode');
      return;
    }

    // Verify profile override section exists
    await expect(page.getByTestId('profile-override-section')).toBeVisible();

    // Select "Fast Escalator" from profile override dropdown
    await page.getByTestId('profile-override-select').click();
    await page.getByRole('option', { name: 'Fast Escalator' }).click();

    // Verify the selection is saved to localStorage
    const savedProfile = await page.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-debug-profile');
    });
    expect(savedProfile).toBe('fast-escalator');

    // Select "Adaptive" profile
    await page.getByTestId('profile-override-select').click();
    await page.getByRole('option', { name: 'Adaptive' }).click();

    // Verify the new selection is saved
    const updatedProfile = await page.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-debug-profile');
    });
    expect(updatedProfile).toBe('adaptive-escalator');

    // Test reset button
    await page.getByTestId('profile-override-reset').click();

    // Verify the profile override is cleared
    const resetProfile = await page.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-debug-profile');
    });
    expect(resetProfile).toBeNull();
  });

  test('assignment strategy: switch between static, diagnostic, and bandit', async ({ page }) => {
    const learnerId = 'strategy-test-learner';

    // Set up learner profile
    await page.addInitScript((id) => {
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Strategy Test Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
    }, learnerId);

    // Navigate to settings
    await page.goto('/settings');
    await expect(page).toHaveURL(/\/settings/);

    // Check if Week 5 debug controls are present (DEV mode only)
    const debugControls = page.locator('[data-testid="week5-debug-controls"]');
    const count = await debugControls.count();
    
    if (count === 0) {
      console.log('Skipping test: Week 5 debug controls not present - not in DEV mode');
      return;
    }

    // Verify assignment strategy section exists
    await expect(page.getByTestId('assignment-strategy-section')).toBeVisible();

    // Verify all three radio options exist
    await expect(page.getByRole('radio', { name: 'Static' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Diagnostic' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Bandit' })).toBeVisible();

    // Bandit should be selected by default
    await expect(page.getByRole('radio', { name: 'Bandit' })).toBeChecked();

    // Select "Static" strategy
    await page.getByRole('radio', { name: 'Static' }).click();

    // Verify selection is saved to localStorage
    let savedStrategy = await page.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-debug-strategy');
    });
    expect(savedStrategy).toBe('static');

    // Select "Diagnostic" strategy
    await page.getByRole('radio', { name: 'Diagnostic' }).click();

    savedStrategy = await page.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-debug-strategy');
    });
    expect(savedStrategy).toBe('diagnostic');

    // Select "Bandit" strategy
    await page.getByRole('radio', { name: 'Bandit' }).click();

    savedStrategy = await page.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-debug-strategy');
    });
    expect(savedStrategy).toBe('bandit');
  });
});
