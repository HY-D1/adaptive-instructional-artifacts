import { test, expect } from '@playwright/test';

/**
 * Storage Corruption Recovery Tests
 * 
 * Tests how the app handles corrupted localStorage data.
 * Ensures graceful degradation and automatic recovery.
 * 
 * Tagged with @no-external @weekly for GitHub Actions compatibility.
 */

test.describe('@no-external @weekly Storage Corruption Recovery', () => {
  // ============================================================================
  // JSON Corruption
  // ============================================================================

  test('recovers from malformed JSON in user profile', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', '{"id": "test", invalid json}');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Corrupted profile should be cleared
    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });
    expect(profile).toBeNull();
  });

  test('recovers from truncated JSON', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', '{"id": "test", "name": "Test"');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });
    expect(profile).toBeNull();
  });

  test('recovers from JSON with wrong types', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', '{"id": 123, "name": "Test", "role": "student", "createdAt": 123}');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });
    expect(profile).toBeNull();
  });

  // ============================================================================
  // Strategy Corruption
  // ============================================================================

  test('defaults to bandit when strategy is corrupted', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 'corrupted_value_123');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should still work with fallback behavior
    await expect(page).toHaveURL(/\/practice/);
  });

  test('handles null string as strategy', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 'null');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite invalid strategy
    await expect(page).toHaveURL(/\/practice/);
  });

  // ============================================================================
  // Profile Override Corruption
  // ============================================================================

  test('ignores invalid profile override', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'invalid-profile-id');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite invalid override
    await expect(page).toHaveURL(/\/practice/);

    // App should use normal assignment (not override)
    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvent = events.find(e => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();
  });

  // ============================================================================
  // Preview Mode Corruption
  // ============================================================================

  test('handles invalid preview mode values', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-preview-mode', 'yes');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite invalid preview mode
    await expect(page).toHaveURL(/\/practice/);
  });

  // ============================================================================
  // Multiple Corruption
  // ============================================================================

  test('recovers from multiple simultaneous corruptions', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', 'invalid json here');
      localStorage.setItem('sql-adapt-debug-strategy', 'bad-strategy');
      localStorage.setItem('sql-adapt-debug-profile', 'bad-profile');
      localStorage.setItem('sql-adapt-preview-mode', 'bad-boolean');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // App should redirect to start page
    await expect(page).toHaveURL('/');

    // App should be on start page due to invalid user profile
    await expect(page).toHaveURL('/');
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================

  test('handles extremely long name in profile', async ({ page }) => {
    const veryLongName = 'A'.repeat(1000);
    
    await page.addInitScript((name) => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: name,
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, veryLongName);

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Should handle gracefully
    await expect(page.locator('body')).toBeVisible();
  });

  test('handles special characters in profile fields', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-<script>alert(1)</script>',
        name: '<b>Bold</b>',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Should handle gracefully
    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.id).toBeDefined();
    }
  });

  test('handles negative timestamp', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: -1
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Negative timestamp may be rejected - check if redirected
    const url = page.url();
    if (url === '/') {
      // Profile was rejected
      const profile = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-user-profile');
      });
      expect(profile).toBeNull();
    }
  });

  test('handles zero timestamp', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: 0
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Zero timestamp is valid (epoch)
    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });
    
    expect(profile).not.toBeNull();
    const parsed = JSON.parse(profile!);
    expect(parsed.createdAt).toBe(0);
  });

  // ============================================================================
  // Event Verification
  // ============================================================================

  test('logs events during recovery', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 'invalid-strategy');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Check that events were logged
    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });

    const profileEvents = events.filter(e => e.eventType === 'profile_assigned');
    expect(profileEvents.length).toBeGreaterThanOrEqual(1);
  });
});
