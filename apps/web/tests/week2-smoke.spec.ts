import { expect, Locator, Page, test } from '@playwright/test';

async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount} errors\\b`));

  for (let i = 0; i < 10; i += 1) {
    await runQueryButton.click();
    if (await marker.first().isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(400);
  }

  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

test('@week2 smoke: hint ladder -> escalate -> add/update note -> textbook evidence', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'SQL Learning Lab' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'HintWise' })).toBeVisible();

  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await expect(runQueryButton).toBeVisible();

  // Practice attempt -> first error to seed lastError context.
  await runUntilErrorCount(page, runQueryButton, 1);

  // Hint ladder 1/2/3.
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

  // Escalation is automatic after hint 3 and recorded as explanation_view.
  const helpFlowSnapshot = await page.evaluate(() => {
    const activeSessionId = window.localStorage.getItem('sql-learning-active-session');
    const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
    const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
    const helpInteractions = interactions.filter(
      (interaction: any) =>
        interaction.sessionId === activeSessionId &&
        (interaction.eventType === 'hint_view' || interaction.eventType === 'explanation_view')
    );
    return {
      hintLevels: helpInteractions
        .filter((interaction: any) => interaction.eventType === 'hint_view')
        .map((interaction: any) => Number(interaction.hintLevel) || 0),
      hintHelpIndices: helpInteractions
        .filter((interaction: any) => interaction.eventType === 'hint_view')
        .map((interaction: any) => Number(interaction.helpRequestIndex) || 0),
      escalationHelpIndices: helpInteractions
        .filter((interaction: any) => interaction.eventType === 'explanation_view')
        .map((interaction: any) => Number(interaction.helpRequestIndex) || 0)
    };
  });
  expect(Math.max(...helpFlowSnapshot.hintLevels)).toBe(3);
  expect(helpFlowSnapshot.hintHelpIndices).toEqual([1, 2, 3]);
  expect(helpFlowSnapshot.escalationHelpIndices.some((index: number) => index >= 4)).toBeTruthy();

  const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
  await expect(addToNotesButton).toBeVisible({ timeout: 30000 });
  await addToNotesButton.click();
  await expect(page.getByText(/Added to My Notes|Updated existing My Notes entry/)).toBeVisible({ timeout: 30000 });
  await addToNotesButton.click();
  await expect(page.getByText(/Updated existing My Notes entry/)).toBeVisible({ timeout: 30000 });

  const notebookUnitSnapshot = await page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-textbook');
    const textbooks = raw ? JSON.parse(raw) : {};
    const learnerUnits = Array.isArray(textbooks['learner-1']) ? textbooks['learner-1'] : [];
    const notebookUnits = learnerUnits.filter(
      (unit: any) => unit?.provenance?.templateId === 'notebook_unit.v1'
    );
    const mergedRetrieved = Array.from(
      new Set(
        notebookUnits.flatMap((unit: any) => unit?.provenance?.retrievedSourceIds || [])
      )
    );

    return {
      notebookUnitCount: notebookUnits.length,
      mergedRetrievedSourceCount: mergedRetrieved.length
    };
  });
  expect(notebookUnitSnapshot.notebookUnitCount).toBe(1);
  expect(notebookUnitSnapshot.mergedRetrievedSourceCount).toBeGreaterThan(0);

  // Verify note surfaced in textbook view.
  await page.getByRole('link', { name: 'My Textbook' }).first().click();
  await expect(page).toHaveURL(/\/textbook/);
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Help with Select All Users', level: 2 })).toBeVisible();
  await expect(page.getByText(/This content was generated from/)).toBeVisible();
  await page.locator('summary', { hasText: 'Provenance' }).first().click();
  await expect(page.getByText(/Retrieved sources:\s*\d+\s+merged/)).toBeVisible();
});

test('@week2 textbook provenance readability: merged source IDs and PDF citations are compact', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');

    const seededUnit = {
      id: 'unit-seeded-provenance',
      sessionId: 'session-learner-1-seeded',
      updatedSessionIds: ['session-learner-1-seeded'],
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Seeded Provenance Unit',
      content: 'Seeded content for provenance readability checks.',
      prerequisites: [],
      addedTimestamp: Date.now(),
      sourceInteractionIds: ['evt-1', 'evt-2'],
      lastErrorSubtypeId: 'incomplete query',
      provenance: {
        model: 'seeded-model',
        params: {
          temperature: 0,
          top_p: 1,
          stream: false,
          timeoutMs: 1000
        },
        templateId: 'notebook_unit.v1',
        inputHash: 'seeded-input-hash-1234567890',
        retrievedSourceIds: [
          'sql-engage:10',
          'sql-engage:11',
          'sql-engage:12',
          'sql-engage:11',
          'sql-engage:13'
        ],
        retrievedPdfCitations: [
          { chunkId: 'pdf:chunk-10', page: 4, score: 0.91 },
          { chunkId: 'pdf:chunk-11', page: 7, score: 0.88 },
          { chunkId: 'pdf:chunk-12', page: 9, score: 0.85 },
          { chunkId: 'pdf:chunk-11', page: 7, score: 0.95 },
          { chunkId: 'pdf:chunk-13', page: 12, score: 0.82 }
        ],
        createdAt: Date.now()
      }
    };

    window.localStorage.setItem(
      'sql-learning-textbook',
      JSON.stringify({ 'learner-1': [seededUnit] })
    );
  });

  await page.goto('/textbook?learnerId=learner-1');
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Seeded Provenance Unit', level: 2 })).toBeVisible();

  await page.locator('summary', { hasText: 'Provenance' }).first().click();
  await expect(page.getByTestId('provenance-retrieved-sources')).toContainText('Retrieved sources: 4 merged');
  await expect(page.getByTestId('provenance-source-ids')).toContainText(
    'Source IDs: sql-engage:10, sql-engage:11, sql-engage:12 +1 more'
  );
  await expect(page.getByTestId('provenance-pdf-citations')).toContainText(
    'PDF citations: pdf:chunk-10 (p.4), pdf:chunk-11 (p.7), pdf:chunk-12 (p.9) +1 more'
  );
});
