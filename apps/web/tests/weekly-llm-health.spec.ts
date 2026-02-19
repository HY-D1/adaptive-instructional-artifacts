import { expect, test } from '@playwright/test';

const MODEL_NAME = 'qwen2.5:1.5b-instruct';

test('@weekly research: Test LLM reports Ollama down then up', async ({ page }) => {
  // Pre-populate localStorage with minimal data so ResearchDashboard renders properly
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // Set up student profile to bypass StartPage role selection
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
    // Add minimal learner profile so dashboard has data to render
    window.localStorage.setItem('sql-learning-profiles', JSON.stringify([{
      id: 'test-learner',
      name: 'Test Learner',
      conceptsCovered: [],
      conceptCoverageEvidence: [],
      errorHistory: [],
      interactionCount: 0,
      currentStrategy: 'adaptive-medium',
      preferences: {
        escalationThreshold: 3,
        aggregationDelay: 300000
      }
    }]));
    window.localStorage.setItem('sql-learning-interactions', JSON.stringify([]));
    window.localStorage.setItem('sql-learning-textbook', JSON.stringify({}));
  });

  let mode: 'down' | 'up' = 'down';

  // Mock Ollama API to simulate down/up behavior
  await page.route('**/ollama/api/tags', async (route) => {
    if (mode === 'down') {
      await route.fulfill({
        status: 503,
        contentType: 'text/plain',
        body: 'service unavailable'
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        models: [{ name: MODEL_NAME }]
      })
    });
  });

  await page.route('**/ollama/api/generate', async (route) => {
    if (mode === 'down') {
      await route.abort('failed');
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: 'OLLAMA_OK'
      })
    });
  });

  // Start from home page and navigate to Research
  await page.goto('/', { timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible({ timeout: 10000 });

  // Navigate to Research page
  await page.getByRole('link', { name: 'Research' }).click();
  await expect(page).toHaveURL(/\/research/, { timeout: 10000 });
  
  // Wait for skeleton loading to finish
  await expect.poll(async () => {
    const skeleton = page.getByTestId('skeleton');
    return await skeleton.count();
  }, {
    message: 'Waiting for skeleton loader to disappear',
    timeout: 20000,
    intervals: [200, 500, 1000]
  }).toBe(0);

  // Wait for the Research Dashboard heading to be visible
  await expect(page.getByRole('heading', { name: 'Research Dashboard' }).first()).toBeVisible({ timeout: 10000 });

  // Find Test LLM button
  const testLlmButton = page.getByRole('button', { name: /Test LLM/i });
  await expect(testLlmButton).toBeVisible({ timeout: 10000 });
  await expect(testLlmButton).toBeEnabled({ timeout: 5000 });

  // First click - Ollama is down
  await testLlmButton.click();
  await expect(page.getByText(/Could not reach local Ollama/i)).toBeVisible({ timeout: 15000 });

  // Switch to up state and test again
  mode = 'up';
  await testLlmButton.click();
  
  // Wait for success message with model name
  await expect(
    page.getByText(new RegExp(`Connected\\. Model '${MODEL_NAME}' is available and replied:`, 'i')),
    { timeout: 15000 }
  ).toBeVisible();
  await expect(page.getByText(/OLLAMA_OK/)).toBeVisible({ timeout: 5000 });
});
