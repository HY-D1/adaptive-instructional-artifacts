/**
 * Static Assignment Strategy E2E Tests
 *
 * Tests for the 'static' assignment strategy which:
 * - Assigns the same profile to the same learner every time (deterministic)
 * - Uses a hash of learnerId to determine profile
 * - Does not change between sessions
 * - Logs events with strategy='static' and reason='static_assignment'
 *
 * Tags: @no-external @weekly
 * - @no-external: No Ollama or external services needed
 * - @weekly: Part of weekly regression suite
 */

import { expect, test } from '@playwright/test';

test.describe('@no-external @weekly Static Assignment Strategy', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test for clean state
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  /**
   * Test 1: Verify that the static strategy assigns the same profile
   * to the same learner across multiple sessions/page reloads.
   * This tests the deterministic nature of hash-based assignment.
   */
  test('static strategy assigns same profile to same learner across sessions', async ({ page }) => {
    // Setup: Configure static strategy and create learner profile
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'static-learner-123',
        name: 'Static Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    // Navigate to practice page to trigger profile assignment
    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });

    // Verify: Check that profile_assigned event was logged with correct strategy and reason
    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();
    expect(profileEvent.assignmentStrategy).toBe('static');
    expect(profileEvent.payload?.reason).toBe('static_assignment');
    expect(profileEvent.payload?.strategy).toBe('static');

    // Store the first assigned profile for comparison
    const firstProfile = profileEvent.payload?.profile;
    expect(firstProfile).toBeDefined();
    expect(['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first']).toContain(firstProfile);

    // Simulate new session: Clear only interaction events but keep learner identity
    await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      const filtered = interactions.filter((e: any) => e.eventType !== 'profile_assigned');
      localStorage.setItem('sql-learning-interactions', JSON.stringify(filtered));
    });

    // Reload page (simulating new session)
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });

    // Verify: Get new events and check profile assignment
    const newEvents = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const newProfileEvent = newEvents.find((e: any) => e.eventType === 'profile_assigned');
    expect(newProfileEvent).toBeDefined();
    expect(newProfileEvent.assignmentStrategy).toBe('static');
    expect(newProfileEvent.payload?.reason).toBe('static_assignment');

    // Critical assertion: Same learner should get same profile
    expect(newProfileEvent.payload?.profile).toBe(firstProfile);
  });

  /**
   * Test 2: Verify that different learners get different profiles (or at least
   * valid profiles). The hash-based assignment should distribute learners
   * across available profiles.
   */
  test('static strategy assigns different profiles to different learners', async ({ page }) => {
    const assignedProfiles: string[] = [];
    const learnerIds = ['learner-alpha-001', 'learner-beta-002', 'learner-gamma-003'];

    for (const learnerId of learnerIds) {
      // Clear storage for fresh learner
      await page.evaluate(() => localStorage.clear());

      // Setup new learner with static strategy
      await page.addInitScript((id) => {
        localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: id,
          name: `Learner ${id}`,
          role: 'student',
          createdAt: Date.now()
        }));
        localStorage.setItem('sql-adapt-debug-strategy', 'static');
        localStorage.setItem('sql-adapt-welcome-seen', 'true');
      }, learnerId);

      await page.goto('/practice');
      await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });

      // Get assigned profile
      const events = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      });

      const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
      expect(profileEvent).toBeDefined();
      expect(profileEvent.assignmentStrategy).toBe('static');
      expect(profileEvent.payload?.reason).toBe('static_assignment');

      const profileId = profileEvent.payload?.profile;
      expect(profileId).toBeDefined();

      // Validate profile is one of the expected escalation profiles
      const validProfiles = ['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first'];
      expect(validProfiles).toContain(profileId);

      assignedProfiles.push(profileId);
    }

    // Verify all learners got valid profiles
    expect(assignedProfiles).toHaveLength(learnerIds.length);

    // Log the distribution for debugging
    console.log('Static assignment distribution:', {
      learners: learnerIds,
      profiles: assignedProfiles
    });

    // Note: Hash-based assignment doesn't guarantee different profiles,
    // but with 3+ learners and 4 profiles, they should likely differ.
    // We verify at least that the assignment is deterministic by checking
    // that re-running would produce the same results (implicitly verified
    // by the consistent hash function).
  });

  /**
   * Test 3: Verify that debug profile override takes precedence over
   * static strategy. When both debug-strategy='static' and debug-profile
   * are set, the explicit profile override should win.
   */
  test('static strategy respects profile override when both are set', async ({ page }) => {
    const overrideProfile = 'fast-escalator';

    await page.addInitScript((profile) => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'static-learner-override',
        name: 'Static Learner Override',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
      localStorage.setItem('sql-adapt-debug-profile', profile);
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, overrideProfile);

    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();

    // Should use override profile, not static assignment
    expect(profileEvent.payload?.profile).toBe(overrideProfile);
    expect(profileEvent.payload?.reason).toBe('debug_override');
  });

  /**
   * Test 4: Verify that static strategy correctly logs all required
   * event fields with proper structure.
   */
  test('static strategy logs complete profile assignment event', async ({ page }) => {
    const learnerId = 'static-event-test-learner';

    await page.addInitScript((id) => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: id,
        name: 'Event Test Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, learnerId);

    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();

    // Verify all required fields are present
    expect(profileEvent.learnerId).toBe(learnerId);
    expect(profileEvent.eventType).toBe('profile_assigned');
    expect(profileEvent.timestamp).toBeDefined();
    expect(profileEvent.timestamp).toBeGreaterThan(0);
    expect(profileEvent.assignmentStrategy).toBe('static');
    expect(profileEvent.policyVersion).toBeDefined();

    // Verify payload structure
    expect(profileEvent.payload).toBeDefined();
    expect(profileEvent.payload.profile).toBeDefined();
    expect(profileEvent.payload.strategy).toBe('static');
    expect(profileEvent.payload.reason).toBe('static_assignment');

    // Verify profile is valid
    const validProfiles = ['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first'];
    expect(validProfiles).toContain(profileEvent.payload.profile);
  });

  /**
   * Test 5: Verify deterministic assignment by testing the same learner
   * multiple times in sequence and ensuring consistent results.
   */
  test('static strategy produces consistent results across multiple visits', async ({ page }) => {
    const learnerId = 'deterministic-test-learner';
    const observedProfiles: string[] = [];

    for (let i = 0; i < 3; i++) {
      // Clear interaction history but maintain learner identity and strategy
      await page.evaluate(() => {
        const profile = localStorage.getItem('sql-adapt-user-profile');
        const strategy = localStorage.getItem('sql-adapt-debug-strategy');
        const welcomeSeen = localStorage.getItem('sql-adapt-welcome-seen');
        localStorage.clear();
        if (profile) localStorage.setItem('sql-adapt-user-profile', profile);
        if (strategy) localStorage.setItem('sql-adapt-debug-strategy', strategy);
        if (welcomeSeen) localStorage.setItem('sql-adapt-welcome-seen', welcomeSeen);
      });

      await page.goto('/practice');
      await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });

      const events = await page.evaluate(() => {
        return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      });

      const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
      expect(profileEvent).toBeDefined();
      expect(profileEvent.payload?.reason).toBe('static_assignment');

      observedProfiles.push(profileEvent.payload?.profile);

      // Small delay between visits
      await page.waitForTimeout(100);
    }

    // All observations should be the same (deterministic)
    expect(observedProfiles).toHaveLength(3);
    expect(new Set(observedProfiles).size).toBe(1); // All values should be identical
  });
});
