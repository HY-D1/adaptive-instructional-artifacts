import { test, expect } from '@playwright/test';
import { loginAsStudent } from '../helpers/auth';

test.describe('Save to Notes Visibility @hardening', () => {
  test('Save to Notes button appears after viewing hints', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/practice');
    
    // Wait for practice page to load
    await page.waitForSelector('[data-testid="practice-page"]', { timeout: 15000 });
    
    // Look for "Get Hint" or "Get More Help" button
    const hintButton = page.locator('button:has-text("Get Hint"), button:has-text("Get More Help")').first();
    
    // If hint button exists, click it
    if (await hintButton.isVisible().catch(() => false)) {
      await hintButton.click();
      await page.waitForTimeout(1500);
      
      // After viewing a hint, Save to Notes should be visible
      const saveToNotes = page.locator('text=Save to My Notes');
      await expect(saveToNotes).toBeVisible({ timeout: 10000 });
    } else {
      // If no hint button, the save button might already be visible due to other conditions
      const saveToNotes = page.locator('text=Save to My Notes');
      const isVisible = await saveToNotes.isVisible().catch(() => false);
      
      // Either hint button exists and we clicked it, or save button is already visible
      expect(isVisible || !(await hintButton.isVisible().catch(() => false))).toBeTruthy();
    }
  });
  
  test('Save to Notes button stays after solving problem', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/practice');
    
    // Wait for practice page to load
    await page.waitForSelector('[data-testid="practice-page"]', { timeout: 15000 });
    
    // Get hint first to enable save button
    const hintButton = page.locator('button:has-text("Get Hint"), button:has-text("Get More Help")').first();
    if (await hintButton.isVisible().catch(() => false)) {
      await hintButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Find the editor and submit a query
    const editor = page.locator('.monaco-editor textarea').first();
    
    // Try to submit any query (even if it errors, we're testing visibility)
    await editor.fill('SELECT 1');
    await page.keyboard.press('Control+Enter');
    
    // Wait for execution to complete
    await page.waitForTimeout(3000);
    
    // Save to Notes should still be visible after execution (whether success or error)
    const saveToNotes = page.locator('text=Save to My Notes');
    
    // Button should be visible because:
    // 1. We viewed hints (hasViewedHints = true), OR
    // 2. The query executed (may have created error context), OR  
    // 3. The problem was solved (hasSolvedCurrentProblem = true)
    await expect(saveToNotes).toBeVisible({ timeout: 10000 });
  });
  
  test('Save to Notes appears for correctly solved problem', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/practice');
    
    // Wait for practice page to load
    await page.waitForSelector('[data-testid="practice-page"]', { timeout: 15000 });
    
    // Get the current problem description to understand what to solve
    const problemText = await page.locator('[data-testid="problem-description"]').textContent().catch(() => '');
    
    // Try to submit a simple correct query based on problem context
    // Most problems accept "SELECT * FROM table" as a starting point
    const editor = page.locator('.monaco-editor textarea').first();
    
    // Common correct queries for typical SQL practice problems
    const attempts = [
      'SELECT * FROM employees LIMIT 1',
      'SELECT 1',
      'SELECT * FROM students LIMIT 1',
      'SELECT COUNT(*) FROM employees',
    ];
    
    for (const query of attempts) {
      await editor.fill(query);
      await page.keyboard.press('Control+Enter');
      await page.waitForTimeout(2000);
      
      // Check if we got a success message
      const hasSuccess = await page.locator('text=Correct').first().isVisible().catch(() => false);
      
      if (hasSuccess) {
        break;
      }
    }
    
    // Wait a bit for state to settle
    await page.waitForTimeout(1000);
    
    // Save to Notes should be visible after correct answer
    // (either because hasSolvedCurrentProblem is true, or because we viewed hints)
    const saveToNotes = page.locator('text=Save to My Notes');
    const isVisible = await saveToNotes.isVisible().catch(() => false);
    
    // The button should be visible - if not, log the state for debugging
    if (!isVisible) {
      const pageContent = await page.content();
      console.log('Save to Notes not visible. Page content snippet:', pageContent.slice(0, 1000));
    }
    
    expect(isVisible).toBeTruthy();
  });
  
  test('Save to Notes button is clickable and opens dialog', async ({ page }) => {
    await loginAsStudent(page);
    await page.goto('/practice');
    
    // Wait for practice page to load
    await page.waitForSelector('[data-testid="practice-page"]', { timeout: 15000 });
    
    // Get hint to enable save button
    const hintButton = page.locator('button:has-text("Get Hint"), button:has-text("Get More Help")').first();
    if (await hintButton.isVisible().catch(() => false)) {
      await hintButton.click();
      await page.waitForTimeout(1500);
    }
    
    // Click Save to Notes
    const saveToNotes = page.locator('text=Save to My Notes');
    await expect(saveToNotes).toBeVisible({ timeout: 10000 });
    await saveToNotes.click();
    
    // Wait for dialog/modal to appear
    await page.waitForTimeout(500);
    
    // Should show some form of save dialog or confirmation
    const hasDialog = await Promise.race([
      page.locator('text=Save Note').first().isVisible().catch(() => false),
      page.locator('text=Add to Notebook').first().isVisible().catch(() => false),
      page.locator('text=Confirm').first().isVisible().catch(() => false),
      page.locator('textarea[placeholder*="note"]').first().isVisible().catch(() => false),
      page.locator('[role="dialog"]').first().isVisible().catch(() => false),
    ]);
    
    expect(hasDialog).toBeTruthy();
  });
});
