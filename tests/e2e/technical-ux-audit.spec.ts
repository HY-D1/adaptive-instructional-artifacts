/**
 * Technical UX Audit - Console Errors, Network Issues, Loading States, Performance
 *
 * This audit tests:
 * 1. Console errors (JS errors, warnings, notices)
 * 2. Network failures (4xx, 5xx, CORS issues)
 * 3. Loading states (skeletons, spinners, FOUC)
 * 4. Responsive/layout issues
 * 5. Performance metrics
 */

import { test, expect, type Page, type ConsoleMessage, type Request, type Response } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

// Test configuration - use baseURL from playwright config
const SCREENSHOTS_DIR = './test-results/ux-audit';

// Types for audit results
interface ConsoleEntry {
  type: 'error' | 'warning' | 'info' | 'log';
  message: string;
  location?: string;
  page: string;
}

interface NetworkEntry {
  url: string;
  method: string;
  status: number;
  statusText: string;
  duration: number;
  failed: boolean;
  page: string;
}

interface PageMetrics {
  page: string;
  loadTime: number;
  domContentLoaded: number;
  firstPaint?: number;
  firstContentfulPaint?: number;
}

// Global collectors
const consoleLogs: ConsoleEntry[] = [];
const networkLogs: NetworkEntry[] = [];
const pageMetrics: PageMetrics[] = [];

// Helper to setup console and network listeners
function setupPageMonitoring(page: Page, pageName: string) {
  // Console monitoring
  page.on('console', (msg: ConsoleMessage) => {
    const type = msg.type() as 'error' | 'warning' | 'info' | 'log';
    const entry: ConsoleEntry = {
      type: type === 'error' || type === 'warning' ? type : 'log',
      message: msg.text(),
      location: msg.location()?.url,
      page: pageName,
    };
    consoleLogs.push(entry);
  });

  page.on('pageerror', (error) => {
    consoleLogs.push({
      type: 'error',
      message: `Page Error: ${error.message}`,
      location: error.stack,
      page: pageName,
    });
  });

  // Network monitoring
  page.on('request', (request: Request) => {
    // Track request start time
    (request as any).__startTime = Date.now();
  });

  page.on('response', async (response: Response) => {
    const request = response.request();
    const startTime = (request as any).__startTime || Date.now();
    const duration = Date.now() - startTime;
    const status = response.status();

    const entry: NetworkEntry = {
      url: response.url(),
      method: request.method(),
      status,
      statusText: response.statusText(),
      duration,
      failed: status >= 400 || status === 0,
      page: pageName,
    };
    networkLogs.push(entry);
  });

  page.on('requestfailed', (request: Request) => {
    const entry: NetworkEntry = {
      url: request.url(),
      method: request.method(),
      status: 0,
      statusText: 'Failed',
      duration: 0,
      failed: true,
      page: pageName,
    };
    networkLogs.push(entry);
  });
}

// Helper to collect performance metrics
async function collectPerformanceMetrics(page: Page, pageName: string): Promise<PageMetrics> {
  const timing = await page.evaluate(() => {
    const perf = performance.timing;
    const paint = performance.getEntriesByType('paint');

    return {
      loadTime: perf.loadEventEnd - perf.navigationStart,
      domContentLoaded: perf.domContentLoadedEventEnd - perf.navigationStart,
      firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
      firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime,
    };
  });

  const metrics: PageMetrics = {
    page: pageName,
    ...timing,
  };
  pageMetrics.push(metrics);
  return metrics;
}

// Helper to seed student auth - using storage state instead of localStorage
async function seedStudentAuth(page: Page) {
  // Seed auth via page.evaluate after navigation instead of addInitScript
  // to avoid cross-origin localStorage access issues
  await page.evaluate(() => {
    const studentProfile = {
      id: 'audit-student-001',
      name: 'Audit Student',
      role: 'student',
      learningMode: 'guided',
      createdAt: Date.now(),
    };
    localStorage.setItem('user_profile', JSON.stringify(studentProfile));
    localStorage.setItem('aa_auth_profile', JSON.stringify(studentProfile));
  });
}

// Helper to seed instructor auth
async function seedInstructorAuth(page: Page) {
  await page.evaluate(() => {
    const instructorProfile = {
      id: 'audit-instructor-001',
      name: 'Audit Instructor',
      role: 'instructor',
      createdAt: Date.now(),
    };
    localStorage.setItem('user_profile', JSON.stringify(instructorProfile));
    localStorage.setItem('aa_auth_profile', JSON.stringify(instructorProfile));
  });
}

// Report generation helper
function generateAuditReport() {
  const errors = consoleLogs.filter(l => l.type === 'error');
  const warnings = consoleLogs.filter(l => l.type === 'warning');
  const failedRequests = networkLogs.filter(n => n.failed);
  const slowRequests = networkLogs.filter(n => n.duration > 2000 && !n.failed);

  const report = {
    summary: {
      totalConsoleErrors: errors.length,
      totalConsoleWarnings: warnings.length,
      totalFailedRequests: failedRequests.length,
      totalSlowRequests: slowRequests.length,
      pagesTested: [...new Set(consoleLogs.map(l => l.page))].length,
    },
    consoleErrors: errors,
    consoleWarnings: warnings,
    failedRequests: failedRequests,
    slowRequests: slowRequests,
    performance: pageMetrics,
  };

  return report;
}

// Print formatted report
function printReport(report: ReturnType<typeof generateAuditReport>) {
  console.log('\n' + '='.repeat(80));
  console.log('TECHNICAL UX AUDIT REPORT');
  console.log('='.repeat(80));

  console.log('\n📊 SUMMARY:');
  console.log(`  Console Errors: ${report.summary.totalConsoleErrors}`);
  console.log(`  Console Warnings: ${report.summary.totalConsoleWarnings}`);
  console.log(`  Failed Requests: ${report.summary.totalFailedRequests}`);
  console.log(`  Slow Requests (>2s): ${report.summary.totalSlowRequests}`);
  console.log(`  Pages Tested: ${report.summary.pagesTested}`);

  if (report.consoleErrors.length > 0) {
    console.log('\n❌ CONSOLE ERRORS:');
    report.consoleErrors.forEach((err, i) => {
      console.log(`  ${i + 1}. [${err.page}] ${err.message.slice(0, 100)}${err.message.length > 100 ? '...' : ''}`);
    });
  }

  if (report.consoleWarnings.length > 0) {
    console.log('\n⚠️  CONSOLE WARNINGS:');
    report.consoleWarnings.forEach((warn, i) => {
      console.log(`  ${i + 1}. [${warn.page}] ${warn.message.slice(0, 100)}${warn.message.length > 100 ? '...' : ''}`);
    });
  }

  if (report.failedRequests.length > 0) {
    console.log('\n🌐 FAILED REQUESTS:');
    report.failedRequests.forEach((req, i) => {
      console.log(`  ${i + 1}. [${req.page}] ${req.method} ${req.status} - ${req.url.slice(0, 80)}${req.url.length > 80 ? '...' : ''}`);
    });
  }

  if (report.slowRequests.length > 0) {
    console.log('\n🐌 SLOW REQUESTS (>2s):');
    report.slowRequests.forEach((req, i) => {
      console.log(`  ${i + 1}. [${req.page}] ${req.duration}ms - ${req.url.slice(0, 80)}${req.url.length > 80 ? '...' : ''}`);
    });
  }

  console.log('\n⏱️  PERFORMANCE METRICS:');
  report.performance.forEach((m) => {
    console.log(`  ${m.page}:`);
    console.log(`    Load Time: ${m.loadTime}ms`);
    console.log(`    DOM Content Loaded: ${m.domContentLoaded}ms`);
    if (m.firstContentfulPaint) {
      console.log(`    First Contentful Paint: ${Math.round(m.firstContentfulPaint)}ms`);
    }
  });

  console.log('\n' + '='.repeat(80));
}

// Tests
test.describe('Technical UX Audit', () => {
  test.afterAll(async () => {
    const report = generateAuditReport();
    printReport(report);

    // Write report to file
    const reportPath = path.join(process.cwd(), 'test-results', 'ux-audit-report.json');
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Full report written to: ${reportPath}`);
  });

  test.describe('Public Pages', () => {
    test('Start Page - /', async ({ page }) => {
      setupPageMonitoring(page, 'start-page');

      const startTime = Date.now();
      await page.goto('/');
      await page.waitForLoadState('networkidle');

      await collectPerformanceMetrics(page, 'start-page');

      // Check for loading states
      const hasLoader = await page.locator('[data-testid="loader"], .loading, .spinner').count() > 0;
      console.log(`  Start page has loader: ${hasLoader}`);

      // Take screenshot
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/start-page.png`, fullPage: true });
    });

    test('Auth Page - /login', async ({ page }) => {
      setupPageMonitoring(page, 'auth-page');

      await page.goto('/login');
      await page.waitForLoadState('networkidle');

      await collectPerformanceMetrics(page, 'auth-page');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/auth-page.png`, fullPage: true });
    });
  });

  test.describe('Student Pages', () => {
    test('Concept Library - /concepts', async ({ page }) => {
      setupPageMonitoring(page, 'concept-library');

      await page.goto('/concepts');
      await seedStudentAuth(page);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for content to load
      await page.waitForTimeout(2000);

      await collectPerformanceMetrics(page, 'concept-library');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/concept-library.png`, fullPage: true });

      // Check for skeleton screens
      const skeletons = await page.locator('[data-testid="skeleton"], .skeleton').count();
      console.log(`  Concept library skeletons found: ${skeletons}`);
    });

    test('Learning Interface - /practice', async ({ page }) => {
      setupPageMonitoring(page, 'learning-interface');

      await page.goto('/practice');
      await seedStudentAuth(page);
      await page.reload();
      await page.waitForLoadState('networkidle');

      // Wait for SQL editor to initialize
      await page.waitForTimeout(3000);

      await collectPerformanceMetrics(page, 'learning-interface');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/learning-interface.png`, fullPage: true });
    });

    test('Textbook Page - /textbook', async ({ page }) => {
      setupPageMonitoring(page, 'textbook');

      await page.goto('/textbook');
      await seedStudentAuth(page);
      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2000);

      await collectPerformanceMetrics(page, 'textbook');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/textbook.png`, fullPage: true });
    });
  });

  test.describe('Instructor Pages', () => {
    test('Instructor Dashboard - /instructor-dashboard', async ({ page }) => {
      setupPageMonitoring(page, 'instructor-dashboard');

      await page.goto('/instructor-dashboard');
      await seedInstructorAuth(page);
      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2000);

      await collectPerformanceMetrics(page, 'instructor-dashboard');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/instructor-dashboard.png`, fullPage: true });
    });

    test('Research Page - /research', async ({ page }) => {
      setupPageMonitoring(page, 'research-page');

      await page.goto('/research');
      await seedInstructorAuth(page);
      await page.reload();
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(2000);

      await collectPerformanceMetrics(page, 'research-page');
      await page.screenshot({ path: `${SCREENSHOTS_DIR}/research-page.png`, fullPage: true });
    });
  });

  test.describe('Responsive Testing', () => {
    test('Mobile viewport - Concept Library', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });

      setupPageMonitoring(page, 'concept-library-mobile');

      await page.goto('/concepts');
      await seedStudentAuth(page);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await page.screenshot({ path: `${SCREENSHOTS_DIR}/concept-library-mobile.png`, fullPage: true });

      // Check for horizontal overflow
      const hasOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > window.innerWidth;
      });
      console.log(`  Mobile horizontal overflow: ${hasOverflow}`);
    });

    test('Tablet viewport - Learning Interface', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });

      setupPageMonitoring(page, 'learning-interface-tablet');

      await page.goto('/practice');
      await seedStudentAuth(page);
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      await page.screenshot({ path: `${SCREENSHOTS_DIR}/learning-interface-tablet.png`, fullPage: true });
    });
  });

  test.describe('Error Boundary Testing', () => {
    test('Route Error Page', async ({ page }) => {
      setupPageMonitoring(page, 'error-page');

      // Navigate to a non-existent route
      await page.goto('/non-existent-page-12345');
      await page.waitForLoadState('networkidle');

      await page.waitForTimeout(1000);

      await page.screenshot({ path: `${SCREENSHOTS_DIR}/error-page.png`, fullPage: true });
    });
  });

  test.describe('Loading State Analysis', () => {
    test('Initial page load - no auth', async ({ page }) => {
      setupPageMonitoring(page, 'load-no-auth');

      // Clear any existing state
      await page.context().clearCookies();

      const navigationStart = Date.now();
      await page.goto('/');

      // Measure time to first meaningful paint
      await page.waitForSelector('body', { state: 'visible' });
      const bodyVisibleTime = Date.now() - navigationStart;

      await page.waitForLoadState('networkidle');
      const networkIdleTime = Date.now() - navigationStart;

      console.log(`  Body visible: ${bodyVisibleTime}ms`);
      console.log(`  Network idle: ${networkIdleTime}ms`);

      // Check for FOUC (Flash of Unstyled Content)
      const hasFouc = await page.evaluate(() => {
        const styles = document.querySelectorAll('style, link[rel="stylesheet"]');
        return styles.length === 0;
      });
      console.log(`  Potential FOUC: ${hasFouc}`);
    });
  });
});
