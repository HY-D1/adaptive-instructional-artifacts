import { test, expect } from '@playwright/test';

/**
 * Storage Validation Tests
 * 
 * Tests for localStorage validation to prevent corrupted state.
 * These tests verify the app handles invalid data gracefully.
 * 
 * Tagged with @no-external @weekly for GitHub Actions compatibility.
 */

test.describe('@no-external @weekly Storage Validation', () => {
  // ============================================================================
  // Profile ID Validation
  // ============================================================================

  test('valid profile override is used', async ({ page }) => {
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

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Valid profile should be preserved
    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-profile');
    });

    expect(stored).toBe('fast-escalator');
  });

  test('invalid profile override is ignored', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'invalid-profile');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite invalid override (uses normal assignment)
    await expect(page).toHaveURL(/\/practice/);
    
    // Verify events show non-debug assignment
    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    
    const profileEvent = events.find(e => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();
    // Should NOT be debug_override since invalid profile was ignored
    expect(profileEvent?.details?.selectionReason).not.toBe('debug_override');
  });

  test('empty profile override is ignored', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', '');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite empty override
    await expect(page).toHaveURL(/\/practice/);
  });

  // ============================================================================
  // Strategy Validation
  // ============================================================================

  test('valid strategy is preserved', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 'static');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-strategy');
    });

    expect(stored).toBe('static');
  });

  test('invalid strategy falls back to bandit behavior', async ({ page }) => {
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

    // App should still work - falls back to bandit
    await expect(page).toHaveURL(/\/practice/);
    
    // Should have bandit-related events
    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    
    const profileEvent = events.find(e => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();
  });

  test('missing strategy uses bandit by default', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work with default bandit strategy
    await expect(page).toHaveURL(/\/practice/);
    
    // Should have profile assignment event
    const events = await page.evaluate(() => {
      return JSON.parse(localStorage.getItem('sql-learning-interactions') || '[]');
    });
    
    const profileEvent = events.find(e => e.eventType === 'profile_assigned');
    expect(profileEvent).toBeDefined();
  });

  // ============================================================================
  // User Profile Validation
  // ============================================================================

  test('valid user profile allows access', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'user-123',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Should be on practice page
    await expect(page).toHaveURL(/\/practice/);

    // Profile should exist
    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    expect(stored).not.toBeNull();
  });

  test('instructor profile allows access to instructor routes', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'instructor-123',
        name: 'Instructor User',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/instructor-dashboard');
    await page.waitForLoadState('networkidle');

    // Should be on instructor dashboard
    await expect(page).toHaveURL(/\/instructor-dashboard/);
  });

  test('corrupted user profile redirects to start', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', 'not-valid-json');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Should redirect to start page
    await expect(page).toHaveURL('/');

    // Profile should be cleared
    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    expect(stored).toBeNull();
  });

  test('missing user profile redirects to start', async ({ page }) => {
    // No profile set
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Should redirect to start page
    await expect(page).toHaveURL('/');
  });

  test('profile with missing fields is rejected', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'user-123'
        // missing name, role, createdAt
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Should redirect to start page
    await expect(page).toHaveURL('/');

    // Profile should be cleared
    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    expect(stored).toBeNull();
  });

  test('profile with invalid role is rejected', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'user-123',
        name: 'Test User',
        role: 'admin',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Should redirect to start page
    await expect(page).toHaveURL('/');

    // Profile should be cleared
    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    expect(stored).toBeNull();
  });

  test('profile with empty name is rejected', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'user-123',
        name: '',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Should redirect to start page
    await expect(page).toHaveURL('/');
  });

  test('profile with invalid createdAt is rejected', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'user-123',
        name: 'Test User',
        role: 'student',
        createdAt: 'not-a-number'
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // Should redirect to start page
    await expect(page).toHaveURL('/');

    // Profile should be cleared
    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    expect(stored).toBeNull();
  });

  // ============================================================================
  // Preview Mode Validation
  // ============================================================================

  test('valid preview mode true is preserved', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-preview-mode', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-preview-mode');
    });

    expect(stored).toBe('true');
  });

  test('valid preview mode false is preserved', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-preview-mode', 'false');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-preview-mode');
    });

    expect(stored).toBe('false');
  });

  test('invalid preview mode is handled gracefully', async ({ page }) => {
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
});
