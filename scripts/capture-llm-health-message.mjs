import { chromium } from '@playwright/test';

const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173';
const timeoutMs = Number(process.env.LLM_HEALTH_WAIT_MS || 45000);

async function captureLlmHealthMessage() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
  await page.getByRole('link', { name: 'Research' }).click();
  await page.getByRole('heading', { name: 'Research Dashboard' }).first().waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Test LLM' }).click();

  await page.waitForFunction(
    () => {
      const messages = Array.from(document.querySelectorAll('p'))
        .map((node) => node.textContent?.trim() || '')
        .filter(Boolean);
      return messages.some((message) => (
        message.startsWith('Connected.') ||
        message.startsWith('Connected and model') ||
        message.startsWith('Connected, but model') ||
        message.startsWith('Could not reach local Ollama') ||
        message.startsWith('LLM health check failed unexpectedly')
      ));
    },
    undefined,
    { timeout: timeoutMs }
  );

  const result = await page.evaluate(() => {
    const lines = Array.from(document.querySelectorAll('p'))
      .map((node) => node.textContent?.trim() || '')
      .filter(Boolean);

    const message = lines.find((line) => (
      line.startsWith('Connected.') ||
      line.startsWith('Connected and model') ||
      line.startsWith('Connected, but model') ||
      line.startsWith('Could not reach local Ollama') ||
      line.startsWith('LLM health check failed unexpectedly')
    )) || '';

    const modelLine = lines.find((line) => line.startsWith('Target model:')) || '';
    return { message, modelLine };
  });

  await browser.close();
  return result;
}

captureLlmHealthMessage()
  .then(({ message, modelLine }) => {
    console.log(JSON.stringify({
      baseUrl,
      modelLine,
      message
    }, null, 2));
  })
  .catch((error) => {
    console.error(`capture-llm-health-message failed: ${error.message}`);
    process.exitCode = 1;
  });
