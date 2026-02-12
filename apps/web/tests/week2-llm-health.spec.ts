import { expect, test } from '@playwright/test';

const MODEL_NAME = 'qwen2.5:1.5b-instruct';

test('@week2 research: Test LLM reports Ollama down then up', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  let mode: 'down' | 'up' = 'down';

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
      await route.abort();
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

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();
  await page.getByRole('link', { name: 'Research' }).click();
  await expect(page.getByRole('heading', { name: 'Research Dashboard' }).first()).toBeVisible();

  const testLlmButton = page.getByRole('button', { name: 'Test LLM' });
  await expect(testLlmButton).toBeVisible();

  await testLlmButton.click();
  await expect(page.getByText(/Could not reach local Ollama/i)).toBeVisible();

  mode = 'up';
  await testLlmButton.click();
  await expect(
    page.getByText(new RegExp(`Connected\\. Model '${MODEL_NAME}' is available and replied:`, 'i'))
  ).toBeVisible();
  await expect(page.getByText(/OLLAMA_OK/)).toBeVisible();
});
