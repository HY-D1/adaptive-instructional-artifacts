/**
 * Automated Instructor UX Audit
 *
 * This script performs an automated audit of instructor-facing surfaces
 * using Playwright. It uses localStorage-based auth to avoid backend dependencies.
 *
 * Run with:
 *   npx playwright test tests/e2e/instructor-ux-audit-automated.spec.ts --project=chromium
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:5174';

// Helper to set up instructor auth via localStorage
async function setupInstructorAuth(page: Page) {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => {
    localStorage.setItem('sql-learning-user-profile', JSON.stringify({
      id: 'test-instructor-001',
      name: 'Test Instructor',
      email: 'instructor@test.edu',
      role: 'instructor',
      createdAt: Date.now(),
    }));
  });
}

// Helper to set up student auth via localStorage
async function setupStudentAuth(page: Page) {
  await page.goto(`${BASE_URL}/`);
  await page.evaluate(() => {
    localStorage.setItem('sql-learning-user-profile', JSON.stringify({
      id: 'test-student-001',
      name: 'Test Student',
      email: 'student@test.edu',
      role: 'student',
      createdAt: Date.now(),
    }));
  });
}

// Helper to clear auth
async function clearAuth(page: Page) {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

test.describe('Instructor UX Audit - Automated', () => {
  test.beforeEach(async ({ page }) => {
    await clearAuth(page);
  });

  // ==========================================
  // FLOW 1: INSTRUCTOR DASHBOARD
  // ==========================================
  test.describe('Flow 1: Instructor Dashboard', () => {
    test('dashboard layout and structure', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/instructor-dashboard`);

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Screenshot for documentation
      await page.screenshot({
        path: `test-results/audit/instructor-dashboard-${Date.now()}.png`,
        fullPage: true
      });

      // Check page title
      const title = await page.title();
      expect(title).toContain('Adaptive');

      // Check for main heading
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
      const headingText = await heading.textContent();
      console.log('Dashboard heading:', headingText);

      // Document all visible sections
      const sections = await page.locator('section, [class*="card"], [class*="Card"]').all();
      console.log(`Found ${sections.length} sections/cards`);

      for (let i = 0; i < Math.min(sections.length, 10); i++) {
        const text = await sections[i].textContent().catch(() => '');
        console.log(`  Section ${i + 1}: ${text.substring(0, 100)}...`);
      }
    });

    test('dashboard stats visibility', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/instructor-dashboard`);
      await page.waitForLoadState('networkidle');

      // Look for common stat labels
      const statLabels = ['Total Students', 'Active', 'Progress', 'Interactions', 'Errors'];
      const pageText = await page.textContent('body');

      for (const label of statLabels) {
        if (pageText?.includes(label)) {
          console.log(`  Found stat label: "${label}"`);
        }
      }
    });

    test('dashboard interactive elements', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/instructor-dashboard`);
      await page.waitForLoadState('networkidle');

      // Find all buttons
      const buttons = await page.locator('button').all();
      console.log(`Found ${buttons.length} buttons:`);

      for (const button of buttons.slice(0, 10)) {
        const text = await button.textContent().catch(() => '');
        const isVisible = await button.isVisible().catch(() => false);
        const isEnabled = await button.isEnabled().catch(() => false);
        console.log(`  - "${text.trim()}": visible=${isVisible}, enabled=${isEnabled}`);
      }

      // Find all links
      const links = await page.locator('a').all();
      console.log(`Found ${links.length} links`);
    });

    test('dashboard console errors check', async ({ page }) => {
      const errors: string[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
          console.log(`[CONSOLE ERROR] ${msg.text()}`);
        }
      });

      page.on('pageerror', (error) => {
        errors.push(error.message);
        console.log(`[PAGE ERROR] ${error.message}`);
      });

      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/instructor-dashboard`);
      await page.waitForLoadState('networkidle');

      // Wait a bit for any async errors
      await page.waitForTimeout(1000);

      // Filter out expected CORS errors (backend not running)
      const criticalErrors = errors.filter(e =>
        !e.includes('CORS') &&
        !e.includes('api/auth/me') &&
        !e.includes('vercel-scripts')
      );

      if (criticalErrors.length > 0) {
        console.log('Critical errors found:', criticalErrors);
      }

      expect(criticalErrors).toHaveLength(0);
    });
  });

  // ==========================================
  // FLOW 2: PREVIEW MODE
  // ==========================================
  test.describe('Flow 2: Preview Mode', () => {
    test('preview mode activation', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/instructor-dashboard`);
      await page.waitForLoadState('networkidle');

      // Look for preview-related elements
      const pageText = await page.textContent('body');
      const hasPreview = pageText?.toLowerCase().includes('preview');
      console.log('Preview mode mentioned:', hasPreview);

      // Look for launch preview button
      const previewButton = page.locator('button:has-text("Preview"), [data-testid*="preview"]').first();
      const isVisible = await previewButton.isVisible().catch(() => false);

      if (isVisible) {
        console.log('Found preview button');
        await previewButton.click();
        await page.waitForTimeout(500);

        // Screenshot the modal/dialog
        await page.screenshot({
          path: `test-results/audit/preview-modal-${Date.now()}.png`,
          fullPage: true
        });
      }
    });

    test('preview mode indicator', async ({ page }) => {
      // Set preview mode flag
      await setupInstructorAuth(page);
      await page.evaluate(() => {
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      // Navigate to practice page
      await page.goto(`${BASE_URL}/practice`);
      await page.waitForLoadState('networkidle');

      // Screenshot
      await page.screenshot({
        path: `test-results/audit/preview-mode-active-${Date.now()}.png`,
        fullPage: true
      });

      // Look for preview indicator
      const pageText = await page.textContent('body');
      const hasPreviewIndicator = pageText?.toLowerCase().includes('preview');
      console.log('Preview indicator visible:', hasPreviewIndicator);
    });

    test('exit preview mode', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.evaluate(() => {
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      await page.goto(`${BASE_URL}/practice`);
      await page.waitForLoadState('networkidle');

      // Look for exit button
      const exitButton = page.locator('button:has-text("Exit"), button:has-text("Close"), [data-testid*="exit"]').first();
      const hasExit = await exitButton.isVisible().catch(() => false);

      if (hasExit) {
        console.log('Found exit preview button');
        await exitButton.click();
        await page.waitForTimeout(500);

        // Check if redirected
        const url = page.url();
        console.log('After exit, URL:', url);
      }

      // Verify preview mode cleared
      const previewMode = await page.evaluate(() => {
        return localStorage.getItem('sql-adapt-preview-mode');
      });
      console.log('Preview mode after exit:', previewMode);
    });
  });

  // ==========================================
  // FLOW 3: SETTINGS PAGE
  // ==========================================
  test.describe('Flow 3: Settings Page', () => {
    test('instructor settings visibility', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      // Screenshot
      await page.screenshot({
        path: `test-results/audit/instructor-settings-${Date.now()}.png`,
        fullPage: true
      });

      // Document all settings sections
      const headings = await page.locator('h2, h3, [class*="title"]').all();
      console.log('Settings sections:');
      for (const heading of headings.slice(0, 15)) {
        const text = await heading.textContent().catch(() => '');
        if (text.trim()) {
          console.log(`  - ${text.trim()}`);
        }
      }

      // Check for specific instructor-only features
      const pageText = await page.textContent('body');
      const features = ['PDF', 'Upload', 'Preview', 'Experimental', 'Debug', 'Week 5', 'Week 6'];
      console.log('Instructor features found:');
      for (const feature of features) {
        if (pageText?.includes(feature)) {
          console.log(`  - ${feature}`);
        }
      }
    });

    test('settings - identify debug controls', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      const pageText = await page.textContent('body');

      // Debug/DEV mode indicators
      const debugIndicators = [
        'DEV Mode',
        'Debug',
        'Testing Controls',
        'Week 5',
        'Week 6',
        'Profile Override',
        'Assignment Strategy',
        'HDI',
        'Bandit',
        'Force arm',
        'Clear HDI',
      ];

      console.log('Potential debug controls found:');
      for (const indicator of debugIndicators) {
        if (pageText?.includes(indicator)) {
          console.log(`  - "${indicator}"`);
        }
      }
    });

    test('settings - destructive actions check', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      // Look for potentially destructive buttons
      const dangerousTexts = ['Clear', 'Reset', 'Delete', 'Remove'];
      const buttons = await page.locator('button').all();

      console.log('Potentially destructive actions:');
      for (const button of buttons) {
        const text = await button.textContent().catch(() => '');
        for (const dangerous of dangerousTexts) {
          if (text.toLowerCase().includes(dangerous.toLowerCase())) {
            const variant = await button.getAttribute('data-variant').catch(() => 'default');
            console.log(`  - "${text.trim()}": variant=${variant}`);
          }
        }
      }
    });

    test('settings persistence', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      // Find and toggle a switch if available
      const switches = await page.locator('input[type="checkbox"], [role="switch"]').all();

      if (switches.length > 0) {
        const firstSwitch = switches[0];
        const initialState = await firstSwitch.isChecked().catch(() => false);
        console.log('Initial switch state:', initialState);

        // Toggle
        await firstSwitch.click();
        await page.waitForTimeout(200);

        const newState = await firstSwitch.isChecked().catch(() => false);
        console.log('After toggle:', newState);

        // Refresh
        await page.reload();
        await page.waitForLoadState('networkidle');

        const afterRefresh = await page.locator('input[type="checkbox"], [role="switch"]').first()
          .isChecked().catch(() => false);
        console.log('After refresh:', afterRefresh);
      }
    });

    test('student settings - limited visibility', async ({ page }) => {
      await setupStudentAuth(page);
      await page.goto(`${BASE_URL}/settings`);
      await page.waitForLoadState('networkidle');

      // Screenshot
      await page.screenshot({
        path: `test-results/audit/student-settings-${Date.now()}.png`,
        fullPage: true
      });

      const pageText = await page.textContent('body');

      // Check instructor-only features are NOT visible
      const instructorFeatures = ['PDF Upload', 'Experimental', 'Debug'];
      console.log('Checking instructor features hidden from students:');
      for (const feature of instructorFeatures) {
        const isVisible = pageText?.includes(feature);
        console.log(`  - "${feature}": ${isVisible ? 'VISIBLE (ISSUE!)' : 'Hidden (good)'}`);
      }
    });
  });

  // ==========================================
  // FLOW 4: RESEARCH PAGE
  // ==========================================
  test.describe('Flow 4: Research Page', () => {
    test('research page structure', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/research`);
      await page.waitForLoadState('networkidle');

      // Screenshot
      await page.screenshot({
        path: `test-results/audit/research-page-${Date.now()}.png`,
        fullPage: true
      });

      // Check heading
      const heading = page.locator('h1').first();
      await expect(heading).toBeVisible();
      const headingText = await heading.textContent();
      console.log('Research page heading:', headingText);

      // Document sections
      const sections = await page.locator('section, [class*="card"]').all();
      console.log(`Found ${sections.length} sections`);
    });

    test('research page data visualization', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/research`);
      await page.waitForLoadState('networkidle');

      // Look for chart/visualization elements
      const charts = await page.locator('[class*="chart"], [class*="graph"], svg, canvas').all();
      console.log(`Found ${charts.length} potential chart elements`);

      // Look for data tables
      const tables = await page.locator('table').all();
      console.log(`Found ${tables.length} tables`);

      for (let i = 0; i < Math.min(tables.length, 3); i++) {
        const headers = await tables[i].locator('th').allTextContents();
        console.log(`  Table ${i + 1} headers:`, headers);
      }
    });

    test('research page navigation', async ({ page }) => {
      await setupInstructorAuth(page);
      await page.goto(`${BASE_URL}/research`);
      await page.waitForLoadState('networkidle');

      // Look for back button
      const backButton = page.locator('button:has-text("Back"), a:has-text("Back")').first();
      const hasBack = await backButton.isVisible().catch(() => false);

      if (hasBack) {
        console.log('Found back button');
        await backButton.click();
        await page.waitForTimeout(500);

        const url = page.url();
        console.log('After back click, URL:', url);
      }
    });

    test('research page - student access denied', async ({ page }) => {
      await setupStudentAuth(page);
      await page.goto(`${BASE_URL}/research`);
      await page.waitForLoadState('networkidle');

      // Should be redirected
      const url = page.url();
      console.log('Student accessing research, URL:', url);

      expect(url).not.toContain('/research');
    });
  });

  // ==========================================
  // CROSS-CUTTING: PERMISSION BOUNDARIES
  // ==========================================
  test.describe('Cross-Cutting: Permission Boundaries', () => {
    test('student cannot access instructor routes', async ({ page }) => {
      await setupStudentAuth(page);

      const instructorRoutes = ['/instructor-dashboard', '/research'];

      for (const route of instructorRoutes) {
        await page.goto(`${BASE_URL}${route}`);
        await page.waitForLoadState('networkidle');

        const url = page.url();
        console.log(`Student accessing ${route}: redirected to ${url}`);

        expect(url).not.toContain(route);
      }
    });

    test('instructor without preview cannot access student routes', async ({ page }) => {
      await setupInstructorAuth(page);

      // Ensure preview mode is OFF
      await page.evaluate(() => {
        localStorage.removeItem('sql-adapt-preview-mode');
      });

      await page.goto(`${BASE_URL}/practice`);
      await page.waitForLoadState('networkidle');

      const url = page.url();
      console.log('Instructor without preview accessing /practice:', url);

      // Should redirect to instructor dashboard
      expect(url).toContain('instructor-dashboard');
    });

    test('instructor with preview can access student routes', async ({ page }) => {
      await setupInstructorAuth(page);

      // Enable preview mode
      await page.evaluate(() => {
        localStorage.setItem('sql-adapt-preview-mode', 'true');
      });

      await page.goto(`${BASE_URL}/practice`);
      await page.waitForLoadState('networkidle');

      const url = page.url();
      console.log('Instructor with preview accessing /practice:', url);

      // Should stay on practice page
      expect(url).toContain('/practice');
    });
  });
});
