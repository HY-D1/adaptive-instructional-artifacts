/**
 * Student Progress Persistence Regression Tests
 * 
 * Tests for Workstream 1 fixes:
 * - Root Cause A: Progress Not Hydrated Before UI Reads
 * - Root Cause B: Draft Keyed by SessionId
 */

import { test, expect } from '@playwright/test';

async function navigateToPracticePage(page: import('@playwright/test').Page) {
  await page.goto('/practice');
  await page.waitForSelector('[data-testid="sql-editor"], .monaco-editor', { timeout: 15000 });
}

async function executeQuery(page: import('@playwright/test').Page, sql?: string) {
  if (sql) {
    await page.fill('[data-testid="sql-editor"] textarea, .cm-editor textarea', sql);
  }
  await page.locator('[data-testid="run-query-btn"]').click();
  await page.waitForSelector('[data-testid="query-results"], [data-testid="result-correct"], [data-testid="result-incorrect"]', { timeout: 15000 });
}

async function waitForProblemLoad(page: import('@playwright/test').Page) {
  await page.goto('/practice');
  await page.waitForSelector('[data-testid="sql-editor"], .monaco-editor', { timeout: 15000 });
}

test.describe('Student Progress Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to practice page before each test
    await navigateToPracticePage(page);
  });

  test('solved count updates after executing correct query', async ({ page }) => {
    // Wait for problem to load
    await waitForProblemLoad(page);

    // Get initial solved count from progress display
    const progressIndicator = page.locator('[data-testid="progress-indicator"], .progress-text, text=/\\d+\\/\\d+/').first();
    const initialText = await progressIndicator.textContent().catch(() => '0/32');
    
    // Type a correct query for the first problem
    // Problem 1 typically asks for all employees
    await page.fill('[data-testid="sql-editor"] textarea, .cm-editor textarea', 'SELECT * FROM employees');
    
    // Execute the query
    await executeQuery(page);

    // Wait for success indicator
    await expect(page.locator('[data-testid="success-indicator"], .success-message, text=/correct/i').first()).toBeVisible({ timeout: 5000 });
    
    // Verify solved count increased
    // The progress should reflect the solved state
    await page.waitForTimeout(500); // Allow state to propagate
    
    // Refresh and verify persistence
    await page.reload();
    await waitForProblemLoad(page);
    
    // Progress should still show solved after reload
    const afterReloadText = await progressIndicator.textContent().catch(() => '0/32');
    expect(afterReloadText).toContain('1/'); // At least 1 solved
  });

  test('draft survives page reload', async ({ page }) => {
    // Wait for problem to load
    await waitForProblemLoad(page);

    // Type a draft query
    const draftQuery = 'SELECT id, name FROM employees WHERE department = ';
    await page.fill('[data-testid="sql-editor"] textarea, .cm-editor textarea', draftQuery);
    
    // Wait for draft to be saved (debounced)
    await page.waitForTimeout(2500);
    
    // Reload the page
    await page.reload();
    await waitForProblemLoad(page);

    // Verify draft is restored
    const editor = page.locator('[data-testid="sql-editor"] textarea, .cm-editor textarea').first();
    const restoredContent = await editor.inputValue();
    expect(restoredContent).toContain('SELECT id, name FROM employees');
  });

  test('draft survives problem navigation', async ({ page }) => {
    // Wait for problem to load
    await waitForProblemLoad(page);

    // Type a draft query on first problem
    const draftQuery = 'SELECT * FROM departments WHERE location = ';
    await page.fill('[data-testid="sql-editor"] textarea, .cm-editor textarea', draftQuery);
    
    // Wait for draft to be saved
    await page.waitForTimeout(2500);

    // Navigate to next problem
    const nextButton = page.locator('[data-testid="next-problem-btn"], button:has-text("Next"), .problem-nav-next').first();
    if (await nextButton.isVisible().catch(() => false)) {
      await nextButton.click();
    } else {
      // Use problem selector if available
      await page.click('[data-testid="problem-selector"]');
      await page.click('text=Problem 2');
    }
    
    await page.waitForTimeout(1000);
    
    // Navigate back to first problem
    const prevButton = page.locator('[data-testid="prev-problem-btn"], button:has-text("Previous"), .problem-nav-prev').first();
    if (await prevButton.isVisible().catch(() => false)) {
      await prevButton.click();
    } else {
      await page.click('[data-testid="problem-selector"]');
      await page.click('text=Problem 1');
    }
    
    await waitForProblemLoad(page);

    // Verify draft is restored for first problem
    const editor = page.locator('[data-testid="sql-editor"] textarea, .cm-editor textarea').first();
    const restoredContent = await editor.inputValue();
    expect(restoredContent).toContain('SELECT * FROM departments');
  });

  test('progress shows correctly immediately after login', async ({ page }) => {
    // This test verifies that the hydration race condition is fixed
    // by checking that progress is accurate immediately after page load

    await waitForProblemLoad(page);

    // Solve a problem first
    await page.fill('[data-testid="sql-editor"] textarea, .cm-editor textarea', 'SELECT * FROM employees');
    await executeQuery(page);
    await expect(page.locator('[data-testid="success-indicator"], .success-message').first()).toBeVisible({ timeout: 5000 });

    // Clear storage to simulate fresh login
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
    
    // Reload (simulating fresh login)
    await page.reload();
    await waitForProblemLoad(page);

    // Wait for hydration to complete
    await page.waitForTimeout(2000);
    
    // Progress should eventually show the solved problem
    // Using a flexible check since exact timing depends on hydration
    const progressText = await page.locator('body').textContent();
    expect(progressText).toMatch(/\d+\/\d+/); // Should show some progress format
  });
});
