import { expect, test, type Page } from '@playwright/test';

const learnerId = 'textbook-reader-regression';
test.beforeEach(async ({ page }) => {
  await page.addInitScript((id) => {
    localStorage.clear(); sessionStorage.clear();
    const now = Date.now();
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify({ id, name: 'Reader Test', role: 'student', createdAt: now }));
    localStorage.setItem('sql-learning-profiles', JSON.stringify([{ id, name: 'Reader Test', conceptsCovered: [], conceptCoverageEvidence: [], errorHistory: [], interactionCount: 0, version: 1, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } }]));
    localStorage.setItem('sql-learning-practice-drafts', JSON.stringify({ existing: 'SELECT preserve_draft;' }));
    const unit = (unitId: string, title: string, content: string, conceptId: string, problemId: string, status = 'primary') => ({ id: unitId, sessionId: 'reader-session', type: 'summary', conceptId, problemId, title, content, contentFormat: 'markdown', addedTimestamp: now, sourceInteractionIds: [], prerequisites: [], status });
    localStorage.setItem('sql-adapt-textbook', JSON.stringify({ [id]: [
      unit('reader-one', 'Shared title', 'Original first note. NeedleToken', 'select-basic', 'problem-1'),
      unit('reader-two', 'Shared title', 'Distinct second note.', 'select-basic', 'problem-2'),
      unit('reader-join', 'Join reminder', 'Match the keys carefully.', 'joins', 'problem-3'),
      unit('reader-archive', 'Archived reminder', 'Archived note remains available.', 'select-basic', 'problem-4', 'archived'),
    ] }));
  }, learnerId);
});
async function preservedState(page: Page) {
  return page.evaluate(() => ({
    ...Object.fromEntries(['sql-adapt-user-profile', 'sql-learning-practice-drafts', 'sql-adapt-textbook'].map(key => [key, localStorage.getItem(key)])),
    // Existing textbook_view telemetry may create zero-score evidence and increment
    // interaction counters. Reading must not award mastery or change covered concepts.
    mastery: JSON.parse(localStorage.getItem('sql-learning-profiles') || '[]').map((profile: { conceptsCovered: string[]; conceptCoverageEvidence: Array<[string, { score: number }]> }) => ({
      covered: profile.conceptsCovered,
      positiveScores: profile.conceptCoverageEvidence.filter(([, evidence]) => evidence.score > 0),
    })),
  }));
}

test('@no-external reader refreshes selected content under the same ID without losing selection', async ({ page }) => {
  await page.goto('/textbook?unitId=reader-two');
  await expect(page.getByText('Distinct second note.', { exact: true })).toBeVisible();
  await page.evaluate((id) => {
    const units = JSON.parse(localStorage.getItem('sql-adapt-textbook')!);
    const unit = units[id].find((candidate: { id: string }) => candidate.id === 'reader-two');
    unit.content = 'Updated second note.'; unit.updatedTimestamp = Date.now();
    localStorage.setItem('sql-adapt-textbook', JSON.stringify(units));
    window.dispatchEvent(new Event('focus'));
  }, learnerId);
  await expect(page.getByText('Updated second note.', { exact: true })).toBeVisible();
  await expect(page.getByText('Distinct second note.', { exact: true })).toHaveCount(0);
  await page.getByLabel('Sort saved notes').selectOption('oldest');
  await expect(page).toHaveURL(/unitId=reader-two/);
  await expect(page.getByText('Updated second note.', { exact: true })).toBeVisible();
});

for (const width of [1280, 375]) {
  test(`@no-external saved-note search and navigation preserve data at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 850 });
    await page.goto('/textbook?unitId=reader-one');
    await expect(page.getByText('Original first note. NeedleToken', { exact: true })).toBeVisible();
    const before = await preservedState(page);
    if (width === 375) await page.getByRole('button', { name: /Browse saved notes/ }).click();
    const search = page.getByLabel('Search saved notes');
    await search.fill('  needletoken  ');
    await expect(page.getByLabel('Shared title', { exact: true })).toHaveCount(1);
    await search.fill('problem-2');
    await expect(page.getByLabel('Shared title', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Original first note. NeedleToken', { exact: true })).toBeVisible();
    await page.getByLabel('Shared title', { exact: true }).click();
    await expect(page.getByText('Distinct second note.', { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/unitId=reader-two/);
    if (width === 375) {
      await expect(page.getByRole('heading', { name: 'Shared title', exact: true })).toBeFocused();
      await page.getByRole('button', { name: /Browse saved notes/ }).click();
    }
    await search.fill('zz-no-result');
    await expect(page.getByText('Distinct second note.', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Shared title', { exact: true })).toHaveCount(0);
    await search.fill('operations');
    await expect(page.getByLabel('Join reminder', { exact: true })).toBeVisible();
    await search.fill('');
    await expect(page.getByLabel('Archived reminder', { exact: true })).toHaveCount(0);
    expect(await preservedState(page)).toEqual(before);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  });
}

test('@no-external archived deep link opens while missing deep link does not substitute another note', async ({ page }) => {
  await page.goto('/textbook?unitId=reader-archive');
  await expect(page.getByText('Archived note remains available.', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/unitId=reader-archive/);
  await page.goto('/textbook?unitId=missing-reader-note');
  await expect(page.getByText(/requested saved note.*not available|note.*not found/i).first()).toBeVisible();
  await expect(page.getByText('Original first note. NeedleToken', { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/unitId=missing-reader-note/);
});
