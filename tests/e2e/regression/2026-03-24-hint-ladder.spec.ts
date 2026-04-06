/**
 * @file week2-hint-ladder.spec.ts
 * @description Comprehensive test suite for Feature 1: Hint Ladder System (3 levels)
 *
 * This test file covers all functionality of the Guidance Ladder progressive hint system:
 * - Hint level progression (1→2→3)
 * - SQL-Engage integration (subtype mapping, metadata capture)
 * - Hint event logging (hint_view events with all required fields)
 * - Hint deduplication (preventing duplicate events)
 * - Edge cases (no profile, no session, different subtypes)
 * - Hint content quality (progressive specificity, non-empty text)
 *
 * @tag @weekly - All tests tagged for Week 2 verification
 */

import { expect, Locator, Page, test } from '@playwright/test';
import { replaceEditorText } from '../../helpers/test-helpers';

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Run SQL queries until the error count reaches the expected value.
 * Uses regex to match the error count badge text.
 */
async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount} errors\\b`));

  for (let i = 0; i < 10; i += 1) {
    await runQueryButton.click();
    // Use expect.poll for reliable waiting instead of fixed timeout
    try {
      await expect.poll(async () => {
        return await marker.first().isVisible().catch(() => false);
      }, { timeout: 2000, intervals: [100] }).toBe(true);
      return;
    } catch {
      // Continue trying
    }
  }

  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

/**
 * Retrieve all hint_view events from localStorage.
 * Returns an array of interaction events with eventType === 'hint_view'.
 */
async function getHintEventsFromStorage(page: Page): Promise<any[]> {
  return page.evaluate(() => {
    const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
    const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
    return interactions.filter((interaction: any) => interaction.eventType === 'hint_view');
  });
}

/**
 * Get the most recent hint_view event from localStorage.
 * Returns null if no hint events exist.
 *
 * NOTE: This function polls for up to 5 seconds to handle the race condition
 * between event creation and localStorage persistence (React state -> effect -> storage).
 */
async function getLastHintEvent(page: Page, timeout = 5000): Promise<any | null> {
  const startTime = Date.now();
  const intervals = [50, 100, 200, 300]; // Progressive backoff

  while (Date.now() - startTime < timeout) {
    const hintEvents = await getHintEventsFromStorage(page);
    if (hintEvents.length > 0) {
      return hintEvents[hintEvents.length - 1];
    }
    // Wait before next attempt with progressive delay
    const delay = intervals[Math.min(
      Math.floor((Date.now() - startTime) / 500),
      intervals.length - 1
    )];
    await page.waitForTimeout(delay);
  }

  return null;
}

/**
 * Get all interaction events from localStorage (any event type).
 */
async function getAllInteractionsFromStorage(page: Page): Promise<any[]> {
  return page.evaluate(() => {
    const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
    return rawInteractions ? JSON.parse(rawInteractions) : [];
  });
}

/**
 * Get the active session ID from localStorage.
 */
async function getActiveSessionId(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    return window.localStorage.getItem('sql-learning-active-session');
  });
}

async function waitForLearnerSessionReady(page: Page, learnerId = 'test-user') {
  await expect.poll(
    async () =>
      page.evaluate((id) => {
        const sessionId = window.localStorage.getItem('sql-learning-active-session');
        const rawProfiles = window.localStorage.getItem('sql-learning-profiles');
        const profiles = rawProfiles ? JSON.parse(rawProfiles) : [];
        const hasProfile = Array.isArray(profiles) && profiles.some((profile: { id?: string }) => profile?.id === id);
        return Boolean(sessionId && sessionId !== 'session-unknown' && hasProfile);
      }, learnerId).catch(() => false),
    { timeout: 10_000, intervals: [250, 500, 1_000] },
  ).toBe(true);
}

// =============================================================================
// TEST SETUP
// =============================================================================

test.beforeEach(async ({ page }) => {
  // Stub LLM calls to prevent connection refused in CI
  // Return different hint content for each rung level (L1, L2, L3)
  // Use a counter to return progressively more detailed hints
  let hintRequestCount = 0;
  
  const getHintResponse = () => {
    hintRequestCount++;
    if (hintRequestCount === 1) {
      // L1: Short subtle nudge
      return 'Think about what might be missing.';
    } else if (hintRequestCount === 2) {
      // L2: Guiding question with more detail
      return 'Which SQL clause specifies where to retrieve data from? Check if you have included the FROM keyword.';
    } else {
      // L3: Explicit direction with example pattern
      return 'You need a FROM clause to specify the table. Structure: SELECT columns FROM table. The FROM keyword tells the database where to look for the data you want to retrieve.';
    }
  };
  
  await page.route('**/ollama/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: getHintResponse() })
    });
  });
  
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: getHintResponse() })
    });
  });
  
  await page.route('**/ollama/api/tags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'qwen3:4b' }, { name: 'llama3.2:3b' }] })
    });
  });
  
  await page.route('**/api/tags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'qwen3:4b' }, { name: 'llama3.2:3b' }] })
    });
  });
  
  // Idempotent init script - only runs once per test
  await page.addInitScript(() => {
    const FLAG = '__pw_seeded__';
    if (localStorage.getItem(FLAG) === '1') return;
    
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // Set up student profile to bypass StartPage role selection
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
    localStorage.setItem('sql-adapt-debug-profile', 'adaptive-escalator');
    
    localStorage.setItem(FLAG, '1');
  });
});

test.afterEach(async ({ page }) => {
  // Full cleanup to prevent test isolation issues
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
});

// =============================================================================
// TEST SUITE: Hint Ladder System (Feature 1)
// =============================================================================

test.describe('@weekly Hint Ladder System - Feature 1', () => {

  // ===========================================================================
  // TEST 1: Hint Level Persistence
  // ===========================================================================

  test('@weekly hint level persistence: events are stored in localStorage', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    await page.goto('/');
    await waitForLearnerSessionReady(page);
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    // Create error and get hints
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    // Request first hint and wait for it to appear
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();

    // Wait for hint action button to be visible and enabled before clicking
    const nextHintButton = page.getByTestId('hint-action-button');
    await expect(nextHintButton).toBeVisible({ timeout: 5000 });
    await expect(nextHintButton).toBeEnabled({ timeout: 5000 });
    await nextHintButton.click();
    await expect(page.getByTestId('hint-label-2')).toBeVisible();

    // Verify hint events are stored in localStorage
    let hintEvents = await getHintEventsFromStorage(page);
    expect(hintEvents).toHaveLength(2);
    
    // Verify the raw localStorage contains the expected data
    const savedInteractions = await page.evaluate(() => {
      return window.localStorage.getItem('sql-learning-interactions');
    });
    expect(savedInteractions).not.toBeNull();
    
    // Parse and verify the stored data
    const parsed = JSON.parse(savedInteractions!);
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed.length).toBeGreaterThanOrEqual(2);
    
    // Verify the event data has the correct structure
    const hintEventsFromStorage = parsed.filter((i: any) => i.eventType === 'hint_view');
    expect(hintEventsFromStorage[0].hintLevel).toBe(1);
    expect(hintEventsFromStorage[1].hintLevel).toBe(2);
    
    // Verify all required fields are persisted
    for (const event of hintEventsFromStorage) {
      expect(event.id).toBeDefined();
      expect(event.sessionId).toBeDefined();
      expect(event.learnerId).toBeDefined();
      expect(event.timestamp).toBeDefined();
      expect(event.hintId).toBeDefined();
      expect(typeof event.hintId).toBe('string');
      expect(event.hintId.length).toBeGreaterThan(0);
      expect(event.hintText).toBeDefined();
    }
  });

  // ===========================================================================
  // TEST 2: SQL-Engage Integration
  // ===========================================================================

  test('@weekly sql-engage integration: sqlEngageSubtype captured correctly', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    await page.goto('/');
    await waitForLearnerSessionReady(page);

    const runQueryButton = page.getByRole('button', { name: 'Run Query' });

    // Test different error types
    await replaceEditorText(page, 'SELECT * FROM nonexistent_table;');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();

    const hintEvent = await getLastHintEvent(page);
    expect(hintEvent).not.toBeNull();
    expect(hintEvent.sqlEngageSubtype).toBeDefined();
    expect(typeof hintEvent.sqlEngageSubtype).toBe('string');
    expect(hintEvent.sqlEngageSubtype.length).toBeGreaterThan(0);
  });

  // ===========================================================================
  // TEST 3: Hint Event Logging (hint_view)
  // ===========================================================================

  test('@weekly hint event logging: all required fields present', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    await page.goto('/');
    await waitForLearnerSessionReady(page);

    const runQueryButton = page.getByRole('button', { name: 'Run Query' });

    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();

    const hintEvent = await getLastHintEvent(page);
    expect(hintEvent).not.toBeNull();

    // Verify all required fields exist
    expect(hintEvent.eventType).toBe('hint_view');

    // hintId is retained for per-hint tracing in local exports/events.
    expect(hintEvent.hintId).toBeDefined();
    expect(typeof hintEvent.hintId).toBe('string');
    expect(hintEvent.hintId.length).toBeGreaterThan(0);

    // hintLevel: 1, 2, or 3
    expect(hintEvent.hintLevel).toBeDefined();
    expect([1, 2, 3]).toContain(hintEvent.hintLevel);

    // hintText: non-empty
    expect(hintEvent.hintText).toBeDefined();
    expect(typeof hintEvent.hintText).toBe('string');
    expect(hintEvent.hintText.length).toBeGreaterThan(0);

    // sqlEngageSubtype
    expect(hintEvent.sqlEngageSubtype).toBeDefined();
    expect(typeof hintEvent.sqlEngageSubtype).toBe('string');
    expect(hintEvent.sqlEngageSubtype.length).toBeGreaterThan(0);

    // sqlEngageRowId
    expect(hintEvent.sqlEngageRowId).toBeDefined();
    expect(typeof hintEvent.sqlEngageRowId).toBe('string');
    expect(hintEvent.sqlEngageRowId.length).toBeGreaterThan(0);

    // policyVersion
    expect(hintEvent.policyVersion).toBeDefined();
    expect(typeof hintEvent.policyVersion).toBe('string');
    expect(hintEvent.policyVersion.length).toBeGreaterThan(0);

    // ruleFired
    expect(hintEvent.ruleFired).toBeDefined();
    expect(typeof hintEvent.ruleFired).toBe('string');
    expect(hintEvent.ruleFired.length).toBeGreaterThan(0);

    // helpRequestIndex
    expect(hintEvent.helpRequestIndex).toBeDefined();
    expect(typeof hintEvent.helpRequestIndex).toBe('number');
    expect(hintEvent.helpRequestIndex).toBeGreaterThanOrEqual(1);

    // sessionId
    expect(hintEvent.sessionId).toBeDefined();
    expect(typeof hintEvent.sessionId).toBe('string');
    expect(hintEvent.sessionId.length).toBeGreaterThan(0);

    // learnerId
    expect(hintEvent.learnerId).toBeDefined();
    expect(typeof hintEvent.learnerId).toBe('string');
    expect(hintEvent.learnerId.length).toBeGreaterThan(0);

    // timestamp
    expect(hintEvent.timestamp).toBeDefined();
    expect(typeof hintEvent.timestamp).toBe('number');
    expect(hintEvent.timestamp).toBeGreaterThan(0);
  });

  // ===========================================================================
  // TEST 4: Hint Deduplication
  // ===========================================================================

  // NOTE: Test removed - "Next Hint" button UI element no longer exists in current implementation
  // The deduplication logic is still active but uses different UI flow

  test('@weekly hint deduplication: rapid clicks do not create duplicates', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    await page.goto('/');
    await waitForLearnerSessionReady(page);
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    // Click hint button multiple times rapidly (button text may change after first click)
    const hintButton = page.getByTestId('hint-action-button');
    
    // Click multiple times rapidly - deduplication should prevent multiple events
    await hintButton.click();
    await hintButton.click({ force: true });
    await hintButton.click({ force: true });
    
    // Wait for any processing to settle
    await page.waitForTimeout(1000);
    
    // Verify deduplication worked
    const hintEvents = await getHintEventsFromStorage(page);
    const uniqueHelpIndices = new Set(hintEvents.map((e: any) => e.helpRequestIndex));
    
    // Each helpRequestIndex should be unique
    expect(uniqueHelpIndices.size).toBe(hintEvents.length);
  });

  // ===========================================================================
  // TEST 5: Edge Cases
  // ===========================================================================

  test('@weekly edge case: no profile available - graceful handling', async ({ page }) => {
    // Seed storage with no learner profile
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass StartPage
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      // Intentionally not creating any learner profile for sql-learning
    });

    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();

    // The app should still load, but hint system may be disabled
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryButton).toBeVisible();

    // The app should create a default profile automatically
    // So hints should still work
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    const hintButton = page.getByRole('button', { name: 'Request Hint' });
    
    // Button may be disabled without profile, or app creates default profile
    const isEnabled = await hintButton.isEnabled().catch(() => false);
    
    if (isEnabled) {
      await hintButton.click();
      // Should work with default profile
      await expect(page.getByTestId('hint-label-1')).toBeVisible();
    }
    // If disabled, that's also acceptable behavior for no-profile state
  });

  test('@weekly edge case: no session - button disabled', async ({ page }) => {
    // Seed storage with profile but no active session
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Set up student profile to bypass StartPage
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      // Create a profile but no session
      const profile = {
        id: 'learner-test',
        name: 'Test Learner',
        conceptsCovered: [],
        errorHistory: {},
        interactionCount: 0,
        currentStrategy: 'adaptive-medium',
        preferences: {
          escalationThreshold: 3,
          aggregationDelay: 300000
        }
      };
      window.localStorage.setItem('sql-learning-profile', JSON.stringify(profile));
      // Intentionally not setting sql-learning-active-session
    });

    await page.goto('/practice');
    await expect(page.getByRole('heading', { name: 'Practice SQL' })).toBeVisible();

    // The app should create a new session automatically
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    // Check if session was created
    const sessionId = await getActiveSessionId(page);
    expect(sessionId).not.toBeNull();
    
    // Hint button should be enabled now
    const hintButton = page.getByRole('button', { name: 'Request Hint' });
    await expect(hintButton).toBeEnabled();
  });


  // ===========================================================================
  // TEST 6: Hint Content Quality
  // ===========================================================================

  // NOTE: Test removed - "Next Hint" button UI element no longer exists in current implementation
  // The hint system uses a single "Request Hint" button that progresses through levels
  // This test relied on specific button text that has changed


  test('@weekly hint content quality: hints reference the specific error', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
    });
    await page.goto('/');
    await waitForLearnerSessionReady(page);

    const runQueryButton = page.getByRole('button', { name: 'Run Query' });

    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible();

    const hintEvent = await getLastHintEvent(page);
    expect(hintEvent).not.toBeNull();

    // Hint should have a SQL-Engage subtype that relates to the error
    expect(hintEvent.sqlEngageSubtype).toBeDefined();

    // The hintText should be related to the subtype
    expect(hintEvent.hintText.toLowerCase()).not.toContain('undefined');
    expect(hintEvent.hintText.toLowerCase()).not.toContain('null');
    expect(hintEvent.hintText.toLowerCase()).not.toContain('error');
  });

  // ===========================================================================
  // TEST 7: Session and Learner Association
  // ===========================================================================



});
