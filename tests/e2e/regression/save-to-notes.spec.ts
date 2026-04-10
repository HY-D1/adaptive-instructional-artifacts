import { test, expect } from '@playwright/test';
import { navigateToProblem, waitForProblemLoad } from '../helpers/learning-interface';

test.describe('Save to Notes @hardening', () => {
  test('Save to Notes works without prior error', async ({ page }) => {
    // Navigate to the learning interface
    await page.goto('/');
    
    // Wait for the page to load and navigate to a problem
    await waitForProblemLoad(page);
    
    // Do NOT submit any incorrect query - we want to test saving without an error
    
    // Click "Save to Notes" button
    const saveToNotesButton = page.locator('button:has-text("Save to Notes"), [data-testid="save-to-notes-button"]').first();
    await expect(saveToNotesButton).toBeVisible();
    await saveToNotesButton.click();
    
    // Wait for the operation to complete
    await page.waitForTimeout(1000);
    
    // Verify: note is saved (no "no concept context" or "Could not save" error)
    const actionMessage = page.locator('[data-testid="notes-action-message"], .notes-action-message, [data-testid="save-notification"]').first();
    
    // Check that either:
    // 1. A success message appears, OR
    // 2. No error message about "no concept context" appears
    const errorLocator = page.locator('text=/no concept context|Could not save/i');
    const errorCount = await errorLocator.count();
    
    // There should be no "no concept context" error
    expect(errorCount).toBe(0);
    
    // Alternatively, verify a success message appears
    const successMessage = page.locator('text=/Saved.*My Textbook|find it in My Textbook/i');
    await expect(successMessage).toBeVisible({ timeout: 5000 });
  });
  
  test('Escalation button works without prior error', async ({ page }) => {
    // Navigate to the learning interface
    await page.goto('/');
    
    // Wait for the page to load
    await waitForProblemLoad(page);
    
    // Do NOT submit any incorrect query
    
    // Look for and click an escalation button ("I need more help" or similar)
    const escalationButton = page.locator('button:has-text("I need more help"), button:has-text("Show explanation"), [data-testid="escalation-button"]').first();
    
    // Skip if no escalation button is found (some configurations may not have it)
    const buttonCount = await escalationButton.count();
    if (buttonCount === 0) {
      test.skip();
      return;
    }
    
    await escalationButton.click();
    
    // Wait for the operation to complete
    await page.waitForTimeout(1000);
    
    // Verify: no "no concept context" error appears
    const errorLocator = page.locator('text=/no concept context|Could not save/i');
    const errorCount = await errorLocator.count();
    
    // There should be no "no concept context" error
    expect(errorCount).toBe(0);
  });
});
