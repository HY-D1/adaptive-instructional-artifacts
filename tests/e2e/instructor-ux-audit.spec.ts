/**
 * Instructor UX Audit Script
 *
 * Conducts a real-browser QA audit of all instructor-facing surfaces:
 * 1. Instructor Dashboard
 * 2. Preview Mode
 * 3. Settings Page
 * 4. Research Page
 */

import { test, expect, Page, ConsoleMessage } from '@playwright/test';
import { storage } from '../app/lib/storage';

// Test configuration
const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5174';

// Track console errors and warnings
const consoleMessages: Array<{ type: string; text: string; location?: string }> = [];
const networkErrors: Array<{ url: string; error: string }> = [];

// Helper to setup error tracking
function setupErrorTracking(page: Page) {
  consoleMessages.length = 0;
  networkErrors.length = 0;

  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type();
    if (type === 'error' || type === 'warning') {
      consoleMessages.push({
        type,
        text: msg.text(),
        location: msg.location()?.url,
      });
      console.log(`[${type.toUpperCase()}] ${msg.text()}`);
    }
  });

  page.on('pageerror', (error) => {
    consoleMessages.push({
      type: 'pageerror',
      text: error.message,
    });
    console.log(`[PAGE ERROR] ${error.message}`);
  });

  page.on('requestfailed', (request) => {
    networkErrors.push({
      url: request.url(),
      error: request.failure()?.errorText || 'Unknown error',
    });
    console.log(`[NETWORK ERROR] ${request.url()}: ${request.failure()?.errorText}`);
  });
}

// Helper to login as instructor
async function loginAsInstructor(page: Page) {
  await page.goto(`${BASE_URL}/`);

  // Wait for start page to load
  await page.waitForSelector('[data-testid="start-page"]', { timeout: 5000 });

  // Click "I'm an Instructor" button
  await page.click('[data-testid="instructor-button"]');

  // Wait for navigation to instructor dashboard
  await page.waitForURL(/instructor-dashboard/, { timeout: 5000 });
}

// Helper to login as student
async function loginAsStudent(page: Page) {
  await page.goto(`${BASE_URL}/`);

  // Wait for start page to load
  await page.waitForSelector('[data-testid="start-page"]', { timeout: 5000 });

  // Click "Start Learning" button (student path)
  await page.click('[data-testid="student-button"]');

  // Wait for navigation
  await page.waitForURL(/\/(concepts|practice|textbook)?/, { timeout: 5000 });
}

// Helper to clear preview mode
async function clearPreviewMode(page: Page) {
  await page.evaluate(() => {
    localStorage.removeItem('sql-adapt-preview-mode');
  });
}

test.describe('Instructor UX Audit', () => {
  test.beforeEach(async ({ page }) => {
    setupErrorTracking(page);

    // Clear storage before each test
    await page.goto(`${BASE_URL}/`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test.afterEach(async ({ page }, testInfo) => {
    // Report any console errors
    if (consoleMessages.length > 0) {
      console.log(`\n=== Console Errors for ${testInfo.title} ===`);
      consoleMessages.forEach(msg => {
        console.log(`[${msg.type}] ${msg.text}`);
      });
    }

    // Report network errors
    if (networkErrors.length > 0) {
      console.log(`\n=== Network Errors for ${testInfo.title} ===`);
      networkErrors.forEach(err => {
        console.log(`${err.url}: ${err.error}`);
      });
    }
  });

  // ==========================================
  // FLOW 1: Instructor Dashboard
  // ==========================================
  test.describe('Flow 1: Instructor Dashboard', () => {
    test('should display dashboard with correct layout', async ({ page }) => {
      await loginAsInstructor(page);

      // Verify we're on the instructor dashboard
      await expect(page).toHaveURL(/instructor-dashboard/);

      // Check for key dashboard elements
      await expect(page.locator('h1')).toContainText('Instructor Dashboard');

      // Verify stats cards are present
      await expect(page.locator('[data-testid="stats-cards"]')).toBeVisible();

      // Check learner table is readable
      const learnerTable = page.locator('[data-testid="learner-table"]');
      await expect(learnerTable).toBeVisible();

      // Take screenshot for documentation
      await page.screenshot({
        path: `test-results/instructor-dashboard-overview-${Date.now()}.png`,
        fullPage: true
      });

      // Verify no console errors
      const errors = consoleMessages.filter(m => m.type === 'error' || m.type === 'pageerror');
      expect(errors).toHaveLength(0);
    });

    test('should display learner statistics correctly', async ({ page }) => {
      await loginAsInstructor(page);

      // Check for key statistics
      const statsSection = page.locator('[data-testid="class-stats"]');
      await expect(statsSection).toBeVisible();

      // Verify stat labels are understandable
      await expect(page.locator('text=Total Students')).toBeVisible();
      await expect(page.locator('text=Active Today')).toBeVisible();
      await expect(page.locator('text=Average Progress')).toBeVisible();

      // Take screenshot of stats section
      await statsSection.screenshot({
        path: `test-results/instructor-dashboard-stats-${Date.now()}.png`
      });
    });

    test('should handle empty learner state gracefully', async ({ page }) => {
      await loginAsInstructor(page);

      // Check for empty state message
      const emptyState = page.locator('[data-testid="empty-learners"]');

      // If no learners, should show helpful message
      if (await emptyState.isVisible().catch(() => false)) {
        await expect(emptyState).toContainText('No learners yet');
      }
    });

    test('should have working navigation links', async ({ page }) => {
      await loginAsInstructor(page);

      // Check Research link
      await page.click('[data-testid="nav-research"]');
      await expect(page).toHaveURL(/research/);

      // Go back
      await page.goBack();

      // Check Settings link
      await page.click('[data-testid="nav-settings"]');
      await expect(page).toHaveURL(/settings/);
    });
  });

  // ==========================================
  // FLOW 2: Preview Mode
  // ==========================================
  test.describe('Flow 2: Preview Mode', () => {
    test('should activate preview mode from dashboard', async ({ page }) => {
      await loginAsInstructor(page);

      // Find and click preview button
      const previewButton = page.locator('[data-testid="launch-preview-button"]');
      await expect(previewButton).toBeVisible();
      await previewButton.click();

      // Preview modal should open
      const previewModal = page.locator('[data-testid="preview-modal"]');
      await expect(previewModal).toBeVisible();

      // Take screenshot of preview modal
      await previewModal.screenshot({
        path: `test-results/preview-modal-${Date.now()}.png`
      });

      // Select a profile and launch preview
      await page.click('[data-testid="preview-profile-adaptive"]');
      await page.click('[data-testid="confirm-preview-button"]');

      // Should navigate to practice page with preview mode
      await expect(page).toHaveURL(/practice/);

      // Verify preview mode indicator is visible
      await expect(page.locator('[data-testid="preview-mode-indicator"]')).toBeVisible();

      // Take screenshot of preview mode active
      await page.screenshot({
        path: `test-results/preview-mode-active-${Date.now()}.png`,
        fullPage: true
      });
    });

    test('should show visual indicator when in preview mode', async ({ page }) => {
      await loginAsInstructor(page);

      // Activate preview mode
      await page.evaluate(() => {
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      // Navigate to student route
      await page.goto(`${BASE_URL}/practice`);

      // Should show preview mode banner/indicator
      const indicator = page.locator('[data-testid="preview-mode-indicator"]');
      await expect(indicator).toBeVisible();

      // Should contain explanatory text
      await expect(indicator).toContainText('Preview');
    });

    test('should allow exiting preview mode', async ({ page }) => {
      await loginAsInstructor(page);

      // Activate preview mode
      await page.evaluate(() => {
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      // Navigate to practice page
      await page.goto(`${BASE_URL}/practice`);

      // Find and click exit preview button
      const exitButton = page.locator('[data-testid="exit-preview-button"]');
      await expect(exitButton).toBeVisible();
      await exitButton.click();

      // Should redirect back to instructor dashboard
      await expect(page).toHaveURL(/instructor-dashboard/);

      // Preview mode should be cleared
      const previewMode = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-preview-mode');
      });
      expect(previewMode).toBeNull();
    });

    test('should maintain state consistency between modes', async ({ page }) => {
      await loginAsInstructor(page);

      // Activate preview mode
      await page.evaluate(() => {
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      // Navigate to practice and do something
      await page.goto(`${BASE_URL}/practice`);

      // Wait for page to load
      await page.waitForSelector('[data-testid="learning-interface"]', { timeout: 5000 });

      // Exit preview mode
      await page.click('[data-testid="exit-preview-button"]');
      await expect(page).toHaveURL(/instructor-dashboard/);

      // Re-enter preview mode
      await page.evaluate(() => {
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });
      await page.goto(`${BASE_URL}/practice`);

      // Should still work without errors
      await expect(page.locator('[data-testid="learning-interface"]')).toBeVisible();

      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors).toHaveLength(0);
    });

    test('should prevent students from accessing preview mode', async ({ page }) => {
      await loginAsStudent(page);

      // Try to set preview mode as student
      await page.evaluate(() => {
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      // Try to access instructor-only route
      await page.goto(`${BASE_URL}/instructor-dashboard`);

      // Should be redirected away (to home or student dashboard)
      await expect(page).not.toHaveURL(/instructor-dashboard/);
    });
  });

  // ==========================================
  // FLOW 3: Settings Page
  // ==========================================
  test.describe('Flow 3: Settings Page', () => {
    test('should display settings for instructors', async ({ page }) => {
      await loginAsInstructor(page);

      // Navigate to settings
      await page.goto(`${BASE_URL}/settings`);

      // Verify settings page loads
      await expect(page.locator('h1')).toContainText('Settings');

      // Take screenshot
      await page.screenshot({
        path: `test-results/instructor-settings-${Date.now()}.png`,
        fullPage: true
      });
    });

    test('should show PDF upload section for instructors', async ({ page }) => {
      await loginAsInstructor(page);
      await page.goto(`${BASE_URL}/settings`);

      // PDF upload should be visible for instructors
      const pdfSection = page.locator('[data-testid="pdf-upload-section"]');
      await expect(pdfSection).toBeVisible();

      // Should have helpful description
      await expect(pdfSection).toContainText('textbook');
    });

    test('should show preview mode toggle for instructors', async ({ page }) => {
      await loginAsInstructor(page);
      await page.goto(`${BASE_URL}/settings`);

      const previewToggle = page.locator('[data-testid="preview-mode-toggle"]');
      await expect(previewToggle).toBeVisible();

      // Toggle preview mode
      await previewToggle.click();

      // Verify localStorage is updated
      const previewMode = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-preview-mode');
      });
      expect(previewMode).toBe('true');

      // Toggle off
      await previewToggle.click();

      const previewModeOff = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-preview-mode');
      });
      expect(previewModeOff).toBe('false');
    });

    test('should show debug controls only in DEV mode', async ({ page }) => {
      await loginAsInstructor(page);
      await page.goto(`${BASE_URL}/settings`);

      // Check if DEV mode controls are present
      const debugControls = page.locator('[data-testid="week5-debug-controls"]');

      // In DEV mode, these should be visible
      // In production, they should be hidden
      const isDev = await page.evaluate(() => {
        return import.meta.env?.DEV ?? false;
      }).catch(() => false);

      if (isDev) {
        await expect(debugControls).toBeVisible();
      }
    });

    test('should show experimental toggles for instructors', async ({ page }) => {
      await loginAsInstructor(page);
      await page.goto(`${BASE_URL}/settings`);

      const experimentalSection = page.locator('[data-testid="experimental-toggles-section"]');
      await expect(experimentalSection).toBeVisible();

      // Check for specific toggles
      await expect(page.locator('[data-testid="toggle-textbook-disabled"]')).toBeVisible();
      await expect(page.locator('[data-testid="toggle-adaptive-ladder"]')).toBeVisible();
    });

    test('should persist settings after refresh', async ({ page }) => {
      await loginAsInstructor(page);
      await page.goto(`${BASE_URL}/settings`);

      // Enable preview mode
      await page.click('[data-testid="preview-mode-toggle"]');

      // Refresh page
      await page.reload();

      // Toggle should still be on
      const toggle = page.locator('[data-testid="preview-mode-toggle"] input');
      await expect(toggle).toBeChecked();
    });

    test('should NOT show PDF upload for students', async ({ page }) => {
      await loginAsStudent(page);
      await page.goto(`${BASE_URL}/settings`);

      // PDF upload should NOT be visible for students
      const pdfSection = page.locator('[data-testid="pdf-upload-section"]');
      await expect(pdfSection).not.toBeVisible();
    });

    test('should NOT show experimental toggles for students', async ({ page }) => {
      await loginAsStudent(page);
      await page.goto(`${BASE_URL}/settings`);

      // Experimental toggles should NOT be visible for students
      const experimentalSection = page.locator('[data-testid="experimental-toggles-section"]');
      await expect(experimentalSection).not.toBeVisible();
    });
  });

  // ==========================================
  // FLOW 4: Research Page
  // ==========================================
  test.describe('Flow 4: Research Page', () => {
    test('should display research dashboard for instructors', async ({ page }) => {
      await loginAsInstructor(page);

      // Navigate to research page
      await page.goto(`${BASE_URL}/research`);

      // Verify research page loads
      await expect(page.locator('h1')).toContainText('Research Dashboard');

      // Take screenshot
      await page.screenshot({
        path: `test-results/research-dashboard-${Date.now()}.png`,
        fullPage: true
      });

      // Verify no console errors
      const errors = consoleMessages.filter(m => m.type === 'error');
      expect(errors).toHaveLength(0);
    });

    test('should show research data visualizations', async ({ page }) => {
      await loginAsInstructor(page);
      await page.goto(`${BASE_URL}/research`);

      // Check for data visualization elements
      const dashboard = page.locator('[data-testid="research-dashboard"]');
      await expect(dashboard).toBeVisible();

      // Should have some data display
      const dataElements = page.locator('[data-testid*="chart"], [data-testid*="graph"], [data-testid*="stats"]');
      const count = await dataElements.count();
      expect(count).toBeGreaterThan(0);
    });

    test('should have back navigation to instructor dashboard', async ({ page }) => {
      await loginAsInstructor(page);
      await page.goto(`${BASE_URL}/research`);

      // Find back button
      const backButton = page.locator('text=Back to Dashboard');
      await expect(backButton).toBeVisible();

      // Click back
      await backButton.click();
      await expect(page).toHaveURL(/instructor-dashboard/);
    });

    test('should show hosted mode banner when applicable', async ({ page }) => {
      await loginAsInstructor(page);
      await page.goto(`${BASE_URL}/research`);

      // Check for hosted mode banner
      const hostedBanner = page.locator('[data-testid="hosted-mode-banner"]');

      // Banner may or may not be visible depending on environment
      if (await hostedBanner.isVisible().catch(() => false)) {
        await expect(hostedBanner).toContainText('Hosted Mode');
      }
    });

    test('should prevent students from accessing research page', async ({ page }) => {
      await loginAsStudent(page);

      // Try to access research page
      await page.goto(`${BASE_URL}/research`);

      // Should be redirected away
      await expect(page).not.toHaveURL(/research/);
    });
  });

  // ==========================================
  // Cross-cutting Concerns
  // ==========================================
  test.describe('Cross-cutting: Permission Boundaries', () => {
    test('should enforce role-based access control', async ({ page }) => {
      // Login as student
      await loginAsStudent(page);

      // Try to access instructor-only routes
      const instructorRoutes = [
        '/instructor-dashboard',
        '/research',
      ];

      for (const route of instructorRoutes) {
        await page.goto(`${BASE_URL}${route}`);

        // Should not stay on the instructor route
        const url = page.url();
        expect(url).not.toContain(route);
      }
    });

    test('should allow instructors to access student routes (without preview)', async ({ page }) => {
      await loginAsInstructor(page);

      // Clear any preview mode
      await clearPreviewMode(page);

      // Try to access student routes - should be redirected
      await page.goto(`${BASE_URL}/practice`);

      // Without preview mode, should redirect to instructor dashboard
      await expect(page).toHaveURL(/instructor-dashboard/);
    });

    test('should allow instructors to access student routes with preview mode', async ({ page }) => {
      await loginAsInstructor(page);

      // Enable preview mode
      await page.evaluate(() => {
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      // Now should be able to access student routes
      await page.goto(`${BASE_URL}/practice`);
      await expect(page).toHaveURL(/practice/);
    });
  });
});
