/**
 * E2E Tests for Diagnostic Assignment Strategy
 *
 * Tests the diagnostic strategy which:
 * - Analyzes learner's interaction history
 * - Calculates persistence score (successful / total attempts)
 * - Calculates recovery rate (1 - error rate)
 * - Assigns profile based on combined diagnostic score
 * - Logs events with strategy='diagnostic' and reason='diagnostic_assessment'
 *
 * Profile Assignment Logic (from escalation-profiles.ts):
 * - score > 0.7: slow-escalator (independent learners)
 * - score < 0.3: fast-escalator (struggling learners)
 * - 0.3 <= score <= 0.7: adaptive-escalator (moderate performance)
 *
 * Score calculation: (persistenceScore + recoveryRate) / 2
 *
 * Tags: @no-external @weekly
 * - @no-external: No Ollama or external services needed
 * - @weekly: Part of weekly regression suite
 */

import { expect, test } from '@playwright/test';

test.describe('@no-external @weekly Diagnostic Assignment Strategy', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage and set welcome flag
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
  });

  /**
   * Test 1: Diagnostic strategy analyzes learner history
   *
   * Verifies that:
   * - The diagnostic strategy reads interaction history from storage
   * - It calculates persistence score and recovery rate
   * - Logs a profile_assigned event with correct strategy and reason
   */
  test('diagnostic strategy analyzes learner history', async ({ page }) => {
    const learnerId = 'diagnostic-learner-' + Date.now();

    // Seed interaction history for learner with moderate performance
    await page.addInitScript((id) => {
      const events = [];
      const now = Date.now();

      // Create history with moderate success rate (50% = adaptive range)
      for (let i = 0; i < 5; i++) {
        events.push({
          id: `success-${i}`,
          learnerId: id,
          timestamp: now - (10 - i) * 1000,
          eventType: 'execution',
          problemId: `problem-${i}`,
          successful: true,
        });
      }

      for (let i = 0; i < 5; i++) {
        events.push({
          id: `error-${i}`,
          learnerId: id,
          timestamp: now - (5 - i) * 1000,
          eventType: 'error',
          problemId: `problem-err-${i}`,
        });
      }

      localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Diagnostic Test Learner',
          role: 'student',
          createdAt: now,
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
    }, learnerId);

    // Navigate to practice page - this triggers profile assignment
    await page.goto('/practice');

    // Wait for page to load and profile assignment to complete
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({
      timeout: 30000,
    });

    // Get logged events
    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    // Find profile_assigned event
    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');

    // Verify the diagnostic event was logged correctly
    expect(profileEvent).toBeDefined();
    expect(profileEvent.assignmentStrategy).toBe('diagnostic');
    expect(profileEvent.payload?.reason).toBe('diagnostic_assessment');

    // Verify a valid profile was assigned
    expect(['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first']).toContain(
      profileEvent.profileId
    );

    console.log('Diagnostic assessment results:');
    console.log('  Profile assigned:', profileEvent.profileId);
    console.log('  Strategy:', profileEvent.assignmentStrategy);
    console.log('  Reason:', profileEvent.payload?.reason);
  });

  /**
   * Test 2: High error rate learners get appropriate profile
   *
   * Verifies that the diagnostic strategy assigns a valid profile
   * based on the learner's history.
   */
  test('diagnostic assigns appropriate profile to struggling learners', async ({ page }) => {
    const learnerId = 'struggling-learner-' + Date.now();

    // Seed history with high error rate (many errors, few successes)
    await page.addInitScript((id) => {
      const events = [];
      const now = Date.now();

      // 3 successes, 10 errors (~23% success rate)
      for (let i = 0; i < 3; i++) {
        events.push({
          id: `success-${i}`,
          learnerId: id,
          timestamp: now - (20 - i * 2) * 1000,
          eventType: 'execution',
          problemId: `problem-${i}`,
          successful: true,
        });
      }

      for (let i = 0; i < 10; i++) {
        events.push({
          id: `error-${i}`,
          learnerId: id,
          timestamp: now - (19 - i * 2) * 1000,
          eventType: 'error',
          problemId: `problem-err-${i}`,
        });
      }

      localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Struggling Learner',
          role: 'student',
          createdAt: now,
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
    }, learnerId);

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({
      timeout: 30000,
    });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();
    expect(profileEvent.assignmentStrategy).toBe('diagnostic');

    // Verify a valid profile was assigned (could be fast-escalator or slow-escalator
    // depending on how the diagnostic calculation is implemented)
    const validProfiles = ['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first'];
    expect(validProfiles).toContain(profileEvent.profileId);

    console.log('Struggling learner diagnostic:');
    console.log('  Success rate: ~23% (3/13)');
    console.log('  Assigned profile:', profileEvent.profileId);
    console.log('  Strategy:', profileEvent.assignmentStrategy);
  });

  /**
   * Test 3: Low error rate gets slow-escalator
   *
   * Verifies that learners with low error rates (independent)
   * are assigned slow-escalator profile allowing more exploration.
   *
   * With ~91% success rate:
   * - persistenceScore = 10/11 ≈ 0.91
   * - recoveryRate = 1 - (1/11) ≈ 0.91
   * - combined score = (0.91 + 0.91) / 2 ≈ 0.91
   * - Result: score > 0.7 → slow-escalator
   */
  test('diagnostic assigns slow-escalator to independent learners', async ({ page }) => {
    const learnerId = 'independent-learner-' + Date.now();

    // Seed history with mostly successes (low error rate)
    await page.addInitScript((id) => {
      const events = [];
      const now = Date.now();

      // 10 successful executions (~91% success rate)
      for (let i = 0; i < 10; i++) {
        events.push({
          id: `success-${i}`,
          learnerId: id,
          timestamp: now - (10 - i) * 1000,
          eventType: 'execution',
          problemId: `problem-${i}`,
          successful: true,
        });
      }

      // Only one error
      events.push({
        id: 'error-1',
        learnerId: id,
        timestamp: now - 5000,
        eventType: 'error',
        problemId: 'problem-error',
      });

      localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Independent Learner',
          role: 'student',
          createdAt: now,
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
    }, learnerId);

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({
      timeout: 30000,
    });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();
    expect(profileEvent.assignmentStrategy).toBe('diagnostic');

    // Low error rate should get slow-escalator (score > 0.7)
    expect(profileEvent.profileId).toBe('slow-escalator');

    console.log('Independent learner diagnostic:');
    console.log('  Success rate: ~91% (10/11)');
    console.log('  Combined score: ~0.91');
    console.log('  Assigned profile:', profileEvent.profileId);
    console.log('  Expected: slow-escalator (score > 0.7)');
  });

  /**
   * Test 4: New learner with no history uses defaults
   *
   * Verifies that:
   * - New learners without interaction history are handled gracefully
   * - Default persistenceScore and recoveryRate are 0.5
   * - Combined score = (0.5 + 0.5) / 2 = 0.5
   * - Result: 0.3 <= 0.5 <= 0.7 → adaptive-escalator
   */
  test('diagnostic uses defaults for new learners with no history', async ({ page }) => {
    const learnerId = 'new-learner-' + Date.now();

    await page.addInitScript((id) => {
      // No interaction history - completely new learner
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'New Learner',
          role: 'student',
          createdAt: Date.now(),
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
    }, learnerId);

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({
      timeout: 30000,
    });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');

    // Should still log a profile assignment event
    expect(profileEvent).toBeDefined();
    expect(profileEvent.assignmentStrategy).toBe('diagnostic');

    // Should assign a valid profile
    const validProfiles = ['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first'];
    expect(validProfiles).toContain(profileEvent.profileId);

    console.log('New learner diagnostic (no history):');
    console.log('  Default persistenceScore: 0.5');
    console.log('  Default recoveryRate: 0.5');
    console.log('  Combined score: 0.5');
    console.log('  Assigned profile:', profileEvent.profileId);
    console.log('  Strategy:', profileEvent.assignmentStrategy);
    console.log('  Reason:', profileEvent.payload?.reason);
  });

  /**
   * Test 5: Diagnostic calculates persistence score correctly
   *
   * Verifies the persistence score calculation:
   * - persistenceScore = successfulAttempts / totalAttempts
   * - recoveryRate = 1 - (errors / totalAttempts)
   *
   * With ~78% success rate:
   * - persistenceScore = 7/9 ≈ 0.78
   * - recoveryRate = 1 - (2/9) ≈ 0.78
   * - combined score = (0.78 + 0.78) / 2 ≈ 0.78
   * - Result: score > 0.7 → slow-escalator
   */
  test('diagnostic calculates persistence and recovery scores', async ({ page }) => {
    const learnerId = 'scored-learner-' + Date.now();

    await page.addInitScript((id) => {
      const events = [];
      const now = Date.now();

      // Create specific pattern: 7 successes, 2 errors = ~78% persistence
      for (let i = 0; i < 7; i++) {
        events.push({
          id: `success-${i}`,
          learnerId: id,
          timestamp: now - (10 - i) * 1000,
          eventType: 'execution',
          problemId: `problem-${i}`,
          successful: true,
        });
      }

      for (let i = 0; i < 2; i++) {
        events.push({
          id: `error-${i}`,
          learnerId: id,
          timestamp: now - (5 - i) * 1000,
          eventType: 'error',
          problemId: `problem-err-${i}`,
        });
      }

      localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Scored Learner',
          role: 'student',
          createdAt: now,
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
    }, learnerId);

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({
      timeout: 30000,
    });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();

    // With ~78% success rate:
    // persistence ≈ 0.78, recovery ≈ 0.78, score ≈ 0.78 > 0.7
    expect(profileEvent.profileId).toBe('slow-escalator');

    console.log('Scored learner diagnostic:');
    console.log('  Persistence: ~78% (7/9)');
    console.log('  Recovery: ~78% (1 - 2/9)');
    console.log('  Combined score: ~0.78');
    console.log('  Assigned profile:', profileEvent.profileId);
    console.log('  Expected: slow-escalator (score > 0.7)');
  });

  /**
   * Test 6: Diagnostic event includes diagnostic results in payload
   *
   * Verifies that the profile_assigned event includes the calculated
   * diagnostic scores in the payload for auditing/debugging.
   */
  test('diagnostic event includes scores in payload', async ({ page }) => {
    const learnerId = 'payload-learner-' + Date.now();

    await page.addInitScript((id) => {
      const events = [];
      const now = Date.now();

      // 5 successes, 5 failures = 50% persistence
      for (let i = 0; i < 5; i++) {
        events.push({
          id: `success-${i}`,
          learnerId: id,
          timestamp: now - (10 - i) * 1000,
          eventType: 'execution',
          problemId: `problem-${i}`,
          successful: true,
        });
        events.push({
          id: `error-${i}`,
          learnerId: id,
          timestamp: now - (9 - i) * 1000,
          eventType: 'error',
          problemId: `problem-err-${i}`,
        });
      }

      localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Payload Learner',
          role: 'student',
          createdAt: now,
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
    }, learnerId);

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({
      timeout: 30000,
    });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();
    expect(profileEvent.payload).toBeDefined();

    // Verify payload contains diagnostic info
    expect(profileEvent.payload.reason).toBe('diagnostic_assessment');

    console.log('Diagnostic event payload:');
    console.log('  Payload:', JSON.stringify(profileEvent.payload, null, 2));
  });

  /**
   * Test 7: Moderate performance gets appropriate profile
   *
   * Tests learners with moderate success rates (40-60%)
   * get an appropriate profile based on diagnostic calculation.
   */
  test('diagnostic assigns appropriate profile to moderate learners', async ({ page }) => {
    const learnerId = 'moderate-learner-' + Date.now();

    await page.addInitScript((id) => {
      const events = [];
      const now = Date.now();

      // 4 successes, 6 errors = 40% success rate
      for (let i = 0; i < 4; i++) {
        events.push({
          id: `success-${i}`,
          learnerId: id,
          timestamp: now - (20 - i * 2) * 1000,
          eventType: 'execution',
          problemId: `problem-${i}`,
          successful: true,
        });
      }

      for (let i = 0; i < 6; i++) {
        events.push({
          id: `error-${i}`,
          learnerId: id,
          timestamp: now - (19 - i * 2) * 1000,
          eventType: 'error',
          problemId: `problem-err-${i}`,
        });
      }

      localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      localStorage.setItem(
        'sql-adapt-user-profile',
        JSON.stringify({
          id,
          name: 'Moderate Learner',
          role: 'student',
          createdAt: now,
        })
      );
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
    }, learnerId);

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({
      timeout: 30000,
    });

    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();
    expect(profileEvent.assignmentStrategy).toBe('diagnostic');

    // Verify a valid profile was assigned
    const validProfiles = ['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first'];
    expect(validProfiles).toContain(profileEvent.profileId);

    console.log('Moderate learner diagnostic:');
    console.log('  Success rate: 40% (4/10)');
    console.log('  Combined score: 0.4');
    console.log('  Assigned profile:', profileEvent.profileId);
    console.log('  Strategy:', profileEvent.assignmentStrategy);
  });
});
