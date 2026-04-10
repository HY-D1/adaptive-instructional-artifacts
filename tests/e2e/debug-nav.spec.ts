import { test, expect } from '@playwright/test';

test('debug navigation', async ({ page }) => {
  // Setup auth like the failing tests do
  await page.addInitScript((id: string) => {
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id,
      name: 'Debug Test',
      role: 'student',
      createdAt: Date.now()
    }));
    window.localStorage.setItem('sql-learning-profiles', JSON.stringify([{
      id,
      name: 'Debug Test',
      conceptsCovered: [],
      conceptCoverageEvidence: [],
      errorHistory: [],
      interactionCount: 0,
      version: 1,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 3, aggregationDelay: 300000 }
    }]));
  }, 'debug-learner');
  
  await page.goto('/practice');
  await page.waitForLoadState('networkidle');
  
  // Take a screenshot to see what's on the page
  await page.screenshot({ path: 'test-results/debug-page.png', fullPage: true });
  
  // Check if monaco editor exists
  const hasMonaco = await page.locator('.monaco-editor').count() > 0;
  console.log('Has Monaco editor:', hasMonaco);
  
  // Check current URL
  console.log('Current URL:', page.url());
  
  // Check localStorage
  const ls = await page.evaluate(() => {
    const items: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) items[key] = localStorage.getItem(key) || '';
    }
    return items;
  });
  console.log('localStorage keys:', Object.keys(ls));
});
