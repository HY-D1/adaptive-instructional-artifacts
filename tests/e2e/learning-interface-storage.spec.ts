import { expect, test } from '@playwright/test';

/**
 * LearningInterface Storage Validation Integration Tests
 * 
 * Verifies:
 * - Safe getter usage for strategy and profile
 * - Profile assignment flow with all strategies
 * - Override precedence
 * - Event logging correctness
 * - Error handling for corrupted/invalid data
 */

test.describe('@weekly LearningInterface Storage Validation', () => {
  test.beforeEach(async ({ page }) => {
    // Clear all localStorage to ensure clean state
    await page.addInitScript(() => {
      localStorage.clear();
    });
  });

  test('happy path: default bandit strategy assigns profile correctly', async ({ page }) => {
    // Arrange: Set up valid user with no strategy override
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // No strategy set - should default to 'bandit'
    });

    // Act: Navigate to practice page
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Assert: Profile badge should show one of the bandit profiles
    const profileBadge = page.locator('[data-testid="profile-badge"]').first();
    await expect(profileBadge).toBeVisible({ timeout: 5000 });
    
    // Verify profile_assigned event was logged
    const profileAssignedEvent = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.find((i: Record<string, unknown>) => i.eventType === 'profile_assigned');
    });
    
    expect(profileAssignedEvent).toBeDefined();
    expect(profileAssignedEvent.assignmentStrategy).toBe('bandit');
    expect(profileAssignedEvent.profileId).toMatch(/fast-escalator|slow-escalator|adaptive-escalator|explanation-first/);
    expect(profileAssignedEvent.selectionReason).toBe('bandit_selection');
  });

  test('static strategy: assigns profile deterministically by learnerId', async ({ page }) => {
    // Arrange: Set static strategy
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-123',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
    });

    // Act
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Assert: Should log profile_assigned with static_assignment reason
    const profileAssignedEvent = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.find((i: Record<string, unknown>) => i.eventType === 'profile_assigned');
    });
    
    expect(profileAssignedEvent).toBeDefined();
    expect(profileAssignedEvent.assignmentStrategy).toBe('static');
    expect(profileAssignedEvent.selectionReason).toBe('static_assignment');
    expect(profileAssignedEvent.profileId).toBeDefined();
  });

  test('diagnostic strategy: analyzes learner history for assignment', async ({ page }) => {
    // Arrange: Set diagnostic strategy and pre-populate some interactions
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'learner-456',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 'diagnostic');
      
      // Add some mock interaction history
      const interactions = [
        {
          id: 'event-1',
          learnerId: 'learner-456',
          timestamp: Date.now() - 10000,
          eventType: 'execution',
          problemId: 'problem-1',
          successful: true
        },
        {
          id: 'event-2',
          learnerId: 'learner-456',
          timestamp: Date.now() - 5000,
          eventType: 'error',
          problemId: 'problem-1',
          successful: false
        }
      ];
      localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    });

    // Act
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Assert
    const profileAssignedEvent = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.find((i: Record<string, unknown>) => i.eventType === 'profile_assigned');
    });
    
    expect(profileAssignedEvent).toBeDefined();
    expect(profileAssignedEvent.assignmentStrategy).toBe('diagnostic');
    expect(profileAssignedEvent.selectionReason).toBe('diagnostic_assessment');
  });

  test('profile override: takes precedence over strategy', async ({ page }) => {
    // Arrange: Set both strategy and override
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
      localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator'); // Override
    });

    // Act
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Assert: Should use override profile
    const profileAssignedEvent = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.find((i: Record<string, unknown>) => i.eventType === 'profile_assigned');
    });
    
    expect(profileAssignedEvent).toBeDefined();
    expect(profileAssignedEvent.profileId).toBe('fast-escalator');
    expect(profileAssignedEvent.assignmentStrategy).toBe('static'); // Strategy recorded as 'static' for override
    expect(profileAssignedEvent.selectionReason).toBe('debug_override');
  });

  test('invalid profile override: ignored gracefully', async ({ page }) => {
    // Arrange: Set invalid override
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'invalid-profile-id'); // Invalid
    });

    // Act - Should not throw
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Assert: Page loads successfully with fallback profile
    const profileAssignedEvent = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.find((i: Record<string, unknown>) => i.eventType === 'profile_assigned');
    });
    
    expect(profileAssignedEvent).toBeDefined();
    // Should fall back to bandit selection since override is invalid
    expect(profileAssignedEvent.selectionReason).toBe('bandit_selection');
  });

  test('invalid strategy: falls back to bandit', async ({ page }) => {
    // Arrange: Set invalid strategy
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 'invalid-strategy'); // Invalid
    });

    // Act
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Assert: Falls back to bandit
    const profileAssignedEvent = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.find((i: Record<string, unknown>) => i.eventType === 'profile_assigned');
    });
    
    expect(profileAssignedEvent).toBeDefined();
    expect(profileAssignedEvent.assignmentStrategy).toBe('bandit');
  });

  test('bandit strategy: logs arm selection event', async ({ page }) => {
    // Arrange
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Default is bandit
    });

    // Act
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Assert: Should log bandit_arm_selected event
    const banditEvent = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.find((i: Record<string, unknown>) => i.eventType === 'bandit_arm_selected');
    });
    
    expect(banditEvent).toBeDefined();
    expect(banditEvent.selectedArm).toMatch(/aggressive|conservative|adaptive|explanation-first/);
    expect(banditEvent.selectionMethod).toBe('thompson_sampling');
  });

  test('escalation profile passed to HintSystem correctly', async ({ page }) => {
    // Arrange: Set a specific profile
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
    });

    // Act
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Get a hint to trigger escalation logic
    const hintButton = page.locator('button:has-text("Get Hint")').first();
    if (await hintButton.isVisible().catch(() => false)) {
      await hintButton.click();
      
      // Fast escalator should escalate after 2 hints
      await hintButton.click();
      
      // Assert: Should show explanation after rungExhausted threshold
      const explanation = page.locator('[data-testid="explanation-panel"]').first();
      await expect(explanation).toBeVisible({ timeout: 10000 });
    }
  });

  test('localStorage quota exceeded: handles gracefully', async ({ page }) => {
    // Arrange: Mock localStorage to throw quota error
    await page.addInitScript(() => {
      const originalSetItem = localStorage.setItem.bind(localStorage);
      let callCount = 0;
      localStorage.setItem = (key: string, value: string) => {
        // Fail on the first interaction save attempt
        if (key === 'sql-learning-interactions' && callCount++ === 0) {
          const error = new Error('QuotaExceededError');
          (error as Error & { name: string }).name = 'QuotaExceededError';
          throw error;
        }
        return originalSetItem(key, value);
      };
      
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    // Act - Should not crash
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Assert: Page still functional
    const header = page.locator('h1:has-text("Practice SQL")');
    await expect(header).toBeVisible();
  });

  test('profile persists across problem changes', async ({ page }) => {
    // Arrange
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
    });

    // Act
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Get initial profile
    const initialProfile = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.find((i: Record<string, unknown>) => i.eventType === 'profile_assigned');
    });

    // Change problem
    const problemSelect = page.locator('[data-testid="problem-select-trigger"]').first();
    if (await problemSelect.isVisible().catch(() => false)) {
      await problemSelect.click();
      const option = page.locator('[role="option"]').nth(1);
      await option.click();

      // Assert: Same profile should be used (not reassigned)
      const eventsAfterChange = await page.evaluate(() => {
        const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
        return interactions.filter((i: Record<string, unknown>) => i.eventType === 'profile_assigned');
      });
      
      // Should only have one profile_assigned event (not re-assigned on problem change)
      expect(eventsAfterChange.length).toBe(1);
      expect(eventsAfterChange[0].profileId).toBe(initialProfile.profileId);
    }
  });

  test('clearing override reverts to strategy-based assignment', async ({ page }) => {
    // Arrange: Start with override
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      localStorage.setItem('sql-adapt-debug-profile', 'explanation-first');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Clear override
    await page.evaluate(() => {
      localStorage.removeItem('sql-adapt-debug-profile');
    });

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Assert: New profile_assigned event with bandit selection
    const events = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.filter((i: Record<string, unknown>) => i.eventType === 'profile_assigned');
    });
    
    expect(events.length).toBe(2); // One before, one after reload
    expect(events[1].assignmentStrategy).toBe('bandit');
  });
});

test.describe('@weekly LearningInterface Event Properties', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-learner-789',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
  });

  test('profile_assigned event has all required properties', async ({ page }) => {
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    const event = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.find((i: Record<string, unknown>) => i.eventType === 'profile_assigned');
    });

    // Required properties per type definition
    expect(event.id).toBeDefined();
    expect(event.learnerId).toBe('test-learner-789');
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.eventType).toBe('profile_assigned');
    expect(event.problemId).toBeDefined();
    expect(event.profileId).toMatch(/fast-escalator|slow-escalator|adaptive-escalator|explanation-first/);
    expect(event.assignmentStrategy).toMatch(/static|diagnostic|bandit/);
    expect(event.selectionReason).toBeDefined();
    expect(['debug_override', 'static_assignment', 'diagnostic_assessment', 'bandit_selection']).toContain(event.selectionReason);
  });

  test('bandit_arm_selected event has all required properties', async ({ page }) => {
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    const event = await page.evaluate(() => {
      const interactions = JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
      return interactions.find((i: Record<string, unknown>) => i.eventType === 'bandit_arm_selected');
    });

    expect(event).toBeDefined();
    expect(event.id).toBeDefined();
    expect(event.learnerId).toBe('test-learner-789');
    expect(event.timestamp).toBeGreaterThan(0);
    expect(event.eventType).toBe('bandit_arm_selected');
    expect(event.selectedArm).toMatch(/aggressive|conservative|adaptive|explanation-first/);
    expect(event.selectionMethod).toBe('thompson_sampling');
    expect(event.policyVersion).toBe('bandit-arm-v1');
  });
});
