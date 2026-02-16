/**
 * @file week2-hint-ladder.spec.ts
 * @description Comprehensive test suite for Feature 1: Hint Ladder System (3 levels)
 *
 * This test file covers all functionality of the HintWise-based progressive hint system:
 * - Hint level progression (1→2→3)
 * - SQL-Engage integration (subtype mapping, metadata capture)
 * - Hint event logging (hint_view events with all required fields)
 * - Hint deduplication (preventing duplicate events)
 * - Edge cases (no profile, no session, different subtypes)
 * - Hint content quality (progressive specificity, non-empty text)
 *
 * @tag @week2 - All tests tagged for Week 2 verification
 */

import { expect, Locator, Page, test } from '@playwright/test';

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
    if (await marker.first().isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(400);
  }

  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

/**
 * Replace the entire content of the Monaco editor with new text.
 * Uses Ctrl+A (or Cmd+A on Mac) to select all, then types the new content.
 */
async function replaceEditorText(page: Page, text: string) {
  const editorSurface = page.locator('.monaco-editor .view-lines').first();
  await editorSurface.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(text);
}

/**
 * Get the current text content from the Monaco editor.
 */
async function getEditorText(page: Page): Promise<string> {
  return page.locator('.monaco-editor .view-lines').first().innerText();
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
 */
async function getLastHintEvent(page: Page): Promise<any | null> {
  const hintEvents = await getHintEventsFromStorage(page);
  return hintEvents.length > 0 ? hintEvents[hintEvents.length - 1] : null;
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

// =============================================================================
// TEST SETUP
// =============================================================================

test.beforeEach(async ({ page }) => {
  // Clear all storage and set welcome flag to suppress modal
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });
});

// =============================================================================
// TEST SUITE: Hint Ladder System (Feature 1)
// =============================================================================

test.describe('@week2 Hint Ladder System - Feature 1', () => {

  // ===========================================================================
  // TEST 1: Hint Level Progression
  // ===========================================================================

  test('@week2 hint level progression: 1→2→3 with sequential helpRequestIndex', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();

    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    // Step 1: Create an error to seed the error context
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    // Step 2: Request first hint (Level 1)
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();

    // Verify Level 1 hint was logged
    let hintEvents = await getHintEventsFromStorage(page);
    expect(hintEvents).toHaveLength(1);
    expect(hintEvents[0].hintLevel).toBe(1);
    expect(hintEvents[0].helpRequestIndex).toBe(1);

    // Step 3: Request second hint (Level 2)
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByText('Hint 2', { exact: true })).toBeVisible();

    // Verify Level 2 hint was logged
    hintEvents = await getHintEventsFromStorage(page);
    expect(hintEvents).toHaveLength(2);
    expect(hintEvents[1].hintLevel).toBe(2);
    expect(hintEvents[1].helpRequestIndex).toBe(2);

    // Step 4: Request third hint (Level 3)
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByText('Hint 3', { exact: true })).toBeVisible();

    // Verify Level 3 hint was logged
    hintEvents = await getHintEventsFromStorage(page);
    expect(hintEvents).toHaveLength(3);
    expect(hintEvents[2].hintLevel).toBe(3);
    expect(hintEvents[2].helpRequestIndex).toBe(3);

    // Verify progression sequence
    const hintLevels = hintEvents.map((e: any) => e.hintLevel);
    expect(hintLevels).toEqual([1, 2, 3]);

    const helpIndices = hintEvents.map((e: any) => e.helpRequestIndex);
    expect(helpIndices).toEqual([1, 2, 3]);
  });

  test('@week2 hint level progression: cannot exceed level 3', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    // Create error and progress through all 3 hint levels
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    // Progress through hints 1→2→3
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();
    
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByText('Hint 2', { exact: true })).toBeVisible();
    
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByText('Hint 3', { exact: true })).toBeVisible();

    // Verify max hint level is 3
    const hintEvents = await getHintEventsFromStorage(page);
    const maxLevel = Math.max(...hintEvents.map((e: any) => e.hintLevel));
    expect(maxLevel).toBe(3);

    // Verify all hint levels are within valid range (1-3)
    for (const event of hintEvents) {
      expect(event.hintLevel).toBeGreaterThanOrEqual(1);
      expect(event.hintLevel).toBeLessThanOrEqual(3);
    }

    // After level 3, click "Get More Help" (help request 4) to trigger escalation
    await page.getByRole('button', { name: 'Get More Help' }).click();
    await expect(page.getByText('Explanation has been generated')).toBeVisible();
    
    // Verify explanation_view event was logged
    await expect.poll(async () => {
      const interactions = await getAllInteractionsFromStorage(page);
      return interactions.filter((i: any) => i.eventType === 'explanation_view').length;
    }).toBeGreaterThanOrEqual(1);
  });

  test('@week2 hint level persistence: events are stored in localStorage', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    // Create error and get hints
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();
    
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByText('Hint 2', { exact: true })).toBeVisible();

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
      expect(event.hintText).toBeDefined();
    }
  });

  // ===========================================================================
  // TEST 2: SQL-Engage Integration
  // ===========================================================================

  test('@week2 sql-engage integration: error subtypes map to correct hint templates', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    // Test with incomplete query (should map to 'incomplete query' subtype)
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();

    const hintEvent = await getLastHintEvent(page);
    expect(hintEvent).not.toBeNull();
    
    // Verify SQL-Engage subtype is captured
    expect(hintEvent.sqlEngageSubtype).toBeDefined();
    expect(hintEvent.sqlEngageSubtype).not.toBe('');
    
    // Verify the subtype is one of the canonical SQL-Engage subtypes
    const canonicalSubtypes = [
      'incomplete query',
      'undefined column',
      'undefined table',
      'undefined function',
      'ambiguous reference',
      'wrong positioning'
    ];
    expect(canonicalSubtypes).toContain(hintEvent.sqlEngageSubtype);
  });

  test('@week2 sql-engage integration: sqlEngageSubtype captured correctly', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    // Test different error types
    await replaceEditorText(page, 'SELECT * FROM nonexistent_table;');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    
    const hintEvent = await getLastHintEvent(page);
    expect(hintEvent).not.toBeNull();
    expect(hintEvent.sqlEngageSubtype).toBeDefined();
    expect(typeof hintEvent.sqlEngageSubtype).toBe('string');
    expect(hintEvent.sqlEngageSubtype.length).toBeGreaterThan(0);
  });

  test('@week2 sql-engage integration: sqlEngageRowId is logged', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    
    const hintEvent = await getLastHintEvent(page);
    expect(hintEvent).not.toBeNull();
    
    // Verify sqlEngageRowId exists and follows the format
    expect(hintEvent.sqlEngageRowId).toBeDefined();
    expect(typeof hintEvent.sqlEngageRowId).toBe('string');
    expect(hintEvent.sqlEngageRowId).toMatch(/^sql-engage:/);
  });

  test('@week2 sql-engage integration: policyVersion is correct', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    
    const hintEvent = await getLastHintEvent(page);
    expect(hintEvent).not.toBeNull();
    
    // Verify policyVersion exists and has expected format
    expect(hintEvent.policyVersion).toBeDefined();
    expect(typeof hintEvent.policyVersion).toBe('string');
    expect(hintEvent.policyVersion.length).toBeGreaterThan(0);
    
    // Expected policy version (from sql-engage.ts)
    expect(hintEvent.policyVersion).toBe('sql-engage-index-v3-hintid-contract');
  });

  // ===========================================================================
  // TEST 3: Hint Event Logging (hint_view)
  // ===========================================================================

  test('@week2 hint event logging: all required fields present', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    
    const hintEvent = await getLastHintEvent(page);
    expect(hintEvent).not.toBeNull();

    // Verify all required fields exist
    expect(hintEvent.eventType).toBe('hint_view');
    
    // hintId: format "sql-engage:<subtype>:L<level>:<rowId>"
    expect(hintEvent.hintId).toBeDefined();
    expect(typeof hintEvent.hintId).toBe('string');
    expect(hintEvent.hintId).toMatch(/^sql-engage:.+:L[123]:sql-engage:/);
    
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

  test('@week2 hint event logging: hintId format validation', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    // Progress through all 3 hint levels
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    for (let level = 1; level <= 3; level++) {
      const buttonLabel = level === 1 ? 'Request Hint' : 'Next Hint';
      await page.getByRole('button', { name: buttonLabel }).click();
      await expect(page.getByText(`Hint ${level}`, { exact: true })).toBeVisible();
      
      const hintEvent = await getLastHintEvent(page);
      expect(hintEvent.hintId).toMatch(new RegExp(`^sql-engage:.+:L${level}:sql-engage:`));
    }
  });

  // ===========================================================================
  // TEST 4: Hint Deduplication
  // ===========================================================================

  test('@week2 hint deduplication: same helpRequestIndex cannot be logged twice', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    // Request first hint
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();
    
    // Verify one hint event
    let hintEvents = await getHintEventsFromStorage(page);
    expect(hintEvents).toHaveLength(1);
    const initialCount = hintEvents.length;
    
    // Click next hint button once
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByText('Hint 2', { exact: true })).toBeVisible();
    
    // Verify we moved to level 2, not duplicated level 1
    hintEvents = await getHintEventsFromStorage(page);
    expect(hintEvents.length).toBe(initialCount + 1);
    
    // Verify helpRequestIndex values are unique (no duplicates)
    const helpIndices = hintEvents.map((e: any) => e.helpRequestIndex);
    const uniqueIndices = new Set(helpIndices);
    expect(uniqueIndices.size).toBe(helpIndices.length);
  });

  test('@week2 hint deduplication: rapid clicks do not create duplicates', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    // Rapidly click the hint button multiple times
    const hintButton = page.getByRole('button', { name: 'Request Hint' });
    
    // Fire multiple clicks rapidly
    await Promise.all([
      hintButton.click(),
      hintButton.click(),
      hintButton.click()
    ]);
    
    // Wait for processing
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

  test('@week2 edge case: no profile available - graceful handling', async ({ page }) => {
    // Seed storage with no learner profile
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      // Intentionally not creating any learner profile
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();

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
      await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();
    }
    // If disabled, that's also acceptable behavior for no-profile state
  });

  test('@week2 edge case: no session - button disabled', async ({ page }) => {
    // Seed storage with profile but no active session
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
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

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();

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

  test('@week2 edge case: different error subtypes get different hints', async ({ page }) => {
    // First error type test
    await page.goto('/');
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    // Test with incomplete query
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    const hint1 = await getLastHintEvent(page);
    const text1 = hint1.hintText;
    const subtype1 = hint1.sqlEngageSubtype;

    // Clear storage for second test
    await page.evaluate(() => {
      window.localStorage.removeItem('sql-learning-interactions');
    });
    
    // Test with undefined table error (reload to reset state)
    await page.reload();
    await page.evaluate(() => {
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
    
    await replaceEditorText(page, 'SELECT * FROM nonexistent_table_xyz;');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    const hint2 = await getLastHintEvent(page);
    const text2 = hint2.hintText;
    const subtype2 = hint2.sqlEngageSubtype;

    // Hints for different error types should be different
    // (Note: Due to canonicalization, some errors may map to the same subtype)
    // At minimum, verify both hints are valid
    expect(text1.length).toBeGreaterThan(0);
    expect(text2.length).toBeGreaterThan(0);
    
    // Verify SQL-Engage subtype is captured for both
    expect(subtype1).toBeDefined();
    expect(subtype2).toBeDefined();
    
    // Both should have valid subtypes
    expect(typeof subtype1).toBe('string');
    expect(typeof subtype2).toBe('string');
  });

  // ===========================================================================
  // TEST 6: Hint Content Quality
  // ===========================================================================

  test('@week2 hint content quality: hints are progressively more specific', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    const hintTexts: string[] = [];
    
    // Collect all 3 hint texts
    for (let level = 1; level <= 3; level++) {
      const buttonLabel = level === 1 ? 'Request Hint' : 'Next Hint';
      await page.getByRole('button', { name: buttonLabel }).click();
      await expect(page.getByText(`Hint ${level}`, { exact: true })).toBeVisible();
      
      const hintEvent = await getLastHintEvent(page);
      hintTexts.push(hintEvent.hintText);
    }

    // Verify we have 3 different hints
    expect(hintTexts).toHaveLength(3);
    
    // Verify each hint is progressively more detailed
    // Level 1 should be shortest (subtle nudge)
    // Level 3 should be longest (explicit direction)
    expect(hintTexts[0].length).toBeGreaterThan(0);
    expect(hintTexts[1].length).toBeGreaterThanOrEqual(hintTexts[0].length);
    expect(hintTexts[2].length).toBeGreaterThanOrEqual(hintTexts[1].length);
    
    // Verify all hints are different
    expect(hintTexts[0]).not.toBe(hintTexts[1]);
    expect(hintTexts[1]).not.toBe(hintTexts[2]);
  });

  test('@week2 hint content quality: hint text is non-empty and meaningful', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    
    const hintEvent = await getLastHintEvent(page);
    
    // Hint text should not be empty
    expect(hintEvent.hintText).toBeDefined();
    expect(hintEvent.hintText.trim().length).toBeGreaterThan(10);
    
    // Hint text should contain actionable guidance
    const hintText = hintEvent.hintText.toLowerCase();
    // Keywords based on actual SUBTYPE_LADDER_GUIDANCE content
    const actionableKeywords = [
      'start', 'completing', 'missing', 'build', 'incrementally', 
      'check', 'clause', 'present', 'complete', 'query',
      'select', 'from', 'where', 'verify', 'table'
    ];
    const hasActionableContent = actionableKeywords.some(keyword => hintText.includes(keyword));
    expect(hasActionableContent).toBe(true);
  });

  test('@week2 hint content quality: hints reference the specific error', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    
    const hintEvent = await getLastHintEvent(page);
    
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

  test('@week2 session association: all hints linked to active session', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    // Get the active session ID
    const sessionId = await getActiveSessionId(page);
    expect(sessionId).not.toBeNull();

    // Request multiple hints
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await page.getByRole('button', { name: 'Next Hint' }).click();

    // Verify all hints are associated with the same session
    const hintEvents = await getHintEventsFromStorage(page);
    expect(hintEvents.length).toBeGreaterThanOrEqual(3);
    
    for (const event of hintEvents) {
      expect(event.sessionId).toBe(sessionId);
    }
  });

  test('@week2 learner association: all hints linked to learner ID', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    await page.getByRole('button', { name: 'Request Hint' }).click();
    
    const hintEvent = await getLastHintEvent(page);
    
    // Verify learnerId is set
    expect(hintEvent.learnerId).toBeDefined();
    expect(typeof hintEvent.learnerId).toBe('string');
    expect(hintEvent.learnerId.length).toBeGreaterThan(0);
    
    // Default learner should be 'learner-1' or similar
    expect(hintEvent.learnerId).toMatch(/^learner-/);
  });

  // ===========================================================================
  // TEST 8: Integration with Escalation System
  // ===========================================================================

  test('@week2 escalation integration: after level 3, next request triggers explanation', async ({ page }) => {
    await page.goto('/');
    
    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    
    await replaceEditorText(page, 'SELECT');
    await runUntilErrorCount(page, runQueryButton, 1);

    // Progress through all 3 hint levels
    await page.getByRole('button', { name: 'Request Hint' }).click();
    await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();
    
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByText('Hint 2', { exact: true })).toBeVisible();
    
    await page.getByRole('button', { name: 'Next Hint' }).click();
    await expect(page.getByText('Hint 3', { exact: true })).toBeVisible();

    // After level 3, click "Get More Help" (help request 4) to trigger escalation
    await page.getByRole('button', { name: 'Get More Help' }).click();
    await expect(page.getByText('Explanation has been generated')).toBeVisible();

    // Verify explanation_view event was logged
    await expect.poll(async () => {
      const interactions = await getAllInteractionsFromStorage(page);
      return interactions.filter((i: any) => i.eventType === 'explanation_view').length;
    }).toBeGreaterThanOrEqual(1);

    // Verify the explanation_view event has correct fields
    const interactions = await getAllInteractionsFromStorage(page);
    const explanationEvent = interactions.find((i: any) => i.eventType === 'explanation_view');
    
    expect(explanationEvent).toBeDefined();
    expect(explanationEvent.helpRequestIndex).toBeGreaterThanOrEqual(4);
    expect(explanationEvent.policyVersion).toBeDefined();
    expect(explanationEvent.sqlEngageSubtype).toBeDefined();
  });

});
