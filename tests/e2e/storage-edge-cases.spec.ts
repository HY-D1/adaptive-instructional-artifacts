import { test, expect } from '@playwright/test';

/**
 * Storage Edge Cases Tests
 * 
 * Tests for edge cases and boundary conditions in localStorage handling.
 * 
 * Tagged with @no-external @weekly for GitHub Actions compatibility.
 */

test.describe('@no-external @weekly Storage Edge Cases', () => {
  // ============================================================================
  // Null/Undefined Values
  // ============================================================================

  test('handles string "null" as value', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'null');
      localStorage.setItem('sql-adapt-debug-strategy', 'null');
      localStorage.setItem('sql-adapt-preview-mode', 'null');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite null strings
    await expect(page).toHaveURL(/\/practice/);
  });

  test('handles string "undefined" as value', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', 'undefined');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });
    expect(profile).toBeNull();
  });

  // ============================================================================
  // Empty String Values
  // ============================================================================

  test('handles empty string values', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', '');
      localStorage.setItem('sql-adapt-debug-strategy', '');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite empty strings
    await expect(page).toHaveURL(/\/practice/);
  });

  // ============================================================================
  // Case Sensitivity
  // ============================================================================

  test('profile IDs are case-sensitive', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'Fast-Escalator');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite wrong case
    await expect(page).toHaveURL(/\/practice/);
  });

  test('strategies are case-sensitive', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 'BANDIT');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite wrong case
    await expect(page).toHaveURL(/\/practice/);
  });

  // ============================================================================
  // Whitespace Issues
  // ============================================================================

  test('handles leading/trailing whitespace', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', '  static  ');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite whitespace
    await expect(page).toHaveURL(/\/practice/);
  });

  test('handles whitespace-only values', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', '   ');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite whitespace-only value
    await expect(page).toHaveURL(/\/practice/);
  });

  // ============================================================================
  // Very Long Values
  // ============================================================================

  test('handles extremely long profile ID', async ({ page }) => {
    const longValue = 'a'.repeat(10000);
    
    await page.addInitScript((value) => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-profile', value);
    }, longValue);

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite long invalid value
    await expect(page.locator('body')).toBeVisible();
  });

  // ============================================================================
  // Special Characters
  // ============================================================================

  test('handles XSS attempt in profile fields', async ({ page }) => {
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

    const stored = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    if (stored) {
      const parsed = JSON.parse(stored);
      expect(parsed.id).toBeDefined();
    }
  });

  test('handles unicode and emoji in profile', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-用户-123',
        name: 'Test 🎉 User ñ',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    expect(profile).not.toBeNull();
    const parsed = JSON.parse(profile!);
    expect(parsed.id).toBe('test-用户-123');
    expect(parsed.name).toBe('Test 🎉 User ñ');
  });

  // ============================================================================
  // Malformed JSON
  // ============================================================================

  test('handles truncated JSON', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', '{"id": "test", "name": ');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    expect(profile).toBeNull();
  });

  test('handles array instead of object', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', '["id", "name", "role", "createdAt"]');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    expect(profile).toBeNull();
  });

  test('handles empty object', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', '{}');
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    expect(profile).toBeNull();
  });

  // ============================================================================
  // Quota Exceeded
  // ============================================================================

  test('handles localStorage quota exceeded gracefully', async ({ page }) => {
    await page.addInitScript(() => {
      try {
        for (let i = 0; i < 1000; i++) {
          localStorage.setItem(`garbage-${i}`, 'x'.repeat(10000));
        }
      } catch (e) {
        // Expected to fail
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('body')).toBeVisible();
  });

  // ============================================================================
  // Boundary Values
  // ============================================================================

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

    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });
    
    expect(profile).not.toBeNull();
    const parsed = JSON.parse(profile!);
    expect(parsed.createdAt).toBe(0);
  });

  test('handles future timestamp', async ({ page }) => {
    const future = Date.now() + 1000 * 60 * 60 * 24 * 365;
    
    await page.addInitScript((ts) => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: ts
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    }, future);

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    const profile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-user-profile');
    });

    if (profile) {
      const parsed = JSON.parse(profile);
      expect(parsed.createdAt).toBe(future);
    }
  });

  test('handles single character values', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      localStorage.setItem('sql-adapt-debug-strategy', 's');
    });

    await page.goto('/practice');
    await page.waitForLoadState('networkidle');

    // App should work despite single char strategy
    await expect(page).toHaveURL(/\/practice/);
  });

  // ============================================================================
  // Rapid Changes
  // ============================================================================

  test('handles rapid localStorage changes', async ({ page }) => {
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

    const strategy = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-strategy');
    });

    expect(strategy).toBe('static');
  });
});
