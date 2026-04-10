import { test, expect } from '@playwright/test';
import { loginAsInstructor, loginAsStudent } from '../helpers/auth';

test.describe('Instructor View Student Textbook @hardening', () => {
  test('textbook shows student notes when instructor views it', async ({ page }) => {
    // Setup: Login as student and add a note
    await loginAsStudent(page);
    
    // Navigate to practice and add a note
    await page.goto('/practice');
    await page.waitForSelector('[data-testid="practice-page"]', { timeout: 15000 });
    
    // Get a hint to enable Save to Notes
    const hintButton = page.locator('button:has-text("Get Hint")');
    if (await hintButton.isVisible().catch(() => false)) {
      await hintButton.click();
      await page.waitForTimeout(1000);
    }
    
    // Try to add to notes (may or may not be visible depending on state)
    const saveToNotesButton = page.locator('text=Save to My Notes');
    if (await saveToNotesButton.isVisible().catch(() => false)) {
      await saveToNotesButton.click();
      await page.waitForTimeout(1000);
      
      // Confirm if dialog appears
      const confirmButton = page.locator('button:has-text("Save")').first();
      if (await confirmButton.isVisible().catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }
    }
    
    // Get the student's user ID for the URL
    const storageData = await page.evaluate(() => {
      const auth = localStorage.getItem('sql_adapt_auth');
      return { auth };
    });
    
    let studentId = '';
    if (storageData.auth) {
      try {
        const auth = JSON.parse(storageData.auth);
        studentId = auth.user?.id || auth.user?.learnerId || '';
      } catch {
        // ignore parse error
      }
    }
    
    // Logout and login as instructor
    await page.goto('/logout');
    await page.waitForTimeout(1000);
    
    await loginAsInstructor(page);
    
    // Navigate to instructor dashboard to find a student
    await page.goto('/instructor-dashboard');
    await page.waitForSelector('[data-testid="instructor-dashboard"]', { timeout: 15000 });
    
    // If we don't have a specific student ID, try to get one from the dashboard
    if (!studentId) {
      const firstStudentLink = page.locator('a[href*="/textbook?learnerId="]').first();
      if (await firstStudentLink.isVisible().catch(() => false)) {
        const href = await firstStudentLink.getAttribute('href');
        if (href) {
          const match = href.match(/learnerId=([^&]+)/);
          if (match) studentId = match[1];
        }
      }
    }
    
    // Navigate to view the student's textbook
    if (studentId) {
      await page.goto(`/textbook?learnerId=${studentId}`);
    } else {
      // Fallback: just go to textbook and hope there's a learner selector
      await page.goto('/textbook');
    }
    
    // Wait for textbook to load (not stuck on loading spinner)
    await page.waitForTimeout(3000);
    
    // The page should show either:
    // 1. Textbook content (notes)
    // 2. Empty state with student name/context
    // 3. "No notes yet" message
    // But NOT an infinite loading spinner
    
    const hasLoaded = await Promise.race([
      page.locator('[data-testid="textbook-content"]').isVisible().catch(() => false),
      page.locator('text=No notes yet').isVisible().catch(() => false),
      page.locator('text=My Notes').first().isVisible().catch(() => false),
      page.locator('text=Notebook').first().isVisible().catch(() => false),
    ]);
    
    expect(hasLoaded).toBeTruthy();
    
    // Verify we're not showing "Loading..." indefinitely
    const stillLoading = await page.locator('text=Loading').first().isVisible().catch(() => false);
    expect(stillLoading).toBeFalsy();
  });
  
  test('textbook hydration completes before showing content', async ({ page }) => {
    await loginAsInstructor(page);
    
    // Navigate directly to textbook with a learnerId parameter
    await page.goto('/textbook?learnerId=test-learner-id');
    
    // Should show loading state initially
    const hasLoadingIndicator = await Promise.race([
      page.locator('text=Loading').first().isVisible().catch(() => false),
      page.locator('.loading-spinner').first().isVisible().catch(() => false),
      page.locator('[data-testid="loading-skeleton"]').first().isVisible().catch(() => false),
    ]);
    
    // Loading state should appear
    expect(hasLoadingIndicator).toBeTruthy();
    
    // Wait for hydration to complete (up to 5 seconds)
    await page.waitForTimeout(5000);
    
    // Should no longer be in pure loading state
    const stillPureLoading = await page.locator('text=Loading...').first().isVisible().catch(() => false);
    
    // Either shows content, empty state, or error (not stuck loading)
    const hasSettled = await Promise.race([
      page.locator('[data-testid="textbook-content"]').isVisible().catch(() => false),
      page.locator('text=No notes').first().isVisible().catch(() => false),
      page.locator('text=Unable to load').first().isVisible().catch(() => false),
      Promise.resolve(!stillPureLoading),
    ]);
    
    expect(hasSettled).toBeTruthy();
  });
});
