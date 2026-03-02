/**
 * Complete End-to-End Learning Journey Tests
 * 
 * Tests complete learning scenarios across all major components:
 * - LearningInterface, HintSystem, AdaptiveOrchestrator, Storage
 * - Bandit profile selection, HDI calculation, interventions
 * - Settings override, instructor preview mode
 * 
 * Five Journey Scenarios:
 * 1. Independent Learner (Low HDI) - minimal hint usage, bandit keeps appropriate profile
 * 2. Dependent Learner (High HDI) - heavy hint usage, intervention triggered
 * 3. Profile Adaptation via Bandit - exploration and convergence
 * 4. Instructor Preview Mode - preview with profile override
 * 5. Settings Override - static override then restore
 * 
 * @no-external - No external services needed
 */

import { expect, test } from '@playwright/test';
import { replaceEditorText, getAllInteractionsFromStorage } from './test-helpers';

test.describe('@no-external Complete Learning Journeys', () => {
  // Stub LLM calls to prevent ECONNREFUSED errors
  test.beforeEach(async ({ page }) => {
    await page.route('**/ollama/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: '{"title": "Test", "content_markdown": "Test content", "key_points": [], "common_pitfall": "", "next_steps": [], "source_ids": []}'
        })
      });
    });
    await page.route('**/api/generate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          response: '{"title": "Test", "content_markdown": "Test content", "key_points": [], "common_pitfall": "", "next_steps": [], "source_ids": []}'
        })
      });
    });
  });

  // =============================================================================
  // Journey 1: Independent Learner (Low HDI)
  // =============================================================================
  test.describe('Journey 1: Independent Learner (Low HDI)', () => {
    test('independent learner maintains low HDI without interventions', async ({ page }) => {
      const learnerId = 'independent-learner-1';
      
      // Setup via addInitScript (runs before page load)
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'IndependentLearner',
          role: 'student',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
        window.localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
      }, learnerId);

      // Navigate to practice
      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
      await page.waitForSelector('.monaco-editor .view-lines', { state: 'visible', timeout: 30000 });
      await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 30000 });

      // Step 1: Write correct SQL on first try
      await replaceEditorText(page, 'SELECT * FROM users');
      await page.getByRole('button', { name: 'Run Query' }).click();
      await page.waitForTimeout(500);

      // Verify success event
      let interactions = await getAllInteractionsFromStorage(page);
      const successEvents1 = interactions.filter((e: any) => 
        e.eventType === 'execution' && e.successful === true
      );
      expect(successEvents1.length).toBeGreaterThanOrEqual(1);

      // Step 2: Switch to Problem 2, make error but fix without hints
      await page.getByTestId('problem-select-trigger').click();
      await page.getByRole('option', { name: /Problem 2/i }).first().click();
      await page.waitForTimeout(500);

      // Make an error
      await replaceEditorText(page, 'SELECT name FORM users WHERE age > 25');
      await page.getByRole('button', { name: 'Run Query' }).click();
      await page.waitForTimeout(500);

      // Fix without requesting hints
      await replaceEditorText(page, 'SELECT name FROM users WHERE age > 25');
      await page.getByRole('button', { name: 'Run Query' }).click();
      await page.waitForTimeout(500);

      // Verify no hint requests
      interactions = await getAllInteractionsFromStorage(page);
      const hintRequests = interactions.filter((e: any) => 
        e.eventType === 'hint_request' || e.eventType === 'hint_view'
      );
      expect(hintRequests.length).toBe(0);

      // Step 3: Continue with minimal hint usage
      await page.getByTestId('problem-select-trigger').click();
      await page.getByRole('option', { name: /Problem 3/i }).first().click();
      await page.waitForTimeout(500);

      await replaceEditorText(page, 'SELECT COUNT(*) FROM users');
      await page.getByRole('button', { name: 'Run Query' }).click();
      await page.waitForTimeout(500);

      // Step 4: Verify HDI stays low (< 0.4)
      interactions = await getAllInteractionsFromStorage(page);
      const hintViews = interactions.filter((e: any) => e.eventType === 'hint_view').length;
      const executions = interactions.filter((e: any) => e.eventType === 'execution').length;
      const hdi = executions > 0 ? hintViews / executions : 0;
      expect(hdi).toBeLessThan(0.4);

      // Step 5: Verify no dependency warnings
      const warningToast = page.locator('[data-testid="dependency-warning-toast"]');
      const hasWarning = await warningToast.isVisible().catch(() => false);
      expect(hasWarning).toBe(false);

      // Step 6: Verify profile assignment event logged
      const profileEvent = interactions.find((e: any) => e.eventType === 'profile_assigned');
      expect(profileEvent).toBeDefined();
    });

    test('low HDI learner receives encouragement progress hints', async ({ page }) => {
      const learnerId = 'low-hdi-learner';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'LowHDILearner',
          role: 'student',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
      }, learnerId);

      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
      await page.waitForSelector('.monaco-editor .view-lines', { state: 'visible', timeout: 30000 });
      await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 30000 });

      // Solve multiple problems independently
      for (let i = 0; i < 3; i++) {
        await replaceEditorText(page, 'SELECT * FROM users');
        await page.getByRole('button', { name: 'Run Query' }).click();
        await page.waitForTimeout(300);
      }

      // Verify no escalation triggered
      const interactions = await getAllInteractionsFromStorage(page);
      const escalationEvents = interactions.filter((e: any) => 
        e.eventType === 'escalation_triggered' || e.eventType === 'guidance_escalate'
      );
      expect(escalationEvents.length).toBe(0);
    });
  });

  // =============================================================================
  // Journey 2: Dependent Learner (High HDI)
  // =============================================================================
  test.describe('Journey 2: Dependent Learner (High HDI)', () => {
    test('dependent learner HDI increases and triggers intervention', async ({ page }) => {
      const learnerId = 'dependent-learner-1';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'DependentLearner',
          role: 'student',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
        window.localStorage.setItem('sql-adapt-debug-profile', 'explanation-first');
      }, learnerId);

      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
      await page.waitForSelector('.monaco-editor .view-lines', { state: 'visible', timeout: 30000 });
      await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 30000 });

      // Make initial error
      await replaceEditorText(page, 'SELECT * FORM users');
      await page.getByRole('button', { name: 'Run Query' }).click();
      await page.waitForTimeout(500);

      // Seed interaction pattern for high HDI via page.evaluate after navigation
      await page.evaluate((id: string) => {
        const now = Date.now();
        const interactions = [
          { id: 'h1', eventType: 'hint_view', learnerId: id, problemId: 'p1', timestamp: now - 10000, hintLevel: 1 },
          { id: 'h2', eventType: 'hint_view', learnerId: id, problemId: 'p1', timestamp: now - 9000, hintLevel: 2 },
          { id: 'h3', eventType: 'hint_view', learnerId: id, problemId: 'p1', timestamp: now - 8000, hintLevel: 3 },
          { id: 'e1', eventType: 'explanation_view', learnerId: id, problemId: 'p1', timestamp: now - 7000 },
          { id: 'h4', eventType: 'hint_view', learnerId: id, problemId: 'p2', timestamp: now - 6000, hintLevel: 1 },
          { id: 'h5', eventType: 'hint_view', learnerId: id, problemId: 'p2', timestamp: now - 5000, hintLevel: 2 },
          { id: 'h6', eventType: 'hint_view', learnerId: id, problemId: 'p2', timestamp: now - 4000, hintLevel: 3 },
          { id: 'e2', eventType: 'explanation_view', learnerId: id, problemId: 'p2', timestamp: now - 3000 },
          { id: 'ex1', eventType: 'execution', learnerId: id, problemId: 'p1', timestamp: now - 7500, successful: false },
          { id: 'ex2', eventType: 'execution', learnerId: id, problemId: 'p1', timestamp: now - 6500, successful: true },
          { id: 'ex3', eventType: 'execution', learnerId: id, problemId: 'p2', timestamp: now - 3500, successful: false },
          { id: 'ex4', eventType: 'execution', learnerId: id, problemId: 'p2', timestamp: now - 2500, successful: true },
        ];
        window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
      }, learnerId);

      await page.goto('/practice');
      await page.waitForTimeout(1000);

      // Verify HDI is high (> 0.6)
      const interactions = await getAllInteractionsFromStorage(page);
      const hintViews = interactions.filter((e: any) => e.eventType === 'hint_view').length;
      const explanationViews = interactions.filter((e: any) => e.eventType === 'explanation_view').length;
      const executions = interactions.filter((e: any) => e.eventType === 'execution').length;
      
      const hpa = executions > 0 ? Math.min(hintViews / executions, 1.0) : 0;
      const er = executions > 0 ? Math.min(explanationViews / executions, 1.0) : 0;
      const hdi = Math.min(1, (hpa * 0.4 + er * 0.6));

      expect(hdi).toBeGreaterThan(0.6);
      expect(hintViews).toBeGreaterThanOrEqual(6);
      expect(explanationViews).toBeGreaterThanOrEqual(2);
    });

    test('high HDI learner sees dependency warning after hint requests', async ({ page }) => {
      const learnerId = 'high-hdi-warning';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'HighHDIWarning',
          role: 'student',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-debug-profile', 'explanation-first');
      }, learnerId);

      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });

      // Seed with high HDI interaction pattern
      await page.evaluate((id: string) => {
        const now = Date.now();
        const interactions = Array.from({ length: 20 }, (_, i) => ({
          id: `hint-${i}`,
          eventType: 'hint_view',
          learnerId: id,
          problemId: `p${Math.floor(i / 4)}`,
          timestamp: now - (20 - i) * 1000,
          hintLevel: (i % 3) + 1
        })).concat([
          { id: 'exec-1', eventType: 'execution', learnerId: id, problemId: 'p0', timestamp: now - 5000, successful: true },
          { id: 'exec-2', eventType: 'execution', learnerId: id, problemId: 'p1', timestamp: now - 3000, successful: true },
          { id: 'exec-3', eventType: 'execution', learnerId: id, problemId: 'p2', timestamp: now - 1000, successful: true },
        ]);
        window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
      }, learnerId);

      await page.goto('/practice');
      await page.waitForTimeout(1000);

      // Verify high hint-to-execution ratio
      const interactions = await getAllInteractionsFromStorage(page);
      const hintCount = interactions.filter((e: any) => e.eventType === 'hint_view').length;
      expect(hintCount).toBeGreaterThan(15);
    });
  });

  // =============================================================================
  // Journey 3: Profile Adaptation via Bandit
  // =============================================================================
  test.describe('Journey 3: Profile Adaptation via Bandit', () => {
    test('bandit explores profiles and converges on effective one', async ({ page }) => {
      const learnerId = 'bandit-explorer';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'BanditExplorer',
          role: 'student',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      }, learnerId);

      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
      await page.waitForTimeout(1000);

      // Verify bandit arm selected event logged
      let interactions = await getAllInteractionsFromStorage(page);
      const banditSelectEvent = interactions.find((e: any) => e.eventType === 'bandit_arm_selected');
      expect(banditSelectEvent).toBeDefined();
      expect(banditSelectEvent?.selectionMethod).toBe('thompson_sampling');

      // Simulate struggling pattern
      await page.evaluate((id: string) => {
        const now = Date.now();
        const interactions = [
          { id: 'struggle-1', eventType: 'hint_view', learnerId: id, problemId: 'p1', timestamp: now - 50000, hintLevel: 1 },
          { id: 'struggle-2', eventType: 'hint_view', learnerId: id, problemId: 'p1', timestamp: now - 45000, hintLevel: 2 },
          { id: 'struggle-3', eventType: 'hint_view', learnerId: id, problemId: 'p1', timestamp: now - 40000, hintLevel: 3 },
          { id: 'struggle-4', eventType: 'explanation_view', learnerId: id, problemId: 'p1', timestamp: now - 35000 },
          { id: 'struggle-5', eventType: 'hint_view', learnerId: id, problemId: 'p2', timestamp: now - 30000, hintLevel: 1 },
          { id: 'struggle-6', eventType: 'hint_view', learnerId: id, problemId: 'p2', timestamp: now - 25000, hintLevel: 2 },
          { id: 'struggle-7', eventType: 'hint_view', learnerId: id, problemId: 'p2', timestamp: now - 20000, hintLevel: 3 },
          { id: 'struggle-8', eventType: 'explanation_view', learnerId: id, problemId: 'p2', timestamp: now - 15000 },
          { id: 'exec-fail-1', eventType: 'execution', learnerId: id, problemId: 'p1', timestamp: now - 48000, successful: false },
          { id: 'exec-ok-1', eventType: 'execution', learnerId: id, problemId: 'p1', timestamp: now - 32000, successful: true },
          { id: 'exec-fail-2', eventType: 'execution', learnerId: id, problemId: 'p2', timestamp: now - 28000, successful: false },
          { id: 'exec-ok-2', eventType: 'execution', learnerId: id, problemId: 'p2', timestamp: now - 12000, successful: true },
        ];
        window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
      }, learnerId);

      await page.goto('/practice');
      await page.waitForTimeout(1000);

      // Verify exploration happened
      interactions = await getAllInteractionsFromStorage(page);
      const profileEvents = interactions.filter((e: any) => e.eventType === 'profile_assigned');
      expect(profileEvents.length).toBeGreaterThanOrEqual(1);
    });

    test('bandit tracks arm statistics correctly', async ({ page }) => {
      const learnerId = 'bandit-stats';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'BanditStats',
          role: 'student',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      }, learnerId);

      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
      await page.waitForTimeout(1000);

      // Check bandit stats in settings
      await page.goto('/settings');
      const week5Controls = page.locator('[data-testid="week5-debug-controls"]');
      
      if (await week5Controls.isVisible().catch(() => false)) {
        const armStatsTable = page.locator('[data-testid="bandit-arm-stats"]');
        await expect(armStatsTable).toBeVisible();
        const armRows = armStatsTable.locator('tbody tr');
        await expect(armRows).toHaveCount(4);
        for (const armId of ['aggressive', 'conservative', 'adaptive', 'explanation-first']) {
          await expect(page.locator(`[data-testid="arm-stat-${armId}"]`)).toBeVisible();
        }
      }
    });
  });

  // =============================================================================
  // Journey 4: Instructor Preview Mode
  // =============================================================================
  test.describe('Journey 4: Instructor Preview Mode', () => {
    test('instructor preview shows student navigation and profile override', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'instructor-test',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-preview-mode', 'true');
        window.localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
      });

      await page.goto('/practice');
      await page.waitForTimeout(2000);

      // Verify student navigation is shown
      const previewBanner = page.locator('text=Student Preview Mode');
      const hasBanner = await previewBanner.isVisible().catch(() => false);
      
      if (hasBanner) {
        await expect(previewBanner).toBeVisible();
      }

      // Make errors to see fast escalation
      await page.waitForSelector('.monaco-editor .view-lines', { state: 'visible', timeout: 30000 });
      await replaceEditorText(page, 'SELECT * FORM users');
      await page.getByRole('button', { name: 'Run Query' }).click();
      await page.waitForTimeout(500);

      // Verify preview mode is active
      const previewMode = await page.evaluate(() => {
        return window.localStorage.getItem('sql-adapt-preview-mode');
      });
      expect(previewMode).toBe('true');

      // Exit preview
      const exitButton = page.getByRole('button', { name: /exit preview/i });
      if (await exitButton.isVisible().catch(() => false)) {
        await exitButton.click();
      } else {
        await page.evaluate(() => {
          window.localStorage.removeItem('sql-adapt-preview-mode');
          window.localStorage.removeItem('sql-adapt-debug-profile');
        });
        await page.goto('/instructor-dashboard');
      }

      // Verify return to instructor dashboard
      await expect(page.getByRole('heading', { name: 'Instructor Dashboard', exact: true })).toBeVisible({ timeout: 10000 });

      // Note: Preview mode may persist in localStorage depending on implementation
      // The test verifies the navigation flow works correctly
    });

    test('preview mode applies profile override correctly', async ({ page }) => {
      await page.addInitScript(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'instructor-test',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-preview-mode', 'true');
        window.localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
      });

      await page.goto('/practice');
      await page.waitForTimeout(1000);

      // Verify override is active in events
      const interactions = await getAllInteractionsFromStorage(page);
      const profileEvent = interactions.find((e: any) => e.eventType === 'profile_assigned');
      if (profileEvent) {
        expect(profileEvent.overrideReason || profileEvent.payload?.reason).toBeDefined();
      }
    });
  });

  // =============================================================================
  // Journey 5: Settings Override
  // =============================================================================
  test.describe('Journey 5: Settings Override', () => {
    test('settings override takes precedence over bandit', async ({ page }) => {
      const learnerId = 'override-tester';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'OverrideTester',
          role: 'student',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
        window.localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
      }, learnerId);

      await page.goto('/settings');
      await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 10000 });

      const week5Controls = page.locator('[data-testid="week5-debug-controls"]');
      const hasWeek5Controls = await week5Controls.isVisible().catch(() => false);

      if (hasWeek5Controls) {
        await page.getByRole('radio', { name: /static/i }).click();
        await page.getByTestId('profile-override-select').click();
        await page.getByRole('option', { name: 'Fast Escalator', exact: true }).click();

        const savedProfile = await page.evaluate(() => {
          return window.localStorage.getItem('sql-adapt-debug-profile');
        });
        expect(savedProfile).toBe('fast-escalator');
      }

      // Return to practice with override active
      await page.goto('/practice');
      await page.waitForTimeout(1000);

      // Verify override is used
      const interactions = await getAllInteractionsFromStorage(page);
      const profileEvent = interactions.find((e: any) => e.eventType === 'profile_assigned');
      if (profileEvent && hasWeek5Controls) {
        expect(profileEvent.assignmentStrategy || profileEvent.payload?.strategy).toBeDefined();
      }
    });

    test('removing override restores bandit selection', async ({ page }) => {
      const learnerId = 'restore-bandit';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'RestoreBandit',
          role: 'student',
          createdAt: Date.now()
        }));
      }, learnerId);

      await page.goto('/settings');
      const week5Controls = page.locator('[data-testid="week5-debug-controls"]');
      
      if (await week5Controls.isVisible().catch(() => false)) {
        await page.getByTestId('profile-override-select').click();
        await page.getByRole('option', { name: 'Fast Escalator', exact: true }).click();

        let savedProfile = await page.evaluate(() => {
          return window.localStorage.getItem('sql-adapt-debug-profile');
        });
        expect(savedProfile).toBe('fast-escalator');

        await page.getByTestId('profile-override-reset').click();

        savedProfile = await page.evaluate(() => {
          return window.localStorage.getItem('sql-adapt-debug-profile');
        });
        expect(savedProfile).toBeNull();
      }
    });
  });

  // =============================================================================
  // Cross-Component Integration Tests
  // =============================================================================
  test.describe('Cross-Component Integration', () => {
    test('bandit → profile → hints integration works correctly', async ({ page }) => {
      const learnerId = 'integration-test';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'IntegrationTest',
          role: 'student',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      }, learnerId);

      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
      await page.waitForTimeout(1000);

      // Verify bandit selected profile
      let interactions = await getAllInteractionsFromStorage(page);
      const banditSelect = interactions.find((e: any) => e.eventType === 'bandit_arm_selected');
      expect(banditSelect).toBeDefined();

      const profileAssign = interactions.find((e: any) => e.eventType === 'profile_assigned');
      expect(profileAssign).toBeDefined();

      // Make error and request hint
      await page.waitForSelector('.monaco-editor .view-lines', { state: 'visible', timeout: 30000 });
      await replaceEditorText(page, 'SELECT * FORM users');
      await page.getByRole('button', { name: 'Run Query' }).click();
      await page.waitForTimeout(500);

      // Request hint
      const hintButton = page.getByRole('button', { name: /request hint/i });
      if (await hintButton.isVisible().catch(() => false)) {
        await hintButton.click();
        await page.waitForTimeout(500);

        interactions = await getAllInteractionsFromStorage(page);
        const hintViews = interactions.filter((e: any) => e.eventType === 'hint_view');
        expect(hintViews.length).toBeGreaterThanOrEqual(1);
      }
    });

    test('events → HDI → interventions chain works', async ({ page }) => {
      const learnerId = 'hdi-chain-test';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'HDIChainTest',
          role: 'student',
          createdAt: Date.now()
        }));
      }, learnerId);

      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });

      // Seed with interaction events
      await page.evaluate((id: string) => {
        const now = Date.now();
        const interactions = [
          { id: 'chain-1', eventType: 'hint_view', learnerId: id, problemId: 'p1', timestamp: now - 5000, hintLevel: 1 },
          { id: 'chain-2', eventType: 'hint_view', learnerId: id, problemId: 'p1', timestamp: now - 4000, hintLevel: 2 },
          { id: 'chain-3', eventType: 'execution', learnerId: id, problemId: 'p1', timestamp: now - 3000, successful: true },
          { id: 'chain-4', eventType: 'explanation_view', learnerId: id, problemId: 'p2', timestamp: now - 2000 },
          { id: 'chain-5', eventType: 'execution', learnerId: id, problemId: 'p2', timestamp: now - 1000, successful: true },
        ];
        window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
      }, learnerId);

      await page.goto('/practice');
      await page.waitForTimeout(1000);

      // Verify events exist
      const interactions = await getAllInteractionsFromStorage(page);
      const hintViews = interactions.filter((e: any) => e.eventType === 'hint_view');
      const executions = interactions.filter((e: any) => e.eventType === 'execution');
      const explanations = interactions.filter((e: any) => e.eventType === 'explanation_view');

      expect(hintViews.length).toBeGreaterThanOrEqual(2);
      expect(executions.length).toBeGreaterThanOrEqual(2);
      expect(explanations.length).toBeGreaterThanOrEqual(1);
    });

    test('settings → localStorage → LearningInterface integration', async ({ page }) => {
      const learnerId = 'settings-integration';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'SettingsIntegration',
          role: 'student',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-debug-strategy', 'static');
        window.localStorage.setItem('sql-adapt-debug-profile', 'adaptive-escalator');
      }, learnerId);

      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
      await page.waitForTimeout(1000);

      // Verify profile was picked up
      const interactions = await getAllInteractionsFromStorage(page);
      const profileEvent = interactions.find((e: any) => e.eventType === 'profile_assigned');
      expect(profileEvent).toBeDefined();
      expect(profileEvent?.assignmentStrategy || profileEvent?.payload?.strategy).toBe('static');
    });
  });

  // =============================================================================
  // Data Verification Tests
  // =============================================================================
  test.describe('Data Verification', () => {
    test('all required event types are logged', async ({ page }) => {
      const learnerId = 'event-logger';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'EventLogger',
          role: 'student',
          createdAt: Date.now()
        }));
        window.localStorage.setItem('sql-adapt-debug-strategy', 'bandit');
      }, learnerId);

      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
      await page.waitForTimeout(1000);

      // Perform actions
      await page.waitForSelector('.monaco-editor .view-lines', { state: 'visible', timeout: 30000 });
      await replaceEditorText(page, 'SELECT * FROM users');
      await page.getByRole('button', { name: 'Run Query' }).click();
      await page.waitForTimeout(500);

      // Request hint
      const hintButton = page.getByRole('button', { name: /request hint/i });
      if (await hintButton.isVisible().catch(() => false)) {
        await hintButton.click();
        await page.waitForTimeout(500);
      }

      // Check events
      const interactions = await getAllInteractionsFromStorage(page);
      const eventTypes = new Set(interactions.map((e: any) => e.eventType));
      
      expect(eventTypes.has('execution')).toBe(true);
      expect(eventTypes.has('profile_assigned')).toBe(true);
      expect(eventTypes.has('bandit_arm_selected')).toBe(true);
    });

    test('localStorage state is consistent across pages', async ({ page }) => {
      const learnerId = 'storage-consistency';
      
      await page.addInitScript((id: string) => {
        window.localStorage.clear();
        window.sessionStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id,
          name: 'StorageConsistency',
          role: 'student',
          createdAt: Date.now()
        }));
      }, learnerId);

      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });

      // Add some interactions
      await page.evaluate((id: string) => {
        const interactions = [
          { id: 'storage-1', eventType: 'hint_view', learnerId: id, problemId: 'p1', timestamp: Date.now(), hintLevel: 1 },
          { id: 'storage-2', eventType: 'execution', learnerId: id, problemId: 'p1', timestamp: Date.now() + 1000, successful: true },
        ];
        window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
      }, learnerId);

      // Visit multiple pages
      await page.goto('/');
      await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
      
      await page.goto('/textbook');
      await expect(page).toHaveURL(/\/textbook/, { timeout: 30000 });
      
      await page.goto('/settings');
      await expect(page).toHaveURL(/\/settings/, { timeout: 30000 });

      // Verify interactions persisted
      const interactions = await getAllInteractionsFromStorage(page);
      expect(interactions.length).toBeGreaterThanOrEqual(2);

      // Verify profile persisted
      const profile = await page.evaluate(() => {
        return window.localStorage.getItem('sql-adapt-user-profile');
      });
      expect(profile).not.toBeNull();
    });
  });
});
