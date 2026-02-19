import { expect, Page, test } from '@playwright/test';

/**
 * Test cases for CSV parsing edge cases with quoted commas and escaped quotes.
 * These patterns occur in SQL query datasets where queries contain commas within quoted strings.
 */
const CSV_EDGE_CASE_TESTS = [
  // Basic comma within quoted field
  { input: 'col1,"val,ue",col3', expected: ['col1', 'val,ue', 'col3'], desc: 'comma within quotes' },
  // Escaped quotes (doubled quotes) within field
  { input: 'col1,"val""ue",col3', expected: ['col1', 'val"ue', 'col3'], desc: 'escaped quotes' },
  // Multiple commas within quoted field
  { input: 'col1,"a,b,c,d",col3', expected: ['col1', 'a,b,c,d', 'col3'], desc: 'multiple commas in quotes' },
  // Empty quoted field
  { input: 'col1,"",col3', expected: ['col1', '', 'col3'], desc: 'empty quoted field' },
  // Quotes at start/end of field
  { input: '"col1","col2","col3"', expected: ['col1', 'col2', 'col3'], desc: 'all fields quoted' },
  // Mixed quoted and unquoted
  { input: 'unquoted,"quoted, with, commas",unquoted', expected: ['unquoted', 'quoted, with, commas', 'unquoted'], desc: 'mixed quoted/unquoted' },
  // SQL-like query with commas
  { input: 'SELECT * FROM t,"error, message",subtype', expected: ['SELECT * FROM t', 'error, message', 'subtype'], desc: 'SQL query pattern' },
  // Nested quotes scenario
  { input: 'id,"feedback: ""help, me""",outcome', expected: ['id', 'feedback: "help, me"', 'outcome'], desc: 'nested quotes with comma' },
  // Trailing comma edge case
  { input: 'col1,col2,', expected: ['col1', 'col2', ''], desc: 'trailing comma' },
  // Leading/trailing spaces in quoted field
  { input: 'col1,"  spaced value  ",col3', expected: ['col1', 'spaced value', 'col3'], desc: 'spaces in quoted field' }
];

/**
 * Unit test for CSV parsing logic - tests the parseCsvLine function behavior.
 * This mirrors the logic in sql-engage.ts:68-96
 */
test.describe('@parser CSV Parsing Edge Cases', () => {
  test('parses CSV lines with quoted commas correctly', () => {
    // Replicate the parseCsvLine function logic for testing
    function parseCsvLine(line: string): string[] {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];

        // Handle escaped quotes ("") within quoted fields
        if (ch === '"' && inQuotes && next === '"') {
          current += '"';
          i += 1; // Skip the next quote
          continue;
        }
        // Toggle quote state
        if (ch === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        // Only split on commas outside of quotes
        if (ch === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
          continue;
        }
        current += ch;
      }

      // Push the last value
      values.push(current.trim());
      
      // Remove surrounding quotes from each value if present
      return values.map(v => {
        if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
          return v.slice(1, -1).replace(/""/g, '"');
        }
        return v;
      });
    }

    // Run all edge case tests
    for (const testCase of CSV_EDGE_CASE_TESTS) {
      const result = parseCsvLine(testCase.input);
      expect(result, `Failed for: ${testCase.desc}`).toEqual(testCase.expected);
    }
  });

  test('handles SQL-Engage dataset query patterns with commas', () => {
    // Simulate realistic SQL-Engage CSV row with complex query
    // The query is wrapped in quotes to protect the comma within it
    const sqlEngageRow = '"SELECT DISTINCT Level_of_Access, COUNT(*) AS Access_Count FROM Access_Codes GROUP BY Level_of_Access HAVING COUNT(*) > 1;",construction,inefficient query,sadness,"Don\'t worry, I\'m here to help! Just remove DISTINCT because GROUP BY already ensures one row per Level_of_Access.",Learning to avoid unnecessary DISTINCT';
    
    function parseCsvLine(line: string): string[] {
      const values: string[] = [];
      let current = '';
      let inQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        const next = line[i + 1];

        if (ch === '"' && inQuotes && next === '"') {
          current += '"';
          i += 1;
          continue;
        }
        if (ch === '"') {
          inQuotes = !inQuotes;
          continue;
        }
        if (ch === ',' && !inQuotes) {
          values.push(current.trim());
          current = '';
          continue;
        }
        current += ch;
      }
      values.push(current.trim());
      return values.map(v => {
        if (v.length >= 2 && v.startsWith('"') && v.endsWith('"')) {
          return v.slice(1, -1).replace(/""/g, '"');
        }
        return v;
      });
    }

    const result = parseCsvLine(sqlEngageRow);
    // The parser returns 6 fields when the query is properly quoted
    expect(result.length).toBe(6);
    // Check key fields are present (first field should contain the full SELECT query)
    expect(result[0]).toContain('SELECT DISTINCT Level_of_Access, COUNT(*)');
    expect(result[1]).toBe('construction');
    expect(result[2]).toBe('inefficient query');
    expect(result[3]).toBe('sadness');
    // The feedback message with comma should be properly parsed
    expect(result[4]).toContain("Don't worry");
    expect(result[4]).toContain("GROUP BY already ensures");
    expect(result[5]).toBe('Learning to avoid unnecessary DISTINCT');
  });
});

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
    // Use expect.poll for reliable waiting instead of fixed timeout
    try {
      await expect.poll(async () => {
        return await marker.first().isVisible().catch(() => false);
      }, { timeout: 2000, intervals: [100] }).toBe(true);
      return;
    } catch {
      // Continue trying
    }
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
    // Set up student profile to bypass StartPage role selection
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
  });

  await page.goto('/practice');
  // Should be on practice page
  await expect(page).toHaveURL(/\/practice$/, { timeout: 15000 });
  await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 15000 });

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
  await expect(page.getByRole('heading', { name: 'SQL-Adapt Learning System' })).toBeVisible();

  console.log(
    `[parser-batch] total=${generations.length} parse_success=${parseSuccessCount} parse_failure=${parseFailureCount} parse_success_rate=${parseSuccessRate}%`
  );
});
