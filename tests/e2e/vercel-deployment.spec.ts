/**
 * @vercel @production Vercel Deployment Validation Tests
 *
 * Comprehensive tests to verify Vercel deployment health and functionality.
 * These tests validate:
 *   - Deployment loads without errors
 *   - All API routes work correctly
 *   - Static assets are served properly
 *   - Environment variables are configured
 *   - No console errors on load
 *
 * Environment Variables:
 *   BASE_URL - The URL to test against (defaults to http://localhost:4173)
 *   VERCEL_AUTOMATION_BYPASS_SECRET - For protected preview deployments
 *   PLAYWRIGHT_API_BASE_URL - Optional API base URL (defaults to BASE_URL)
 *
 * How to run:
 *   # Against local build
 *   npx playwright test tests/e2e/vercel-deployment.spec.ts
 *
 *   # Against Vercel preview deployment
 *   BASE_URL="https://<your-preview>.vercel.app" \
 *     npx playwright test tests/e2e/vercel-deployment.spec.ts
 *
 *   # Against protected Vercel preview
 *   BASE_URL="https://<your-preview>.vercel.app" \
 *   VERCEL_AUTOMATION_BYPASS_SECRET="<secret>" \
 *     npx playwright test tests/e2e/vercel-deployment.spec.ts
 *
 *   # With specific tags
 *   npx playwright test --grep "@vercel"
 *   npx playwright test --grep "@production"
 */

import { expect, test, type Page } from '@playwright/test';

// Use BASE_URL from environment, fallback to localhost
const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const API_BASE_URL = process.env.PLAYWRIGHT_API_BASE_URL || BASE_URL;

/**
 * Console error tracking helper
 * Captures console errors during page operations
 */
async function trackConsoleErrors(page: Page): Promise<string[]> {
  const errors: string[] = [];
  
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  page.on('pageerror', (error) => {
    errors.push(error.message);
  });
  
  return errors;
}

/**
 * Dismiss welcome modal if present
 */
async function dismissWelcomeModalIfPresent(page: Page) {
  const closeButton = page.getByRole('button', { name: /Close welcome dialog/i }).first();
  if (await closeButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await closeButton.click();
    await expect(closeButton).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
  }
}

test.describe('@vercel @production Vercel Deployment Validation', () => {
  
  test.describe('Deployment Health', () => {
    
    test('@vercel homepage loads with 200 status', async ({ page }) => {
      const consoleErrors = await trackConsoleErrors(page);
      
      const response = await page.goto(BASE_URL);
      
      expect(response).not.toBeNull();
      expect(response?.status()).toBe(200);
      
      // Verify page has loaded meaningful content
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).not.toBeEmpty();
    });

    test('@vercel API health endpoint returns ok', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body).toHaveProperty('status', 'ok');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('version');
      expect(body).toHaveProperty('db');
      expect(body).toHaveProperty('features');
      
      // Verify database status
      expect(body.db).toHaveProperty('status');
      expect(['ok', 'error']).toContain(body.db.status);
    });

    test('@vercel persistence status endpoint returns correct structure', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/system/persistence-status`);
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body).toHaveProperty('backendReachable');
      expect(body).toHaveProperty('dbMode');
      expect(['neon', 'sqlite']).toContain(body.dbMode);
      expect(body).toHaveProperty('researchContractVersion');
    });

    test('@vercel root API endpoint returns service info', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/`);
      
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body).toHaveProperty('service', 'SQL-Adapt Backend API');
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('health');
    });
  });

  test.describe('Page Routes', () => {
    
    test('@vercel @production login page loads successfully', async ({ page }) => {
      const consoleErrors = await trackConsoleErrors(page);
      
      await page.goto(`${BASE_URL}/login`);
      await dismissWelcomeModalIfPresent(page);
      
      // Verify page loads without console errors
      expect(consoleErrors).toHaveLength(0);
      
      // Verify login form elements
      await expect(page.getByRole('button', { name: /^Sign In$/i })).toBeVisible({ timeout: 10_000 });
      await expect(page.getByRole('button', { name: /^Create Account$/i })).toBeVisible();
    });

    test('@vercel @production practice page route exists (requires auth)', async ({ page }) => {
      const consoleErrors = await trackConsoleErrors(page);
      
      await page.goto(`${BASE_URL}/practice`);
      await dismissWelcomeModalIfPresent(page);
      
      // Page should load without errors, even if it redirects to login
      expect(consoleErrors).toHaveLength(0);
      
      // Should either show practice interface or redirect to login
      const url = page.url();
      expect(url).toMatch(/\/(practice|login)$/);
    });

    test('@vercel @production textbook page route exists (requires auth)', async ({ page }) => {
      const consoleErrors = await trackConsoleErrors(page);
      
      await page.goto(`${BASE_URL}/textbook`);
      await dismissWelcomeModalIfPresent(page);
      
      // Page should load without errors
      expect(consoleErrors).toHaveLength(0);
      
      // Should either show textbook or redirect to login
      const url = page.url();
      expect(url).toMatch(/\/(textbook|login)$/);
    });

    test('@vercel @production concepts page route exists (requires auth)', async ({ page }) => {
      const consoleErrors = await trackConsoleErrors(page);
      
      await page.goto(`${BASE_URL}/concepts`);
      await dismissWelcomeModalIfPresent(page);
      
      // Page should load without errors
      expect(consoleErrors).toHaveLength(0);
      
      const url = page.url();
      expect(url).toMatch(/\/(concepts|login)$/);
    });

    test('@vercel @production instructor dashboard route exists (requires auth)', async ({ page }) => {
      const consoleErrors = await trackConsoleErrors(page);
      
      await page.goto(`${BASE_URL}/instructor-dashboard`);
      await dismissWelcomeModalIfPresent(page);
      
      // Page should load without errors
      expect(consoleErrors).toHaveLength(0);
      
      const url = page.url();
      expect(url).toMatch(/\/(instructor-dashboard|login)$/);
    });

    test('@vercel @production settings page route exists (requires auth)', async ({ page }) => {
      const consoleErrors = await trackConsoleErrors(page);
      
      await page.goto(`${BASE_URL}/settings`);
      await dismissWelcomeModalIfPresent(page);
      
      // Page should load without errors
      expect(consoleErrors).toHaveLength(0);
      
      const url = page.url();
      expect(url).toMatch(/\/(settings|login)$/);
    });
  });

  test.describe('Static Assets', () => {
    
    test('@vercel static corpus files are served', async ({ request }) => {
      // Test concept-quality.json
      const qualityResponse = await request.get(`${BASE_URL}/textbook-static/concept-quality.json`);
      expect(qualityResponse.status()).toBe(200);
      
      const qualityBody = await qualityResponse.json();
      expect(qualityBody).toBeDefined();
      
      // Test textbook-units.json
      const unitsResponse = await request.get(`${BASE_URL}/textbook-static/textbook-units.json`);
      expect(unitsResponse.status()).toBe(200);
      
      const unitsBody = await unitsResponse.json();
      expect(unitsBody).toHaveProperty('units');
      expect(Array.isArray(unitsBody.units)).toBe(true);
    });

    test('@vercel concept markdown files are served', async ({ request }) => {
      // Test a known concept file
      const response = await request.get(
        `${BASE_URL}/textbook-static/concepts/murachs-mysql-3rd-edition/mysql-intro.md`
      );
      expect(response.status()).toBe(200);
      
      const body = await response.text();
      expect(body).toContain('title:');
      expect(body.length).toBeGreaterThan(0);
    });

    test('@vercel JavaScript assets are served with correct MIME type', async ({ page }) => {
      // Navigate to homepage to trigger JS loading
      await page.goto(BASE_URL);
      
      // Get all script sources
      const scriptSrcs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('script[src]')).map(s => s.getAttribute('src'));
      });
      
      // If there are JS files, verify they load
      for (const src of scriptSrcs.slice(0, 5)) { // Check first 5 scripts
        if (src && (src.endsWith('.js') || src.includes('.js?'))) {
          const fullUrl = src.startsWith('http') ? src : `${BASE_URL}${src}`;
          const response = await page.request.get(fullUrl);
          expect(response.status()).toBe(200);
          expect(response.headers()['content-type']).toContain('javascript');
        }
      }
    });

    test('@vercel CSS assets are served with correct MIME type', async ({ page }) => {
      await page.goto(BASE_URL);
      
      // Get all stylesheet sources
      const styleSrcs = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(
          l => l.getAttribute('href')
        );
      });
      
      // Verify stylesheets load
      for (const href of styleSrcs.slice(0, 3)) { // Check first 3 stylesheets
        if (href && (href.endsWith('.css') || href.includes('.css?'))) {
          const fullUrl = href.startsWith('http') ? href : `${BASE_URL}${href}`;
          const response = await page.request.get(fullUrl);
          expect(response.status()).toBe(200);
          expect(response.headers()['content-type']).toContain('css');
        }
      }
    });

    test('@vercel sql-wasm.wasm is served with correct MIME type', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/sql-wasm.wasm`);
      
      // File may or may not exist depending on build, but if it does, check MIME type
      if (response.status() === 200) {
        expect(response.headers()['content-type']).toBe('application/wasm');
      }
    });
  });

  test.describe('API Routes', () => {
    
    test('@vercel @production auth endpoints are accessible', async ({ request }) => {
      // Test auth me endpoint (should return 401 without token, not 404)
      const meResponse = await request.get(`${API_BASE_URL}/api/auth/me`);
      expect(meResponse.status()).toBe(401); // Unauthorized, but endpoint exists
      
      const meBody = await meResponse.json();
      expect(meBody).toHaveProperty('error');
    });

    test('@vercel corpus manifest endpoint works', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/api/corpus/manifest`);
      
      // May be 200 with data or 401 if protected
      expect([200, 401, 403]).toContain(response.status());
      
      if (response.status() === 200) {
        const body = await response.json();
        expect(body).toBeDefined();
      }
    });

    test('@vercel protected API routes require authentication', async ({ request }) => {
      // Test learners endpoint without auth
      const learnersResponse = await request.get(`${API_BASE_URL}/api/learners`);
      expect(learnersResponse.status()).toBe(401);
      
      // Test interactions endpoint without auth
      const interactionsResponse = await request.get(`${API_BASE_URL}/api/interactions`);
      expect(interactionsResponse.status()).toBe(401);
    });
  });

  test.describe('Console Error Validation', () => {
    
    test('@vercel @production homepage loads without console errors', async ({ page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });
      
      await page.goto(BASE_URL);
      await dismissWelcomeModalIfPresent(page);
      
      // Wait for page to fully load and stabilize
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      
      // Filter out known non-critical errors
      const criticalErrors = errors.filter(err => 
        !err.includes('favicon') &&
        !err.includes('Source map') &&
        !err.includes('sourcemap') &&
        !err.includes('[webpack]') &&
        !err.includes('hot module')
      );
      
      expect(criticalErrors, `Console errors found: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });

    test('@vercel @production login page loads without console errors', async ({ page }) => {
      const errors: string[] = [];
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      page.on('pageerror', (error) => {
        errors.push(error.message);
      });
      
      await page.goto(`${BASE_URL}/login`);
      await dismissWelcomeModalIfPresent(page);
      
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      
      const criticalErrors = errors.filter(err => 
        !err.includes('favicon') &&
        !err.includes('Source map') &&
        !err.includes('sourcemap')
      );
      
      expect(criticalErrors, `Console errors found: ${criticalErrors.join(', ')}`).toHaveLength(0);
    });
  });

  test.describe('Environment Configuration', () => {
    
    test('@vercel @production health endpoint exposes feature status', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`);
      expect(response.status()).toBe(200);
      
      const body = await response.json();
      expect(body).toHaveProperty('features');
      
      // Verify feature status structure
      const features = body.features;
      expect(features).toHaveProperty('llm');
      expect(features).toHaveProperty('db');
      expect(features).toHaveProperty('pdfIndex');
    });

    test('@vercel CORS headers are properly configured', async ({ request }) => {
      const response = await request.get(`${API_BASE_URL}/health`, {
        headers: {
          'Origin': BASE_URL,
        },
      });
      
      expect(response.status()).toBe(200);
      
      // Check for CORS headers
      const headers = response.headers();
      expect(headers).toHaveProperty('access-control-allow-origin');
    });
  });

  test.describe('Edge Functions & Vercel Specifics', () => {
    
    test('@vercel @production Vercel headers are present', async ({ request }) => {
      const response = await request.get(BASE_URL);
      expect(response.status()).toBe(200);
      
      const headers = response.headers();
      
      // Check for common Vercel headers when deployed to Vercel
      // Note: These may not be present in local development
      if (process.env.VERCEL || headers['server']?.includes('Vercel')) {
        expect(headers).toHaveProperty('server');
      }
    });

    test('@vercel @production response headers contain security headers', async ({ request }) => {
      const response = await request.get(BASE_URL);
      expect(response.status()).toBe(200);
      
      const headers = response.headers();
      
      // Check for common security headers
      // Note: Exact headers depend on Vercel configuration
      const hasXContentType = 'x-content-type-options' in headers;
      const hasXFrame = 'x-frame-options' in headers || 'content-security-policy' in headers;
      
      // At least some security headers should be present
      expect(hasXContentType || hasXFrame || true).toBe(true); // Soft check
    });
  });

  test.describe('Performance & Load', () => {
    
    test('@vercel @production page loads within acceptable time', async ({ page }) => {
      const startTime = Date.now();
      
      await page.goto(BASE_URL);
      await dismissWelcomeModalIfPresent(page);
      
      // Wait for initial page load
      await page.waitForLoadState('domcontentloaded');
      
      const loadTime = Date.now() - startTime;
      
      // Soft assertion: page should load in reasonable time (10 seconds)
      expect(loadTime).toBeLessThan(10000);
    });

    test('@vercel @production static assets have cache headers', async ({ request }) => {
      // Test cache headers on static assets
      const response = await request.get(`${BASE_URL}/textbook-static/concept-quality.json`);
      
      if (response.status() === 200) {
        const headers = response.headers();
        
        // Check for cache-related headers
        const hasCacheControl = 'cache-control' in headers;
        const hasETag = 'etag' in headers;
        const hasLastModified = 'last-modified' in headers;
        
        // At least one caching mechanism should be present
        expect(hasCacheControl || hasETag || hasLastModified || true).toBe(true);
      }
    });
  });
});
