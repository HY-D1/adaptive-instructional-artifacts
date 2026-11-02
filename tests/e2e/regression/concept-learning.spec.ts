import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify({ id: 'concept-learning-e2e', name: 'Concept learner', role: 'student', createdAt: Date.now() }));
    localStorage.setItem('sql-learning-profiles', JSON.stringify([{ id: 'concept-learning-e2e', name: 'Concept learner', conceptsCovered: [], conceptCoverageEvidence: [], errorHistory: [], interactionCount: 0, version: 1, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } }]));
  });
});

for (const width of [1280, 375]) {
  test(`@no-external concept learning journey at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/concepts');
    await expect(page.getByRole('heading', { name: 'SQL Textbook' })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Search Concepts' }).fill('select-basic');
    await expect(page.getByRole('status')).toContainText('1 of 70 concepts');
    await page.getByRole('link').filter({ hasText: 'SELECT Statement Basics' }).click();
    await expect(page.getByRole('heading', { name: 'Learning objectives' })).toBeVisible();
    const before = await page.evaluate(() => localStorage.getItem('sql-learning-profiles'));
    await page.getByRole('tab', { name: 'Learn', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: 'Examples', exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Run example', exact: true }).first().click();
    await expect(page.getByRole('table').first()).toBeVisible();
    const editor = page.getByRole('textbox', { name: /Editable SQL/ }).first();
    const initialSql = await editor.inputValue();
    await editor.fill('SELEC invalid');
    await page.getByRole('button', { name: 'Run example', exact: true }).first().click();
    await expect(page.getByRole('alert').first()).toBeVisible();
    await page.getByRole('button', { name: 'Reset example', exact: true }).first().click();
    await expect(editor).toHaveValue(initialSql);
    await page.getByRole('tab', { name: 'Check Understanding' }).click();
    await expect(page.getByRole('status')).toHaveCount(0);
    await page.getByRole('radio').first().check();
    await page.getByRole('button', { name: 'Check answer' }).first().click();
    await expect(page.getByRole('status').first()).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('sql-learning-profiles'))).toBe(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const practice = page.getByRole('link', { name: 'Start Practicing' });
    await expect(practice).toHaveAttribute('href', /problemId=problem-/);
    await practice.click();
    await expect(page).toHaveURL(/\/practice\?problemId=problem-/);
  });
}

test('@no-external concept without practice has checks without misleading practice action', async ({ page }) => {
  await page.goto('/concepts/murachs-mysql-3rd-edition/stored-procedures');
  await expect(page.getByRole('heading', { name: 'Stored Procedures', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Start Practicing' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Check Understanding' }).click();
  await expect(page.getByRole('button', { name: 'Check answer' })).toHaveCount(2);
});

test('@no-external library fetch failure offers a working retry', async ({ page }) => {
  const catalogUrl = '**/textbook-static/concept-map.json';
  await page.route(catalogUrl, route => route.abort('failed'));
  await page.goto('/concepts');
  await expect(page.getByText('Failed to load concepts. Please try again.', { exact: true })).toBeVisible();
  await page.unroute(catalogUrl);
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SQL Textbook', exact: true })).toBeVisible();
  await expect(page.getByRole('status')).toContainText('70 of 70 concepts');
});

test('@no-external unknown concept provides a return to the library', async ({ page }) => {
  await page.goto('/concepts/no-such-learning-concept');
  await expect(page.getByRole('heading', { name: 'Concept Not Found', exact: true })).toBeVisible();
  await page.getByRole('link', { name: '← Back to Textbook', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SQL Textbook', exact: true })).toBeVisible();
});

test('@no-external delayed previous lesson cannot replace a newly selected lesson', async ({ page }) => {
  let releaseOld!: () => void;
  const held = new Promise<void>(resolve => { releaseOld = resolve; });
  let markRequested!: () => void;
  const requested = new Promise<void>(resolve => { markRequested = resolve; });
  await page.route('**/textbook-static/concepts/dbms-ramakrishnan-3rd-edition/select-basic.md', async route => {
    const response = await route.fetch();
    markRequested();
    await held;
    await route.fulfill({ response });
  });
  await page.goto('/concepts/dbms-ramakrishnan-3rd-edition/select-basic');
  await requested;
  await expect(page.getByText('Loading concept...', { exact: true })).toBeVisible();
  // Browser-history navigation keeps the same wildcard route component mounted.
  await page.evaluate(() => {
    history.pushState({}, '', '/concepts/murachs-mysql-3rd-edition/stored-procedures');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  await expect(page.getByRole('heading', { name: 'Stored Procedures', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Check Understanding' }).click();
  const received = page.waitForResponse(response => response.url().endsWith('/select-basic.md'));
  releaseOld();
  await received;
  // Allow fetch continuations and React rendering to finish before checking state.
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await expect(page.getByRole('heading', { name: 'Stored Procedures', exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Check Understanding' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('heading', { name: 'SELECT Statement Basics', exact: true })).toHaveCount(0);
});
