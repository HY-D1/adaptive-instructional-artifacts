/**
 * Regression Tests for Query 13 Grading Fix
 * 
 * Addresses: Query 13 correct answers being marked wrong due to:
 * 1. compareResults() now uses epsilon-aware comparison via valuesEqual()
 * 2. Improved cell-level diff output for better debugging
 * 
 * Related files:
 * - apps/web/src/app/data/problems.ts (problem-13 expected data)
 * - apps/web/src/app/lib/sql-executor.ts (grading logic)
 */

import { test, expect } from '@playwright/test';

test.describe('Query 13 Grading Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the SQL practice page
    await page.goto('/sql-practice');
    
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
  });

  test('problem-13 shows as solved when correct answer is submitted', async ({ page }) => {
    // Navigate to problem-13
    await page.goto('/sql-practice/problem-13');
    await page.waitForLoadState('networkidle');
    
    // Wait for SQL editor to be ready
    await page.waitForSelector('[data-testid="sql-editor"] textarea, .monaco-editor', { timeout: 10000 });
    
    // Type the correct query
    const editor = page.locator('[data-testid="sql-editor"] textarea, .monaco-editor').first();
    await editor.click();
    await editor.fill(`SELECT category, AVG(price) AS avg_price FROM products GROUP BY category HAVING AVG(price) > 200;`);
    
    // Click run button
    await page.click('[data-testid="run-query-btn"]');
    
    // Wait for results to appear
    await page.waitForSelector('h3:has-text("Results"), .text-green-600:has-text("Output matches")', { timeout: 10000 });
    
    // Verify success message appears
    const successMessage = page.locator('.text-green-600:has-text("Output matches"), .text-green-600:has-text("Results match")');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });

  test('problem-13 accepts equivalent queries with different formatting', async ({ page }) => {
    await page.goto('/sql-practice/problem-13');
    await page.waitForLoadState('networkidle');
    
    await page.waitForSelector('[data-testid="sql-editor"] textarea, .monaco-editor', { timeout: 10000 });
    
    // Type equivalent query with different formatting
    const editor = page.locator('[data-testid="sql-editor"] textarea, .monaco-editor').first();
    await editor.click();
    await editor.fill(`
      SELECT category, AVG(price) AS avg_price 
      FROM products 
      GROUP BY category 
      HAVING AVG(price) > 200
    `);
    
    await page.click('[data-testid="run-query-btn"]');
    
    await page.waitForSelector('.text-green-600:has-text("Output matches"), .text-green-600:has-text("Results match")', { timeout: 10000 });
    
    const successMessage = page.locator('.text-green-600:has-text("Output matches"), .text-green-600:has-text("Results match")');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });

  test('problem-13 rejects queries with wrong HAVING threshold', async ({ page }) => {
    await page.goto('/sql-practice/problem-13');
    await page.waitForLoadState('networkidle');
    
    await page.waitForSelector('[data-testid="sql-editor"] textarea, .monaco-editor', { timeout: 10000 });
    
    // Type query with wrong threshold
    const editor = page.locator('[data-testid="sql-editor"] textarea, .monaco-editor').first();
    await editor.click();
    await editor.fill(`SELECT category, AVG(price) AS avg_price FROM products GROUP BY category HAVING AVG(price) > 500;`);
    
    await page.click('[data-testid="run-query-btn"]');
    
    // Wait for results and verify it shows as incorrect
    await page.waitForSelector('.text-red-600:has-text("Results differ"), .text-amber-600:has-text("different results")', { timeout: 10000 });
    
    const errorMessage = page.locator('.text-red-600:has-text("Results differ"), .text-amber-600:has-text("different results")').first();
    await expect(errorMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Float Comparison Epsilon Tests', () => {
  test('floating point AVG results match within epsilon', async ({ page }) => {
    // This test verifies that floating point results like 369.99 match expected 369.99
    // even if SQLite returns 369.99000000000001 due to floating point precision
    await page.goto('/sql-practice/problem-13');
    await page.waitForLoadState('networkidle');
    
    await page.waitForSelector('[data-testid="sql-editor"] textarea, .monaco-editor', { timeout: 10000 });
    
    // The correct query should return Electronics avg = 369.99
    // (999.99 + 29.99 + 79.99) / 3 = 369.99
    const editor = page.locator('[data-testid="sql-editor"] textarea, .monaco-editor').first();
    await editor.click();
    await editor.fill(`SELECT category, AVG(price) AS avg_price FROM products GROUP BY category HAVING AVG(price) > 200;`);
    
    await page.click('[data-testid="run-query-btn"]');
    
    // Verify success - this proves epsilon comparison is working
    await page.waitForSelector('.text-green-600:has-text("Output matches"), .text-green-600:has-text("Results match")', { timeout: 10000 });
    
    const successMessage = page.locator('.text-green-600:has-text("Output matches"), .text-green-600:has-text("Results match")');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Problem 5 Float Verification', () => {
  test('problem-5 calculates correct averages', async ({ page }) => {
    await page.goto('/sql-practice/problem-5');
    await page.waitForLoadState('networkidle');
    
    await page.waitForSelector('[data-testid="sql-editor"] textarea, .monaco-editor', { timeout: 10000 });
    
    // Submit the correct query
    const editor = page.locator('[data-testid="sql-editor"] textarea, .monaco-editor').first();
    await editor.click();
    await editor.fill(`SELECT category, AVG(price) as avg_price FROM products GROUP BY category;`);
    
    await page.click('[data-testid="run-query-btn"]');
    
    // Verify success
    await page.waitForSelector('.text-green-600:has-text("Output matches"), .text-green-600:has-text("Results match")', { timeout: 10000 });
    
    const successMessage = page.locator('.text-green-600:has-text("Output matches"), .text-green-600:has-text("Results match")');
    await expect(successMessage).toBeVisible({ timeout: 10000 });
  });
});
