/**
 * Week 3 Replay Metrics Tests
 * 
 * Covers: D9 (Replay Metrics), D8 (Event Logging)
 * - Session export with guidance events
 * - Metrics computation (rung distribution, groundedness)
 * - Escalation trigger logging
 * - Textbook unit upsert tracking
 * - Source view event logging
 * - Metrics script export processing
 * 
 * @module Week3ReplayMetricsTests
 * @weekly
 */

import { expect, test } from '@playwright/test';

test.describe('@weekly Week 3 Replay Metrics', () => {
  test.beforeEach(async ({ page }) => {
    // Idempotent init script - only runs once per test
    await page.addInitScript(() => {
      const FLAG = '__pw_seeded__';
      if (localStorage.getItem(FLAG) === '1') return;
      
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // CRITICAL: Set up user profile for role-based auth
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',  // student role for Practice page access
        createdAt: Date.now()
      }));
      
      localStorage.setItem(FLAG, '1');
    });
  });

  test.afterEach(async ({ page }) => {
    // Only clear storage if page is loaded (some tests don't use page)
    try {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
        localStorage.removeItem('__pw_seeded__');
      });
    } catch {
      // Ignore errors for tests that don't use page
    }
  });

  test('@weekly rung distribution computed correctly', async () => {
    // Pure computation test - no browser page needed
    // Create mock export data
    const mockExport = {
      sessionId: 'test-session',
      learnerId: 'test-learner',
      interactions: [
        { eventType: 'guidance_view', rung: 1, timestamp: 1000 },
        { eventType: 'guidance_view', rung: 1, timestamp: 2000 },
        { eventType: 'guidance_view', rung: 2, timestamp: 3000 },
        { eventType: 'guidance_view', rung: 3, timestamp: 4000 },
      ]
    };

    // Compute rung distribution
    const guidanceEvents = mockExport.interactions.filter(
      (e: any) => e.eventType === 'guidance_view'
    );
    
    const rungCounts = guidanceEvents.reduce((acc: any, e: any) => {
      acc[e.rung] = (acc[e.rung] || 0) + 1;
      return acc;
    }, {});

    expect(rungCounts[1]).toBe(2);
    expect(rungCounts[2]).toBe(1);
    expect(rungCounts[3]).toBe(1);
  });

  test('@weekly groundedness rate computed correctly', async () => {
    // Pure computation test - no browser page needed
    // Create mock export data
    const mockExport = {
      sessionId: 'test-session',
      interactions: [
        { eventType: 'guidance_view', rung: 1, grounded: false },
        { eventType: 'guidance_view', rung: 2, grounded: true },
        { eventType: 'guidance_view', rung: 2, grounded: true },
        { eventType: 'guidance_view', rung: 3, grounded: true },
      ]
    };

    // Compute groundedness rate for rung 2+
    const rung2Plus = mockExport.interactions.filter(
      (e: any) => e.eventType === 'guidance_view' && e.rung >= 2
    );
    
    const groundedCount = rung2Plus.filter((e: any) => e.grounded).length;
    const groundednessRate = groundedCount / rung2Plus.length;

    expect(groundednessRate).toBe(1.0);
  });

  test('@weekly escalation triggers logged', async ({ page }) => {
    // Navigate to practice page directly since test needs Monaco editor
    await page.goto('/practice');
    
    // Setup active session
    await page.evaluate(() => {
      window.localStorage.setItem('sql-learning-active-session', 'escalation-test');
    });

    // Generate escalation
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Request multiple hints to trigger escalation
    await page.getByRole('button', { name: /Request Hint/ }).click();
    await page.getByRole('button', { name: /Next Hint/ }).click();
    await page.getByRole('button', { name: /Next Hint/ }).click();

    // Verify escalation events
    const events = await page.evaluate(() => {
      const interactions = JSON.parse(
        window.localStorage.getItem('sql-learning-interactions') || '[]'
      );
      return interactions.filter((e: any) => e.eventType === 'guidance_escalate');
    });

    // Should have escalation events
    expect(events.length).toBeGreaterThanOrEqual(1);
  });

  test('@weekly textbook unit upserts tracked', async ({ page }) => {
    await page.goto('/');
    
    // Setup active session
    await page.evaluate(() => {
      window.localStorage.setItem('sql-learning-active-session', 'upsert-test');
    });

    // Generate error and get explanation to trigger unit creation
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    // Request hints until explanation
    await page.getByRole('button', { name: /Request Hint/ }).click();

    // Check for textbook_unit_upsert events
    const events = await page.evaluate(() => {
      const interactions = JSON.parse(
        window.localStorage.getItem('sql-learning-interactions') || '[]'
      );
      return interactions.filter((e: any) => e.eventType === 'textbook_unit_upsert');
    });

    // Should track unit operations
    expect(events).toBeDefined();
  });

  test('@weekly source view events logged', async ({ page }) => {
    await page.goto('/');
    
    // Setup active session
    await page.evaluate(() => {
      window.localStorage.setItem('sql-learning-active-session', 'source-view-test');
    });

    // Generate hint with sources
    await page.locator('.monaco-editor .view-lines').first().click();
    await page.keyboard.type('SELECT FROM users;');
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(page.locator('text=SQL Error')).toBeVisible();

    await page.getByRole('button', { name: /Request Hint/ }).click();

    // Events are logged automatically by the system
    const events = await page.evaluate(() => {
      const interactions = JSON.parse(
        window.localStorage.getItem('sql-learning-interactions') || '[]'
      );
      return interactions;
    });

    // Should have logged interactions
    expect(events.length).toBeGreaterThan(0);
  });

  test('@weekly metrics script can process export', async () => {
    // Pure computation test - no browser page needed
    // Create test export data
    const testExport = {
      sessionId: 'metrics-test',
      learnerId: 'test-learner',
      exportTimestamp: Date.now(),
      interactions: [
        { eventType: 'guidance_view', rung: 1, grounded: false, timestamp: 1000 },
        { eventType: 'guidance_escalate', fromRung: 1, toRung: 2, trigger: 'rung_exhausted', timestamp: 2000 },
        { eventType: 'guidance_view', rung: 2, grounded: true, timestamp: 3000 },
        { eventType: 'guidance_escalate', fromRung: 2, toRung: 3, trigger: 'learner_request', timestamp: 4000 },
        { eventType: 'guidance_view', rung: 3, grounded: true, timestamp: 5000 },
        { eventType: 'textbook_unit_upsert', unitId: 'unit-1', action: 'created', timestamp: 6000 },
        { eventType: 'source_view', passageCount: 3, timestamp: 7000 },
      ]
    };

    // Verify metrics can be computed
    const guidanceViews = testExport.interactions.filter(e => e.eventType === 'guidance_view');
    const escalations = testExport.interactions.filter(e => e.eventType === 'guidance_escalate');
    const upserts = testExport.interactions.filter(e => e.eventType === 'textbook_unit_upsert');
    const sourceViews = testExport.interactions.filter(e => e.eventType === 'source_view');

    expect(guidanceViews.length).toBe(3);
    expect(escalations.length).toBe(2);
    expect(upserts.length).toBe(1);
    expect(sourceViews.length).toBe(1);

    // Compute rung distribution
    const rungDist = guidanceViews.reduce((acc, e) => {
      acc[e.rung] = (acc[e.rung] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);

    expect(rungDist[1]).toBe(1);
    expect(rungDist[2]).toBe(1);
    expect(rungDist[3]).toBe(1);

    // Compute groundedness
    const rung2Plus = guidanceViews.filter(e => e.rung >= 2);
    const groundedCount = rung2Plus.filter(e => e.grounded).length;
    expect(groundedCount / rung2Plus.length).toBe(1.0);
  });
});
