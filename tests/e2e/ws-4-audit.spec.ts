import { expect, test } from '@playwright/test';

const LEARNER_ID = 'ws-4-concept-audit';

// Test concepts covering different scenarios
const TEST_CONCEPTS = [
  { id: 'murachs-mysql-3rd-edition/mysql-intro', name: 'Introduction to MySQL', expectedQuality: 'fallback' },
  { id: 'dbms-ramakrishnan-3rd-edition/select-basic', name: 'SELECT Statement Basics', expectedQuality: 'fallback' },
  { id: 'murachs-mysql-3rd-edition/select-basic', name: 'SELECT Basic (Murach)', expectedQuality: 'good' },
  { id: 'murachs-mysql-3rd-edition/where-clause', name: 'WHERE Clause', expectedQuality: 'good' },
];

test.beforeEach(async ({ page }) => {
  await page.addInitScript((id: string) => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id,
      name: 'Concept Auditor',
      role: 'student',
      createdAt: Date.now()
    }));
  }, LEARNER_ID);
});

test.describe('WS-4: Concept Page Audit', () => {
  
  for (const concept of TEST_CONCEPTS) {
    test(`Concept: ${concept.name} - Learn Tab`, async ({ page }) => {
      await page.goto(`/concepts/${concept.id}`);
      
      // Wait for page load
      await expect(page.locator('h1')).toBeVisible({ timeout: 30000 });
      
      // Screenshot Learn tab
      await page.screenshot({ 
        path: `test-results/ws-4-${concept.id.replace(/\//g, '-')}-learn.png`, 
        fullPage: true 
      });
      
      // Verify Learn tab is active
      const learnTab = page.getByRole('button', { name: 'Learn' });
      await expect(learnTab).toBeVisible();
      
      // Check for definition box
      const definitionBox = page.locator('.bg-blue-50.border-l-4');
      await expect(definitionBox.first()).toBeVisible();
      
      // Verify difficulty badge
      const difficultyBadge = page.locator('[class*="rounded"][class*="text-xs"]').first();
      await expect(difficultyBadge).toBeVisible();
      
      // Verify estimated read time
      const readTime = page.locator('text=/\\d+ min read/i');
      await expect(readTime).toBeVisible();
    });
    
    test(`Concept: ${concept.name} - Examples Tab`, async ({ page }) => {
      await page.goto(`/concepts/${concept.id}`);
      await expect(page.locator('h1')).toBeVisible({ timeout: 30000 });
      
      // Click Examples tab
      await page.getByRole('button', { name: 'Examples' }).click();
      
      // Wait for tab content
      await page.waitForTimeout(500);
      
      // Screenshot Examples tab
      await page.screenshot({ 
        path: `test-results/ws-4-${concept.id.replace(/\//g, '-')}-examples.png`, 
        fullPage: true 
      });
      
      // Verify Examples tab content loads
      const examplesContent = page.locator('.divide-y, [data-testid="no-verified-examples"]');
      await expect(examplesContent).toBeVisible();
    });
    
    test(`Concept: ${concept.name} - Mistakes Tab`, async ({ page }) => {
      await page.goto(`/concepts/${concept.id}`);
      await expect(page.locator('h1')).toBeVisible({ timeout: 30000 });
      
      // Click Mistakes tab
      await page.getByRole('button', { name: 'Common Mistakes' }).click();
      
      // Wait for tab content
      await page.waitForTimeout(500);
      
      // Screenshot Mistakes tab
      await page.screenshot({ 
        path: `test-results/ws-4-${concept.id.replace(/\//g, '-')}-mistakes.png`, 
        fullPage: true 
      });
      
      // Verify Mistakes tab content loads
      const mistakesContent = page.locator('.divide-y, .p-12');
      await expect(mistakesContent.first()).toBeVisible();
    });
    
    test(`Concept: ${concept.name} - Back Navigation`, async ({ page }) => {
      await page.goto(`/concepts/${concept.id}`);
      await expect(page.locator('h1')).toBeVisible({ timeout: 30000 });
      
      // Click back button
      const backButton = page.locator('a[href="/concepts"]').first();
      await expect(backButton).toBeVisible();
      
      // Navigate back
      await backButton.click();
      
      // Should navigate to concepts list
      await expect(page).toHaveURL(/\/concepts/);
    });
  }
  
  test('Concept List Page - Loading and Display', async ({ page }) => {
    await page.goto('/concepts');
    
    // Wait for page load
    await expect(page.locator('h1')).toBeVisible({ timeout: 30000 });
    
    // Screenshot concept list
    await page.screenshot({ 
      path: 'test-results/ws-4-concept-list.png', 
      fullPage: true 
    });
    
    // Verify "My Textbook" heading
    await expect(page.getByText('My Textbook')).toBeVisible();
    
    // Verify concept cards are displayed
    const conceptCards = page.locator('a[href^="/concepts/"]');
    const count = await conceptCards.count();
    expect(count).toBeGreaterThan(0);
  });
  
  test('Navigation between concepts', async ({ page }) => {
    await page.goto('/concepts');
    await expect(page.locator('h1')).toBeVisible({ timeout: 30000 });
    
    // Click first concept
    const firstConcept = page.locator('a[href^="/concepts/"]').first();
    await firstConcept.click();
    
    // Should be on a concept detail page
    await expect(page).toHaveURL(/\/concepts\//);
    await expect(page.locator('h1')).toBeVisible();
    
    // Screenshot
    await page.screenshot({ 
      path: 'test-results/ws-4-navigation-result.png', 
      fullPage: true 
    });
  });
});
