import { test, expect } from '@playwright/test';

/** Navigate to practice and wait for problem to load */
async function waitForProblemLoad(page: import('@playwright/test').Page) {
  await page.goto('/practice');
  await page.waitForSelector('[data-testid="sql-editor"], .monaco-editor', { timeout: 15000 });
}

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

  test('Save to Notes works before any query execution (uses problem concept fallback)', async ({ page }) => {
    await page.goto('/');
    await waitForProblemLoad(page);

    // Do NOT submit any query or request any hint

    // Look for Save to Notes or Add to My Textbook button
    const saveBtn = page.locator(
      'button:has-text("Save to Notes"), button:has-text("Save to My Notes"), [data-testid="save-to-notes-button"]'
    ).first();

    const btnCount = await saveBtn.count();
    if (btnCount === 0) {
      test.skip();
      return;
    }

    await saveBtn.click();
    await page.waitForTimeout(2000);

    // Should NOT see "no concept context" error
    const errorLocator = page.locator('text=/no concept context/i');
    await expect(errorLocator).toHaveCount(0);
  });
});
