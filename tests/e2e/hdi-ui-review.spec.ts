import { expect, test } from '@playwright/test';

/**
 * HDI UI Review Test Suite
 * 
 * Tests for visual design, responsive layout, accessibility, and
 * information architecture of the Hint Dependency Index display.
 */

// Helper to complete start page flow
async function completeStartPageFlow(page: any, name: string = 'TestUser') {
  await page.goto('/');
  await page.waitForSelector('[data-testid="start-page"]', { timeout: 5000 });
  await page.fill('input[name="userName"]', name);
  await page.click('text=Student');
  await page.click('button:has-text("Get Started")');
  await page.waitForURL('**/practice', { timeout: 5000 });
}

test.describe('@weekly HDI UI Review', () => {
  test.beforeEach(async ({ page }) => {
    // Set up auth for student role
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'test-user',
        name: 'Test User',
        role: 'student',
        createdAt: Date.now()
      }));
      // Hide welcome modal
      window.localStorage.setItem('sql-adapt-welcome-dismissed', 'true');
    });
    await page.goto('/practice');
    await page.waitForSelector('.bg-gradient-to-br.from-indigo-50', { timeout: 15000 });
  });

  test('HDI display visual inspection', async ({ page }) => {
    // Take screenshot of HDI panel
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    // Verify main elements exist
    await expect(hdiCard.locator('text=Hint Dependency Index')).toBeVisible();
    await expect(hdiCard.locator('text=Overall HDI')).toBeVisible();
    await expect(hdiCard.locator('text=Component Breakdown')).toBeVisible();
    
    // Check all 5 components are displayed
    await expect(hdiCard.locator('text=HPA')).toBeVisible();
    await expect(hdiCard.locator('text=AED')).toBeVisible();
    await expect(hdiCard.locator('text=ER')).toBeVisible();
    await expect(hdiCard.locator('text=REAE')).toBeVisible();
    await expect(hdiCard.locator('text=IWH')).toBeVisible();
    
    // Take screenshot for review
    await hdiCard.screenshot({ path: 'test-results/hdi-default-view.png' });
  });

  test('HDI responsive design - mobile', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForTimeout(2000);
    
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    // Check no overflow
    const box = await hdiCard.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/hdi-mobile-view.png', fullPage: true });
  });

  test('HDI responsive design - tablet', async ({ page }) => {
    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForTimeout(2000);
    
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/hdi-tablet-view.png', fullPage: true });
  });

  test('HDI responsive design - desktop', async ({ page }) => {
    // Desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.reload();
    await page.waitForTimeout(2000);
    
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/hdi-desktop-view.png', fullPage: true });
  });

  test('HDI accessibility - ARIA labels and roles', async ({ page }) => {
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    
    // Check for progress bar elements (should have proper ARIA)
    const progressBars = hdiCard.locator('[role="progressbar"]');
    const count = await progressBars.count();
    
    // Log findings for review
    console.log(`Found ${count} progressbar elements`);
    
    // Check color contrast for text elements
    const texts = hdiCard.locator('text=HDI');
    await expect(texts.first()).toBeVisible();
  });

  test('HDI interactive elements - tooltips', async ({ page }) => {
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    
    // Hover over HPA component
    const hpaRow = hdiCard.locator('text=HPA').first();
    await hpaRow.hover();
    
    // Wait for tooltip
    await page.waitForTimeout(500);
    
    // Tooltip content should appear
    const tooltip = page.locator('[role="tooltip"], .tooltip');
    await expect(tooltip).toBeVisible();
  });

  test('HDI level badge colors', async ({ page }) => {
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    
    // Check that level badge exists
    const badge = hdiCard.locator('[class*="bg-green-100"], [class*="bg-yellow-100"], [class*="bg-red-100"]').first();
    await expect(badge).toBeVisible();
  });

  test('HDI trend indicator display', async ({ page }) => {
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    
    // Check trend row exists
    const trendRow = hdiCard.locator('text=Trend').first();
    await expect(trendRow).toBeVisible();
    
    // Should show one of: Improving, Rising, Stable
    const trendText = await hdiCard.locator('.mt-3').textContent();
    expect(trendText).toMatch(/Improving|Rising|Stable/);
  });

  test('HDI component progress bars visual check', async ({ page }) => {
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    
    // Get all progress bar containers
    const progressBars = hdiCard.locator('.h-1\\.5.bg-indigo-100, .h-1\\.5.bg-indigo-200');
    const count = await progressBars.count();
    
    // Should have at least 5 progress bars (one per component + overall)
    expect(count).toBeGreaterThanOrEqual(5);
    
    // Check for filled progress bars
    const filledBars = hdiCard.locator('.bg-indigo-500, .bg-green-500');
    expect(await filledBars.count()).toBeGreaterThanOrEqual(1);
  });
});

test.describe('@weekly HDI Edge Cases', () => {
  test('HDI with zero interactions', async ({ page }) => {
    // Clear interactions
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'new-user',
        name: 'New User',
        role: 'student',
        createdAt: Date.now()
      }));
      window.localStorage.setItem('sql-adapt-welcome-dismissed', 'true');
      window.localStorage.removeItem('sql-learning-interactions');
    });
    
    await page.goto('/practice');
    await page.waitForTimeout(2000);
    
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    // Should show 0.0% for new user
    const hdiText = await hdiCard.textContent();
    expect(hdiText).toContain('0.0%');
    
    await hdiCard.screenshot({ path: 'test-results/hdi-zero-state.png' });
  });

  test('HDI with simulated interactions', async ({ page }) => {
    // Set up interactions that would create non-zero HDI
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'experienced-user',
        name: 'Experienced User',
        role: 'student',
        createdAt: Date.now()
      }));
      window.localStorage.setItem('sql-adapt-welcome-dismissed', 'true');
      
      // Create mock interactions
      const interactions = [
        {
          id: 'event-1',
          learnerId: 'experienced-user',
          timestamp: Date.now() - 10000,
          eventType: 'execution',
          problemId: 'problem-1',
          successful: true
        },
        {
          id: 'hint-1',
          learnerId: 'experienced-user',
          timestamp: Date.now() - 8000,
          eventType: 'hint_view',
          problemId: 'problem-1',
          hintLevel: 2
        },
        {
          id: 'error-1',
          learnerId: 'experienced-user',
          timestamp: Date.now() - 5000,
          eventType: 'error',
          problemId: 'problem-1'
        }
      ];
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    });
    
    await page.goto('/practice');
    await page.waitForTimeout(2000);
    
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    await hdiCard.screenshot({ path: 'test-results/hdi-with-data.png' });
  });
});

test.describe('@weekly HDI Student Session Simulation', () => {
  test('HDI updates during student session', async ({ page }) => {
    await completeStartPageFlow(page, 'SessionTestUser');
    
    // Initial state
    await page.waitForTimeout(2000);
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    const initialHDI = await hdiCard.locator('.text-lg.font-bold').textContent();
    console.log('Initial HDI:', initialHDI);
    
    // Type an incorrect query
    const editor = page.locator('.monaco-editor');
    await editor.click();
    await page.keyboard.press('Control+a');
    await page.keyboard.type('SELECT * FROM nonexistent');
    
    // Run query
    await page.click('[data-testid="run-query-btn"]');
    await page.waitForTimeout(1000);
    
    // Take screenshot after error
    await page.screenshot({ path: 'test-results/hdi-after-error.png' });
    
    // Check HDI updated
    const afterErrorHDI = await hdiCard.locator('.text-lg.font-bold').textContent();
    console.log('HDI after error:', afterErrorHDI);
  });
});
