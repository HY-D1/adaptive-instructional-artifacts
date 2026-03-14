import { expect, test } from '@playwright/test';

/**
 * HDI UI Visual Review Test Suite
 * 
 * Comprehensive visual testing of the Hint Dependency Index display.
 */

async function setupAndDismissModal(page: any) {
  // Set up auth
  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
  });
  
  await page.goto('/practice');
  await page.waitForTimeout(2000);
  
  // Dismiss welcome modal if present
  const modal = page.locator('text=Welcome to SQL-Adapt');
  if (await modal.isVisible().catch(() => false)) {
    await page.click('button:has-text("Continue")');
    await page.waitForTimeout(500);
  }
}

test.describe('@flaky @slow HDI Visual Review', () => {
  test('HDI panel - desktop view', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupAndDismissModal(page);
    
    // Wait for HDI panel
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    // Take full page screenshot
    await page.screenshot({ path: 'test-results/hdi-desktop-full.png', fullPage: true });
    
    // Take HDI panel screenshot
    await hdiCard.screenshot({ path: 'test-results/hdi-panel-desktop.png' });
  });

  test('HDI panel - mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await setupAndDismissModal(page);
    
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    await page.screenshot({ path: 'test-results/hdi-mobile-full.png', fullPage: true });
    await hdiCard.screenshot({ path: 'test-results/hdi-panel-mobile.png' });
  });

  test('HDI panel - tablet view', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await setupAndDismissModal(page);
    
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    await page.screenshot({ path: 'test-results/hdi-tablet-full.png', fullPage: true });
    await hdiCard.screenshot({ path: 'test-results/hdi-panel-tablet.png' });
  });

  test('HDI component tooltips', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await setupAndDismissModal(page);
    
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    
    // Hover over HPA component and take screenshot
    const hpaRow = hdiCard.locator('text=HPA').first();
    await hpaRow.hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/hdi-tooltip-hpa.png' });
    
    // Hover over IWH component (the positive one)
    await hdiCard.locator('text=IWH').first().hover();
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test-results/hdi-tooltip-iwh.png' });
  });

  test('HDI with interactions - visual state', async ({ page }) => {
    // Set up user with some interactions
    await page.addInitScript(() => {
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: 'experienced-user',
        name: 'Experienced User',
        role: 'student',
        createdAt: Date.now()
      }));
      
      // Create mock interactions for non-zero HDI
      const interactions = [
        {
          id: 'event-1',
          learnerId: 'experienced-user',
          timestamp: Date.now() - 100000,
          eventType: 'execution',
          problemId: 'problem-1',
          successful: true
        },
        {
          id: 'hint-1',
          learnerId: 'experienced-user',
          timestamp: Date.now() - 80000,
          eventType: 'hint_view',
          problemId: 'problem-1',
          hintLevel: 2
        },
        {
          id: 'hint-2',
          learnerId: 'experienced-user',
          timestamp: Date.now() - 70000,
          eventType: 'hint_view',
          problemId: 'problem-1',
          hintLevel: 3
        },
        {
          id: 'error-1',
          learnerId: 'experienced-user',
          timestamp: Date.now() - 50000,
          eventType: 'error',
          problemId: 'problem-1'
        },
        {
          id: 'explanation-1',
          learnerId: 'experienced-user',
          timestamp: Date.now() - 30000,
          eventType: 'explanation_view',
          problemId: 'problem-1'
        },
        {
          id: 'event-2',
          learnerId: 'experienced-user',
          timestamp: Date.now() - 10000,
          eventType: 'execution',
          problemId: 'problem-1',
          successful: true
        }
      ];
      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactions));
    });
    
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/practice');
    await page.waitForTimeout(2000);
    
    // Dismiss modal
    const modal = page.locator('text=Welcome to SQL-Adapt');
    if (await modal.isVisible().catch(() => false)) {
      await page.click('button:has-text("Continue")');
      await page.waitForTimeout(500);
    }
    
    const hdiCard = page.locator('.bg-gradient-to-br.from-indigo-50');
    await expect(hdiCard).toBeVisible();
    
    // Get HDI value
    const hdiValue = await hdiCard.locator('.text-lg.font-bold').textContent();
    console.log('HDI Value with interactions:', hdiValue);
    
    await hdiCard.screenshot({ path: 'test-results/hdi-panel-with-data.png' });
  });
});
