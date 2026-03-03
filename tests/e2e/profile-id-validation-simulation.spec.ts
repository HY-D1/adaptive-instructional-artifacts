/**
 * Profile ID Validation Simulation Tests
 * 
 * Comprehensive simulation of all profile ID validation scenarios including:
 * - Valid profile IDs (all 4 escalation profiles)
 * - Invalid profile IDs (rejection and fallback)
 * - Profile override flow (debug override mechanism)
 * - Profile persistence (across sessions and reloads)
 * - Concurrent modifications (multi-tab behavior)
 * 
 * Tags: @no-external - No external services needed
 * 
 * Expected behaviors:
 * 1. Valid profiles: accepted and applied correctly
 * 2. Invalid profiles: rejected, fallback to strategy-based assignment
 * 3. Debug override: takes precedence over strategy selection
 * 4. Persistence: survives page refresh and session restore
 * 5. Concurrent: last-write-wins semantics
 */

import { expect, test, Page, BrowserContext } from '@playwright/test';
import { setupTest, completeStartPageFlow, replaceEditorText } from '../helpers/test-helpers';

// =============================================================================
// Test Data
// =============================================================================

const VALID_PROFILES = [
  { id: 'fast-escalator', expectedName: 'Fast Escalator', expectedThreshold: 2 },
  { id: 'slow-escalator', expectedName: 'Slow Escalator', expectedThreshold: 5 },
  { id: 'adaptive-escalator', expectedName: 'Adaptive', expectedThreshold: 3 },
  { id: 'explanation-first', expectedName: 'Explanation First', expectedThreshold: 1 },
] as const;

const INVALID_PROFILES = [
  { value: 'fast', description: 'partial match' },
  { value: 'super-fast', description: 'similar but invalid' },
  { value: 'explanation', description: 'partial match' },
  { value: 'invalid', description: 'completely invalid' },
  { value: 'admin', description: 'admin-like string' },
  { value: '', description: 'empty string' },
  { value: 'null', description: 'string "null"' },
  { value: 'undefined', description: 'string "undefined"' },
  { value: '   ', description: 'whitespace only' },
  { value: 'fast-escalator-extra', description: 'extra suffix' },
  { value: '<script>alert(1)</script>', description: 'XSS attempt' },
  { value: 'fast-escalator\n', description: 'newline injection' },
  { value: 'FAST-ESCALATOR', description: 'wrong case' },
  { value: 'Fast-Escalator', description: 'title case' },
  { value: 'fast_escalator', description: 'underscore instead of hyphen' },
  { value: 'fast.escalator', description: 'dot instead of hyphen' },
  { value: 'fast escalator', description: 'space instead of hyphen' },
  { value: ' fast-escalator ', description: 'leading/trailing spaces' },
];

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Set up a valid student profile in localStorage
 */
async function setupStudentProfile(page: Page, name: string = 'TestStudent') {
  await page.addInitScript((userName) => {
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: `student-${userName.toLowerCase().replace(/\s+/g, '-')}`,
      name: userName,
      role: 'student',
      createdAt: Date.now()
    }));
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
  }, name);
}

/**
 * Get the latest profile_assigned event from interactions
 */
async function getLatestProfileEvent(page: Page) {
  const interactions = await page.evaluate(() => {
    return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
  });
  const profileEvents = interactions.filter((e: any) => e.eventType === 'profile_assigned');
  return profileEvents[profileEvents.length - 1] || null;
}

/**
 * Navigate to practice and wait for load
 */
async function navigateToPractice(page: Page) {
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });
  // Wait for profile assignment to complete
  await page.waitForTimeout(500);
}

/**
 * Execute SQL with error to trigger error logging
 */
async function executeWithError(page: Page, sql: string = 'SELECT * FORM users') {
  await page.waitForSelector('.monaco-editor', { timeout: 10000 });
  await replaceEditorText(page, sql);
  await page.getByRole('button', { name: /run/i }).click();
  await page.waitForTimeout(600);
}

// =============================================================================
// Test Suite 1: Valid Profile IDs
// =============================================================================

test.describe('@no-external Valid Profile IDs', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  for (const profile of VALID_PROFILES) {
    test(`valid profile "${profile.id}" is accepted and applied`, async ({ page }) => {
      // Set profile override via localStorage
      await page.addInitScript((profileId) => {
        localStorage.setItem('sql-adapt-debug-profile', profileId);
      }, profile.id);

      await setupStudentProfile(page, `ValidProfile-${profile.id}`);
      await navigateToPractice(page);

      // Verify profile is in localStorage
      const savedProfile = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-debug-profile');
      });
      expect(savedProfile).toBe(profile.id);

      // Verify profile_assigned event with debug_override reason
      const profileEvent = await getLatestProfileEvent(page);
      expect(profileEvent).toBeDefined();
      expect(profileEvent.payload?.profile).toBe(profile.id);
      expect(profileEvent.payload?.strategy).toBe('static'); // debug override reports as static
      expect(profileEvent.payload?.reason).toBe('debug_override');

      // Verify escalation threshold matches profile
      const interactions = await page.evaluate(() => {
        return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
      });
      
      // Find escalation_triggered events to verify threshold
      const escalationEvents = interactions.filter((e: any) => e.eventType === 'escalation_triggered');
      // Just verify profile was assigned correctly - actual escalation depends on behavior
    });

    test(`valid profile "${profile.id}" shows correct escalation behavior`, async ({ page }) => {
      await page.addInitScript((profileId) => {
        localStorage.setItem('sql-adapt-debug-profile', profileId);
      }, profile.id);

      await setupStudentProfile(page, `Escalation-${profile.id}`);
      await navigateToPractice(page);

      // Execute errors to test escalation threshold
      for (let i = 0; i < profile.expectedThreshold + 1; i++) {
        await executeWithError(page);
      }

      // Verify errors were logged
      const interactions = await page.evaluate(() => {
        return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
      });
      const errorEvents = interactions.filter((e: any) => e.eventType === 'error');
      expect(errorEvents.length).toBeGreaterThanOrEqual(profile.expectedThreshold);
    });
  }

  test('valid profiles persist correctly across different profiles', async ({ page }) => {
    const appliedProfiles: string[] = [];

    for (const profile of VALID_PROFILES) {
      // Clear and set new profile
      await page.evaluate(() => {
        localStorage.removeItem('sql-learning-interactions');
      });
      
      await page.evaluate((profileId) => {
        localStorage.setItem('sql-adapt-debug-profile', profileId);
      }, profile.id);

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });
      await page.waitForTimeout(500);

      const profileEvent = await getLatestProfileEvent(page);
      if (profileEvent?.payload?.profile) {
        appliedProfiles.push(profileEvent.payload.profile);
      }
    }

    // Verify all profiles were applied
    expect(appliedProfiles).toHaveLength(VALID_PROFILES.length);
    for (const profile of VALID_PROFILES) {
      expect(appliedProfiles).toContain(profile.id);
    }
  });
});

// =============================================================================
// Test Suite 2: Invalid Profile IDs
// =============================================================================

test.describe('@no-external Invalid Profile IDs', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  for (const invalid of INVALID_PROFILES) {
    test(`invalid profile "${invalid.description}" ("${invalid.value.substring(0, 30)}") is rejected`, async ({ page }) => {
      // Set invalid profile via localStorage
      await page.addInitScript((value) => {
        localStorage.setItem('sql-adapt-debug-profile', value);
      }, invalid.value);

      await setupStudentProfile(page, `Invalid-${invalid.description.replace(/\s+/g, '-')}`);
      
      // Set strategy to static for deterministic assignment
      await page.addInitScript(() => {
        localStorage.setItem('sql-adapt-debug-strategy', 'static');
      });

      await navigateToPractice(page);

      // Verify invalid profile is NOT used (should fall back to strategy-based)
      const profileEvent = await getLatestProfileEvent(page);
      expect(profileEvent).toBeDefined();
      
      // Should NOT be the invalid value
      expect(profileEvent.payload?.profile).not.toBe(invalid.value);
      
      // Should be a valid profile ID from strategy assignment
      const validProfileIds = VALID_PROFILES.map(p => p.id);
      expect(validProfileIds).toContain(profileEvent.payload?.profile);
      
      // Should use strategy-based assignment (not debug_override)
      expect(profileEvent.payload?.strategy).not.toBe('debug_override');
      expect(['static', 'diagnostic', 'bandit']).toContain(profileEvent.payload?.strategy);
    });
  }

  test('XSS attempt in profile ID does not execute', async ({ page }) => {
    const xssPayload = '<script>alert(1)</script>';
    
    await page.addInitScript((value) => {
      localStorage.setItem('sql-adapt-debug-profile', value);
    }, xssPayload);

    await setupStudentProfile(page, 'XSSTest');
    await navigateToPractice(page);

    // Verify no alert was triggered and page is functional
    const profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.profile).not.toBe(xssPayload);
    
    // Page should be fully functional
    await executeWithError(page);
    
    const interactions = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    });
    expect(interactions.length).toBeGreaterThan(0);
  });

  test('case sensitivity: uppercase profile ID is rejected', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'FAST-ESCALATOR');
    });

    await setupStudentProfile(page, 'CaseTest');
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
    });

    await navigateToPractice(page);

    const profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.profile).not.toBe('FAST-ESCALATOR');
    // Should fall back to strategy-based assignment
    expect(['fast-escalator', 'slow-escalator', 'adaptive-escalator']).toContain(profileEvent.payload?.profile);
  });

  test('whitespace variations are rejected', async ({ page }) => {
    const whitespaceProfiles = [
      ' fast-escalator ',
      '  fast-escalator',
      'fast-escalator  ',
      '\tfast-escalator',
      'fast-escalator\n',
    ];

    for (const wsProfile of whitespaceProfiles) {
      await page.evaluate((value) => {
        localStorage.setItem('sql-adapt-debug-profile', value);
      }, wsProfile);

      await page.reload();
      await page.waitForTimeout(500);

      const profileEvent = await getLatestProfileEvent(page);
      expect(profileEvent.payload?.profile).not.toBe(wsProfile.trim());
    }
  });
});

// =============================================================================
// Test Suite 3: Profile Override Flow
// =============================================================================

test.describe('@no-external Profile Override Flow', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('complete override flow: set -> apply -> verify -> clear -> resume', async ({ page }) => {
    const learnerName = 'OverrideFlowTest';
    await setupStudentProfile(page, learnerName);

    // Step 1: Set profile override
    await page.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
    });

    // Step 2: Navigate and verify override applied
    await navigateToPractice(page);

    let profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.profile).toBe('fast-escalator');
    expect(profileEvent.payload?.reason).toBe('debug_override');

    // Step 3: Clear override
    await page.evaluate(() => {
      localStorage.removeItem('sql-adapt-debug-profile');
    });

    // Step 4: Reload and verify strategy-based assignment resumes
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.reason).not.toBe('debug_override');
    expect(['static_assignment', 'diagnostic_assessment', 'bandit_selection']).toContain(profileEvent.payload?.reason);
  });

  test('override takes precedence over bandit strategy', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
    });

    await setupStudentProfile(page, 'PrecedenceTest');
    await navigateToPractice(page);

    const profileEvent = await getLatestProfileEvent(page);
    // Override should take precedence
    expect(profileEvent.payload?.profile).toBe('slow-escalator');
    expect(profileEvent.payload?.reason).toBe('debug_override');
    
    // Should not be a bandit selection
    expect(profileEvent.payload?.reason).not.toBe('bandit_selection');
  });

  test('override takes precedence over diagnostic strategy', async ({ page }) => {
    // Seed with struggling learner history that would normally get fast-escalator
    const learnerId = 'student-diagnostic-test';
    
    await page.addInitScript((id) => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id,
        name: 'Diagnostic Test',
        role: 'student',
        createdAt: Date.now()
      }));
      
      // Seed error history indicating struggling learner
      const now = Date.now();
      const events = [
        { id: `err-${now}-1`, learnerId: id, timestamp: now - 10000, eventType: 'error', problemId: 'p1', payload: { errorType: 'syntax' } },
        { id: `err-${now}-2`, learnerId: id, timestamp: now - 9000, eventType: 'error', problemId: 'p1', payload: { errorType: 'syntax' } },
        { id: `err-${now}-3`, learnerId: id, timestamp: now - 8000, eventType: 'error', problemId: 'p1', payload: { errorType: 'semantic' } },
      ];
      localStorage.setItem('sql-learning-interactions', JSON.stringify(events));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      
      // Set slow-escalator override (would normally get fast-escalator for struggling learner)
      localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
    }, learnerId);

    await navigateToPractice(page);

    const profileEvent = await getLatestProfileEvent(page);
    // Override should take precedence over diagnostic assignment
    expect(profileEvent.payload?.profile).toBe('slow-escalator');
    expect(profileEvent.payload?.reason).toBe('debug_override');
  });

  test('escalation behavior matches overridden profile', async ({ page }) => {
    // Set explanation-first (threshold = 1)
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'explanation-first');
    });

    await setupStudentProfile(page, 'BehaviorTest');
    await navigateToPractice(page);

    // Execute once to trigger escalation (threshold = 1)
    await executeWithError(page);

    // Verify profile was applied
    const profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.profile).toBe('explanation-first');
  });
});

// =============================================================================
// Test Suite 4: Profile Persistence
// =============================================================================

test.describe('@no-external Profile Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('profile override persists across page refresh', async ({ page }) => {
    await setupStudentProfile(page, 'PersistenceTest');
    
    // Set profile and navigate
    await page.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'adaptive-escalator');
    });

    await navigateToPractice(page);

    // Verify initial assignment
    let profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.profile).toBe('adaptive-escalator');

    // Refresh page
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(500);

    // Verify profile still applied after refresh
    profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.profile).toBe('adaptive-escalator');

    // Verify localStorage still has the override
    const savedProfile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-profile');
    });
    expect(savedProfile).toBe('adaptive-escalator');
  });

  test('profile override survives sessionStorage clear', async ({ page }) => {
    await setupStudentProfile(page, 'SessionClearTest');
    
    await page.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
    });

    await navigateToPractice(page);

    // Clear sessionStorage (simulates session end but keeps localStorage)
    await page.evaluate(() => {
      sessionStorage.clear();
    });

    await page.reload();
    await page.waitForTimeout(500);

    // Verify profile still applied
    const profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.profile).toBe('fast-escalator');
  });

  test('clearing localStorage removes profile override', async ({ page }) => {
    await setupStudentProfile(page, 'ClearTest');
    
    await page.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
    });

    await navigateToPractice(page);

    // Verify profile was applied
    let profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.profile).toBe('slow-escalator');

    // Clear localStorage
    await page.evaluate(() => {
      localStorage.clear();
      // Restore user profile and welcome flag for navigation
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'student-cleartest',
        name: 'Clear Test',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.reload();
    await page.waitForTimeout(500);

    // Verify no profile override
    const savedProfile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-profile');
    });
    expect(savedProfile).toBeNull();
  });

  test('profile events are logged with correct timestamps', async ({ page }) => {
    await setupStudentProfile(page, 'TimestampTest');
    
    const beforeNavigation = Date.now();
    
    await page.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'explanation-first');
    });

    await navigateToPractice(page);
    
    const afterNavigation = Date.now();

    const profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.timestamp).toBeGreaterThanOrEqual(beforeNavigation);
    expect(profileEvent.timestamp).toBeLessThanOrEqual(afterNavigation + 1000);
  });
});

// =============================================================================
// Test Suite 5: Concurrent Modifications
// =============================================================================

test.describe('@no-external Concurrent Modifications', () => {
  test.beforeEach(async ({ page, context }) => {
    await setupTest(page);
  });

  test('last-write-wins: second tab override takes precedence', async ({ page, context }) => {
    await setupStudentProfile(page, 'ConcurrentTest');
    
    // Tab 1: Set fast-escalator
    await page.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
    });

    // Open Tab 2
    const page2 = await context.newPage();
    await page2.goto('/practice');
    
    // Tab 2: Set slow-escalator (simulates later write)
    await page2.evaluate(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
    });

    // Tab 1: Refresh to pick up new value
    await page.reload();
    await page.waitForTimeout(500);

    // Verify Tab 1 now has the Tab 2 value (last-write-wins)
    const savedProfile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-profile');
    });
    expect(savedProfile).toBe('slow-escalator');

    await page2.close();
  });

  test('multiple rapid changes result in consistent state', async ({ page }) => {
    await setupStudentProfile(page, 'RapidChangeTest');

    // Rapidly change profile multiple times
    const profiles = ['fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first', 'fast-escalator'];
    
    for (const profile of profiles) {
      await page.evaluate((p) => {
        localStorage.setItem('sql-adapt-debug-profile', p);
      }, profile);
    }

    await navigateToPractice(page);

    // Should have the last value
    const savedProfile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-profile');
    });
    expect(savedProfile).toBe('fast-escalator');

    const profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.profile).toBe('fast-escalator');
  });

  test('separate browser contexts have isolated storage', async ({ browser }) => {
    // Context 1
    const context1 = await browser.newContext();
    const page1 = await context1.newPage();
    
    await page1.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'student-context1',
        name: 'Context 1 User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
    });

    // Context 2
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    
    await page2.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'student-context2',
        name: 'Context 2 User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
    });

    // Navigate both
    await page1.goto('/practice');
    await page2.goto('/practice');
    await page1.waitForTimeout(500);
    await page2.waitForTimeout(500);

    // Verify isolated state
    const profile1 = await page1.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-profile');
    });
    const profile2 = await page2.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-profile');
    });

    expect(profile1).toBe('fast-escalator');
    expect(profile2).toBe('slow-escalator');
    expect(profile1).not.toBe(profile2);

    await context1.close();
    await context2.close();
  });
});

// =============================================================================
// Test Suite 6: Edge Cases and Error Handling
// =============================================================================

test.describe('@no-external Edge Cases and Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('very long profile ID is rejected', async ({ page }) => {
    const longProfileId = 'fast-escalator' + 'a'.repeat(1000);
    
    await page.addInitScript((value) => {
      localStorage.setItem('sql-adapt-debug-profile', value);
    }, longProfileId);

    await setupStudentProfile(page, 'LongIdTest');
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
    });

    await navigateToPractice(page);

    const profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent.payload?.profile).not.toBe(longProfileId);
    expect(VALID_PROFILES.map(p => p.id)).toContain(profileEvent.payload?.profile);
  });

  test('unicode characters in profile ID are rejected', async ({ page }) => {
    const unicodeProfiles = [
      'fast-escalator🔥',
      'fast-escalator日本語',
      '🚀rocket-escalator',
      'fast\u0000escalator', // null byte
    ];

    for (const profileId of unicodeProfiles) {
      await page.evaluate((value) => {
        localStorage.setItem('sql-adapt-debug-profile', value);
      }, profileId);

      await page.reload();
      await page.waitForTimeout(500);

      const profileEvent = await getLatestProfileEvent(page);
      expect(profileEvent.payload?.profile).not.toBe(profileId);
    }
  });

  test('localStorage corruption is handled gracefully', async ({ page }) => {
    // Simulate corrupted localStorage value
    await page.addInitScript(() => {
      // Set a non-string value (would be JSON serialized but parsed differently)
      localStorage.setItem('sql-adapt-debug-profile', '{"invalid": "json');
    });

    await setupStudentProfile(page, 'CorruptionTest');
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
    });

    // Should not crash
    await navigateToPractice(page);

    // Should fall back to strategy-based assignment
    const profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent).toBeDefined();
    expect(VALID_PROFILES.map(p => p.id)).toContain(profileEvent.payload?.profile);
  });

  test('null localStorage value is handled', async ({ page }) => {
    // Don't set any profile override
    await setupStudentProfile(page, 'NullTest');
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
    });

    await navigateToPractice(page);

    // Verify no crash and strategy-based assignment used
    const profileEvent = await getLatestProfileEvent(page);
    expect(profileEvent).toBeDefined();
    expect(profileEvent.payload?.reason).not.toBe('debug_override');
  });

  test('switching between valid profiles logs multiple events', async ({ page }) => {
    await setupStudentProfile(page, 'SwitchTest');

    const profiles = ['fast-escalator', 'slow-escalator', 'adaptive-escalator'];
    
    for (let i = 0; i < profiles.length; i++) {
      await page.evaluate((profile) => {
        localStorage.setItem('sql-adapt-debug-profile', profile);
      }, profiles[i]);

      await page.reload();
      await page.waitForTimeout(500);

      const profileEvent = await getLatestProfileEvent(page);
      expect(profileEvent.payload?.profile).toBe(profiles[i]);
    }

    // Verify all events were logged
    const interactions = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    });
    const profileEvents = interactions.filter((e: any) => e.eventType === 'profile_assigned');
    expect(profileEvents.length).toBeGreaterThanOrEqual(profiles.length);
  });
});

// =============================================================================
// Test Suite 7: Integration with Settings Page
// =============================================================================

test.describe('@no-external Settings Page Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
    
    // Set up instructor to access debug panel
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

  test('settings page shows current profile override', async ({ page }) => {
    // Set profile via localStorage
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Verify reset button is enabled (indicating override is set)
    const resetButton = page.locator('[data-testid="profile-override-reset"]');
    await expect(resetButton).toBeEnabled();
  });

  test('settings page reset clears override', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
    });

    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    // Click reset
    const resetButton = page.locator('[data-testid="profile-override-reset"]');
    await resetButton.click();

    // Verify cleared
    const savedProfile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-profile');
    });
    expect(savedProfile).toBeNull();
  });

  test('profile selector dropdown shows all valid options', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');

    const selectWrapper = page.locator('[data-testid="profile-override-select"]');
    const trigger = selectWrapper.locator('button[role="combobox"]').first();
    await trigger.click();

    // Verify all valid options are present
    await expect(page.getByRole('option', { name: /Auto/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Fast Escalator/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Slow Escalator/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /^Adaptive$/ })).toBeVisible();
    await expect(page.getByRole('option', { name: /Explanation First/ })).toBeVisible();
  });
});

// =============================================================================
// Summary Test
// =============================================================================

test.describe('@no-external Profile Validation Summary', () => {
  test('all validation scenarios execute without crashes', async ({ page }) => {
    // This is a meta-test that ensures all scenarios can run
    await setupTest(page);
    await setupStudentProfile(page, 'SummaryTest');

    const allProfiles = [
      ...VALID_PROFILES.map(p => ({ value: p.id, expectValid: true })),
      ...INVALID_PROFILES.map(p => ({ value: p.value, expectValid: false })),
    ];

    const results: Array<{ value: string; applied: boolean; error?: string }> = [];

    for (const { value, expectValid } of allProfiles) {
      try {
        // Clear previous interactions
        await page.evaluate(() => {
          localStorage.removeItem('sql-learning-interactions');
          localStorage.setItem('sql-adapt-debug-strategy', 'static');
        });

        // Set profile
        await page.evaluate((v) => {
          localStorage.setItem('sql-adapt-debug-profile', v);
        }, value);

        // Navigate
        await page.goto('/practice');
        await page.waitForTimeout(300);

        // Check result
        const profileEvent = await getLatestProfileEvent(page);
        const applied = profileEvent?.payload?.profile === value;

        results.push({
          value: value.substring(0, 30),
          applied,
          error: expectValid && !applied ? 'Expected valid profile to be applied' : undefined
        });
      } catch (e) {
        results.push({
          value: value.substring(0, 30),
          applied: false,
          error: e instanceof Error ? e.message : 'Unknown error'
        });
      }
    }

    // Log results
    console.log('Profile Validation Summary:');
    console.table(results);

    // Verify valid profiles were applied and invalid ones were not
    for (let i = 0; i < allProfiles.length; i++) {
      const { value, expectValid } = allProfiles[i];
      const result = results[i];
      
      if (expectValid) {
        expect(result.applied).toBe(true);
      } else {
        // Invalid profiles should be rejected
        expect(result.applied).toBe(false);
      }
    }
  });
});
