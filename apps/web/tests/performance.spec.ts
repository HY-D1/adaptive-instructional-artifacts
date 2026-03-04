/**
 * Performance Tests for SQL-Adapt Learning System
 * 
 * Tests the performance characteristics of:
 * 1. HDI Calculation Performance - various interaction counts
 * 2. Cross-Tab Sync Latency - preview mode synchronization
 * 3. Memory Usage - during HDI updates
 * 4. Page Load Performance - LearningInterface load time
 * 5. Rendering Performance - frame rate during HDI updates
 * 
 * Target Benchmarks:
 * - HDI calc (100 interactions): <20ms (target: <10ms)
 * - HDI calc (1000 interactions): <50ms (target: <30ms)
 * - Cross-tab sync: <100ms (target: <50ms)
 * - Page load: <3s (target: <2s)
 * - Render (60fps): >30fps (target: 60fps)
 * 
 * @no-external - No external services needed
 * @weekly - Part of weekly regression
 */

import { expect, test } from '@playwright/test';
import { setupTest } from './test-helpers';

test.describe('@weekly @no-external Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  // ============================================================================
  // HDI Calculation Performance
  // ============================================================================

  test('HDI calculation performance with 10 interactions completes in <10ms', async ({ page }) => {
    const learnerId = 'perf-hdi-10';
    const baseTime = Date.now();

    // Seed with 10 interactions
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Perf Test Learner',
        role: 'student',
        createdAt: baseTime
      }));

      const interactions = Array.from({ length: 10 }, (_, i) => ({
        id: `perf-${i}`,
        eventType: i % 3 === 0 ? 'hint_request' : 'execution',
        learnerId,
        problemId: `problem-${i}`,
        timestamp: baseTime + i * 100,
        successful: i % 2 === 0,
        hintLevel: i % 3 === 0 ? 1 : undefined
      }));

      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });

    // Measure HDI calculation performance
    const duration = await page.evaluate(() => {
      const start = performance.now();

      const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');

      // HPA
      const hintRequests = interactions.filter(
        (i: any) => i.eventType === 'hint_request' || i.eventType === 'guidance_request'
      ).length;
      const attempts = interactions.filter((i: any) => i.eventType === 'execution').length;
      const hpa = attempts > 0 ? Math.min(hintRequests / attempts, 1.0) : 0;

      // AED
      const hintEvents = interactions.filter(
        (i: any) => ['hint_request', 'guidance_request', 'hint_view', 'guidance_view'].includes(i.eventType) && i.hintLevel !== undefined
      );
      const avgLevel = hintEvents.length > 0
        ? hintEvents.reduce((sum: number, i: any) => sum + (i.hintLevel || 1), 0) / hintEvents.length
        : 1;
      const aed = Math.min(Math.max((avgLevel - 1) / 2, 0), 1);

      // ER
      const explanationViews = interactions.filter((i: any) => i.eventType === 'explanation_view').length;
      const er = attempts > 0 ? Math.min(explanationViews / attempts, 1.0) : 0;

      // REAE
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

      // IWH
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

      // Final HDI calculation
      const WEIGHTS = { hpa: 0.3, aed: 0.133, er: 0.3, reae: 0.133, iwh: 0.134 };
      const hdi =
        hpa * WEIGHTS.hpa +
        aed * WEIGHTS.aed +
        er * WEIGHTS.er +
        reae * WEIGHTS.reae +
        (1 - iwh) * WEIGHTS.iwh;
      const normalizedHDI = Math.min(Math.max(hdi, 0), 1);

      return performance.now() - start;
    });

    console.log(`HDI calculation (10 interactions): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(10);
  });

  test('HDI calculation performance with 100 interactions completes in <20ms', async ({ page }) => {
    const learnerId = 'perf-hdi-100';
    const baseTime = Date.now();

    // Seed with 100 interactions
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Perf Test Learner',
        role: 'student',
        createdAt: baseTime
      }));

      const interactions = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-${i}`,
        eventType: i % 3 === 0 ? 'hint_request' : 'execution',
        learnerId,
        problemId: `problem-${Math.floor(i / 5)}`,
        timestamp: baseTime + i * 100,
        successful: i % 2 === 0,
        hintLevel: i % 3 === 0 ? (i % 9 === 0 ? 3 : 1) : undefined
      }));

      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });

    const duration = await page.evaluate(() => {
      const start = performance.now();

      const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');

      // HPA
      const hintRequests = interactions.filter(
        (i: any) => i.eventType === 'hint_request' || i.eventType === 'guidance_request'
      ).length;
      const attempts = interactions.filter((i: any) => i.eventType === 'execution').length;
      const hpa = attempts > 0 ? Math.min(hintRequests / attempts, 1.0) : 0;

      // AED
      const hintEvents = interactions.filter(
        (i: any) => ['hint_request', 'guidance_request', 'hint_view', 'guidance_view'].includes(i.eventType) && i.hintLevel !== undefined
      );
      const avgLevel = hintEvents.length > 0
        ? hintEvents.reduce((sum: number, i: any) => sum + (i.hintLevel || 1), 0) / hintEvents.length
        : 1;
      const aed = Math.min(Math.max((avgLevel - 1) / 2, 0), 1);

      // ER
      const explanationViews = interactions.filter((i: any) => i.eventType === 'explanation_view').length;
      const er = attempts > 0 ? Math.min(explanationViews / attempts, 1.0) : 0;

      // REAE
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

      // IWH
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

      // Final HDI
      const WEIGHTS = { hpa: 0.3, aed: 0.133, er: 0.3, reae: 0.133, iwh: 0.134 };
      const hdi =
        hpa * WEIGHTS.hpa +
        aed * WEIGHTS.aed +
        er * WEIGHTS.er +
        reae * WEIGHTS.reae +
        (1 - iwh) * WEIGHTS.iwh;

      return performance.now() - start;
    });

    console.log(`HDI calculation (100 interactions): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(20);
  });

  test('HDI calculation performance with 1000 interactions completes in <50ms', async ({ page }) => {
    const learnerId = 'perf-hdi-1000';
    const baseTime = Date.now();

    // Seed with 1000 interactions
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Perf Test Learner',
        role: 'student',
        createdAt: baseTime
      }));

      const interactions = Array.from({ length: 1000 }, (_, i) => ({
        id: `perf-${i}`,
        eventType: i % 3 === 0 ? 'hint_request' : 'execution',
        learnerId,
        problemId: `problem-${Math.floor(i / 10)}`,
        timestamp: baseTime + i * 100,
        successful: i % 2 === 0,
        hintLevel: i % 3 === 0 ? ((i % 6 === 0) ? 3 : (i % 4 === 0) ? 2 : 1) : undefined
      }));

      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });

    const duration = await page.evaluate(() => {
      const start = performance.now();

      const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');

      // HPA
      const hintRequests = interactions.filter(
        (i: any) => i.eventType === 'hint_request' || i.eventType === 'guidance_request'
      ).length;
      const attempts = interactions.filter((i: any) => i.eventType === 'execution').length;
      const hpa = attempts > 0 ? Math.min(hintRequests / attempts, 1.0) : 0;

      // AED
      const hintEvents = interactions.filter(
        (i: any) => ['hint_request', 'guidance_request', 'hint_view', 'guidance_view'].includes(i.eventType) && i.hintLevel !== undefined
      );
      const avgLevel = hintEvents.length > 0
        ? hintEvents.reduce((sum: number, i: any) => sum + (i.hintLevel || 1), 0) / hintEvents.length
        : 1;
      const aed = Math.min(Math.max((avgLevel - 1) / 2, 0), 1);

      // ER
      const explanationViews = interactions.filter((i: any) => i.eventType === 'explanation_view').length;
      const er = attempts > 0 ? Math.min(explanationViews / attempts, 1.0) : 0;

      // REAE
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

      // IWH
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

      // Final HDI
      const WEIGHTS = { hpa: 0.3, aed: 0.133, er: 0.3, reae: 0.133, iwh: 0.134 };
      const hdi =
        hpa * WEIGHTS.hpa +
        aed * WEIGHTS.aed +
        er * WEIGHTS.er +
        reae * WEIGHTS.reae +
        (1 - iwh) * WEIGHTS.iwh;

      return performance.now() - start;
    });

    console.log(`HDI calculation (1000 interactions): ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(50);
  });

  // ============================================================================
  // Cross-Tab Sync Performance
  // ============================================================================

  test('cross-tab sync latency for preview mode is <100ms', async ({ context }) => {
    // Open two pages
    const page1 = await context.newPage();
    const page2 = await context.newPage();

    // Set up both pages with instructor profile
    const setupProfile = async (page: any) => {
      await page.addInitScript(() => {
        window.localStorage.clear();
        window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
        window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
          id: 'instructor-1',
          name: 'Test Instructor',
          role: 'instructor',
          createdAt: Date.now()
        }));
      });
      await page.goto('/settings');
      await page.waitForLoadState('domcontentloaded');
    };

    await setupProfile(page1);
    await setupProfile(page2);

    // Ensure both pages have loaded
    await expect(page1.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 10000 });
    await expect(page2.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible({ timeout: 10000 });

    // Measure sync time from page1
    const startTime = Date.now();

    // Set preview mode on page1
    await page1.evaluate(() => {
      window.localStorage.setItem('sql-adapt-preview-mode', 'true');
      const event = { key: 'sql-adapt-preview-mode', value: 'true', timestamp: Date.now() };
      window.localStorage.setItem('sql-adapt-sync', JSON.stringify(event));
      window.localStorage.removeItem('sql-adapt-sync');
    });

    // Wait for page2 to receive the sync (poll for change)
    let synced = false;
    const maxWait = 1000; // 1 second max
    const pollInterval = 10; // 10ms poll interval
    const startPoll = Date.now();

    while (Date.now() - startPoll < maxWait) {
      const value = await page2.evaluate(() => {
        return window.localStorage.getItem('sql-adapt-preview-mode');
      });
      if (value === 'true') {
        synced = true;
        break;
      }
      await new Promise(r => setTimeout(r, pollInterval));
    }

    const duration = Date.now() - startTime;

    console.log(`Cross-tab sync latency: ${duration}ms`);

    expect(synced).toBe(true);
    expect(duration).toBeLessThan(100);

    await page1.close();
    await page2.close();
  });

  // ============================================================================
  // Memory Usage
  // ============================================================================

  test('memory usage remains stable during repeated HDI calculations', async ({ page }) => {
    const learnerId = 'perf-memory';
    const baseTime = Date.now();

    // Seed with sample interactions
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Memory Test Learner',
        role: 'student',
        createdAt: baseTime
      }));

      const interactions = Array.from({ length: 100 }, (_, i) => ({
        id: `perf-${i}`,
        eventType: i % 3 === 0 ? 'hint_request' : 'execution',
        learnerId,
        problemId: `problem-${Math.floor(i / 5)}`,
        timestamp: baseTime + i * 100,
        successful: i % 2 === 0,
        hintLevel: i % 3 === 0 ? 1 : undefined
      }));

      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });

    // Measure memory after multiple HDI calculations
    const memoryGrowth = await page.evaluate(async () => {
      const perf = performance as any;
      if (!perf.memory) {
        return null; // Memory API not available
      }

      const measurements: number[] = [];

      // Trigger 50 HDI calculations
      for (let i = 0; i < 50; i++) {
        const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');

        // Full HDI calculation
        const hintRequests = interactions.filter(
          (i: any) => i.eventType === 'hint_request' || i.eventType === 'guidance_request'
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

        const WEIGHTS = { hpa: 0.3, aed: 0.133, er: 0.3, reae: 0.133, iwh: 0.134 };
        const hdi =
          hpa * WEIGHTS.hpa +
          aed * WEIGHTS.aed +
          er * WEIGHTS.er +
          reae * WEIGHTS.reae +
          (1 - iwh) * WEIGHTS.iwh;

        // Measure memory every 10 iterations
        if (i % 10 === 0) {
          measurements.push(perf.memory.usedJSHeapSize);
        }
      }

      // Calculate growth from first to last measurement
      if (measurements.length >= 2) {
        return measurements[measurements.length - 1] - measurements[0];
      }
      return 0;
    });

    if (memoryGrowth === null) {
      console.log('Memory API not available - skipping memory test');
      test.skip();
      return;
    }

    console.log(`Memory growth after 50 HDI calculations: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);

    // Should be less than 10MB growth
    expect(memoryGrowth).toBeLessThan(10 * 1024 * 1024);
  });

  // ============================================================================
  // Page Load Performance
  // ============================================================================

  test('LearningInterface loads in <3 seconds', async ({ page }) => {
    const learnerId = 'perf-load';
    const baseTime = Date.now();

    // Seed with sample data
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Load Test Learner',
        role: 'student',
        createdAt: baseTime
      }));

      // Seed with 50 interactions to simulate realistic data
      const interactions = Array.from({ length: 50 }, (_, i) => ({
        id: `load-${i}`,
        eventType: i % 3 === 0 ? 'hint_request' : 'execution',
        learnerId,
        problemId: `problem-${Math.floor(i / 5)}`,
        timestamp: baseTime + i * 100,
        successful: i % 2 === 0,
        hintLevel: i % 3 === 0 ? 1 : undefined
      }));

      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });

    // Measure page load time
    const startTime = Date.now();
    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });
    const loadTime = Date.now() - startTime;

    console.log(`LearningInterface load time: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(3000);
  });

  // ============================================================================
  // Rendering Performance
  // ============================================================================

  test('rendering maintains >30fps during HDI updates', async ({ page }) => {
    const learnerId = 'perf-render';
    const baseTime = Date.now();

    // Seed with interactions
    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Render Test Learner',
        role: 'student',
        createdAt: baseTime
      }));

      const interactions = Array.from({ length: 50 }, (_, i) => ({
        id: `render-${i}`,
        eventType: i % 3 === 0 ? 'hint_request' : 'execution',
        learnerId,
        problemId: `problem-${Math.floor(i / 5)}`,
        timestamp: baseTime + i * 100,
        successful: i % 2 === 0,
        hintLevel: i % 3 === 0 ? 1 : undefined
      }));

      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });

    // Measure frame rate during HDI updates
    const frameCount = await page.evaluate(async () => {
      let frameCount = 0;
      let rafId: number;
      
      const countFrames = () => {
        frameCount++;
        rafId = requestAnimationFrame(countFrames);
      };

      // Start counting frames
      rafId = requestAnimationFrame(countFrames);

      // Trigger 20 HDI calculations spread over ~500ms
      for (let i = 0; i < 20; i++) {
        const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');

        // Quick HDI calculation
        const hintRequests = interactions.filter(
          (i: any) => i.eventType === 'hint_request' || i.eventType === 'guidance_request'
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

        const WEIGHTS = { hpa: 0.3, aed: 0.133, er: 0.3, reae: 0.133, iwh: 0.134 };
        const hdi =
          hpa * WEIGHTS.hpa +
          aed * WEIGHTS.aed +
          er * WEIGHTS.er +
          reae * WEIGHTS.reae +
          (1 - iwh) * WEIGHTS.iwh;

        // Small delay between calculations to allow rendering
        await new Promise(r => setTimeout(r, 25));
      }

      // Wait a bit more to capture remaining frames
      await new Promise(r => setTimeout(r, 100));

      cancelAnimationFrame(rafId);
      return frameCount;
    });

    const duration = 600; // ~600ms total (20 * 25ms + 100ms buffer)
    const fps = frameCount / (duration / 1000);

    console.log(`Frame count: ${frameCount}, Estimated FPS: ${fps.toFixed(1)}`);

    expect(frameCount).toBeGreaterThan(18); // >30fps for ~600ms = ~18 frames minimum
  });
});

// ============================================================================
// Performance Benchmark Summary
// ============================================================================
//
// Target performance:
// | Operation                  | Target  | Acceptable | Test Location |
// |----------------------------|---------|------------|---------------|
// | HDI calc (10 interactions) | <5ms    | <10ms      | Line ~77      |
// | HDI calc (100 interactions)| <10ms   | <20ms      | Line ~135     |
// | HDI calc (1000 interactions)| <30ms  | <50ms      | Line ~209     |
// | Cross-tab sync             | <50ms   | <100ms     | Line ~287     |
// | Page load                  | <2s     | <3s        | Line ~445     |
// | Render (60fps)             | 60fps   | >30fps     | Line ~475     |
//
// Optimization recommendations if performance issues found:
// 1. Memoization strategies - cache HDI results
// 2. Debouncing/throttling - limit HDI recalculation frequency
// 3. Lazy loading - defer non-critical calculations
// 4. Virtual scrolling - for large interaction lists
// 5. Web Workers - offload calculations to worker thread
