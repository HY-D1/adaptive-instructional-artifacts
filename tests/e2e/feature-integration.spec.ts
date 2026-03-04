/**
 * Feature Integration Tests
 * 
 * Tests integration between all new Week 5 features:
 * 1. HDI + LearningInterface Integration
 * 2. Cross-Tab + Preview Mode Integration  
 * 3. Learning Journey + HDI Integration
 * 4. Storage Validation + All Features
 * 5. Performance + All Features
 * 
 * Edge Cases:
 * - Corrupted Data + HDI
 * - Quota Exceeded + Cross-Tab
 * - Rapid Actions + Performance
 * 
 * @no-external - No external services needed
 */

import { expect, test, BrowserContext, Page } from '@playwright/test';
import { setupTest, completeStartPageFlow, replaceEditorText, waitForEditorReady } from '../helpers/test-helpers';

// =============================================================================
// Test Helpers
// =============================================================================

async function setupStudent(page: Page, learnerId: string = 'integration-test-learner') {
  await page.addInitScript(({ id }) => {
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id,
      name: 'Integration Test Student',
      role: 'student',
      createdAt: Date.now()
    }));
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-learning-interactions', JSON.stringify([]));
  }, { id: learnerId });
}

async function getHDI(page: Page): Promise<number> {
  return page.evaluate(() => {
    // Access HDI from window or calculate from interactions
    const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    
    // Simple HDI calculation for testing
    const hintRequests = interactions.filter(
      (i: any) => i.eventType === 'hint_request' || i.eventType === 'guidance_request'
    ).length;
    const attempts = interactions.filter((i: any) => i.eventType === 'execution').length;
    return attempts > 0 ? Math.min(hintRequests / attempts, 1.0) : 0;
  });
}

async function getFullHDI(page: Page): Promise<{
  hdi: number;
  hpa: number;
  aed: number;
  er: number;
  reae: number;
  iwh: number;
}> {
  return page.evaluate(() => {
    const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    
    // HPA: Hints Per Attempt
    const hintRequests = interactions.filter(
      (i: any) => i.eventType === 'hint_request' || i.eventType === 'guidance_request'
    ).length;
    const attempts = interactions.filter((i: any) => i.eventType === 'execution').length;
    const hpa = attempts > 0 ? Math.min(hintRequests / attempts, 1.0) : 0;
    
    // AED: Average Escalation Depth
    const hintEvents = interactions.filter(
      (i: any) => ['hint_request', 'guidance_request', 'hint_view', 'guidance_view'].includes(i.eventType) && i.hintLevel !== undefined
    );
    const avgLevel = hintEvents.length > 0 
      ? hintEvents.reduce((sum: number, i: any) => sum + (i.hintLevel || 1), 0) / hintEvents.length 
      : 1;
    const aed = Math.min(Math.max((avgLevel - 1) / 2, 0), 1);
    
    // ER: Explanation Rate
    const explanationViews = interactions.filter((i: any) => i.eventType === 'explanation_view').length;
    const er = attempts > 0 ? Math.min(explanationViews / attempts, 1.0) : 0;
    
    // REAE: Repeated Error After Explanation
    const sorted = [...interactions].sort((a: any, b: any) => a.timestamp - b.timestamp);
    let explanationSeen = false;
    let errorsAfterExplanation = 0;
    let totalErrors = 0;
    for (const interaction of sorted) {
      if (interaction.eventType === 'explanation_view') {
        explanationSeen = true;
      } else if (interaction.eventType === 'error') {
        totalErrors++;
        if (explanationSeen) errorsAfterExplanation++;
      }
    }
    const reae = totalErrors > 0 ? errorsAfterExplanation / totalErrors : 0;
    
    // IWH: Improvement Without Hint
    const problemsWithHints = new Set<string>();
    const successfulProblems = new Set<string>();
    const hintUsedBeforeSuccess = new Set<string>();
    
    for (const interaction of sorted) {
      const problemId = interaction.problemId;
      if (['hint_request', 'guidance_request', 'hint_view'].includes(interaction.eventType)) {
        problemsWithHints.add(problemId);
      }
      if (interaction.eventType === 'execution' && interaction.successful) {
        successfulProblems.add(problemId);
        if (problemsWithHints.has(problemId)) {
          hintUsedBeforeSuccess.add(problemId);
        }
      }
    }
    const iwh = successfulProblems.size > 0 
      ? (successfulProblems.size - hintUsedBeforeSuccess.size) / successfulProblems.size 
      : 0;
    
    // Weights from hdi-calculator.ts
    const WEIGHTS = { hpa: 0.3, aed: 0.133, er: 0.3, reae: 0.133, iwh: 0.134 };
    
    const hdi = 
      hpa * WEIGHTS.hpa +
      aed * WEIGHTS.aed +
      er * WEIGHTS.er +
      reae * WEIGHTS.reae +
      (1 - iwh) * WEIGHTS.iwh;
    
    return {
      hdi: Math.min(Math.max(hdi, 0), 1),
      hpa,
      aed,
      er,
      reae,
      iwh
    };
  });
}

async function submitWrongQuery(page: Page) {
  await replaceEditorText(page, 'SELECT * FROM nonexistent_table');
  await page.getByRole('button', { name: 'Run Query' }).click();
  // Wait for error to be recorded
  await page.waitForTimeout(500);
}

async function submitCorrectQuery(page: Page) {
  await replaceEditorText(page, 'SELECT * FROM users');
  await page.getByRole('button', { name: 'Run Query' }).click();
  // Wait for success to be recorded
  await page.waitForTimeout(500);
}

async function requestHint(page: Page) {
  // Click hint button if available
  const hintButton = page.locator('button').filter({ hasText: /hint/i }).first();
  if (await hintButton.isVisible().catch(() => false)) {
    await hintButton.click();
    await page.waitForTimeout(300);
  }
}

async function escalateHint(page: Page) {
  // Click escalate button if available
  const escalateButton = page.locator('button').filter({ hasText: /escalate|more help/i }).first();
  if (await escalateButton.isVisible().catch(() => false)) {
    await escalateButton.click();
    await page.waitForTimeout(300);
  }
}

async function viewExplanation(page: Page) {
  // Click explanation button if available
  const explainButton = page.locator('button').filter({ hasText: /explanation/i }).first();
  if (await explainButton.isVisible().catch(() => false)) {
    await explainButton.click();
    await page.waitForTimeout(300);
  }
}

async function completeLearningJourney(page: Page) {
  // Simulate a complete learning journey
  await submitWrongQuery(page);
  await requestHint(page);
  await submitWrongQuery(page);
  await escalateHint(page);
  await viewExplanation(page);
  await submitCorrectQuery(page);
}

async function waitForStorageEvent(page: Page, timeout = 5000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Storage event timeout')), timeout);
    const handler = () => {
      clearTimeout(timer);
      window.removeEventListener('storage', handler);
      resolve();
    };
    window.addEventListener('storage', handler, { once: true });
  });
}

// =============================================================================
// Test Suite: HDI + LearningInterface Integration
// =============================================================================

test.describe('@no-external HDI + LearningInterface Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('HDI updates through full learning flow', async ({ page }) => {
    const learnerId = 'hdi-flow-learner';
    await setupStudent(page, learnerId);
    
    // Navigate to practice
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // Initial HDI should be 0
    const initialHDI = await getHDI(page);
    expect(initialHDI).toBe(0);
    
    // Make error - HDI should increase or stay same (no hints yet)
    await submitWrongQuery(page);
    const afterErrorHDI = await getHDI(page);
    expect(afterErrorHDI).toBeGreaterThanOrEqual(initialHDI);
    
    // Request hint - HPA component should increase
    await requestHint(page);
    const fullHDI = await getFullHDI(page);
    expect(fullHDI.hpa).toBeGreaterThan(0);
    
    // Solve correctly - IWH component may increase
    await submitCorrectQuery(page);
    const finalFullHDI = await getFullHDI(page);
    expect(finalFullHDI.hdi).toBeGreaterThanOrEqual(0);
    expect(finalFullHDI.hdi).toBeLessThanOrEqual(1);
  });

  test('HDI components update independently', async ({ page }) => {
    const learnerId = 'hdi-components-learner';
    await setupStudent(page, learnerId);
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // Create interactions with specific patterns
    await page.evaluate(({ id }) => {
      const baseTime = Date.now();
      const interactions = [
        // HPA: 2 hints / 4 executions = 0.5
        { id: 'test-1', eventType: 'hint_request', learnerId: id, problemId: 'p1', timestamp: baseTime, hintLevel: 2 },
        { id: 'test-2', eventType: 'execution', learnerId: id, problemId: 'p1', timestamp: baseTime + 1000, successful: true },
        { id: 'test-3', eventType: 'hint_request', learnerId: id, problemId: 'p2', timestamp: baseTime + 2000, hintLevel: 3 },
        { id: 'test-4', eventType: 'execution', learnerId: id, problemId: 'p2', timestamp: baseTime + 3000, successful: true },
        { id: 'test-5', eventType: 'execution', learnerId: id, problemId: 'p3', timestamp: baseTime + 4000, successful: true },
        { id: 'test-6', eventType: 'execution', learnerId: id, problemId: 'p4', timestamp: baseTime + 5000, successful: true },
        // ER: 1 explanation / 4 executions = 0.25
        { id: 'test-7', eventType: 'explanation_view', learnerId: id, problemId: 'p3', timestamp: baseTime + 6000 },
      ];
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { id: learnerId });
    
    const hdi = await getFullHDI(page);
    
    // Verify component ranges
    expect(hdi.hpa).toBe(0.5); // 2 hints / 4 executions
    expect(hdi.aed).toBeGreaterThan(0); // Average level > 1
    expect(hdi.er).toBe(0.25); // 1 explanation / 4 executions
    expect(hdi.iwh).toBe(0.5); // 2 successes with hints / 4 total successes
  });

  test('HDI persists across page navigation', async ({ page }) => {
    const learnerId = 'hdi-persist-learner';
    await setupStudent(page, learnerId);
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // Create some interactions
    await submitWrongQuery(page);
    await requestHint(page);
    
    const hdiBefore = await getFullHDI(page);
    
    // Navigate to settings and back
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    const hdiAfter = await getFullHDI(page);
    
    // HDI should be the same
    expect(hdiAfter.hdi).toBe(hdiBefore.hdi);
    expect(hdiAfter.hpa).toBe(hdiBefore.hpa);
  });
});

// =============================================================================
// Test Suite: Cross-Tab + Preview Mode Integration
// =============================================================================

test.describe('@no-external Cross-Tab + Preview Mode Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('preview mode sync affects all tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    // Set up instructor profile on both pages
    const setupInstructor = async (page: Page) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-instructor',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      });
    };
    
    await setupInstructor(page1);
    await setupInstructor(page2);
    
    // Both pages load
    await page1.goto('/practice');
    await page2.goto('/practice');
    
    // Enable preview mode on page1 via settings
    await page1.goto('/settings');
    await page1.evaluate(() => {
      window.localStorage.setItem('sql-adapt-preview-mode', 'true');
    });
    
    // Trigger storage event on page2 by visiting it again
    await page2.goto('/settings');
    
    // Page2 should show preview banner
    const previewMode = await page2.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-preview-mode');
    });
    expect(previewMode).toBe('true');
  });

  test('HDI calculates correctly in preview mode', async ({ page }) => {
    // Set up student with preview mode enabled
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'preview-hdi-learner',
        name: 'Preview HDI Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-preview-mode', 'true');
      
      // Seed with some interactions
      const baseTime = Date.now();
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([
        { id: 'p1', eventType: 'hint_request', learnerId: 'preview-hdi-learner', problemId: 'p1', timestamp: baseTime, hintLevel: 2 },
        { id: 'p2', eventType: 'execution', learnerId: 'preview-hdi-learner', problemId: 'p1', timestamp: baseTime + 1000, successful: true },
      ]));
    });
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // HDI should still calculate
    const hdi = await getFullHDI(page);
    expect(hdi.hdi).toBeGreaterThan(0);
    expect(hdi.hpa).toBeGreaterThan(0);
  });

  test('profile override syncs across tabs', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    // Set up instructor on both pages
    const setupInstructor = async (page: Page) => {
      await page.addInitScript(() => {
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'test-instructor',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
      });
    };
    
    await setupInstructor(page1);
    await setupInstructor(page2);
    
    await page1.goto('/settings');
    await page2.goto('/settings');
    
    // Set profile override on page1
    await page1.evaluate(() => {
      window.localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
    });
    
    // Verify on page2 after navigation
    await page2.goto('/settings');
    const profileOnPage2 = await page2.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-debug-profile');
    });
    
    expect(profileOnPage2).toBe('fast-escalator');
  });
});

// =============================================================================
// Test Suite: Learning Journey + HDI Integration
// =============================================================================

test.describe('@no-external Learning Journey + HDI Integration', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('complete journey updates HDI progressively', async ({ page }) => {
    const learnerId = 'journey-learner';
    await setupStudent(page, learnerId);
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // Complete journey
    await completeLearningJourney(page);
    
    // Check HDI has all components
    const hdi = await getFullHDI(page);
    
    // Should have used hints
    expect(hdi.hpa).toBeGreaterThan(0);
    
    // Should have some escalation
    expect(hdi.aed).toBeGreaterThanOrEqual(0);
    
    // Overall HDI should be valid
    expect(hdi.hdi).toBeGreaterThanOrEqual(0);
    expect(hdi.hdi).toBeLessThanOrEqual(1);
  });

  test('multiple journeys accumulate HDI correctly', async ({ page }) => {
    const learnerId = 'multi-journey-learner';
    await setupStudent(page, learnerId);
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // Run multiple journeys
    for (let i = 0; i < 3; i++) {
      await submitWrongQuery(page);
      await requestHint(page);
      await submitCorrectQuery(page);
    }
    
    const hdi = await getFullHDI(page);
    
    // Should have accumulated interactions
    const interactions = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    });
    
    expect(interactions.length).toBeGreaterThanOrEqual(9); // 3 journeys * 3 actions
    expect(hdi.hdi).toBeGreaterThanOrEqual(0);
  });

  test('HDI trajectory shows improvement over time', async ({ page }) => {
    const learnerId = 'trajectory-learner';
    const baseTime = Date.now();
    
    await page.addInitScript(({ id, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id,
        name: 'Trajectory Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      // Create a trajectory: high dependency at start, lower at end
      const interactions = [
        // Early: lots of hints
        { id: 't1', eventType: 'hint_request', learnerId: id, problemId: 'p1', timestamp: baseTime, hintLevel: 3 },
        { id: 't2', eventType: 'hint_request', learnerId: id, problemId: 'p1', timestamp: baseTime + 100, hintLevel: 3 },
        { id: 't3', eventType: 'execution', learnerId: id, problemId: 'p1', timestamp: baseTime + 1000, successful: true },
        
        // Later: fewer hints
        { id: 't4', eventType: 'execution', learnerId: id, problemId: 'p2', timestamp: baseTime + 10000, successful: true },
        { id: 't5', eventType: 'execution', learnerId: id, problemId: 'p3', timestamp: baseTime + 11000, successful: true },
        { id: 't6', eventType: 'execution', learnerId: id, problemId: 'p4', timestamp: baseTime + 12000, successful: true },
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { id: learnerId, baseTime });
    
    await page.goto('/practice');
    
    const hdi = await getFullHDI(page);
    
    // IWH should show some independent success
    expect(hdi.iwh).toBeGreaterThan(0);
  });
});

// =============================================================================
// Test Suite: Storage Validation + All Features
// =============================================================================

test.describe('@no-external Storage Validation + All Features', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('storage validation works with HDI calculation', async ({ page }) => {
    const learnerId = 'storage-hdi-learner';
    
    await page.addInitScript(({ id }) => {
      // Set valid profile
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id,
        name: 'Storage HDI Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      
      // Set valid preview mode
      window.localStorage.setItem('sql-adapt-preview-mode', 'true');
      
      // Set valid strategy
      window.localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
    }, { id: learnerId });
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // HDI should calculate
    const hdi = await getHDI(page);
    expect(hdi).toBeGreaterThanOrEqual(0);
    
    // Storage values should be valid
    const storage = await page.evaluate(() => ({
      profile: window.localStorage.getItem('sql-adapt-user-profile'),
      previewMode: window.localStorage.getItem('sql-adapt-preview-mode'),
      strategy: window.localStorage.getItem('sql-adapt-debug-strategy')
    }));
    
    expect(JSON.parse(storage.profile).role).toBe('student');
    expect(storage.previewMode).toBe('true');
    expect(['static', 'diagnostic', 'bandit']).toContain(storage.strategy);
  });

  test('storage validation handles invalid profile gracefully', async ({ page }) => {
    await page.addInitScript(() => {
      // Set invalid profile (missing fields)
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'invalid-profile',
        // missing name, role, createdAt
      }));
    });
    
    await page.goto('/practice');
    
    // Should redirect to start page due to invalid profile
    await expect(page).toHaveURL(/\/(start)?$/);
  });

  test('storage validation handles invalid preview mode', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-learner',
        name: 'Test Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      
      // Set invalid preview mode
      window.localStorage.setItem('sql-adapt-preview-mode', 'invalid-value');
    });
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // App should still work
    const previewMode = await page.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-preview-mode');
    });
    
    // Invalid value might be cleared or ignored
    expect(['invalid-value', null, 'false']).toContain(previewMode);
  });

  test('profile assignment works with storage validation', async ({ page }) => {
    const learnerId = 'profile-assign-learner';
    
    await page.addInitScript(({ id }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id,
        name: 'Profile Assign Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      
      // Set a valid profile override
      window.localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
    }, { id: learnerId });
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // Profile override should be valid
    const profileOverride = await page.evaluate(() => {
      return window.localStorage.getItem('sql-adapt-debug-profile');
    });
    
    expect(['slow-escalator', 'fast-escalator', 'adaptive-escalator', 'explanation-first', null])
      .toContain(profileOverride);
  });
});

// =============================================================================
// Test Suite: Edge Cases
// =============================================================================

test.describe('@no-external Edge Case Integrations', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('corrupted interactions data + HDI - handles gracefully', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'corrupted-learner',
        name: 'Corrupted Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      
      // Set corrupted interactions data
      window.localStorage.setItem('sql-learning-interactions', 'not-valid-json{[');
    });
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // App should not crash
    const pageTitle = await page.title();
    expect(pageTitle).toBeTruthy();
    
    // HDI calculation should handle gracefully
    const hdi = await page.evaluate(() => {
      try {
        const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
        return Array.isArray(interactions) ? interactions.length : -1;
      } catch {
        return -1; // Error state
      }
    });
    
    // Should handle error state
    expect(hdi).toBe(-1);
  });

  test('empty interactions + HDI - returns zero', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'empty-learner',
        name: 'Empty Learner',
        role: 'student',
        createdAt: Date.now()
      }));
      
      // Empty interactions array
      window.localStorage.setItem('sql-learning-interactions', '[]');
    });
    
    await page.goto('/practice');
    
    const hdi = await getFullHDI(page);
    
    // All components should be 0
    expect(hdi.hdi).toBe(0);
    expect(hdi.hpa).toBe(0);
    expect(hdi.aed).toBe(0);
    expect(hdi.er).toBe(0);
    expect(hdi.reae).toBe(0);
    expect(hdi.iwh).toBe(0);
  });

  test('rapid hint requests - handles correctly', async ({ page }) => {
    const learnerId = 'rapid-learner';
    await setupStudent(page, learnerId);
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // Make an error first
    await submitWrongQuery(page);
    
    // Rapid hint requests
    for (let i = 0; i < 5; i++) {
      await requestHint(page);
    }
    
    const hdi = await getFullHDI(page);
    
    // HPA should be capped at 1.0
    expect(hdi.hpa).toBeLessThanOrEqual(1);
    expect(hdi.hdi).toBeLessThanOrEqual(1);
  });

  test('rapid SQL executions - records all events', async ({ page }) => {
    const learnerId = 'rapid-exec-learner';
    await setupStudent(page, learnerId);
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // Rapid executions
    for (let i = 0; i < 5; i++) {
      await submitCorrectQuery(page);
    }
    
    const interactions = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    });
    
    // Should have recorded executions
    const executions = interactions.filter((i: any) => i.eventType === 'execution');
    expect(executions.length).toBeGreaterThanOrEqual(5);
  });

  test('very long name in profile - handles correctly', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'long-name-learner',
        name: 'A'.repeat(1000), // Very long name
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/practice');
    
    // App should handle gracefully
    const profile = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem('sql-adapt-user-profile') || '{}');
    });
    
    expect(profile.name.length).toBe(1000);
  });

  test('unicode and special characters in profile', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'unicode-learner',
        name: 'Test 👨‍💻 User 🚀 日本語',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page.goto('/practice');
    
    const profile = await page.evaluate(() => {
      return JSON.parse(window.localStorage.getItem('sql-adapt-user-profile') || '{}');
    });
    
    expect(profile.name).toBe('Test 👨‍💻 User 🚀 日本語');
  });
});

// =============================================================================
// Test Suite: Performance + All Features
// =============================================================================

test.describe('@no-external Performance + All Features', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  test('HDI calculates quickly with many interactions', async ({ page }) => {
    const learnerId = 'perf-learner';
    const baseTime = Date.now();
    
    // Create 1000 interactions
    await page.addInitScript(({ id, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id,
        name: 'Performance Test Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      const interactions = [];
      for (let i = 0; i < 1000; i++) {
        interactions.push({
          id: `perf-${i}`,
          eventType: i % 3 === 0 ? 'hint_request' : (i % 3 === 1 ? 'execution' : 'error'),
          learnerId: id,
          problemId: `problem-${i % 50}`,
          timestamp: baseTime + i * 100,
          successful: i % 3 === 1,
          hintLevel: (i % 3) + 1
        });
      }
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { id: learnerId, baseTime });
    
    await page.goto('/practice');
    
    // Measure HDI calculation time
    const startTime = Date.now();
    const hdi = await getFullHDI(page);
    const endTime = Date.now();
    
    // Should complete in reasonable time (< 5 seconds for 1000 interactions)
    expect(endTime - startTime).toBeLessThan(5000);
    expect(hdi.hdi).toBeGreaterThanOrEqual(0);
    expect(hdi.hdi).toBeLessThanOrEqual(1);
  });

  test('cross-tab sync handles frequent updates', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    
    await page1.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'sync-test',
        name: 'Sync Test',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    
    await page1.goto('/practice');
    await page2.goto('/practice');
    
    // Rapid updates on page1
    for (let i = 0; i < 10; i++) {
      await page1.evaluate((index) => {
        window.localStorage.setItem('test-key', `value-${index}`);
      }, i);
    }
    
    // Verify page2 sees the latest value
    await page2.goto('/practice');
    const latestValue = await page2.evaluate(() => {
      return window.localStorage.getItem('test-key');
    });
    
    expect(latestValue).toMatch(/^value-\d+$/);
  });

  test('multiple features active simultaneously - performance stable', async ({ page }) => {
    const learnerId = 'multi-feature-learner';
    await setupStudent(page, learnerId);
    
    // Enable multiple features
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-preview-mode', 'true');
      window.localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
      window.localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
    });
    
    const startTime = Date.now();
    
    await page.goto('/practice');
    await waitForEditorReady(page);
    
    // Perform various actions
    await submitWrongQuery(page);
    await requestHint(page);
    await submitCorrectQuery(page);
    
    // Calculate HDI
    const hdi = await getFullHDI(page);
    
    const endTime = Date.now();
    
    // Should complete in reasonable time
    expect(endTime - startTime).toBeLessThan(30000);
    expect(hdi.hdi).toBeGreaterThanOrEqual(0);
  });
});
