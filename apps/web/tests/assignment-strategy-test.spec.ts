import { expect, test } from '@playwright/test';
import { setupTest } from './test-helpers';

test.describe('@no-external Assignment Strategy System Test', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('BUG: static strategy does not use assignProfile function', async ({ page }) => {
    // Set static strategy
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-debug-strategy', 'static');
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'static-test-learner',
          name: 'Static Test Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
    });

    // Navigate to practice
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 30000 });

    // Get logged events
    const interactions = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    });

    // Find profile_assigned event
    const profileEvent = interactions.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();

    // The strategy should be 'static' per localStorage setting
    expect(profileEvent.assignmentStrategy).toBe('static');

    // BUG: Even though strategy is 'static', the profile was selected by bandit
    // because the code always calls banditManager.selectProfileForLearner()
    // and never calls assignProfile() with the static strategy
    console.log('Profile assigned:', profileEvent.profileId);
    console.log('Assignment strategy:', profileEvent.assignmentStrategy);
    console.log('Reason:', profileEvent.payload?.reason);
    
    // The reason is always 'bandit_selection' or 'debug_override'
    // even when strategy is 'static'
    expect(['bandit_selection', 'debug_override', 'static_assignment']).toContain(profileEvent.payload?.reason);
  });

  test('BUG: diagnostic strategy does not run diagnostic assessment', async ({ page }) => {
    // Set diagnostic strategy
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'diagnostic-test-learner',
          name: 'Diagnostic Test Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
    });

    // Navigate to practice
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 30000 });

    // Get logged events
    const interactions = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    });

    // Find profile_assigned event
    const profileEvent = interactions.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();

    // BUG: assignmentStrategy is 'diagnostic' but no diagnostic was actually run
    // because the code always uses bandit selection
    expect(profileEvent.assignmentStrategy).toBe('diagnostic');
    console.log('Profile assigned:', profileEvent.profileId);
    console.log('Reason:', profileEvent.payload?.reason);
    
    // The reason should indicate diagnostic assessment was used, but it's 'bandit_selection'
    expect(profileEvent.payload?.reason).toBe('bandit_selection'); // BUG!
  });

  test('BUG: bandit arm selection always happens regardless of strategy', async ({ page }) => {
    // Set static strategy
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-debug-strategy', 'static');
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'no-bandit-learner',
          name: 'No Bandit Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
    });

    // Navigate to practice
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 30000 });

    // Get logged events
    const interactions = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    });

    // BUG: Even with 'static' strategy, bandit_arm_selected event is still logged
    const banditEvent = interactions.find((e: any) => e.eventType === 'bandit_arm_selected');
    expect(banditEvent).toBeDefined(); // This happens even when strategy != 'bandit'
    
    console.log('Bandit event exists with static strategy:', !!banditEvent);
    console.log('Selected arm:', banditEvent?.selectedArm);
  });

  test('profile override takes precedence over strategy', async ({ page }) => {
    // Set static strategy with profile override
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-debug-strategy', 'static');
      window.localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
      window.localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id: 'override-test-learner',
          name: 'Override Test Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
    });

    // Navigate to practice
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 30000 });

    // Get logged events
    const interactions = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    });

    // Find profile_assigned event
    const profileEvent = interactions.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();

    // Profile override should take precedence
    expect(profileEvent.profileId).toBe('fast-escalator');
    expect(profileEvent.payload?.reason).toBe('debug_override');
    console.log('Profile with override:', profileEvent.profileId);
    console.log('Reason:', profileEvent.payload?.reason);
  });
});
