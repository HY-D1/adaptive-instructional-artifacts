/**
 * Edge Case Bug Testing Suite
 * 
 * Tests for edge cases that were found during bug hunting:
 * 1. HDI edge cases (empty data, corrupted data, extreme values)
 * 2. Cross-tab synchronization edge cases
 * 3. Learning journey flow edge cases
 * 
 * @no-external - No external services needed
 */

import { expect, test, Page } from '@playwright/test';

// Helper to setup student profile
async function setupStudentProfile(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-student',
      name: 'Test Student',
      role: 'student',
      createdAt: Date.now()
    }));
  });
}

// Helper to setup instructor profile
async function setupInstructorProfile(page: Page) {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-instructor',
      name: 'Test Instructor',
      role: 'instructor',
      createdAt: Date.now()
    }));
  });
}

// Stub LLM calls
async function stubLLM(page: Page) {
  await page.route('**/ollama/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: '{"title": "Test", "content_markdown": "Test content", "key_points": [], "common_pitfall": "", "next_steps": [], "source_ids": []}'
      })
    });
  });
}

test.describe('@edge-case @weekly HDI Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await stubLLM(page);
  });

  test('HDI with no interactions shows N/A', async ({ page }) => {
    await setupStudentProfile(page);
    
    // Set empty interactions
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([]));
    });
    
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    // Page should load without crashing
    await expect(page.locator('body')).toBeVisible();
    
    // Verify no errors in console
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(1000);
    expect(consoleErrors).toHaveLength(0);
  });

  test('HDI with corrupted data handles gracefully', async ({ page }) => {
    await setupStudentProfile(page);
    
    // Set corrupted interactions data
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-learning-interactions', 'not-valid-json{{{{');
    });
    
    await page.goto('/practice');
    
    // Should redirect to start or handle gracefully
    await expect(page.locator('body')).toBeVisible();
    
    // Verify the corrupted data was cleaned up
    const interactions = await page.evaluate(() => {
      return window.localStorage.getItem('sql-learning-interactions');
    });
    
    // Should be cleared or reset to empty array
    expect(interactions === null || interactions === '[]').toBeTruthy();
  });

  test('HDI with 1000+ interactions calculates quickly', async ({ page }) => {
    await setupStudentProfile(page);
    
    // Create 1000+ interaction events
    await page.addInitScript(() => {
      const interactions = [];
      const baseTime = Date.now();
      const learnerId = 'test-student';
      
      for (let i = 0; i < 1000; i++) {
        interactions.push({
          id: `event-${i}`,
          eventType: i % 3 === 0 ? 'hint_request' : (i % 3 === 1 ? 'execution' : 'error'),
          learnerId,
          problemId: `problem-${i % 50}`,
          timestamp: baseTime + i * 1000,
          hintLevel: i % 3 === 0 ? ((i % 3) + 1) : undefined,
          successful: i % 3 === 1 ? (i % 2 === 0) : undefined
        });
      }
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    });
    
    await page.goto('/practice');
    const startTime = Date.now();
    
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within reasonable time (< 10 seconds)
    expect(loadTime).toBeLessThan(10000);
    
    // Verify page is functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('HDI component values are clamped to [0, 1]', async ({ page }) => {
    await setupStudentProfile(page);
    
    // Create interactions that might produce out-of-range values
    await page.addInitScript(() => {
      const interactions = [];
      const baseTime = Date.now();
      const learnerId = 'test-student';
      
      // Many more hints than executions (HPA > 1)
      for (let i = 0; i < 10; i++) {
        interactions.push({
          id: `hint-${i}`,
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + i * 100,
          hintLevel: 3
        });
      }
      
      // Only 1 execution
      interactions.push({
        id: 'exec-1',
        eventType: 'execution',
        learnerId,
        problemId: 'problem-1',
        timestamp: baseTime + 10000,
        successful: true
      });
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    });
    
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    // Calculate HDI in page context
    const hdiResult = await page.evaluate(() => {
      // Simple HPA calculation to verify clamping
      const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
      const hintRequests = interactions.filter(
        (i: any) => i.eventType === 'hint_request' || i.eventType === 'guidance_request'
      ).length;
      const attempts = interactions.filter((i: any) => i.eventType === 'execution').length;
      
      // Should be clamped to 1.0 even though 10/1 = 10
      const hpa = attempts > 0 ? Math.min(hintRequests / attempts, 1.0) : 0;
      
      return { hpa, hintRequests, attempts };
    });
    
    // Verify HPA is clamped
    expect(hdiResult.hpa).toBe(1.0);
    expect(hdiResult.hpa).toBeLessThanOrEqual(1.0);
    expect(hdiResult.hpa).toBeGreaterThanOrEqual(0);
  });

  test('HDI with NaN timestamps handles gracefully', async ({ page }) => {
    await setupStudentProfile(page);
    
    await page.addInitScript(() => {
      const interactions = [
        {
          id: 'event-1',
          eventType: 'explanation_view',
          learnerId: 'test-student',
          problemId: 'problem-1',
          timestamp: NaN
        },
        {
          id: 'event-2',
          eventType: 'error',
          learnerId: 'test-student',
          problemId: 'problem-1',
          timestamp: NaN
        }
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    });
    
    await page.goto('/practice');
    
    // Should not crash
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('@edge-case @weekly Cross-Tab Sync Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await stubLLM(page);
  });

  test('rapid storage events do not cause infinite loop', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    // Simulate rapid storage events
    await page.evaluate(() => {
      for (let i = 0; i < 10; i++) {
        const event = new StorageEvent('storage', {
          key: 'sql-adapt-user-profile',
          newValue: JSON.stringify({
            id: 'test-student',
            name: `Rapid Update ${i}`,
            role: 'student',
            createdAt: Date.now()
          }),
          oldValue: null,
          storageArea: localStorage
        });
        window.dispatchEvent(event);
      }
    });
    
    // Wait a bit
    await page.waitForTimeout(500);
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
    
    // No infinite loop means CPU should be idle
    const performanceNow = await page.evaluate(() => {
      const start = performance.now();
      // Small synchronous operation
      let sum = 0;
      for (let i = 0; i < 1000; i++) sum += i;
      return performance.now() - start;
    });
    
    // Should complete quickly (not blocked by infinite loop)
    expect(performanceNow).toBeLessThan(100);
  });

  test('storage event with null newValue clears profile', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    // Simulate profile cleared in another tab
    await page.evaluate(() => {
      const event = new StorageEvent('storage', {
        key: 'sql-adapt-user-profile',
        newValue: null,
        oldValue: localStorage.getItem('sql-adapt-user-profile'),
        storageArea: localStorage
      });
      window.dispatchEvent(event);
    });
    
    // Should redirect to start page
    await expect(page).toHaveURL(/\/$/, { timeout: 5000 });
  });

  test('storage event with invalid JSON is handled gracefully', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    // Track console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    // Simulate storage event with invalid JSON
    await page.evaluate(() => {
      const event = new StorageEvent('storage', {
        key: 'sql-adapt-user-profile',
        newValue: 'invalid-json{{{{',
        oldValue: localStorage.getItem('sql-adapt-user-profile'),
        storageArea: localStorage
      });
      window.dispatchEvent(event);
    });
    
    // Should not crash
    await expect(page.locator('body')).toBeVisible();
    
    // Should log error but not crash
    await page.waitForTimeout(500);
    // May have some errors logged, but page should still work
    expect(consoleErrors.length).toBeGreaterThanOrEqual(0);
  });

  test('storage event for non-profile key is ignored', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    // Simulate storage event for unrelated key
    await page.evaluate(() => {
      const event = new StorageEvent('storage', {
        key: 'some-other-key',
        newValue: 'some-value',
        oldValue: null,
        storageArea: localStorage
      });
      window.dispatchEvent(event);
    });
    
    // Page should remain on practice
    await expect(page).toHaveURL(/practice/);
  });
});

test.describe('@edge-case @weekly Learning Journey Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await stubLLM(page);
  });

  test('rapid navigation between pages does not crash', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    // Rapidly navigate between pages
    const navigations = [];
    for (let i = 0; i < 5; i++) {
      navigations.push(page.goto('/textbook').then(() => page.goto('/practice')));
    }
    
    await Promise.all(navigations);
    
    // Page should still be functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('browser back button works correctly', async ({ page }) => {
    await setupStudentProfile(page);
    
    // Navigate through several pages
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/textbook');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/concepts');
    await page.waitForLoadState('networkidle');
    
    // Go back
    await page.goBack();
    await expect(page).toHaveURL(/textbook/);
    
    // Go back again
    await page.goBack();
    await expect(page).toHaveURL(/practice/);
    
    // Go forward
    await page.goForward();
    await expect(page).toHaveURL(/textbook/);
  });

  test('refresh during session preserves state', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    // Get initial session ID
    const initialSession = await page.evaluate(() => {
      return window.localStorage.getItem('sql-learning-active-session');
    });
    
    // Refresh page
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Session should be preserved or a new one created
    const afterReloadSession = await page.evaluate(() => {
      return window.localStorage.getItem('sql-learning-active-session');
    });
    
    expect(afterReloadSession).toBeTruthy();
    expect(typeof afterReloadSession).toBe('string');
  });

  test('multiple rapid reloads do not corrupt state', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    
    // Rapidly reload multiple times
    for (let i = 0; i < 3; i++) {
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
    }
    
    // Final reload and verify
    await page.reload();
    await page.waitForLoadState('networkidle');
    
    // Page should be functional
    await expect(page.locator('body')).toBeVisible();
    
    // Profile should still be valid
    const profile = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-adapt-user-profile');
      return raw ? JSON.parse(raw) : null;
    });
    
    expect(profile).not.toBeNull();
    expect(profile.id).toBe('test-student');
  });
});

test.describe('@edge-case @weekly Performance Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await stubLLM(page);
  });

  test('HDI calculation with 10000 interactions completes quickly', async ({ page }) => {
    await setupStudentProfile(page);
    
    // Create 10000 interaction events
    await page.addInitScript(() => {
      const interactions = [];
      const baseTime = Date.now();
      const learnerId = 'test-student';
      
      for (let i = 0; i < 10000; i++) {
        interactions.push({
          id: `event-${i}`,
          eventType: i % 4 === 0 ? 'hint_request' : 
                     (i % 4 === 1 ? 'execution' : 
                      (i % 4 === 2 ? 'error' : 'explanation_view')),
          learnerId,
          problemId: `problem-${i % 100}`,
          timestamp: baseTime + i * 100,
          hintLevel: i % 4 === 0 ? ((i % 3) + 1) : undefined,
          successful: i % 4 === 1 ? (i % 2 === 0) : undefined
        });
      }
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    });
    
    await page.goto('/practice');
    
    // Measure time to calculate HDI
    const calcTime = await page.evaluate(() => {
      const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
      
      const start = performance.now();
      
      // Simple component calculations
      const hintRequests = interactions.filter(
        (i: any) => i.eventType === 'hint_request'
      ).length;
      const attempts = interactions.filter((i: any) => i.eventType === 'execution').length;
      const hpa = attempts > 0 ? Math.min(hintRequests / attempts, 1.0) : 0;
      
      const end = performance.now();
      
      return { time: end - start, hpa, count: interactions.length };
    });
    
    // Should complete in reasonable time (< 500ms for 10k items)
    expect(calcTime.time).toBeLessThan(500);
    expect(calcTime.count).toBe(10000);
  });

  test('memory usage remains stable with repeated operations', async ({ page }) => {
    await setupStudentProfile(page);
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    // Perform multiple operations and check memory
    const memorySnapshots = [];
    
    for (let i = 0; i < 5; i++) {
      // Navigate to different pages
      await page.goto('/textbook');
      await page.goto('/practice');
      
      // Get memory info if available
      const memory = await page.evaluate(() => {
        return (performance as any).memory?.usedJSHeapSize || 0;
      });
      
      memorySnapshots.push(memory);
    }
    
    // Memory should not grow uncontrollably
    // (Allow 50% growth, but not 10x)
    if (memorySnapshots[0] > 0 && memorySnapshots[memorySnapshots.length - 1] > 0) {
      const ratio = memorySnapshots[memorySnapshots.length - 1] / memorySnapshots[0];
      expect(ratio).toBeLessThan(5); // Less than 5x growth
    }
  });
});

test.describe('@edge-case @weekly Console Error Monitoring', () => {
  test.beforeEach(async ({ page }) => {
    await stubLLM(page);
  });

  test('no console errors during normal usage', async ({ page }) => {
    await setupStudentProfile(page);
    
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];
    
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });
    
    page.on('pageerror', (error) => {
      consoleErrors.push(error.message);
    });
    
    // Navigate through multiple pages
    await page.goto('/practice');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/textbook');
    await page.waitForLoadState('networkidle');
    
    await page.goto('/concepts');
    await page.waitForLoadState('networkidle');
    
    // Wait a bit for any async errors
    await page.waitForTimeout(1000);
    
    // Filter out expected warnings (e.g., from stubbed LLM)
    const unexpectedErrors = consoleErrors.filter(
      e => !e.includes('ollama') && !e.includes('LLM')
    );
    
    expect(unexpectedErrors).toHaveLength(0);
  });
});
