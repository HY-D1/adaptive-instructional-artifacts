import { expect, Page, test } from '@playwright/test';

const MOCK_RESPONSES = [
  '{"title":"T1","content_markdown":"Grounded explanation.","key_points":["k1"],"common_pitfall":"p1","next_steps":["n1"],"source_ids":["sql-engage:2"]}',
  '```json\n{"title":"T2","content_markdown":"Wrapped JSON.","key_points":["k2"],"common_pitfall":"p2","next_steps":["n2"],"source_ids":["sql-engage:3"]}\n```',
  '{"title":"T3","content_markdown":"Needs repair.","key_points":["k3"],"common_pitfall":"p3","next_steps":["n3"],"source_ids":["sql-engage:4",],}',
  '{"output":{"title":"T4","content_markdown":"Nested object.","key_points":["k4"],"common_pitfall":"p4","next_steps":["n4"],"source_ids":["sql-engage:5"]}}',
  '{"title":"bad-1","content_markdown":"Missing required arrays","key_points":["k"],"source_ids":["sql-engage:6"]}',
  'I cannot comply with JSON format.',
  '[{"title":"T7","content_markdown":"Array payload.","key_points":["k7"],"common_pitfall":"p7","next_steps":["n7"],"source_ids":["sql-engage:7"]}]',
  '{"title":"bad-2","content_markdown":"broken",'
];

type LoggedGeneration = {
  id: string;
  parseSuccess: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  parseAttempts: number;
  parseMode: string | null;
  parseFailureReason: string | null;
};

async function runUntilErrorCount(page: Page, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount} errors\\b`));
  const runQueryButton = page.getByRole('button', { name: 'Run Query' });

  for (let i = 0; i < 12; i += 1) {
    await runQueryButton.click();
    if (await marker.first().isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(300);
  }

  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

async function readGenerationEvents(page: Page): Promise<LoggedGeneration[]> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-interactions');
    const parsed = raw ? JSON.parse(raw) : [];
    return parsed
      .filter((event: any) => event.eventType === 'llm_generate')
      .map((event: any) => ({
        id: event.id,
        parseSuccess: Boolean(event.outputs?.parse_success),
        fallbackUsed: Boolean(event.outputs?.fallback_used),
        fallbackReason: typeof event.outputs?.fallback_reason === 'string' ? event.outputs.fallback_reason : null,
        parseAttempts: Number(event.outputs?.parse_attempts || 0),
        parseMode: typeof event.outputs?.parse_mode === 'string' ? event.outputs.parse_mode : null,
        parseFailureReason: typeof event.outputs?.parse_failure_reason === 'string' ? event.outputs.parse_failure_reason : null
      }));
  });
}

test('@parser-batch parser reliability: malformed output degrades safely with fallback telemetry', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });

  let responseIdx = 0;
  await page.route('**/ollama/api/generate', async (route) => {
    const text = MOCK_RESPONSES[responseIdx] || MOCK_RESPONSES[MOCK_RESPONSES.length - 1];
    responseIdx += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: text })
    });
  });

  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();

  await runUntilErrorCount(page, 3);
  const showExplanationButton = page.getByRole('button', { name: 'Show Explanation' });
  await expect(showExplanationButton).toBeVisible();

  for (let i = 0; i < MOCK_RESPONSES.length; i += 1) {
    await showExplanationButton.click();
    await expect.poll(async () => (await readGenerationEvents(page)).length).toBe(i + 1);
  }

  const generations = await readGenerationEvents(page);
  const parseSuccessCount = generations.filter((event) => event.parseSuccess).length;
  const parseFailureCount = generations.length - parseSuccessCount;
  const safeFallbackCount = generations.filter((event) => !event.parseSuccess && event.fallbackUsed && event.fallbackReason === 'parse_failure').length;
  const parseSuccessRate = Number(((parseSuccessCount / generations.length) * 100).toFixed(2));

  expect(generations.length).toBe(MOCK_RESPONSES.length);
  expect(parseFailureCount).toBe(2);
  expect(parseSuccessRate).toBeGreaterThan(62.5);
  expect(safeFallbackCount).toBe(parseFailureCount);
  expect(pageErrors).toEqual([]);
  await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();

  console.log(
    `[parser-batch] total=${generations.length} parse_success=${parseSuccessCount} parse_failure=${parseFailureCount} parse_success_rate=${parseSuccessRate}%`
  );
});
