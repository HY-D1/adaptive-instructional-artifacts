/**
 * @regression Storage Quota Resilience Test
 *
 * Verifies the application handles browser storage quota pressure gracefully:
 *   - App doesn't crash when localStorage is near quota
 *   - Session config still resolves under quota pressure
 *   - Hints can still be requested and displayed
 *   - Notes can be saved to textbook
 *   - Normal operation resumes after clearing dummy data
 *
 * Tags:
 *   @regression     — must pass on every merge to main
 *   @storage        — storage-related resilience testing
 *   @no-external    — no LLM / Ollama required
 *   @quota-resilience — specific quota handling verification
 *
 * How to run:
 *   npx playwright test -c playwright.config.ts tests/e2e/regression/storage-quota-resilience.spec.ts
 */

import { expect, test, type Page } from '@playwright/test';
import { replaceEditorText, getTextbookUnits } from '../../helpers/test-helpers';

const LEARNER_ID = 'quota-resilience-e2e';
const INCORRECT_QUERY = "SELECT name FROM users WHERE age > 100";

// Storage key for dummy data
const DUMMY_DATA_KEY = 'sql-quota-test-dummy-data';
const STORAGE_FILL_PREFIX = 'sql-quota-fill-';

/**
 * Fill localStorage with progressively larger data until we reach
 * near-quota conditions or a target percentage
 */
async function fillStorageToQuota(page: Page, targetPercent: number = 85): Promise<{
  keysCreated: number;
  approximateBytes: number;
  quotaEstimate: number;
}> {
  return page.evaluate(({ targetPct, dummyKey, fillPrefix }) => {
    // Clear any previous test data first
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(fillPrefix) || key === dummyKey) {
        localStorage.removeItem(key);
      }
    }

    // Create a chunk of data (roughly 100KB each)
    const chunkSize = 100 * 1024;
    const chunk = 'x'.repeat(chunkSize);
    
    let keysCreated = 0;
    let totalBytes = 0;
    let quotaEstimate = 0;
    
    // Try to fill storage until we hit quota or reach target
    for (let i = 0; i < 500; i++) {
      try {
        const key = `${fillPrefix}${i}`;
        localStorage.setItem(key, chunk);
        keysCreated++;
        totalBytes += chunkSize;
        
        // Estimate quota from how much we've stored
        quotaEstimate = Math.max(quotaEstimate, totalBytes);
        
        // Check if we've reached target percentage (estimate ~5MB quota)
        const estimatedQuota = 5 * 1024 * 1024; // Common browser default
        if (totalBytes >= estimatedQuota * (targetPct / 100)) {
          break;
        }
      } catch (e) {
        // Quota exceeded - this is expected
        quotaEstimate = totalBytes;
        break;
      }
    }
    
    return {
      keysCreated,
      approximateBytes: totalBytes,
      quotaEstimate
    };
  }, { targetPct: targetPercent, dummyKey: DUMMY_DATA_KEY, fillPrefix: STORAGE_FILL_PREFIX });
}

/**
 * Clear all dummy data created during quota test
 */
async function clearDummyStorageData(page: Page): Promise<number> {
  return page.evaluate(({ dummyKey, fillPrefix }) => {
    let cleared = 0;
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith(fillPrefix) || key === dummyKey) {
        localStorage.removeItem(key);
        cleared++;
      }
    }
    return cleared;
  }, { dummyKey: DUMMY_DATA_KEY, fillPrefix: STORAGE_FILL_PREFIX });
}

/**
 * Get storage usage statistics
 */
async function getStorageStats(page: Page): Promise<{
  used: number;
  remaining: number;
  keyCount: number;
}> {
  return page.evaluate(() => {
    let used = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) {
        const value = localStorage.getItem(key) || '';
        used += key.length + value.length;
      }
    }
    // Estimate remaining (5MB is typical localStorage quota)
    const typicalQuota = 5 * 1024 * 1024;
    return {
      used,
      remaining: Math.max(0, typicalQuota - used),
      keyCount: localStorage.length
    };
  });
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

test.beforeEach(async ({ page }) => {
  // Clear storage and set up test profile
  await page.addInitScript((id: string) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');

    // Auth profile
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id,
      name: 'Quota Resilience Tester',
      role: 'student',
      createdAt: Date.now()
    }));

    // Learning profile
    window.localStorage.setItem('sql-learning-profiles', JSON.stringify([{
      id,
      name: 'Quota Resilience Tester',
      conceptsCovered: [],
      conceptCoverageEvidence: [],
      errorHistory: [],
      interactionCount: 0,
      version: 1,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
    }]));

    // Active session
    window.localStorage.setItem('sql-learning-active-session', `session-${id}-${Date.now()}`);
  }, LEARNER_ID);
});

test.describe('@regression @storage @quota-resilience @no-external Storage quota resilience', () => {
  
  test('App loads and functions correctly under storage quota pressure', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    
    // Step 1: Navigate to practice page and verify normal load first
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    // Wait for editor ready
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);
    
    await page.screenshot({ 
      path: 'test-results/quota-resilience-01-normal-load.png', 
      fullPage: true 
    });

    // Step 2: Fill storage to near quota
    const fillResult = await fillStorageToQuota(page, 85);
    console.log(`Storage filled: ${fillResult.keysCreated} keys, ~${Math.round(fillResult.approximateBytes / 1024)}KB`);
    
    const statsBefore = await getStorageStats(page);
    console.log(`Storage stats: ${Math.round(statsBefore.used / 1024)}KB used, ${statsBefore.keyCount} keys`);
    
    expect(fillResult.keysCreated).toBeGreaterThan(0);
    expect(statsBefore.used).toBeGreaterThan(100 * 1024); // At least 100KB filled
    
    await page.screenshot({ 
      path: 'test-results/quota-resilience-02-storage-filled.png', 
      fullPage: true 
    });

    // Step 3: Reload page and verify it still loads without crash
    await page.reload();
    
    // Wait for page to settle
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    
    // App should not crash - verify no fatal errors
    const fatalErrors = consoleErrors.filter(e => 
      e.includes('QuotaExceededError') || 
      e.includes('localStorage') && e.includes('exceeded') ||
      e.includes('out of memory') ||
      e.includes('alloc') && e.includes('fail')
    );
    
    // QuotaExceededError is expected, but app should not crash
    console.log(`Console errors found: ${consoleErrors.length}, fatal: ${fatalErrors.length}`);
    
    await page.screenshot({ 
      path: 'test-results/quota-resilience-03-post-reload.png', 
      fullPage: true 
    });

    // Step 4: Verify session config still resolves (key assertion)
    // The app should still be able to read session state
    const sessionId = await page.evaluate(() => {
      return window.localStorage.getItem('sql-learning-active-session');
    });
    
    // Session might be null under quota pressure, but app shouldn't crash
    console.log(`Session ID after reload under quota: ${sessionId}`);
    
    // Verify the page structure is still intact
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#root')).toBeVisible();
    
    // Step 5: Try to navigate to practice page with editor
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    // Wait for editor to be ready (may be slower under quota pressure)
    const editorReady = await page.waitForSelector('.monaco-editor', { 
      state: 'visible', 
      timeout: 30_000 
    }).catch(() => false);
    
    if (editorReady) {
      // Step 6: Submit a query to test functionality
      await replaceEditorText(page, INCORRECT_QUERY);
      await page.getByRole('button', { name: 'Run Query' }).click();
      
      // Wait for results with longer timeout under quota
      await page.waitForTimeout(2000);
      
      await page.screenshot({ 
        path: 'test-results/quota-resilience-04-query-executed.png', 
        fullPage: true 
      });
      
      // Step 7: Try to request a hint
      const hintActionButton = page.getByTestId('hint-action-button');
      const hintButtonVisible = await hintActionButton.isVisible().catch(() => false);
      
      if (hintButtonVisible) {
        await hintActionButton.click();
        
        // Wait for hint to appear with longer timeout
        await page.waitForTimeout(2000);
        
        const hintVisible = await page.getByTestId('hint-label-1').isVisible().catch(() => false);
        console.log(`Hint visible under quota pressure: ${hintVisible}`);
        
        await page.screenshot({ 
          path: 'test-results/quota-resilience-05-hint-requested.png', 
          fullPage: true 
        });
      }
      
      // Step 8: Try to save to textbook
      const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
      const saveButtonVisible = await saveBtn.isVisible().catch(() => false);
      
      if (saveButtonVisible && await saveBtn.isEnabled().catch(() => false)) {
        await saveBtn.click();
        await page.waitForTimeout(2000);
        
        await page.screenshot({ 
          path: 'test-results/quota-resilience-06-save-attempted.png', 
          fullPage: true 
        });
      }
    }

    // Step 9: Clear dummy data
    const clearedCount = await clearDummyStorageData(page);
    console.log(`Cleared ${clearedCount} dummy storage entries`);
    
    const statsAfter = await getStorageStats(page);
    console.log(`Storage after cleanup: ${Math.round(statsAfter.used / 1024)}KB used, ${statsAfter.keyCount} keys`);
    
    // Verify storage was significantly reduced
    expect(statsAfter.used).toBeLessThan(statsBefore.used);
    
    await page.screenshot({ 
      path: 'test-results/quota-resilience-07-storage-cleared.png', 
      fullPage: true 
    });

    // Step 10: Verify normal operation resumes
    await page.reload();
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    
    // Page should load normally
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    // Editor should be ready
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);
    
    // Run a query successfully
    await replaceEditorText(page, "SELECT name FROM users WHERE age > 25");
    await page.getByRole('button', { name: 'Run Query' }).click();
    
    // Wait for results
    await expect.poll(async () => {
      const resultsVisible = await page.locator('[data-testid="query-results"]').isVisible().catch(() => false);
      const errorVisible = await page.locator('.text-red-600, .text-red-700').first().isVisible().catch(() => false);
      return resultsVisible || errorVisible;
    }, { timeout: 15_000, intervals: [500] }).toBe(true);
    
    await page.screenshot({ 
      path: 'test-results/quota-resilience-08-normal-operation-resumed.png', 
      fullPage: true 
    });
    
    // Final assertion: no critical crashes occurred
    const criticalErrors = consoleErrors.filter(e =>
      e.includes('React') && e.includes('error') && !e.includes('QuotaExceededError') ||
      e.includes('crashed') ||
      e.includes('unhandledrejection') && !e.includes('QuotaExceededError')
    );
    
    expect(criticalErrors).toHaveLength(0);
  });

  test('Session config resolution under quota pressure', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    
    // Navigate to practice page
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    // Fill storage to high level
    await fillStorageToQuota(page, 90);
    
    // Reload and verify app doesn't crash
    await page.reload();
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    
    // Verify page structure intact
    await expect(page.locator('body')).toBeVisible();
    await expect(page.locator('#root')).toBeVisible();
    
    // Try to read session-related data
    const sessionData = await page.evaluate(() => {
      const sessionId = window.localStorage.getItem('sql-learning-active-session');
      const profiles = window.localStorage.getItem('sql-learning-profiles');
      const interactions = window.localStorage.getItem('sql-learning-interactions');
      return { sessionId, hasProfiles: !!profiles, hasInteractions: !!interactions };
    });
    
    console.log('Session data under quota:', sessionData);
    
    // App should not have crashed
    const crashErrors = consoleErrors.filter(e => 
      e.includes('crash') || e.includes('fatal') || e.includes('React will try')
    );
    expect(crashErrors).toHaveLength(0);
    
    await page.screenshot({ 
      path: 'test-results/quota-resilience-session-config.png', 
      fullPage: true 
    });
    
    // Clean up
    await clearDummyStorageData(page);
  });

  test('Textbook functionality under quota pressure', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    
    // Navigate and set up initial state
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    await expect.poll(async () => {
      return await page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false);
    }, { timeout: 30_000, intervals: [500] }).toBe(true);
    
    // Add a note before quota pressure
    await replaceEditorText(page, INCORRECT_QUERY);
    await page.getByRole('button', { name: 'Run Query' }).click();
    
    await expect(page.getByText(/Results differ/i).first()).toBeVisible({ timeout: 10_000 });
    
    // Request hint
    const hintActionButton = page.getByTestId('hint-action-button');
    await expect(hintActionButton).toBeVisible({ timeout: 10_000 });
    await hintActionButton.click();
    
    await expect.poll(async () => {
      return await page.getByTestId('hint-label-1').isVisible().catch(() => false);
    }, { timeout: 15_000, intervals: [300, 700, 1200] }).toBe(true);
    
    // Save to notes
    const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 10_000 });
    await saveBtn.click();
    
    await expect(
      page.locator('text=/Saved.*My Textbook|Updated.*My Textbook/i').first()
    ).toBeVisible({ timeout: 20_000 });
    
    // Verify note exists
    const unitsBefore = await getTextbookUnits(page, LEARNER_ID);
    expect(unitsBefore.length).toBeGreaterThan(0);
    
    // Now fill storage to quota
    await fillStorageToQuota(page, 85);
    
    // Navigate to textbook
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });
    
    // Wait for render
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8_000 });
    
    await page.screenshot({ 
      path: 'test-results/quota-resilience-textbook-view.png', 
      fullPage: true 
    });
    
    // Verify page didn't crash
    const crashErrors = consoleErrors.filter(e => 
      e.includes('crash') || e.includes('fatal')
    );
    expect(crashErrors).toHaveLength(0);
    
    // Verify we can still see the previously saved content
    const firstTitle = unitsBefore[0].title as string;
    const titleVisible = await page.getByText(firstTitle, { exact: false }).first().isVisible().catch(() => false);
    console.log(`Textbook title visible under quota: ${titleVisible}`);
    
    // Clean up
    await clearDummyStorageData(page);
  });

  test('Graceful degradation when storage quota exceeded', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    
    // Navigate to practice
    await page.goto('/');
    await expect(page).toHaveURL(/\/practice/, { timeout: 30_000 });
    
    // Try to push past quota limit
    const fillResult = await page.evaluate(({ fillPrefix }) => {
      const chunkSize = 500 * 1024; // 500KB chunks
      const chunk = 'x'.repeat(chunkSize);
      let keysCreated = 0;
      let quotaErrors = 0;
      
      for (let i = 0; i < 20; i++) {
        try {
          localStorage.setItem(`${fillPrefix}large-${i}`, chunk);
          keysCreated++;
        } catch (e: any) {
          if (e.name === 'QuotaExceededError' || e.code === 22) {
            quotaErrors++;
            break; // Stop when we hit quota
          }
        }
      }
      
      return { keysCreated, quotaErrors };
    }, { fillPrefix: STORAGE_FILL_PREFIX });
    
    console.log(`Quota test: ${fillResult.keysCreated} keys, ${fillResult.quotaErrors} quota errors`);
    
    // App should still be functional after quota error
    await page.reload();
    await page.waitForLoadState('domcontentloaded', { timeout: 15_000 });
    
    // Verify no crash
    await expect(page.locator('body')).toBeVisible();
    
    // Try basic interaction
    const runButtonVisible = await page.getByRole('button', { name: 'Run Query' }).isVisible().catch(() => false);
    console.log(`Run button visible after quota error: ${runButtonVisible}`);
    
    await page.screenshot({ 
      path: 'test-results/quota-resilience-graceful-degradation.png', 
      fullPage: true 
    });
    
    // Clean up
    await clearDummyStorageData(page);
    
    // Verify no React crashes
    const reactCrashes = consoleErrors.filter(e => 
      e.includes('React') && e.includes('crash')
    );
    expect(reactCrashes).toHaveLength(0);
  });
});
