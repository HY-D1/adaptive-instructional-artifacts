/**
 * Playwright Configuration for Vercel Deployment Testing
 *
 * This configuration extends the base playwright.config.ts with settings
 * specifically optimized for testing against Vercel deployments.
 *
 * Usage:
 *   # Run against a Vercel preview deployment
 *   BASE_URL="https://<your-preview>.vercel.app" \
 *     npx playwright test -c playwright.vercel.config.ts
 *
 *   # Run with bypass secret for protected deployments
 *   BASE_URL="https://<your-preview>.vercel.app" \
 *   VERCEL_AUTOMATION_BYPASS_SECRET="<secret>" \
 *     npx playwright test -c playwright.vercel.config.ts
 *
 *   # Run only Vercel deployment tests
 *   npx playwright test -c playwright.vercel.config.ts --grep "@vercel"
 *
 *   # Run production validation tests
 *   npx playwright test -c playwright.vercel.config.ts --grep "@production"
 */

import { defineConfig, devices } from '@playwright/test';

// Base URL configuration - prioritize BASE_URL for flexibility
const BASE_URL = process.env.BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:4173';
const IS_VERCEL_DEPLOYMENT = BASE_URL.includes('vercel.app') || process.env.VERCEL === '1';

/**
 * Vercel Automation Bypass Secret
 * Required for accessing Vercel Preview deployments with deployment protection enabled.
 * 
 * Environment variables (in order of priority):
 *   - VERCEL_AUTOMATION_BYPASS_SECRET (standard Vercel naming)
 *   - E2E_VERCEL_BYPASS_SECRET (backward compatibility)
 * 
 * See: https://vercel.com/docs/security/deployment-protection/methods-to-bypass-deployment-protection
 */
const VERCEL_BYPASS_SECRET =
  process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? process.env.E2E_VERCEL_BYPASS_SECRET;

export default defineConfig({
  testDir: './tests/e2e',
  
  // Only run Vercel deployment tests by default
  testMatch: '**/vercel-deployment.spec.ts',
  
  // Extended timeout for deployment testing (network latency)
  timeout: 60_000,
  expect: {
    timeout: 15_000,
  },
  
  // Run tests sequentially for deployment validation (avoid overwhelming the server)
  fullyParallel: false,
  workers: 1,
  
  // Retries for flaky network conditions
  retries: IS_VERCEL_DEPLOYMENT ? 2 : 0,
  
  // Reporter configuration
  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/vercel-deployment-results.json' }],
  ],
  
  use: {
    // Use the configured BASE_URL
    baseURL: BASE_URL,
    
    // Always headless for CI/deployment testing
    headless: true,
    
    // Capture traces and screenshots on failure
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Viewport configuration
    viewport: { width: 1280, height: 720 },
    
    // Ignore HTTPS errors for preview deployments
    ignoreHTTPSErrors: true,
    
    // Action timeout
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    
    // Vercel bypass headers for protected preview deployments
    ...(VERCEL_BYPASS_SECRET
      ? {
          extraHTTPHeaders: {
            'x-vercel-protection-bypass': VERCEL_BYPASS_SECRET,
            'x-vercel-set-bypass-cookie': 'true',
          },
        }
      : {}),
    
    // Context options
    contextOptions: {
      // Reduced motion for consistent testing
      reducedMotion: 'reduce',
    },
  },
  
  // No local web server needed when testing against deployed URL
  ...(BASE_URL.includes('localhost') || BASE_URL.includes('127.0.0.1')
    ? {
        webServer: {
          command: 'npm run build && npx vite preview --config apps/web/vite.config.ts --port 4173 --outDir ../../dist/app',
          url: BASE_URL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
          stdout: 'pipe',
          stderr: 'pipe',
        },
      }
    : {}),
  
  projects: [
    {
      name: 'vercel-chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Chrome args for stable deployment testing
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        },
      },
    },
    
    // Mobile viewport testing for responsive deployment
    {
      name: 'vercel-mobile-chrome',
      use: {
        ...devices['Pixel 5'],
      },
    },
    
    // Safari testing for cross-browser validation
    {
      name: 'vercel-webkit',
      use: {
        ...devices['Desktop Safari'],
      },
    },
  ],
  
  // Output directories
  outputDir: 'test-results/vercel/',
});
