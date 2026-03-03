import { test, expect } from '@playwright/test';

/**
 * Instructor Preview Mode - E2E Tests
 * 
 * Tests the instructor preview mode functionality including:
 * - Preview mode activation from dashboard
 * - Student navigation in preview mode
 * - Exit preview returning to instructor dashboard
 * - Profile override application in preview mode
 * 
 * Tags: @no-external @weekly
 * These tests don't require Ollama and are self-contained.
 */

test.describe('@no-external @weekly Instructor Preview Mode', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage and set up clean state
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  // ============================================
  // TEST 1: Preview Mode Activation
  // ============================================
  test('instructor can activate preview mode', async ({ page }) => {
    // Login as instructor
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/instructor-dashboard');
    await expect(page.locator('text=Instructor Dashboard')).toBeVisible({ timeout: 10000 });

    // Click Launch Preview
    await page.click('[data-testid="launch-preview-button"]');

    // Modal should open with "Student Preview" title
    await expect(page.locator('text=Student Preview')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Configure preview settings and experience the platform as a student')).toBeVisible();

    // Select Fast Escalator profile
    await page.click('text=Fast Escalator');

    // Verify selection is highlighted
    const fastButton = page.locator('button').filter({ hasText: /^Fast Escalator$/ });
    await expect(fastButton).toHaveClass(/border-blue-500/);

    // Click Start Preview
    await page.click('button:has-text("Start Preview")');

    // Should navigate to /practice
    await page.waitForURL('/practice', { timeout: 10000 });

    // Should show preview banner
    await expect(page.locator('text=Student Preview Mode')).toBeVisible({ timeout: 5000 });

    // Verify localStorage keys are set correctly
    const localStorageState = await page.evaluate(() => ({
      previewMode: localStorage.getItem('sql-adapt-preview-mode'),
      debugProfile: localStorage.getItem('sql-adapt-debug-profile'),
      debugStrategy: localStorage.getItem('sql-adapt-debug-strategy')
    }));

    expect(localStorageState.previewMode).toBe('true');
    expect(localStorageState.debugProfile).toBe('fast-escalator');
    expect(localStorageState.debugStrategy).toBe('static');
  });

  // ============================================
  // TEST 2: Student Navigation in Preview
  // ============================================
  test('preview mode shows student navigation', async ({ page }) => {
    // Set preview mode and instructor role
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-preview-mode', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('domcontentloaded');

    // Should show student nav items
    await expect(page.locator('nav')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('nav').getByText('Learn')).toBeVisible();
    await expect(page.locator('nav').getByText('Practice')).toBeVisible();
    await expect(page.locator('nav').getByText('My Textbook')).toBeVisible();

    // Should NOT show instructor nav items
    await expect(page.locator('nav').getByText('Research')).not.toBeVisible();
    await expect(page.locator('nav').getByText('Dashboard')).not.toBeVisible();

    // Should show the student header (not instructor header)
    await expect(page.locator('text=Practice SQL')).toBeVisible();
    await expect(page.locator('text=Instructor Mode')).not.toBeVisible();

    // Should show preview mode indicator
    await expect(page.locator('text=Preview Mode')).toBeVisible();
  });

  // ============================================
  // TEST 3: Exit Preview Returns to Dashboard
  // ============================================
  test('exit preview returns to instructor dashboard', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-preview-mode', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'fast-escalator');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('domcontentloaded');

    // Verify we're in preview mode
    await expect(page.locator('text=Student Preview Mode')).toBeVisible({ timeout: 10000 });

    // Click Exit Preview
    await page.click('button:has-text("Exit Preview")');

    // Should return to instructor dashboard
    await page.waitForURL('/instructor-dashboard', { timeout: 10000 });
    await expect(page.locator('text=Instructor Dashboard')).toBeVisible();

    // Preview mode should be cleared from localStorage
    const previewMode = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-preview-mode');
    });
    expect(previewMode).toBeNull();

    // debug-profile should also be cleared
    const debugProfile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-profile');
    });
    expect(debugProfile).toBeNull();

    // debug-strategy should also be cleared
    const debugStrategy = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-strategy');
    });
    expect(debugStrategy).toBeNull();
  });

  // ============================================
  // TEST 4: Profile Override in Preview
  // ============================================
  test('preview mode applies selected profile', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-preview-mode', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'explanation-first');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('domcontentloaded');

    // Wait for the practice page to fully load
    await expect(page.locator('text=Practice SQL')).toBeVisible({ timeout: 10000 });

    // Make an error by running incorrect SQL
    // Wait for the Monaco editor to be ready
    await page.waitForSelector('.monaco-editor', { state: 'visible', timeout: 10000 });

    // Click on editor and enter invalid SQL
    const editorSurface = page.locator('.monaco-editor .view-lines').first();
    await editorSurface.click({ position: { x: 8, y: 8 } });
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
    await page.keyboard.type('SELECT * FROM wrong_table');

    // Run the query
    await page.click('[data-testid="run-query-btn"]');

    // Wait for error to appear
    await expect(page.locator('text=error', { hasText: /error/i }).first()).toBeVisible({ timeout: 5000 });

    // With explanation-first profile, hint content should be visible or quickly become visible
    // The hint system should respond quickly
    await expect(page.locator('[data-testid="hint-system"]').or(page.locator('.hint-content')).or(page.locator('text=Hint'))).toBeVisible({ timeout: 10000 });

    // Verify the profile is set correctly
    const debugProfile = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-debug-profile');
    });
    expect(debugProfile).toBe('explanation-first');
  });

  // ============================================
  // TEST 5: All Profile Options Available
  // ============================================
  test('all profile options are available in preview modal', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/instructor-dashboard');
    await expect(page.locator('text=Instructor Dashboard')).toBeVisible({ timeout: 10000 });

    // Click Launch Preview
    await page.click('[data-testid="launch-preview-button"]');

    // Modal should open
    await expect(page.locator('text=Student Preview')).toBeVisible({ timeout: 5000 });

    // All profile options should be available
    await expect(page.locator('text=Fast Escalator')).toBeVisible();
    await expect(page.locator('text=Quick intervention')).toBeVisible();

    await expect(page.locator('text=Slow Escalator')).toBeVisible();
    await expect(page.locator('text=Extended exploration')).toBeVisible();

    await expect(page.locator('text=Adaptive')).toBeVisible();
    await expect(page.locator('text=Balanced approach')).toBeVisible();

    await expect(page.locator('text=Explanation First')).toBeVisible();
    await expect(page.locator('text=Immediate help')).toBeVisible();
  });

  // ============================================
  // TEST 6: Preview Mode Persistence Across Navigation
  // ============================================
  test('preview mode persists when navigating between student pages', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-preview-mode', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'adaptive-escalator');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('domcontentloaded');

    // Verify preview mode on practice page
    await expect(page.locator('text=Student Preview Mode')).toBeVisible({ timeout: 10000 });

    // Navigate to My Textbook
    await page.click('nav >> text=My Textbook');
    await page.waitForLoadState('domcontentloaded');

    // Should still be in preview mode
    await expect(page.locator('text=Student Preview Mode')).toBeVisible();

    // Verify localStorage is still set
    const previewMode = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-preview-mode');
    });
    expect(previewMode).toBe('true');

    // Navigate back to Practice
    await page.click('nav >> text=Practice');
    await page.waitForLoadState('domcontentloaded');

    // Should still be in preview mode
    await expect(page.locator('text=Student Preview Mode')).toBeVisible();
  });

  // ============================================
  // TEST 7: Cancel Preview Modal
  // ============================================
  test('cancel button closes preview modal without activating preview', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/instructor-dashboard');
    await expect(page.locator('text=Instructor Dashboard')).toBeVisible({ timeout: 10000 });

    // Click Launch Preview
    await page.click('[data-testid="launch-preview-button"]');

    // Modal should open
    await expect(page.locator('text=Student Preview')).toBeVisible({ timeout: 5000 });

    // Click Cancel
    await page.click('button:has-text("Cancel")');

    // Modal should close
    await expect(page.locator('text=Student Preview')).not.toBeVisible();

    // Should still be on instructor dashboard
    await expect(page.locator('text=Instructor Dashboard')).toBeVisible();

    // Preview mode should NOT be set
    const previewMode = await page.evaluate(() => {
      return localStorage.getItem('sql-adapt-preview-mode');
    });
    expect(previewMode).toBeNull();
  });

  // ============================================
  // TEST 8: Exit Preview Button Position and Styling
  // ============================================
  test('exit preview button has correct styling and position', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-instructor',
        name: 'Test Instructor',
        role: 'instructor',
        createdAt: Date.now()
      }));
      localStorage.setItem('sql-adapt-preview-mode', 'true');
      localStorage.setItem('sql-adapt-debug-profile', 'slow-escalator');
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });

    await page.goto('/practice');
    await page.waitForLoadState('domcontentloaded');

    // Verify the preview banner is at the top with purple styling
    const banner = page.locator('.bg-purple-600');
    await expect(banner).toBeVisible({ timeout: 10000 });

    // Exit Preview button should be within the banner
    const exitButton = banner.locator('button:has-text("Exit Preview")');
    await expect(exitButton).toBeVisible();

    // Verify button styling (white background, purple text)
    await expect(exitButton).toHaveClass(/bg-white/);
    await expect(exitButton).toHaveClass(/text-purple-700/);
  });
});
