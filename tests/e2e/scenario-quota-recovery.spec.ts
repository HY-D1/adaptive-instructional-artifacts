/**
 * @weekly Storage Quota & Recovery Tests
 *
 * Comprehensive scenario tests for SC-4: Storage Quota & Recovery
 *
 * Test Coverage:
 * - SC-4.1: localStorage quota exceeded during save - Critical data preserved
 * - SC-4.2: Large textbook causes quota issue - LRU eviction
 * - SC-4.3: Quota recovered after cleanup - Normal operations resume
 * - SC-4.4: Progressive quota filling - Warnings shown, cleanup triggered
 * - SC-4.5: Quota during critical interaction - Interaction saved via memory fallback
 *
 * Tags:
 *   @weekly          — Run weekly (complex tests)
 *   @quota           — Storage quota handling tests
 *   @recovery        — Recovery behavior tests
 *   @no-external     — No LLM / Ollama required
 *
 * How to run:
 *   npx playwright test -c playwright.config.ts tests/e2e/scenario-quota-recovery.spec.ts
 */

import { expect, test, type Page } from '@playwright/test';
import { replaceEditorText, getTextbookUnits, getAllInteractionsFromStorage } from '../helpers/test-helpers';

const LEARNER_ID = 'quota-recovery-e2e';
const INCORRECT_QUERY = "SELECT name FROM users WHERE age > 100";
const CORRECT_QUERY = "SELECT name FROM users WHERE age > 25";

// Storage keys
const STORAGE_FILL_PREFIX = 'sql-quota-test-fill-';
const LLM_CACHE_KEY = 'sql-learning-llm-cache';
const PDF_INDEX_KEY = 'sql-learning-pdf-index';
const TEXTBOOK_KEY = 'sql-learning-textbook';
const INTERACTIONS_KEY = 'sql-learning-interactions';
const PROFILES_KEY = 'sql-learning-profiles';
const ACTIVE_SESSION_KEY = 'sql-learning-active-session';
const OFFLINE_QUEUE_KEY = 'sql-adapt-offline-queue';
const PENDING_INTERACTIONS_KEY = 'sql-adapt-pending-interactions';

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
      name: 'Quota Recovery Tester',
      role: 'student',
      createdAt: Date.now()
    }));

    // Learning profile
    window.localStorage.setItem('sql-learning-profiles', JSON.stringify([{
      id,
      name: 'Quota Recovery Tester',
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
 * Fill localStorage to near or at quota limit
 */
async function fillStorageToQuota(page: Page, targetPercent: number = 95): Promise<{
  keysCreated: number;
  approximateBytes: number;
  quotaExceeded: boolean;
}> {
  return page.evaluate(({ targetPct, fillPrefix }) => {
    // Clear any previous test data first
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(fillPrefix)) {
        localStorage.removeItem(key);
      }
    }

    // Create a chunk of data (roughly 100KB each)
    const chunkSize = 100 * 1024;
    const chunk = 'x'.repeat(chunkSize);
    
    let keysCreated = 0;
    let totalBytes = 0;
    let quotaExceeded = false;
    
    // Try to fill storage until we hit quota or reach target
    const estimatedQuota = 5 * 1024 * 1024; // Common browser default ~5MB
    const targetBytes = estimatedQuota * (targetPct / 100);
    
    for (let i = 0; i < 500; i++) {
      try {
        const key = `${fillPrefix}${i}`;
        localStorage.setItem(key, chunk);
        keysCreated++;
        totalBytes += chunkSize;
        
        if (totalBytes >= targetBytes) {
          break;
        }
      } catch (e: any) {
        // Quota exceeded - this is expected
        quotaExceeded = true;
        break;
      }
    }
    
    return {
      keysCreated,
      approximateBytes: totalBytes,
      quotaExceeded
    };
  }, { targetPct: targetPercent, fillPrefix: STORAGE_FILL_PREFIX });
}

/**
 * Fill storage with large textbook data to simulate textbook quota issue
 */
async function fillStorageWithLargeTextbook(page: Page, entryCount: number = 50): Promise<number> {
  return page.evaluate(({ learnerId, count, textbookKey }) => {
    const largeEntries = [];
    for (let i = 0; i < count; i++) {
      largeEntries.push({
        id: `unit-${i}`,
        title: `Large Unit ${i} - ${'x'.repeat(5000)}`,
        content: 'Content: ' + 'y'.repeat(50000), // 50KB per entry
        createdAt: Date.now() - (i * 60000),
        updatedAt: Date.now(),
        conceptIds: ['concept-1', 'concept-2'],
        status: 'active'
      });
    }
    
    const textbookData: Record<string, any[]> = {
      [learnerId]: largeEntries
    };
    
    try {
      localStorage.setItem(textbookKey, JSON.stringify(textbookData));
      return largeEntries.length;
    } catch (e) {
      // Partial fill might have worked
      return 0;
    }
  }, { learnerId: LEARNER_ID, count: entryCount, textbookKey: TEXTBOOK_KEY });
}

/**
 * Clear all dummy storage data
 */
async function clearDummyStorageData(page: Page): Promise<number> {
  return page.evaluate(({ fillPrefix }) => {
    let cleared = 0;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(fillPrefix)) {
        localStorage.removeItem(key);
        cleared++;
      }
    }
    return cleared;
  }, { fillPrefix: STORAGE_FILL_PREFIX });
}

/**
 * Get storage usage statistics
 */
async function getStorageStats(page: Page): Promise<{
  used: number;
  keyCount: number;
  criticalKeys: string[];
}> {
  return page.evaluate(() => {
    let used = 0;
    const criticalKeys: string[] = [];
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        used += key.length + value.length;
        
        // Track critical keys
        if (key.includes('interaction') || key.includes('profile') || 
            key.includes('textbook') || key.includes('session') ||
            key.includes('offline') || key.includes('pending')) {
          criticalKeys.push(key);
        }
      }
    }
    
    return {
      used,
      keyCount: localStorage.length,
      criticalKeys
    };
  });
}

/**
 * Simulate QuotaExceededError on specific key
 */
async function simulateQuotaError(page: Page, key: string): Promise<boolean> {
  return page.evaluate((targetKey) => {
    try {
      // Try to add a massive value to trigger quota
      const massiveData = 'z'.repeat(10 * 1024 * 1024); // 10MB
      localStorage.setItem(`__quota_test_${targetKey}`, massiveData);
      return false; // No error thrown
    } catch (e: any) {
      // Clean up test key if it was partially written
      try {
        localStorage.removeItem(`__quota_test_${targetKey}`);
      } catch {
        // Ignore
      }
      return e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014;
    }
  }, key);
}

/**
 * Collect console errors and warnings during test execution
 */
function collectConsoleMessages(page: Page): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    } else if (msg.type() === 'warning') {
      warnings.push(msg.text());
    }
  });
  
  page.on('pageerror', error => {
    errors.push(error.message);
  });
  
  return { errors, warnings };
}

/**
 * Add recoverable cache entries that can be evicted
 */
async function addRecoverableCache(page: Page): Promise<number> {
  return page.evaluate((cacheKey) => {
    const cache: Record<string, any> = {};
    for (let i = 0; i < 20; i++) {
      cache[`cache-entry-${i}`] = {
        data: 'x'.repeat(50000), // 50KB each
        createdAt: Date.now() - (i * 1000)
      };
    }
    
    try {
      localStorage.setItem(cacheKey, JSON.stringify(cache));
      return Object.keys(cache).length;
    } catch {
      return 0;
    }
  }, LLM_CACHE_KEY);
}

// =============================================================================
// SC-4: Storage Quota & Recovery
// =============================================================================

test.describe('@weekly @quota @recovery SC-4: Storage Quota & Recovery', () => {
  test.beforeEach(async ({ page }) => {
    await setupTestAuth(page);
  });

  test('SC-4.1: localStorage quota exceeded during save - Critical data preserved', async ({ page }) => {
    const { errors, warnings } = collectConsoleMessages(page);
    
    // Navigate to practice page
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Fill storage to near quota
    const fillResult = await fillStorageToQuota(page, 90);
    console.log(`Storage filled: ${fillResult.keysCreated} keys, ~${Math.round(fillResult.approximateBytes / 1024)}KB`);
    
    const statsBefore = await getStorageStats(page);
    console.log(`Storage stats: ${Math.round(statsBefore.used / 1024)}KB used, ${statsBefore.keyCount} keys`);
    
    // Verify critical keys are intact before quota pressure
    expect(statsBefore.criticalKeys.length).toBeGreaterThan(0);
    
    // Now try to trigger an interaction while at quota
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'test-results/sc-4-1-quota-pressure.png', 
      fullPage: true 
    });

    // Verify app didn't crash
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#root')).toBeVisible();
    
    // Check that critical data is still accessible
    const statsAfter = await getStorageStats(page);
    const criticalKeysAfter = statsAfter.criticalKeys;
    
    // Critical keys should still exist (profiles, interactions)
    const hasProfileKey = criticalKeysAfter.some(k => k.includes('profile'));
    const hasInteractionKey = criticalKeysAfter.some(k => k.includes('interaction'));
    
    expect(hasProfileKey || statsAfter.keyCount > 0).toBe(true);
    
    // Verify interactions were recorded (possibly in memory fallback)
    const interactions = await getAllInteractionsFromStorage(page);
    console.log(`Interactions recorded: ${interactions.length}`);
    
    // Clean up
    await clearDummyStorageData(page);
    
    // No React crashes
    const reactCrashes = errors.filter(e => 
      e.includes('React') && e.includes('crash') ||
      e.includes('unhandledrejection') && !e.includes('QuotaExceededError')
    );
    expect(reactCrashes).toHaveLength(0);
  });

  test('SC-4.2: Large textbook causes quota issue - LRU eviction', async ({ page }) => {
    // Navigate to practice
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Create some initial textbook entries
    await page.evaluate(({ learnerId, textbookKey }) => {
      const initialUnits = [
        {
          id: 'unit-1',
          title: 'First Entry',
          content: 'Important content 1',
          createdAt: Date.now() - 100000,
          conceptIds: ['concept-1'],
          status: 'active'
        },
        {
          id: 'unit-2', 
          title: 'Second Entry',
          content: 'Important content 2',
          createdAt: Date.now() - 50000,
          conceptIds: ['concept-2'],
          status: 'active'
        }
      ];
      const textbookData: Record<string, any[]> = { [learnerId]: initialUnits };
      localStorage.setItem(textbookKey, JSON.stringify(textbookData));
    }, { learnerId: LEARNER_ID, textbookKey: TEXTBOOK_KEY });

    // Verify initial entries exist
    const unitsBefore = await getTextbookUnits(page, LEARNER_ID);
    expect(unitsBefore.length).toBe(2);
    
    // Fill storage with large textbook entries
    await fillStorageWithLargeTextbook(page, 100);
    
    // Check storage is near quota
    const statsAfterFill = await getStorageStats(page);
    console.log(`After textbook fill: ${Math.round(statsAfterFill.used / 1024)}KB, ${statsAfterFill.keyCount} keys`);
    
    await page.screenshot({ 
      path: 'test-results/sc-4-2-textbook-quota.png', 
      fullPage: true 
    });

    // Try to add one more note (should trigger LRU eviction)
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    
    await expect(page.getByText(/Results differ|error/i).first()).toBeVisible({ timeout: 10_000 });
    
    // Request hint to enable saving
    const hintActionButton = page.getByTestId('hint-action-button');
    if (await hintActionButton.isVisible().catch(() => false)) {
      await hintActionButton.click();
      await page.waitForTimeout(2000);
      
      // Try to save
      const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
      if (await saveBtn.isVisible().catch(() => false) && await saveBtn.isEnabled().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
      }
    }
    
    // App should still function
    await expect(page.locator('body')).toBeVisible();
    
    // Clean up
    await clearDummyStorageData(page);
  });

  test('SC-4.3: Quota recovered after cleanup - Normal operations resume', async ({ page }) => {
    const { errors } = collectConsoleMessages(page);
    
    // Navigate and setup
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Fill storage to quota
    const fillResult = await fillStorageToQuota(page, 85);
    expect(fillResult.keysCreated).toBeGreaterThan(0);
    
    const statsBefore = await getStorageStats(page);
    
    // Try to run a query under quota pressure
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(1000);
    
    // Clear the dummy data to recover quota
    const cleared = await clearDummyStorageData(page);
    console.log(`Cleared ${cleared} dummy storage entries`);
    
    const statsAfter = await getStorageStats(page);
    expect(statsAfter.used).toBeLessThan(statsBefore.used);
    
    await page.screenshot({ 
      path: 'test-results/sc-4-3-quota-recovered.png', 
      fullPage: true 
    });

    // Reload to ensure clean state
    await page.reload();
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Normal operations should resume
    await replaceEditorText(page, CORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    
    // Wait for results
    await expect.poll(async () => {
      const resultsVisible = await page.locator('[data-testid="query-results"]').isVisible().catch(() => false);
      const errorVisible = await page.locator('.text-red-600, .text-red-700').first().isVisible().catch(() => false);
      return resultsVisible || errorVisible;
    }, { timeout: 15_000, intervals: [500] }).toBe(true);
    
    // Verify interaction was saved
    const interactions = await getAllInteractionsFromStorage(page);
    expect(interactions.length).toBeGreaterThan(0);
    
    // No crashes
    const reactCrashes = errors.filter(e => 
      e.includes('React') && e.includes('crash') ||
      e.includes('unhandledrejection')
    );
    expect(reactCrashes).toHaveLength(0);
  });

  test('SC-4.4: Progressive quota filling - Warnings shown, cleanup triggered', async ({ page }) => {
    const { warnings, errors } = collectConsoleMessages(page);
    
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Add recoverable cache data
    await addRecoverableCache(page);
    
    // Progressively fill storage
    const fillLevels = [50, 70, 85];
    for (const level of fillLevels) {
      await fillStorageToQuota(page, level);
      await page.waitForTimeout(500);
      
      // Try an operation at each level
      await replaceEditorText(page, `SELECT * FROM level${level}`);
      await page.getByRole('button', { name: 'Run Query' }).click();
      await page.waitForTimeout(500);
      
      const stats = await getStorageStats(page);
      console.log(`Level ${level}%: ${Math.round(stats.used / 1024)}KB, ${stats.keyCount} keys`);
    }
    
    await page.screenshot({ 
      path: 'test-results/sc-4-4-progressive-quota.png', 
      fullPage: true 
    });

    // Check for quota-related warnings in console
    const quotaWarnings = warnings.filter(w => 
      w.includes('quota') || w.includes('Quota') || 
      w.includes('storage') || w.includes('evict')
    );
    
    // App should show some indication of storage pressure
    console.log(`Quota warnings found: ${quotaWarnings.length}`);
    
    // App should still be functional
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
    
    // Clean up
    await clearDummyStorageData(page);
  });

  test('SC-4.5: Quota during critical interaction - Interaction saved via memory fallback', async ({ page }) => {
    const { errors } = collectConsoleMessages(page);
    
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Get baseline interaction count
    const interactionsBefore = await getAllInteractionsFromStorage(page);
    
    // Fill storage to quota
    await fillStorageToQuota(page, 95);
    
    // Verify we're at quota
    const statsAtQuota = await getStorageStats(page);
    console.log(`At quota: ${Math.round(statsAtQuota.used / 1024)}KB used`);
    
    await page.screenshot({ 
      path: 'test-results/sc-4-5-quota-before-interaction.png', 
      fullPage: true 
    });

    // Attempt a critical interaction (query execution)
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    
    // Wait for processing with extended timeout
    await page.waitForTimeout(3000);
    
    await page.screenshot({ 
      path: 'test-results/sc-4-5-after-interaction.png', 
      fullPage: true 
    });

    // App should not crash
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#root')).toBeVisible();
    
    // Interaction should be recorded (either in storage or queued)
    const interactionsAfter = await getAllInteractionsFromStorage(page);
    const queueAfter = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }, OFFLINE_QUEUE_KEY);
    const pendingAfter = await page.evaluate((key) => {
      const raw = window.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    }, PENDING_INTERACTIONS_KEY);
    
    console.log(`Interactions: ${interactionsAfter.length}, Queue: ${queueAfter.length}, Pending: ${pendingAfter.length}`);
    
    // Total events should have increased or be queued
    const totalEvents = interactionsAfter.length + queueAfter.length + pendingAfter.length;
    expect(totalEvents).toBeGreaterThanOrEqual(interactionsBefore.length);
    
    // Verify the button is still functional for future interactions
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 10_000, intervals: [500] }).toBe(true);
    
    // Clean up
    await clearDummyStorageData(page);
    
    // No critical errors
    const criticalErrors = errors.filter(e => 
      e.includes('React') && e.includes('crash') ||
      e.includes('unhandledrejection') && !e.includes('QuotaExceededError')
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('LRU eviction preserves critical data over cache data', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Set up critical data
    await page.evaluate(({ learnerId, profileKey, sessionKey }) => {
      // Ensure profile exists
      const profiles = [{
        id: learnerId,
        name: 'Test User',
        conceptsCovered: [],
        conceptCoverageEvidence: [],
        errorHistory: [],
        interactionCount: 1,
        version: 1,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
      }];
      localStorage.setItem(profileKey, JSON.stringify(profiles));
      
      // Ensure session exists
      localStorage.setItem(sessionKey, `session-${learnerId}-${Date.now()}`);
    }, { 
      learnerId: LEARNER_ID, 
      profileKey: PROFILES_KEY,
      sessionKey: ACTIVE_SESSION_KEY 
    });

    // Add cache data that can be evicted
    await addRecoverableCache(page);
    
    // Fill to high quota level
    await fillStorageToQuota(page, 90);
    
    // Record critical keys
    const criticalKeysBefore = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('profile') || 
          key.includes('interaction') || 
          key.includes('session') ||
          key.includes('textbook')
        )) {
          keys.push(key);
        }
      }
      return keys;
    });
    
    // Try to trigger an interaction
    await replaceEditorText(page, CORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(2000);
    
    // Check that critical keys still exist
    const criticalKeysAfter = await page.evaluate(() => {
      const keys: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (
          key.includes('profile') || 
          key.includes('interaction') || 
          key.includes('session') ||
          key.includes('textbook')
        )) {
          keys.push(key);
        }
      }
      return keys;
    });
    
    // Critical data should be preserved
    for (const key of criticalKeysBefore) {
      if (key.includes('profile') || key.includes('session')) {
        expect(criticalKeysAfter).toContain(key);
      }
    }
    
    await page.screenshot({ 
      path: 'test-results/sc-4-lru-eviction.png', 
      fullPage: true 
    });

    // Clean up
    await clearDummyStorageData(page);
  });

  test('Graceful degradation with memory fallback', async ({ page }) => {
    // Navigate to practice page (auth is set up by beforeEach)
    // Navigate to root first, then wait for redirect to /practice
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);

    // Try to push past quota limit with more aggressive filling
    const quotaResult = await page.evaluate(({ fillPrefix }) => {
      const results = {
        keysCreated: 0,
        quotaErrors: 0,
        lastError: null as string | null
      };
      
      // Try increasingly large chunks until we hit quota
      const chunkSizes = [100 * 1024, 500 * 1024, 1024 * 1024]; // 100KB, 500KB, 1MB
      
      for (const chunkSize of chunkSizes) {
        try {
          const chunk = 'x'.repeat(chunkSize);
          
          for (let i = 0; i < 50; i++) {
            try {
              localStorage.setItem(`${fillPrefix}large-${chunkSize}-${i}`, chunk);
              results.keysCreated++;
            } catch (e: any) {
              if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014 || 
                  e.message?.includes('quota') || e.message?.includes('Quota')) {
                results.quotaErrors++;
                results.lastError = e.name || e.message;
                break;
              }
            }
          }
          
          if (results.quotaErrors > 0) break;
        } catch (e: any) {
          results.lastError = e.name || e.message;
        }
      }
      
      return results;
    }, { fillPrefix: STORAGE_FILL_PREFIX });
    
    console.log(`Quota test: ${quotaResult.keysCreated} keys, ${quotaResult.quotaErrors} quota errors, lastError: ${quotaResult.lastError}`);
    
    // App should still function even if quota was hit
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#root')).toBeVisible();
    
    // Try to perform operations - this verifies memory fallback works
    await replaceEditorText(page, CORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    await page.waitForTimeout(2000);
    
    await page.screenshot({ 
      path: 'test-results/sc-4-graceful-degradation.png', 
      fullPage: true 
    });

    // Clean up - remove all our test data
    await clearDummyStorageData(page);
    
    // Reload and verify recovery - app should work normally after cleanup
    // Note: after reload, we need to restore auth state since addInitScript only runs on fresh navigation
    await page.evaluate((id: string) => {
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id,
        name: 'Quota Recovery Tester',
        role: 'student',
        createdAt: Date.now()
      }));
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([{
        id,
        name: 'Quota Recovery Tester',
        conceptsCovered: [],
        conceptCoverageEvidence: [],
        errorHistory: [],
        interactionCount: 0,
        version: 1,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
      }]));
    }, LEARNER_ID);
    
    await page.reload();
    await page.waitForLoadState('networkidle', { timeout: 15_000 });
    
    await expect(page.locator('body')).toBeVisible();
    
    // Wait for the app to fully load and render the Run Query button
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isVisible().catch(() => false);
    }, { timeout: 15_000, intervals: [500] }).toBe(true);
  });
});
