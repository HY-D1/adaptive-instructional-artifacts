import { expect, Locator, Page, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount} errors\\b`));

  for (let i = 0; i < 12; i += 1) {
    await runQueryButton.click();
    if (await marker.first().isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(350);
  }

  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

test('week2 demo artifacts: export active-session json and screenshots', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-learning-policy-replay-mode', 'true');
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();

  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await runUntilErrorCount(page, runQueryButton, 1);

  await page.getByRole('button', { name: 'Request Hint' }).click();
  await expect(page.getByText('Hint 1', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByText('Hint 2', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByText('Hint 3', { exact: true })).toBeVisible();
  await expect.poll(async () => (
    page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      return interactions.filter((interaction: any) => interaction.eventType === 'explanation_view').length;
    })
  )).toBeGreaterThan(0);

  const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
  await expect(addToNotesButton).toBeVisible();
  await addToNotesButton.click();
  await expect(page.getByText(/Added to My Notes|Updated existing My Notes entry/)).toBeVisible();

  const outputDir = path.join(process.cwd(), 'dist', 'week2-demo');
  await mkdir(outputDir, { recursive: true });
  await page.getByTestId('hint-panel').screenshot({
    path: path.join(outputDir, 'hint-panel.png')
  });

  await page.getByRole('link', { name: 'Research' }).click();
  await expect(page).toHaveURL(/\/research/);
  await expect(page.getByTestId('export-scope-label')).toContainText('active session (default)');
  await page.getByTestId('export-scope-label').screenshot({
    path: path.join(outputDir, 'research-export-scope.png')
  });

  const exportPayload = await page.evaluate(async () => {
    const { storage } = await import('/src/app/lib/storage.ts');
    return storage.exportData({ allHistory: false });
  });

  await writeFile(
    path.join(outputDir, 'export.json'),
    `${JSON.stringify(exportPayload, null, 2)}\n`,
    'utf8'
  );

  expect(exportPayload.exportScope).toBe('active-session');
  expect(typeof exportPayload.activeSessionId).toBe('string');
  expect(exportPayload.activeSessionId.length).toBeGreaterThan(0);

  const interactions = exportPayload.interactions as Array<Record<string, any>>;
  const hintViews = interactions.filter((interaction) => interaction.eventType === 'hint_view');
  const explanationViews = interactions.filter((interaction) => interaction.eventType === 'explanation_view');
  const maxHintLevel = Math.max(...hintViews.map((interaction) => Number(interaction.hintLevel) || 0));
  const hasHintId = hintViews.some((interaction) => Object.prototype.hasOwnProperty.call(interaction, 'hintId'));
  const allHaveSessionId = interactions.every(
    (interaction) => typeof interaction.sessionId === 'string' && interaction.sessionId.length > 0
  );
  const allHintViewsHaveSqlEngageFields = hintViews.every(
    (interaction) =>
      typeof interaction.sqlEngageSubtype === 'string' &&
      interaction.sqlEngageSubtype.length > 0 &&
      typeof interaction.sqlEngageRowId === 'string' &&
      interaction.sqlEngageRowId.length > 0 &&
      typeof interaction.policyVersion === 'string' &&
      interaction.policyVersion.length > 0
  );
  const allHintViewsHaveHelpRequestIndex = hintViews.every(
    (interaction) =>
      Number.isInteger(interaction.helpRequestIndex) &&
      Number(interaction.helpRequestIndex) >= 1 &&
      Number(interaction.helpRequestIndex) <= 3
  );
  const allEscalationsHaveHelpRequestIndexAndPolicy = explanationViews.every(
    (interaction) =>
      Number.isInteger(interaction.helpRequestIndex) &&
      Number(interaction.helpRequestIndex) >= 4 &&
      typeof interaction.policyVersion === 'string' &&
      interaction.policyVersion.length > 0
  );
  const hintHelpIndices = hintViews.map((interaction) => Number(interaction.helpRequestIndex));

  expect(maxHintLevel).toBe(3);
  expect(hasHintId).toBeFalsy();
  expect(allHaveSessionId).toBeTruthy();
  expect(allHintViewsHaveSqlEngageFields).toBeTruthy();
  expect(allHintViewsHaveHelpRequestIndex).toBeTruthy();
  expect(allEscalationsHaveHelpRequestIndexAndPolicy).toBeTruthy();
  expect(hintHelpIndices).toEqual([1, 2, 3]);
  expect(explanationViews.length).toBeGreaterThanOrEqual(1);
  expect(hintViews.length + explanationViews.length).toBeGreaterThanOrEqual(4);
  expect(interactions.every((interaction) => interaction.sessionId === exportPayload.activeSessionId)).toBeTruthy();
});
