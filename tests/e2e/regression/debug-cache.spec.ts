import { test } from '@playwright/test';

test('debug cache keys', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({ id: 'test-user', name: 'Test User', role: 'student', createdAt: Date.now() }));
    const now = Date.now();
    const cache = {
      'learner-1:select-basic:abc123': { cacheKey: 'learner-1:select-basic:abc123', learnerId: 'learner-1', templateId: 'test', inputHash: 'abc123', unit: { id: 'unit-1', content: 'Content for learner 1' }, createdAt: now },
      'learner-2:select-basic:abc123': { cacheKey: 'learner-2:select-basic:abc123', learnerId: 'learner-2', templateId: 'test', inputHash: 'abc123', unit: { id: 'unit-2', content: 'Content for learner 2' }, createdAt: now }
    };
    window.localStorage.setItem('sql-learning-llm-cache', JSON.stringify(cache));
  });
  await page.goto('/practice');
  await page.waitForTimeout(3000);
  const result = await page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-llm-cache');
    const cache = raw ? JSON.parse(raw) : {};
    return { keys: Object.keys(cache) };
  });
  console.log('CACHE KEYS:', JSON.stringify(result, null, 2));
});
