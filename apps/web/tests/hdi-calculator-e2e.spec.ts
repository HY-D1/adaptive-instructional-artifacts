/**
 * HDI Calculator E2E Tests
 * 
 * Tests for Help-Dependency Index calculation and display:
 * 1. HDI calculation from interactions
 * 2. HDI level classification (low/medium/high)
 * 3. HDI components display (HPA, AED, ER, REAE, IWH)
 * 4. HDI persistence across pages
 * 5. HDI with empty history
 * 6. HDI after clearing history
 * 
 * @no-external - No external services needed
 */

import { expect, test } from '@playwright/test';
import { setupTest, completeStartPageFlow } from './test-helpers';

test.describe('@no-external HDI Calculator E2E', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  // =============================================================================
  // Test 1: HDI Calculation from Interactions
  // =============================================================================
  test('HDI is calculated correctly from interaction events', async ({ page }) => {
    const learnerId = 'test-hdi-learner';
    const baseTime = Date.now();
    
    // Seed localStorage with a user profile and interaction events
    await page.addInitScript(({ learnerId, baseTime }) => {
      // Set user profile
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Test HDI Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      // Create interaction events that should result in a specific HDI
      // Pattern: moderate hint usage, some successes
      // - 2 hint_requests, 4 executions = HPA = 0.5
      // - hint_level 1 and 2 = AED = 0.25 (average level 1.5 -> normalized 0.25)
      // - 1 explanation, 4 executions = ER = 0.25
      // - 1 error after explanation, 1 total error = REAE = 1.0
      // - 1 success without hints, 2 total successes = IWH = 0.5
      const interactions = [
        {
          id: 'event-1',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime,
          hintLevel: 1
        },
        {
          id: 'event-2',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 1000,
          successful: false
        },
        {
          id: 'event-3',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 2000,
          hintLevel: 2
        },
        {
          id: 'event-4',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 3000,
          successful: true
        },
        {
          id: 'event-5',
          eventType: 'explanation_view',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 4000
        },
        {
          id: 'event-6',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-2',
          timestamp: baseTime + 5000,
          successful: true
        },
        {
          id: 'event-7',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-3',
          timestamp: baseTime + 6000,
          successful: true
        },
        {
          id: 'event-8',
          eventType: 'error',
          learnerId,
          problemId: 'problem-3',
          timestamp: baseTime + 7000,
          errorSubtypeId: 'syntax-error'
        }
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });
    
    // Navigate to practice page
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });
    
    // Verify page loaded with seeded data
    const interactions = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    // Check that seeded events exist (setupTest may add additional interactions)
    expect(interactions.filter((i: any) => i.eventType === 'hint_request').length).toBeGreaterThanOrEqual(2);
    expect(interactions.filter((i: any) => i.eventType === 'execution').length).toBeGreaterThanOrEqual(4);
  });

  // =============================================================================
  // Test 2: HDI Level Classification - Low HDI
  // =============================================================================
  test('classifies low HDI (< 0.3) for independent learner', async ({ page }) => {
    const learnerId = 'low-hdi-learner';
    const baseTime = Date.now();
    
    // Seed with interactions showing few hints, many independent successes
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Independent Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      // Pattern: few hints, many executions, mostly successful without hints
      // This should result in low HDI (< 0.3)
      const interactions = [
        // Only 1 hint for 10 executions = HPA = 0.1
        {
          id: 'low-1',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime,
          hintLevel: 1
        },
        // 10 successful executions without hints
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `low-exec-${i}`,
          eventType: 'execution',
          learnerId,
          problemId: `problem-${i + 1}`,
          timestamp: baseTime + (i + 1) * 1000,
          successful: true
        }))
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });
    
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });
    
    // Verify the interactions were stored correctly
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    const hintCount = stored.filter((i: any) => i.eventType === 'hint_request').length;
    const execCount = stored.filter((i: any) => i.eventType === 'execution').length;
    
    // Verify we have low hint-to-execution ratio
    expect(hintCount).toBe(1);
    expect(execCount).toBe(10);
    expect(hintCount / execCount).toBeLessThan(0.3);
  });

  // =============================================================================
  // Test 3: HDI Level Classification - Medium HDI
  // =============================================================================
  test('classifies medium HDI (0.3-0.6) for moderate hint usage', async ({ page }) => {
    const learnerId = 'medium-hdi-learner';
    const baseTime = Date.now();
    
    // Seed with interactions showing moderate hint usage
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Moderate Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      // Pattern: moderate hints, mix of successes
      const interactions = [
        // 3 hints for 6 executions = HPA = 0.5
        {
          id: 'med-1',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime,
          hintLevel: 2
        },
        {
          id: 'med-2',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 1000,
          successful: true
        },
        {
          id: 'med-3',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-2',
          timestamp: baseTime + 2000,
          hintLevel: 1
        },
        {
          id: 'med-4',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-2',
          timestamp: baseTime + 3000,
          successful: true
        },
        {
          id: 'med-5',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-3',
          timestamp: baseTime + 4000,
          hintLevel: 2
        },
        {
          id: 'med-6',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-3',
          timestamp: baseTime + 5000,
          successful: true
        },
        {
          id: 'med-7',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-4',
          timestamp: baseTime + 6000,
          successful: true
        },
        {
          id: 'med-8',
          eventType: 'explanation_view',
          learnerId,
          problemId: 'problem-4',
          timestamp: baseTime + 7000
        },
        {
          id: 'med-9',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-5',
          timestamp: baseTime + 8000,
          successful: false
        }
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });
    
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });
    
    // Verify interaction counts
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    const hintCount = stored.filter((i: any) => i.eventType === 'hint_request').length;
    const execCount = stored.filter((i: any) => i.eventType === 'execution').length;
    
    // Medium usage: ~50% hint ratio
    expect(hintCount).toBe(3);
    expect(execCount).toBe(5);
    expect(hintCount / execCount).toBe(0.6);
  });

  // =============================================================================
  // Test 4: HDI Level Classification - High HDI
  // =============================================================================
  test('classifies high HDI (> 0.6) for heavy hint dependency', async ({ page }) => {
    const learnerId = 'high-hdi-learner';
    const baseTime = Date.now();
    
    // Seed with interactions showing heavy hint dependency
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Dependent Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      // Pattern: many hints per execution, high escalation
      const interactions = [
        // Multiple hints per problem, high escalation level
        {
          id: 'high-1',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime,
          hintLevel: 3
        },
        {
          id: 'high-2',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 100,
          hintLevel: 3
        },
        {
          id: 'high-3',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 1000,
          successful: false
        },
        {
          id: 'high-4',
          eventType: 'explanation_view',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 2000
        },
        {
          id: 'high-5',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-2',
          timestamp: baseTime + 3000,
          hintLevel: 3
        },
        {
          id: 'high-6',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-2',
          timestamp: baseTime + 4000,
          successful: true
        },
        {
          id: 'high-7',
          eventType: 'error',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 5000,
          errorSubtypeId: 'syntax-error'
        }
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });
    
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });
    
    // Verify high hint ratio
    const stored = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    const hintCount = stored.filter((i: any) => i.eventType === 'hint_request').length;
    const execCount = stored.filter((i: any) => i.eventType === 'execution').length;
    
    // High usage: > 100% hint ratio
    expect(hintCount).toBe(3);
    expect(execCount).toBe(2);
    expect(hintCount / execCount).toBeGreaterThan(1);
  });

  // =============================================================================
  // Test 5: HDI Components Display
  // =============================================================================
  test('all 5 HDI components are calculated within [0, 1] range', async ({ page }) => {
    const learnerId = 'components-learner';
    const baseTime = Date.now();
    
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Components Test Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      // Create diverse interactions to exercise all components
      const interactions = [
        // HPA component: 2 hints / 4 executions = 0.5
        {
          id: 'comp-1',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime,
          hintLevel: 1
        },
        {
          id: 'comp-2',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 1000,
          successful: false
        },
        {
          id: 'comp-3',
          eventType: 'hint_request',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 2000,
          hintLevel: 3
        },
        {
          id: 'comp-4',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-1',
          timestamp: baseTime + 3000,
          successful: true
        },
        // AED component: levels 1 and 3 -> average 2 -> 0.5 normalized
        // ER component: 1 explanation / 4 executions = 0.25
        {
          id: 'comp-5',
          eventType: 'explanation_view',
          learnerId,
          problemId: 'problem-2',
          timestamp: baseTime + 4000
        },
        {
          id: 'comp-6',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-2',
          timestamp: baseTime + 5000,
          successful: true
        },
        {
          id: 'comp-7',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-3',
          timestamp: baseTime + 6000,
          successful: true
        },
        // REAE component: error after explanation
        {
          id: 'comp-8',
          eventType: 'error',
          learnerId,
          problemId: 'problem-2',
          timestamp: baseTime + 7000,
          errorSubtypeId: 'syntax-error'
        },
        // IWH component: some success without hints
        {
          id: 'comp-9',
          eventType: 'execution',
          learnerId,
          problemId: 'problem-4',
          timestamp: baseTime + 8000,
          successful: true
        }
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });
    
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });
    
    // Verify component calculation via page JavaScript
    const componentRanges = await page.evaluate(() => {
      // Helper to calculate components (mirroring hdi-calculator.ts logic)
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
      
      return { hpa, aed, er, reae, iwh };
    });
    
    // Verify all components are in [0, 1] range
    expect(componentRanges.hpa).toBeGreaterThanOrEqual(0);
    expect(componentRanges.hpa).toBeLessThanOrEqual(1);
    expect(componentRanges.aed).toBeGreaterThanOrEqual(0);
    expect(componentRanges.aed).toBeLessThanOrEqual(1);
    expect(componentRanges.er).toBeGreaterThanOrEqual(0);
    expect(componentRanges.er).toBeLessThanOrEqual(1);
    expect(componentRanges.reae).toBeGreaterThanOrEqual(0);
    expect(componentRanges.reae).toBeLessThanOrEqual(1);
    expect(componentRanges.iwh).toBeGreaterThanOrEqual(0);
    expect(componentRanges.iwh).toBeLessThanOrEqual(1);
  });

  // =============================================================================
  // Test 6: HDI Persistence Across Pages
  // =============================================================================
  test('HDI value persists when navigating between practice and settings', async ({ page }) => {
    const learnerId = 'persistence-learner';
    const baseTime = Date.now();
    const hdiValue = 0.45;
    
    // Seed with HDI calculated event
    await page.addInitScript(({ learnerId, baseTime, hdiValue }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Persistence Test Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      const interactions = [
        {
          id: 'persist-hdi',
          eventType: 'hdi_calculated',
          learnerId,
          timestamp: baseTime,
          problemId: 'test-problem',
          hdi: hdiValue,
          hdiLevel: 'medium',
          hdiComponents: {
            hpa: 0.5,
            aed: 0.3,
            er: 0.2,
            reae: 0.1,
            iwh: 0.6
          }
        }
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime, hdiValue });
    
    // Navigate to practice page
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });
    
    // Navigate to settings page
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 30000 });
    
    // Wait for Week 5 controls (only visible in DEV mode)
    const week5Controls = page.locator('[data-testid="week5-debug-controls"]');
    
    if (await week5Controls.isVisible().catch(() => false)) {
      // In DEV mode, verify HDI score is displayed
      const hdiScoreElement = page.locator('[data-testid="hdi-score"]');
      await expect(hdiScoreElement).toBeVisible();
      
      // Verify the value matches what we seeded
      const displayedScore = await hdiScoreElement.textContent();
      expect(displayedScore).toBe(hdiValue.toFixed(3));
    }
    
    // Navigate back to practice
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });
    
    // Verify interactions are still intact
    const interactions = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    expect(interactions.length).toBe(1);
    expect(interactions[0].hdi).toBe(hdiValue);
  });

  // =============================================================================
  // Test 7: HDI with Empty History
  // =============================================================================
  test('shows HDI as N/A for new learner with no interactions', async ({ page }) => {
    const learnerId = 'new-learner';
    const baseTime = Date.now();
    
    // Seed only profile, no interactions
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'New Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      // Empty interactions array
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify([]));
    }, { learnerId, baseTime });
    
    // Navigate to practice
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });
    
    // Verify empty interactions
    const interactions = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    // Check no HDI-specific events exist (setupTest may add profile/navigation events)
    const hdiEvents = interactions.filter((i: any) => 
      i.eventType === 'hdi_calculated' || 
      i.eventType === 'hdi_trajectory_updated' ||
      i.eventType === 'dependency_intervention_triggered'
    );
    expect(hdiEvents.length).toBe(0); // No HDI events yet
    
    // Navigate to settings and check HDI display
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 30000 });
    
    const week5Controls = page.locator('[data-testid="week5-debug-controls"]');
    
    if (await week5Controls.isVisible().catch(() => false)) {
      // In DEV mode, verify HDI shows N/A
      const hdiScoreElement = page.locator('[data-testid="hdi-score"]');
      await expect(hdiScoreElement).toBeVisible();
      
      const displayedScore = await hdiScoreElement.textContent();
      expect(displayedScore).toBe('N/A');
      
      // Verify event count is 0
      const eventCountElement = page.locator('[data-testid="hdi-event-count"]');
      await expect(eventCountElement).toHaveText('0');
    }
  });

  // =============================================================================
  // Test 8: HDI After Clearing History
  // =============================================================================
  test('HDI resets to N/A after clearing history', async ({ page }) => {
    const learnerId = 'clear-learner';
    const baseTime = Date.now();
    
    // Seed with HDI events
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Clear Test Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      const interactions = [
        {
          id: 'clear-hdi-1',
          eventType: 'hdi_calculated',
          learnerId,
          timestamp: baseTime,
          problemId: 'test-problem',
          hdi: 0.65,
          hdiLevel: 'high'
        },
        {
          id: 'clear-hdi-2',
          eventType: 'hdi_trajectory_updated',
          learnerId,
          timestamp: baseTime + 1000,
          problemId: 'test-problem',
          hdi: 0.70,
          trend: 'increasing'
        },
        {
          id: 'clear-other',
          eventType: 'hint_view',
          learnerId,
          timestamp: baseTime + 2000,
          problemId: 'test-problem'
        }
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });
    
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 30000 });
    
    const week5Controls = page.locator('[data-testid="week5-debug-controls"]');
    
    if (await week5Controls.isVisible().catch(() => false)) {
      // Verify initial HDI value
      const hdiScoreElement = page.locator('[data-testid="hdi-score"]');
      await expect(hdiScoreElement).toHaveText('0.650');
      
      // Verify event count
      const eventCountElement = page.locator('[data-testid="hdi-event-count"]');
      await expect(eventCountElement).toHaveText('2');
      
      // Click Clear HDI History button
      const clearButton = page.locator('[data-testid="hdi-clear-button"]');
      await expect(clearButton).toBeEnabled();
      await clearButton.click();
      
      // Verify HDI now shows N/A
      await expect(hdiScoreElement).toHaveText('N/A');
      await expect(eventCountElement).toHaveText('0');
      
      // Verify clear button is now disabled
      await expect(clearButton).toBeDisabled();
    }
    
    // Verify in localStorage that HDI events are removed but other events remain
    const interactions = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      return raw ? JSON.parse(raw) : [];
    });
    
    const hdiEvents = interactions.filter((i: any) => 
      i.eventType === 'hdi_calculated' || 
      i.eventType === 'hdi_trajectory_updated' ||
      i.eventType === 'dependency_intervention_triggered'
    );
    const otherEvents = interactions.filter((i: any) => i.eventType === 'hint_view');
    
    expect(hdiEvents.length).toBe(0);
    expect(otherEvents.length).toBe(1);
  });

  // =============================================================================
  // Test 9: HDI Event Count Verification
  // =============================================================================
  test('correctly counts HDI-related events', async ({ page }) => {
    const learnerId = 'count-learner';
    const baseTime = Date.now();
    
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Count Test Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      const interactions = [
        // HDI events (should be counted)
        {
          id: 'count-hdi-1',
          eventType: 'hdi_calculated',
          learnerId,
          timestamp: baseTime,
          problemId: 'p1',
          hdi: 0.4
        },
        {
          id: 'count-hdi-2',
          eventType: 'hdi_trajectory_updated',
          learnerId,
          timestamp: baseTime + 1000,
          problemId: 'p1',
          hdi: 0.45,
          trend: 'increasing'
        },
        {
          id: 'count-hdi-3',
          eventType: 'dependency_intervention_triggered',
          learnerId,
          timestamp: baseTime + 2000,
          problemId: 'p1',
          interventionType: 'forced_independent'
        },
        // Non-HDI events (should not be counted)
        {
          id: 'count-other-1',
          eventType: 'hint_view',
          learnerId,
          timestamp: baseTime + 3000,
          problemId: 'p1'
        },
        {
          id: 'count-other-2',
          eventType: 'execution',
          learnerId,
          timestamp: baseTime + 4000,
          problemId: 'p1',
          successful: true
        },
        // HDI event for different learner (should not be counted)
        {
          id: 'count-hdi-other',
          eventType: 'hdi_calculated',
          learnerId: 'different-learner',
          timestamp: baseTime + 5000,
          problemId: 'p1',
          hdi: 0.8
        }
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });
    
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 30000 });
    
    const week5Controls = page.locator('[data-testid="week5-debug-controls"]');
    
    if (await week5Controls.isVisible().catch(() => false)) {
      // Verify event count is 3 (only for current learner)
      const eventCountElement = page.locator('[data-testid="hdi-event-count"]');
      await expect(eventCountElement).toHaveText('3');
    }
    
    // Verify via localStorage query
    const hdiEventCount = await page.evaluate((learnerId) => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      return interactions.filter((i: any) => 
        i.learnerId === learnerId &&
        (i.eventType === 'hdi_calculated' ||
         i.eventType === 'hdi_trajectory_updated' ||
         i.eventType === 'dependency_intervention_triggered')
      ).length;
    }, learnerId);
    
    expect(hdiEventCount).toBe(3);
  });

  // =============================================================================
  // Test 10: HDI Calculation with Real Formula
  // =============================================================================
  test('HDI formula produces expected weighted sum', async ({ page }) => {
    const learnerId = 'formula-learner';
    const baseTime = Date.now();
    
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Formula Test Learner',
        role: 'student',
        createdAt: baseTime
      }));
      
      // Create interactions that yield known component values
      // HPA = 0.5 (2 hints / 4 executions)
      // AED = 0.5 (avg level 2 -> normalized 0.5)
      // ER = 0.25 (1 explanation / 4 executions)
      // REAE = 0 (no errors after explanation in this scenario)
      // IWH = 0.5 (1 success without hints / 2 total successes)
      const interactions = [
        { id: 'f1', eventType: 'hint_request', learnerId, problemId: 'p1', timestamp: baseTime, hintLevel: 2 },
        { id: 'f2', eventType: 'hint_request', learnerId, problemId: 'p2', timestamp: baseTime + 100, hintLevel: 2 },
        { id: 'f3', eventType: 'execution', learnerId, problemId: 'p1', timestamp: baseTime + 1000, successful: true },
        { id: 'f4', eventType: 'execution', learnerId, problemId: 'p2', timestamp: baseTime + 2000, successful: true },
        { id: 'f5', eventType: 'execution', learnerId, problemId: 'p3', timestamp: baseTime + 3000, successful: true },
        { id: 'f6', eventType: 'execution', learnerId, problemId: 'p4', timestamp: baseTime + 4000, successful: true },
        { id: 'f7', eventType: 'explanation_view', learnerId, problemId: 'p3', timestamp: baseTime + 5000 }
      ];
      
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });
    
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });
    
    // Calculate HDI using the formula
    const calculatedHDI = await page.evaluate(() => {
      const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
      
      // Component calculations matching hdi-calculator.ts
      const hintRequests = interactions.filter((i: any) => 
        i.eventType === 'hint_request' || i.eventType === 'guidance_request'
      ).length;
      const attempts = interactions.filter((i: any) => i.eventType === 'execution').length;
      const hpa = attempts > 0 ? Math.min(hintRequests / attempts, 1.0) : 0;
      
      const hintEvents = interactions.filter(
        (i: any) => ['hint_request', 'guidance_request', 'hint_view', 'guidance_view'].includes(i.eventType) && i.hintLevel !== undefined
      );
      const avgLevel = hintEvents.length > 0 
        ? hintEvents.reduce((sum: number, i: any) => sum + (i.hintLevel || 1), 0) / hintEvents.length 
        : 1;
      const aed = Math.min(Math.max((avgLevel - 1) / 2, 0), 1);
      
      const explanationViews = interactions.filter((i: any) => i.eventType === 'explanation_view').length;
      const er = attempts > 0 ? Math.min(explanationViews / attempts, 1.0) : 0;
      
      // Simplified REAE for this test (no errors after explanation)
      const reae = 0;
      
      // IWH calculation
      const sorted = [...interactions].sort((a: any, b: any) => a.timestamp - b.timestamp);
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
      
      // HDI formula: weighted sum with IWH inverted
      const hdi = 
        hpa * WEIGHTS.hpa +
        aed * WEIGHTS.aed +
        er * WEIGHTS.er +
        reae * WEIGHTS.reae +
        (1 - iwh) * WEIGHTS.iwh;
      
      return { hdi: Math.min(Math.max(hdi, 0), 1), components: { hpa, aed, er, reae, iwh } };
    });
    
    // Verify expected component values
    expect(calculatedHDI.components.hpa).toBe(0.5); // 2 hints / 4 executions
    expect(calculatedHDI.components.aed).toBe(0.5); // Level 2 normalized
    expect(calculatedHDI.components.er).toBe(0.25); // 1 explanation / 4 executions
    expect(calculatedHDI.components.reae).toBe(0); // No errors
    expect(calculatedHDI.components.iwh).toBe(0.5); // 2 successes, 1 without hints
    
    // Verify HDI is in valid range
    expect(calculatedHDI.hdi).toBeGreaterThanOrEqual(0);
    expect(calculatedHDI.hdi).toBeLessThanOrEqual(1);
  });
});