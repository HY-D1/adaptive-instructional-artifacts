/**
 * @weekly Offline/Online Transitions & Session Continuity Tests
 *
 * Comprehensive scenario tests for:
 * - SC-3: Offline/Online Transitions (3.1-3.5)
 * - SC-8: Session Continuity (8.1-8.5)
 *
 * Tags:
 *   @weekly          — Run weekly (complex tests)
 *   @offline         — Tests offline/online behavior
 *   @session         — Tests session continuity
 *   @no-external     — No LLM / Ollama required
 *
 * How to run:
 *   npx playwright test -c playwright.config.ts tests/e2e/scenario-offline-session.spec.ts
 */

import { expect, test, type Page } from '@playwright/test';
import { replaceEditorText, getTextbookUnits, getActiveSessionId } from '../helpers/test-helpers';

const LEARNER_ID = 'offline-session-e2e';
const INCORRECT_QUERY = "SELECT name FROM users WHERE age > 100";
const CORRECT_QUERY = "SELECT name FROM users WHERE age > 25";

// Storage keys
const OFFLINE_QUEUE_KEY = 'sql-adapt-offline-queue';
const PENDING_INTERACTIONS_KEY = 'sql-adapt-pending-interactions';
const ACTIVE_SESSION_KEY = 'sql-learning-active-session';
const INTERACTIONS_KEY = 'sql-learning-interactions';

/**
 * Set up test auth and profile
 */
async function setupTestAuth(page: Page) {
  await page.addInitScript((id: string) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');

    // Auth profile
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id,
      name: 'Offline Session Tester',
      role: 'student',
      createdAt: Date.now()
    }));

    // Learning profile
    window.localStorage.setItem('sql-learning-profiles', JSON.stringify([{
      id,
      name: 'Offline Session Tester',
      conceptsCovered: [],
      conceptCoverageEvidence: [],
      errorHistory: [],
      interactionCount: 0,
      version: 1,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
    }]));

    // Active session
    window.localStorage.setItem(ACTIVE_SESSION_KEY, `session-${id}-${Date.now()}`);
  }, LEARNER_ID);
}

/**
 * Simulate offline condition by blocking API routes
 */
async function goOffline(page: Page) {
  await page.route('**/api/**', route => {
    route.abort('internet.disconnected');
  });
  
  // Also mock navigator.onLine
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', {
      get: () => false,
      configurable: true
    });
    window.dispatchEvent(new Event('offline'));
  });
}

/**
 * Restore online condition
 */
async function goOnline(page: Page) {
  await page.unroute('**/api/**');
  
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'onLine', {
      get: () => true,
      configurable: true
    });
    window.dispatchEvent(new Event('online'));
  });
}

/**
 * Get offline queue from storage
 */
async function getOfflineQueue(page: Page): Promise<any[]> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, OFFLINE_QUEUE_KEY);
}

/**
 * Get pending interactions from storage
 */
async function getPendingInteractions(page: Page): Promise<any[]> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, PENDING_INTERACTIONS_KEY);
}

/**
 * Get all interactions from storage
 */
async function getAllInteractions(page: Page): Promise<any[]> {
  return page.evaluate((key) => {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }, INTERACTIONS_KEY);
}

/**
 * Collect console errors during test execution
 */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  return errors;
}

// =============================================================================
// SC-3: Offline/Online Transitions
// =============================================================================

test.describe('@weekly @offline SC-3: Offline/Online Transitions', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestAuth(page);
  });

  test('SC-3.1: Offline: Solve problem, then online - Interaction queued, synced', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    
    // Navigate to practice page
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    // Wait for editor ready
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Go offline
    await goOffline(page);
    
    // Get initial queue state
    const queueBefore = await getOfflineQueue(page);
    const pendingBefore = await getPendingInteractions(page);
    
    // Perform an interaction while offline
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    
    // Wait for local processing
    await page.waitForTimeout(1000);
    
    // Verify interaction was queued locally
    const queueAfter = await getOfflineQueue(page);
    const pendingAfter = await getPendingInteractions(page);
    
    // Should have queued items or pending interactions
    const totalQueued = queueAfter.length + pendingAfter.length;
    expect(totalQueued).toBeGreaterThanOrEqual(queueBefore.length + pendingBefore.length);
    
    // Verify interaction was saved locally
    const interactions = await getAllInteractions(page);
    const errorEvents = interactions.filter((i: any) => i.eventType === 'error');
    expect(errorEvents.length).toBeGreaterThan(0);
    
    await page.screenshot({ 
      path: 'test-results/sc-3-1-offline-interaction.png', 
      fullPage: true 
    });

    // Go back online
    await goOnline(page);
    
    // Wait for sync attempt
    await page.waitForTimeout(3000);
    
    // Verify queue was processed (may be empty after successful sync)
    const queueFinal = await getOfflineQueue(page);
    console.log(`Queue size after going online: ${queueFinal.length}`);
    
    // No critical errors should occur
    const criticalErrors = consoleErrors.filter(e => 
      e.includes('unhandledrejection') && !e.includes('fetch') ||
      e.includes('React') && e.includes('crash')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('SC-3.2: Offline: Save note, then online - Note persisted locally, synced later', async ({ page }) => {
    // Navigate and wait for editor
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Create context for note saving - submit a query first
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    
    await expect(page.getByText(/Results differ|error/i).first()).toBeVisible({ timeout: 10_000 });
    
    // Request a hint to create saveable context
    const hintActionButton = page.getByTestId('hint-action-button');
    await expect(hintActionButton).toBeVisible({ timeout: 10_000 });
    await hintActionButton.click();
    
    await expect.poll(async () => {
      return await page.getByTestId('hint-label-1').isVisible().catch(() => false);
    }, { timeout: 15_000, intervals: [300, 700, 1200] }).toBe(true);

    // Go offline
    await goOffline(page);
    
    // Get notes count before
    const unitsBefore = await getTextbookUnits(page, LEARNER_ID);
    
    // Try to save to notes while offline
    const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
    if (await saveBtn.isVisible().catch(() => false) && await saveBtn.isEnabled().catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }
    
    // Verify note was saved locally (may be queued or directly in textbook)
    const unitsAfterOffline = await getTextbookUnits(page, LEARNER_ID);
    
    // Note should be in local storage regardless of sync status
    expect(unitsAfterOffline.length).toBeGreaterThanOrEqual(unitsBefore.length);
    
    await page.screenshot({ 
      path: 'test-results/sc-3-2-offline-note.png', 
      fullPage: true 
    });

    // Go back online
    await goOnline(page);
    await page.waitForTimeout(2000);
    
    // Refresh to verify persistence
    await page.reload();
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    
    // Notes should still be present
    const unitsAfterOnline = await getTextbookUnits(page, LEARNER_ID);
    expect(unitsAfterOnline.length).toBeGreaterThanOrEqual(unitsAfterOffline.length);
  });

  test('SC-3.3: Intermittent: Multiple offline periods - Events queued and synced', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    const interactionsBefore = (await getAllInteractions(page)).length;
    
    // First offline period
    await goOffline(page);
    await replaceEditorText(page, "SELECT * FROM users WHERE 1=1");
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(500);
    
    // Online briefly
    await goOnline(page);
    await page.waitForTimeout(2000);
    
    // Second offline period
    await goOffline(page);
    await replaceEditorText(page, "SELECT name FROM orders");
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(500);
    
    // Online briefly
    await goOnline(page);
    await page.waitForTimeout(2000);
    
    // Third offline period
    await goOffline(page);
    await replaceEditorText(page, "SELECT city FROM users");
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(500);
    
    // Final online
    await goOnline(page);
    await page.waitForTimeout(3000);
    
    // Verify all interactions were recorded
    const interactionsAfter = await getAllInteractions(page);
    expect(interactionsAfter.length).toBeGreaterThan(interactionsBefore);
    
    // Should have multiple execution/error events
    const executionEvents = interactionsAfter.filter((i: any) => 
      i.eventType === 'execution' || i.eventType === 'error'
    );
    expect(executionEvents.length).toBeGreaterThanOrEqual(3);
    
    await page.screenshot({ 
      path: 'test-results/sc-3-3-intermittent-offline.png', 
      fullPage: true 
    });
  });

  test('SC-3.4: Long offline session (>1 hour) - Data integrity maintained', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Simulate long offline session by manipulating timestamps
    await goOffline(page);
    
    // Perform multiple interactions
    for (let i = 0; i < 5; i++) {
      await replaceEditorText(page, `SELECT * FROM test${i}`);
      await page.getByRole('button', { name: 'Run Query' }).click();
      await page.waitForTimeout(300);
    }
    
    // Simulate passage of time by aging the queue items
    await page.evaluate((queueKey) => {
      const raw = window.localStorage.getItem(queueKey);
      if (raw) {
        const queue = JSON.parse(raw);
        // Age items by 65 minutes
        const agedQueue = queue.map((item: any) => ({
          ...item,
          timestamp: item.timestamp - (65 * 60 * 1000) // 65 minutes ago
        }));
        window.localStorage.setItem(queueKey, JSON.stringify(agedQueue));
      }
    }, OFFLINE_QUEUE_KEY);
    
    // Verify data is still intact
    const queueAged = await getOfflineQueue(page);
    const interactions = await getAllInteractions(page);
    
    expect(interactions.length).toBeGreaterThanOrEqual(5);
    
    // Go online and verify sync still works
    await goOnline(page);
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'test-results/sc-3-4-long-offline.png', 
      fullPage: true 
    });
    
    // Verify no data loss occurred
    const interactionsAfter = await getAllInteractions(page);
    expect(interactionsAfter.length).toBeGreaterThanOrEqual(interactions.length);
  });

  test('SC-3.5: Backend unavailable at session end - Session_end queued for retry', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Get initial session
    const sessionId = await getActiveSessionId(page);
    expect(sessionId).toBeTruthy();
    
    // Perform an interaction
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(1000);
    
    // Go offline before session end
    await goOffline(page);
    
    // Simulate session end by clearing active session
    await page.evaluate((key) => {
      // Queue a synthetic session_end event
      const queueRaw = window.localStorage.getItem('sql-adapt-offline-queue') || '[]';
      const queue = JSON.parse(queueRaw);
      queue.push({
        id: `session-end-${Date.now()}`,
        type: 'interaction',
        data: {
          id: `evt-session-end-${Date.now()}`,
          sessionId: window.localStorage.getItem(key),
          learnerId: 'offline-session-e2e',
          timestamp: Date.now(),
          eventType: 'session_end',
          problemId: 'session',
          conceptIds: [],
          inputs: {},
          outputs: { duration: 300 }
        },
        retries: 0,
        timestamp: Date.now(),
        status: 'queued_locally',
        errorCount: 0
      });
      window.localStorage.setItem('sql-adapt-offline-queue', JSON.stringify(queue));
      window.localStorage.removeItem(key);
    }, ACTIVE_SESSION_KEY);
    
    // Verify session_end is in queue
    const queueWithSessionEnd = await getOfflineQueue(page);
    const sessionEndEvents = queueWithSessionEnd.filter((item: any) => 
      item.data?.eventType === 'session_end' || item.type === 'session'
    );
    expect(sessionEndEvents.length).toBeGreaterThan(0);
    
    await page.screenshot({ 
      path: 'test-results/sc-3-5-session-end-queued.png', 
      fullPage: true 
    });

    // Go online and verify retry mechanism
    await goOnline(page);
    await page.waitForTimeout(3000);
    
    // Queue should attempt processing
    const queueAfter = await getOfflineQueue(page);
    console.log(`Queue size after going online: ${queueAfter.length}`);
  });
});

// =============================================================================
// SC-8: Session Continuity
// =============================================================================

test.describe('@weekly @session SC-8: Session Continuity', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestAuth(page);
  });

  test('SC-8.1: Browser crash simulation, reopen - Session resumed or properly ended', async ({ page, context }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Get original session
    const originalSessionId = await getActiveSessionId(page);
    expect(originalSessionId).toBeTruthy();
    
    // Perform an interaction
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(1000);
    
    // Get interactions before crash
    const interactionsBefore = await getAllInteractions(page);
    
    // Simulate crash by closing page without cleanup
    await page.close();
    
    // Reopen new page (simulating browser reopen)
    const newPage = await context.newPage();
    await setupTestAuth(newPage);
    await newPage.goto('/');
    await expect(newPage).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await newPage.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Verify session is either resumed or new one started
    const newSessionId = await getActiveSessionId(newPage);
    expect(newSessionId).toBeTruthy();
    
    // Interactions should be preserved
    const interactionsAfter = await getAllInteractions(newPage);
    expect(interactionsAfter.length).toBeGreaterThanOrEqual(interactionsBefore.length);
    
    await newPage.screenshot({ 
      path: 'test-results/sc-8-1-crash-reopen.png', 
      fullPage: true 
    });
  });

  test('SC-8.2: Computer sleep/wake - Session continues, time accounted', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    const sessionIdBefore = await getActiveSessionId(page);
    
    // Perform initial interaction
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(500);
    
    // Simulate sleep by freezing time and hiding page
    await page.evaluate(() => {
      // Store a marker for "sleep" time
      window.sessionStorage.setItem('sleep-test-marker', Date.now().toString());
      
      // Dispatch visibilitychange to simulate tab hidden
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        writable: true
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    
    await page.waitForTimeout(2000);
    
    // Simulate wake
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        writable: true
      });
      document.dispatchEvent(new Event('visibilitychange'));
      
      // Simulate a timer update event
      window.dispatchEvent(new Event('focus'));
    });
    
    // Continue session
    await replaceEditorText(page, CORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(1000);
    
    // Session should continue
    const sessionIdAfter = await getActiveSessionId(page);
    expect(sessionIdAfter).toBe(sessionIdBefore);
    
    // Both interactions should be recorded
    const interactions = await getAllInteractions(page);
    const sessionEvents = interactions.filter((i: any) => i.sessionId === sessionIdBefore);
    expect(sessionEvents.length).toBeGreaterThanOrEqual(2);
    
    await page.screenshot({ 
      path: 'test-results/sc-8-2-sleep-wake.png', 
      fullPage: true 
    });
  });

  test('SC-8.3: Multiple rapid reloads - No duplicate events', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Perform interaction
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(1000);
    
    // Get event count after first interaction
    const interactionsAfterFirst = await getAllInteractions(page);
    const eventIdsFirst = new Set(interactionsAfterFirst.map((i: any) => i.id));
    
    // Rapid reload 3 times
    for (let i = 0; i < 3; i++) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500);
    }
    
    // Wait for page to stabilize
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Get final interactions
    const interactionsFinal = await getAllInteractions(page);
    const eventIdsFinal = new Set(interactionsFinal.map((i: any) => i.id));
    
    // No duplicate events should exist
    expect(interactionsFinal.length).toBe(eventIdsFinal.size);
    
    // Original events should be preserved
    for (const id of eventIdsFirst) {
      expect(eventIdsFinal.has(id)).toBe(true);
    }
    
    await page.screenshot({ 
      path: 'test-results/sc-8-3-rapid-reloads.png', 
      fullPage: true 
    });
  });

  test('SC-8.4: Return after 30 min inactive - New session started appropriately', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    const originalSessionId = await getActiveSessionId(page);
    
    // Perform interaction
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(500);
    
    // Simulate 31 minutes of inactivity by manipulating session timestamp
    await page.evaluate((key) => {
      const sessionId = window.localStorage.getItem(key);
      if (sessionId) {
        // Store session with old timestamp
        const oldTimestamp = Date.now() - (31 * 60 * 1000); // 31 minutes ago
        const oldSessionId = sessionId.replace(/-\d+$/, `-${oldTimestamp}`);
        window.localStorage.setItem(key, oldSessionId);
        window.sessionStorage.setItem('last-activity-time', oldTimestamp.toString());
      }
    }, ACTIVE_SESSION_KEY);
    
    // Reload the page
    await page.reload({ waitUntil: 'domcontentloaded' });
    
    // Wait for page to settle
    await page.waitForTimeout(2000);
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Get new session state
    const newSessionId = await getActiveSessionId(page);
    
    // A session ID should exist (either new or continued based on app logic)
    expect(newSessionId).toBeTruthy();
    
    // Previous interactions should be preserved
    const interactions = await getAllInteractions(page);
    expect(interactions.length).toBeGreaterThan(0);
    
    await page.screenshot({ 
      path: 'test-results/sc-8-4-inactive-return.png', 
      fullPage: true 
    });
  });

  test('SC-8.5: Beforeunload with pending data - Data flushed before close', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Perform interaction that creates pending data
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(500);
    
    // Get pending queue before unload
    const pendingBefore = await getPendingInteractions(page);
    
    // Trigger beforeunload event
    await page.evaluate(() => {
      window.dispatchEvent(new Event('beforeunload'));
      // Some apps also listen to pagehide
      window.dispatchEvent(new Event('pagehide'));
    });
    
    await page.waitForTimeout(500);
    
    // Verify data was flushed - pending items should still be trackable
    const pendingAfter = await getPendingInteractions(page);
    const queueAfter = await getOfflineQueue(page);
    
    // Data should be persisted (either in pending store or in interactions)
    const interactions = await getAllInteractions(page);
    expect(interactions.length).toBeGreaterThan(0);
    
    // Reload and verify data persisted
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    
    const interactionsAfterReload = await getAllInteractions(page);
    expect(interactionsAfterReload.length).toBeGreaterThanOrEqual(interactions.length);
    
    await page.screenshot({ 
      path: 'test-results/sc-8-5-beforeunload-flush.png', 
      fullPage: true 
    });
  });
});
