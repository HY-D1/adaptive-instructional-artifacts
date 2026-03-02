/**
 * Assignment Strategy Switching Integration Tests
 *
 * Tests for strategy switching functionality, verifying that learners can
 * switch between different assignment strategies (static, diagnostic, bandit)
 * and the system responds correctly.
 *
 * Key Behaviors Tested:
 * - Switching from static to bandit strategy via Settings page
 * - Strategy changes taking effect on next problem
 * - Profile override taking precedence over any strategy
 * - Invalid strategy values falling back to bandit
 * - All strategies logging correct event types
 *
 * Tags: @no-external @weekly
 * - @no-external: No Ollama or external services needed
 * - @weekly: Part of weekly regression suite
 */

import { expect, test } from '@playwright/test';
import { setupTest, replaceEditorText } from './test-helpers';

test.describe('@no-external @weekly Assignment Strategy Switching', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  /**
   * Test 1: Verify that learners can switch from static to bandit strategy
   * via the Settings page and the new strategy takes effect.
   *
   * Strategy Switching Behavior:
   * - Initial load with static strategy assigns profile via hash-based assignment
   * - Switching to bandit via Settings changes the localStorage value
   * - Next page load uses bandit strategy with Thompson sampling
   */
  test('can switch from static to bandit strategy', async ({ page }) => {
    // Start with static strategy
    await page.addInitScript(() => {
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'switch-learner',
          name: 'Switch Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    // Navigate to practice to trigger static assignment
    await page.goto('/practice');
    await expect(
      page.getByRole('heading', { name: 'Practice SQL', exact: true })
    ).toBeVisible({ timeout: 10000 });

    // Verify static assignment was used
    let events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    let profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();
    expect(profileEvent.assignmentStrategy).toBe('static');
    const staticProfile = profileEvent.payload?.profile;
    expect(staticProfile).toBeDefined();

    // Switch to bandit via Settings page
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({
      timeout: 10000,
    });

    // Click on Bandit radio button in assignment strategy section
    // The RadioGroupItem with value="bandit" has id="strategy-bandit"
    await page.click('#strategy-bandit');
    await page.waitForTimeout(500);

    // Verify strategy was saved to localStorage
    const savedStrategy = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-strategy');
    });
    expect(savedStrategy).toBe('bandit');

    // Go back to practice to trigger new assignment with bandit
    await page.goto('/practice');
    await expect(
      page.getByRole('heading', { name: 'Practice SQL', exact: true })
    ).toBeVisible({ timeout: 10000 });

    // Verify bandit assignment was used
    events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    const banditEvents = events.filter((e: any) => e.eventType === 'profile_assigned');
    expect(banditEvents.length).toBeGreaterThanOrEqual(2); // At least one static, one bandit

    const latestEvent = banditEvents[banditEvents.length - 1];
    expect(latestEvent.assignmentStrategy).toBe('bandit');
    expect(latestEvent.payload?.strategy).toBe('bandit');
    expect(latestEvent.payload?.reason).toBe('bandit_selection');

    // Bandit should also log bandit_arm_selected event
    const armSelectEvent = events.find((e: any) => e.eventType === 'bandit_arm_selected');
    expect(armSelectEvent).toBeDefined();
    expect(armSelectEvent.armId).toBeDefined();
  });

  /**
   * Test 2: Verify that strategy changes take effect on the next problem,
   * not the current one. This tests the timing of when strategy changes
   * are applied.
   *
   * The LearningInterface reads the strategy from localStorage on mount
   * and when currentProblem.id changes. The strategy change should be
   * reflected on the next problem navigation.
   */
  test('strategy change takes effect on next problem', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'next-problem-learner',
          name: 'Next Problem Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    // Navigate to practice with diagnostic strategy
    await page.goto('/practice');
    await expect(
      page.getByRole('heading', { name: 'Practice SQL', exact: true })
    ).toBeVisible({ timeout: 10000 });
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Complete first problem to generate interaction history
    // Use a valid solution for the first SQL problem
    await replaceEditorText(page, 'SELECT * FROM users');
    await page.getByRole('button', { name: /run/i }).click();
    await page.waitForTimeout(1000);

    // Verify diagnostic assignment was used initially
    let events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    let profileEvents = events.filter((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvents.length).toBeGreaterThanOrEqual(1);
    expect(profileEvents[profileEvents.length - 1].assignmentStrategy).toBe('diagnostic');

    // Switch strategy to bandit
    await page.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
    });

    // Go to next problem
    await page.click('text=Next Problem');
    await page.waitForTimeout(1000);

    // Verify new strategy (bandit) is used for the new problem
    events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    profileEvents = events.filter((e: any) => e.eventType === 'profile_assigned');
    const latestEvent = profileEvents[profileEvents.length - 1];

    expect(latestEvent.assignmentStrategy).toBe('bandit');
    expect(latestEvent.payload?.strategy).toBe('bandit');
  });

  /**
   * Test 3: Verify that profile override takes precedence over any strategy.
   * When sql-adapt-debug-profile is set, it should be used regardless of
   * the assignment strategy.
   *
   * This is important for debugging and forcing specific profiles for testing.
   * The override mechanism allows instructors/researchers to manually assign
   * profiles without changing the underlying strategy logic.
   */
  test('profile override takes precedence over any strategy', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'override-learner',
          name: 'Override Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
      // Set strategy to bandit but also set profile override
      localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      localStorage.setItem('sql-adapt-debug-profile', 'explanation-first');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await expect(
      page.getByRole('heading', { name: 'Practice SQL', exact: true })
    ).toBeVisible({ timeout: 10000 });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();

    // Should use override profile, not bandit-selected profile
    expect(profileEvent.payload?.profile).toBe('explanation-first');
    expect(profileEvent.payload?.reason).toBe('debug_override');
    // Note: assignmentStrategy is still 'static' when override is active
    // because the override bypasses the normal strategy logic
    expect(profileEvent.assignmentStrategy).toBe('static');
  });

  /**
   * Test 4: Verify that invalid strategy values fall back to bandit.
   * The system should gracefully handle unexpected strategy values
   * by defaulting to the bandit strategy.
   *
   * This tests the default case in the switch statement in LearningInterface
   * where any unrecognized strategy defaults to bandit behavior.
   */
  test('invalid strategy value falls back to bandit', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'invalid-strategy-learner',
          name: 'Invalid Strategy Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'invalid-strategy');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await expect(
      page.getByRole('heading', { name: 'Practice SQL', exact: true })
    ).toBeVisible({ timeout: 10000 });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();

    // Should fall back to bandit (the default case)
    expect(profileEvent.assignmentStrategy).toBe('bandit');
    expect(profileEvent.payload?.strategy).toBe('bandit');
    expect(profileEvent.payload?.reason).toBe('bandit_selection');

    // Bandit should also log bandit_arm_selected
    const banditEvent = events.find((e: any) => e.eventType === 'bandit_arm_selected');
    expect(banditEvent).toBeDefined();
  });

  /**
   * Test 5: Verify that all strategies log correct event types.
   * Each strategy should log:
   * - profile_assigned event with correct strategy field
   * - bandit strategy should additionally log bandit_arm_selected
   *
   * This ensures consistent event logging across all assignment methods
   * for analytics and reproducibility.
   */
  test('all strategies log correct event types', async ({ page }) => {
    const strategies = ['static', 'diagnostic', 'bandit'] as const;

    for (const strategy of strategies) {
      // Clear storage for each strategy test
      await page.evaluate(() => localStorage.clear());

      // Setup with specific strategy
      await page.addInitScript((strat) => {
        localStorage.setItem(
          'sql-adapt-user-profile',
          JSON.stringify({
            id: `event-test-${strat}`,
            name: `Event Test ${strat}`,
            role: 'student',
            createdAt: Date.now(),
          })
        );
        localStorage.setItem('sql-adapt-debug-strategy', strat);
        localStorage.setItem('sql-adapt-welcome-seen', 'true');
      }, strategy);

      await page.goto('/practice');
      await expect(
        page.getByRole('heading', { name: 'Practice SQL', exact: true })
      ).toBeVisible({ timeout: 10000 });

      const events = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      });

      // Verify profile_assigned event exists
      const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
      expect(profileEvent).toBeDefined();
      expect(profileEvent.assignmentStrategy).toBe(strategy);

      // Verify payload has required fields
      expect(profileEvent.payload).toBeDefined();
      expect(profileEvent.payload.profile).toBeDefined();
      expect(profileEvent.payload.strategy).toBe(strategy);
      expect(profileEvent.payload.reason).toBeDefined();

      // Strategy-specific event verification
      if (strategy === 'static') {
        expect(profileEvent.payload.reason).toBe('static_assignment');
        // Static should NOT log bandit_arm_selected
        const banditEvent = events.find((e: any) => e.eventType === 'bandit_arm_selected');
        expect(banditEvent).toBeUndefined();
      } else if (strategy === 'diagnostic') {
        expect(profileEvent.payload.reason).toBe('diagnostic_assessment');
        // Diagnostic should NOT log bandit_arm_selected
        const banditEvent = events.find((e: any) => e.eventType === 'bandit_arm_selected');
        expect(banditEvent).toBeUndefined();
      } else if (strategy === 'bandit') {
        expect(profileEvent.payload.reason).toBe('bandit_selection');
        // Bandit SHOULD log bandit_arm_selected
        const banditEvent = events.find((e: any) => e.eventType === 'bandit_arm_selected');
        expect(banditEvent).toBeDefined();
        expect(banditEvent.armId).toBeDefined();
        expect(['aggressive', 'conservative', 'adaptive', 'explanation-first']).toContain(
          banditEvent.armId
        );
      }

      // Verify event has all required fields
      expect(profileEvent.learnerId).toBeDefined();
      expect(profileEvent.timestamp).toBeDefined();
      expect(profileEvent.timestamp).toBeGreaterThan(0);
      expect(profileEvent.eventType).toBe('profile_assigned');
      expect(profileEvent.problemId).toBeDefined();
    }
  });

  /**
   * Test 6: Verify that switching between all strategies works correctly.
   * This tests a complete workflow where a learner switches through
   * multiple strategies in sequence.
   */
  test('can switch between all strategies in sequence', async ({ page }) => {
    // Start with bandit
    await page.addInitScript(() => {
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'sequence-learner',
          name: 'Sequence Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    // Load with bandit
    await page.goto('/practice');
    await expect(
      page.getByRole('heading', { name: 'Practice SQL', exact: true })
    ).toBeVisible({ timeout: 10000 });

    let events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    expect(events.some((e: any) => e.assignmentStrategy === 'bandit')).toBe(true);

    // Switch to static
    await page.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
    });
    await page.goto('/practice');
    await page.waitForTimeout(500);

    events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    expect(events.some((e: any) => e.assignmentStrategy === 'static')).toBe(true);

    // Switch to diagnostic
    await page.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
    });
    await page.goto('/practice');
    await page.waitForTimeout(500);

    events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    expect(events.some((e: any) => e.assignmentStrategy === 'diagnostic')).toBe(true);

    // Switch back to bandit
    await page.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
    });
    await page.goto('/practice');
    await page.waitForTimeout(500);

    events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    expect(events.some((e: any) => e.assignmentStrategy === 'bandit')).toBe(true);

    // Verify we have events from all strategies
    const strategiesUsed = new Set(events.map((e: any) => e.assignmentStrategy).filter(Boolean));
    expect(strategiesUsed.has('bandit')).toBe(true);
    expect(strategiesUsed.has('static')).toBe(true);
    expect(strategiesUsed.has('diagnostic')).toBe(true);
  });

  /**
   * Test 7: Verify that clearing the strategy (removing from localStorage)
   * defaults to bandit behavior.
   */
  test('cleared strategy defaults to bandit', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'cleared-strategy-learner',
          name: 'Cleared Strategy Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
      // Don't set sql-adapt-debug-strategy to simulate cleared/missing strategy
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await expect(
      page.getByRole('heading', { name: 'Practice SQL', exact: true })
    ).toBeVisible({ timeout: 10000 });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();

    // Should default to bandit when no strategy is set
    expect(profileEvent.assignmentStrategy).toBe('bandit');
  });
});
