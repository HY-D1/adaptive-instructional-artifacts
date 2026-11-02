import { expect, test, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.clear(); sessionStorage.clear();
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify({ id: 'example-isolation', name: 'Example Tester', role: 'student', createdAt: Date.now() }));
    localStorage.setItem('sql-learning-profiles', JSON.stringify([{ id: 'example-isolation', name: 'Example Tester', conceptsCovered: [], conceptCoverageEvidence: [], errorHistory: [], interactionCount: 0, version: 1, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 300000 } }]));
    localStorage.setItem('sql-learning-practice-drafts', JSON.stringify({ preserved: 'SELECT keep_this_draft;' }));
  });
});
async function openExample(page: Page) {
  await page.goto('/concepts/dbms-ramakrishnan-3rd-edition/select-basic');
  await page.getByRole('tab', { name: 'Examples', exact: true }).click();
  const editor = page.getByRole('textbox', { name: /Editable SQL/ }).first();
  await expect(editor).toBeVisible();
  return { editor, section: editor.locator('..') };
}
async function savedState(page: Page) {
  return page.evaluate(() => ({ drafts: localStorage.getItem('sql-learning-practice-drafts'), profiles: localStorage.getItem('sql-learning-profiles') }));
}
test('@no-external examples cap results and leave practice drafts/mastery unchanged', async ({ page }) => {
  const { editor, section } = await openExample(page);
  const before = await savedState(page);
  await editor.fill('WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<150) SELECT x FROM n;');
  await section.getByRole('button', { name: 'Run example', exact: true }).click();
  await expect(section.getByRole('table').first().locator('tbody tr')).toHaveCount(100);
  expect(await savedState(page)).toEqual(before);
});
test('@no-external mutations are discarded before the next run', async ({ page }) => {
  const { editor, section } = await openExample(page);
  await editor.fill('CREATE TABLE lesson_ephemeral(n); INSERT INTO lesson_ephemeral VALUES(42); SELECT n FROM lesson_ephemeral;');
  await section.getByRole('button', { name: 'Run example', exact: true }).click();
  await expect(section.getByRole('cell', { name: '42', exact: true })).toBeVisible();
  await editor.fill('SELECT * FROM lesson_ephemeral;');
  await section.getByRole('button', { name: 'Run example', exact: true }).click();
  await expect(section.getByRole('alert')).toContainText('no such table: lesson_ephemeral');
});
test('@no-external slow queries can be cancelled and the next run still works', async ({ page }) => {
  const { editor, section } = await openExample(page);
  await editor.fill('WITH RECURSIVE n(x) AS (VALUES(1) UNION ALL SELECT x+1 FROM n WHERE x<1000000000) SELECT sum(x) FROM n;');
  await section.getByRole('button', { name: 'Run example', exact: true }).click();
  await expect(section.getByRole('button', { name: 'Cancel run' })).toBeVisible();
  await section.getByRole('button', { name: 'Cancel run' }).click();
  await expect(section.getByRole('alert')).toContainText('cancelled');
  await editor.fill('SELECT 7 AS answer;');
  await section.getByRole('button', { name: 'Run example', exact: true }).click();
  await expect(section.getByRole('cell', { name: '7', exact: true })).toBeVisible();
});
