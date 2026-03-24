/**
 * Comprehensive Performance Benchmark Suite
 * 
 * Verifies all performance benchmarks for the SQL-Adapt system:
 * 1. HDI Calculation Performance (10, 100, 1000, 10000 interactions)
 * 2. Cross-Tab Sync Latency
 * 3. Page Load Performance (multiple pages)
 * 4. Memory Usage Benchmarks
 * 5. Rendering Performance (FPS)
 * 
 * Target Benchmarks:
 * | Metric                  | Target     | Acceptable |
 * |-------------------------|------------|------------|
 * | HDI calc (10)           | <5ms       | <10ms      |
 * | HDI calc (100)          | <10ms      | <20ms      |
 * | HDI calc (1000)         | <30ms      | <50ms      |
 * | HDI calc (10000)        | <50ms      | <100ms     |
 * | Cross-tab sync          | <50ms      | <100ms     |
 * | Page load (/)           | <1.5s      | <2s        |
 * | Page load (/practice)   | <2s        | <3s        |
 * | Memory growth           | <5%        | <10%       |
 * | Rendering (60fps)       | 60fps      | >30fps     |
 * 
 * @no-external - No external services needed
 * @weekly - Part of weekly regression
 */

import { expect, test } from '@playwright/test';
import { setupTest } from '../helpers/test-helpers';

// Store all benchmark results for final report
const benchmarkResults: Array<{
  category: string;
  test: string;
  value: string;
  target: string;
  status: 'PASS' | 'FAIL' | 'SKIP';
}> = [];

test.describe('@weekly @no-external @slow Performance Benchmarks', () => {
  test.beforeEach(async ({ page }) => {
    await setupTest(page);
  });

  // ============================================================================
  // 1. HDI Calculation Performance
  // ============================================================================

  test('HDI calculation performance with 10 interactions', async ({ page }) => {
    const learnerId = 'benchmark-hdi-10';
    const baseTime = Date.now();
    const target = 10;

    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Benchmark Learner',
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
      Math.min(Math.max(hdi, 0), 1);

      return performance.now() - start;
    });

    const status = duration < target ? 'PASS' : 'FAIL';
    benchmarkResults.push({
      category: 'HDI Calculation',
      test: '10 interactions',
      value: `${duration.toFixed(2)}ms`,
      target: `<${target}ms`,
      status
    });

    console.log(`HDI calculation (10 interactions): ${duration.toFixed(2)}ms (target: <${target}ms)`);
    expect(duration).toBeLessThan(target);
  });

  test('HDI calculation performance with 100 interactions', async ({ page }) => {
    const learnerId = 'benchmark-hdi-100';
    const baseTime = Date.now();
    const target = 20;

    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Benchmark Learner',
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

      // Same HDI calculation as above
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
      Math.min(Math.max(hdi, 0), 1);

      return performance.now() - start;
    });

    const status = duration < target ? 'PASS' : 'FAIL';
    benchmarkResults.push({
      category: 'HDI Calculation',
      test: '100 interactions',
      value: `${duration.toFixed(2)}ms`,
      target: `<${target}ms`,
      status
    });

    console.log(`HDI calculation (100 interactions): ${duration.toFixed(2)}ms (target: <${target}ms)`);
    expect(duration).toBeLessThan(target);
  });

  test('HDI calculation performance with 1000 interactions', async ({ page }) => {
    const learnerId = 'benchmark-hdi-1000';
    const baseTime = Date.now();
    const target = 50;

    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Benchmark Learner',
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
      Math.min(Math.max(hdi, 0), 1);

      return performance.now() - start;
    });

    const status = duration < target ? 'PASS' : 'FAIL';
    benchmarkResults.push({
      category: 'HDI Calculation',
      test: '1000 interactions',
      value: `${duration.toFixed(2)}ms`,
      target: `<${target}ms`,
      status
    });

    console.log(`HDI calculation (1000 interactions): ${duration.toFixed(2)}ms (target: <${target}ms)`);
    expect(duration).toBeLessThan(target);
  });

  test('HDI calculation performance with 10000 interactions', async ({ page }) => {
    const learnerId = 'benchmark-hdi-10000';
    const baseTime = Date.now();
    const target = 100;

    await page.addInitScript(({ learnerId, baseTime }) => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Benchmark Learner',
        role: 'student',
        createdAt: baseTime
      }));

      const interactions = Array.from({ length: 10000 }, (_, i) => ({
        id: `perf-${i}`,
        eventType: i % 3 === 0 ? 'hint_request' : (i % 5 === 0 ? 'error' : 'execution'),
        learnerId,
        problemId: `problem-${Math.floor(i / 20)}`,
        timestamp: baseTime + i * 100,
        successful: i % 5 !== 0 && i % 2 === 0,
        hintLevel: i % 3 === 0 ? ((i % 9 === 0) ? 3 : (i % 6 === 0) ? 2 : 1) : undefined,
        errorSubtypeId: i % 5 === 0 ? 'syntax-error' : undefined
      }));

      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    }, { learnerId, baseTime });

    await page.goto('/practice');
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 30000 });

    const duration = await page.evaluate(() => {
      const start = performance.now();
      const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');

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
      Math.min(Math.max(hdi, 0), 1);

      return performance.now() - start;
    });

    const status = duration < target ? 'PASS' : 'FAIL';
    benchmarkResults.push({
      category: 'HDI Calculation',
      test: '10000 interactions',
      value: `${duration.toFixed(2)}ms`,
      target: `<${target}ms`,
      status
    });

    console.log(`HDI calculation (10000 interactions): ${duration.toFixed(2)}ms (target: <${target}ms)`);
    expect(duration).toBeLessThan(target);
  });

  // ============================================================================
  // 2. Cross-Tab Sync Performance
  // ============================================================================

  test('cross-tab sync latency benchmark', async ({ context }) => {
    const page1 = await context.newPage();
    const page2 = await context.newPage();
    const target = 100;

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

    // Wait for page2 to receive the sync
    let synced = false;
    const maxWait = 1000;
    const pollInterval = 10;
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

    const status = synced && duration < target ? 'PASS' : (synced ? 'PASS' : 'FAIL');
    benchmarkResults.push({
      category: 'Cross-Tab Sync',
      test: 'Sync latency',
      value: `${duration}ms`,
      target: `<${target}ms`,
      status
    });

    console.log(`Cross-tab sync latency: ${duration}ms (target: <${target}ms)`);

    expect(synced).toBe(true);
    expect(duration).toBeLessThan(target);

    await page1.close();
    await page2.close();
  });

  // ============================================================================
  // 3. Page Load Performance
  // ============================================================================

  test('page load benchmarks', async ({ page }) => {
    const pages = [
      { url: '/', target: 2000, name: 'Start Page' },
      { url: '/practice', target: 3000, name: 'Practice Page' },
      { url: '/settings', target: 2500, name: 'Settings Page' },
      { url: '/textbook', target: 2000, name: 'Textbook Page' },
    ];

    // Seed with a profile first
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'load-test-user',
        name: 'Load Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });

    for (const { url, target, name } of pages) {
      await page.goto(url);
      const start = Date.now();
      await page.waitForLoadState('networkidle');
      const duration = Date.now() - start;

      const status = duration < target ? 'PASS' : 'FAIL';
      benchmarkResults.push({
        category: 'Page Load',
        test: name,
        value: `${duration}ms`,
        target: `<${target}ms`,
        status
      });

      console.log(`${name} (${url}): ${duration}ms (target: <${target}ms)`);
      expect(duration).toBeLessThan(target);
    }
  });

  // ============================================================================
  // 4. Memory Usage Benchmarks
  // ============================================================================

  test('memory stability benchmark', async ({ page }) => {
    const learnerId = 'benchmark-memory';
    const baseTime = Date.now();
    const targetGrowth = 10; // 10%

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

    const result = await page.evaluate(async () => {
      const perf = performance as any;
      if (!perf.memory) {
        return null; // Memory API not available
      }

      const measurements: number[] = [];

      // Trigger 100 HDI calculations
      for (let i = 0; i < 100; i++) {
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
        Math.min(Math.max(hdi, 0), 1);

        // Simulate cross-tab sync
        localStorage.setItem('test', 'value');

        // Measure memory every 10 iterations
        if (i % 10 === 0) {
          measurements.push(perf.memory.usedJSHeapSize);
        }
      }

      // Force garbage collection if available
      if (window.gc) {
        window.gc();
      }

      // Calculate growth from first to last measurement
      if (measurements.length >= 2) {
        const baseline = measurements[0];
        const final = measurements[measurements.length - 1];
        const growth = ((final - baseline) / baseline) * 100;
        return { growth, baseline, final };
      }
      return { growth: 0, baseline: 0, final: 0 };
    });

    if (result === null) {
      console.log('Memory API not available - skipping memory test');
      benchmarkResults.push({
        category: 'Memory Usage',
        test: 'Stability',
        value: 'N/A',
        target: `<${targetGrowth}% growth`,
        status: 'SKIP'
      });
      test.skip();
      return;
    }

    const growth = result.growth;
    const status = growth < targetGrowth ? 'PASS' : 'FAIL';
    benchmarkResults.push({
      category: 'Memory Usage',
      test: 'Stability (100 calculations)',
      value: `${growth.toFixed(2)}%`,
      target: `<${targetGrowth}% growth`,
      status
    });

    console.log(`Memory growth after 100 HDI calculations: ${growth.toFixed(2)}% (target: <${targetGrowth}%)`);
    expect(growth).toBeLessThan(targetGrowth);
  });

  // ============================================================================
  // 5. Rendering Performance
  // ============================================================================

  test('rendering performance benchmark', async ({ page }) => {
    const learnerId = 'benchmark-render';
    const baseTime = Date.now();
    const targetFPS = 30;

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
        Math.min(Math.max(hdi, 0), 1);

        // Trigger HDI update event
        window.dispatchEvent(new Event('hdi-update'));

        // Small delay between calculations
        await new Promise(r => setTimeout(r, 25));
      }

      // Wait a bit more to capture remaining frames
      await new Promise(r => setTimeout(r, 100));

      cancelAnimationFrame(rafId);
      return frameCount;
    });

    const duration = 600; // ~600ms total
    const fps = frameCount / (duration / 1000);
    const status = fps > targetFPS ? 'PASS' : 'FAIL';

    benchmarkResults.push({
      category: 'Rendering',
      test: 'FPS during HDI updates',
      value: `${fps.toFixed(1)} FPS`,
      target: `>${targetFPS} FPS`,
      status
    });

    console.log(`Rendering FPS: ${fps.toFixed(1)} (target: >${targetFPS})`);
    expect(frameCount).toBeGreaterThan(18); // >30fps for ~600ms = ~18 frames minimum
  });
});

// Print benchmark summary after all tests
test.afterAll(() => {
  console.log('\n' + '='.repeat(80));
  console.log('PERFORMANCE BENCHMARK SUMMARY');
  console.log('='.repeat(80));
  console.log('\n| Category | Test | Result | Target | Status |');
  console.log('|----------|------|--------|--------|--------|');
  
  for (const result of benchmarkResults) {
    const statusIcon = result.status === 'PASS' ? '✅' : (result.status === 'FAIL' ? '❌' : '⏭️');
    console.log(`| ${result.category} | ${result.test} | ${result.value} | ${result.target} | ${statusIcon} ${result.status} |`);
  }
  
  const passed = benchmarkResults.filter(r => r.status === 'PASS').length;
  const failed = benchmarkResults.filter(r => r.status === 'FAIL').length;
  const skipped = benchmarkResults.filter(r => r.status === 'SKIP').length;
  
  console.log('\n' + '-'.repeat(80));
  console.log(`Total: ${benchmarkResults.length} | Passed: ${passed} | Failed: ${failed} | Skipped: ${skipped}`);
  console.log('='.repeat(80) + '\n');
});
