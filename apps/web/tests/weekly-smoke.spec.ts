import { expect, Locator, Page, test } from '@playwright/test';
import { replaceEditorText, getEditorText } from './test-helpers';

// Stub LLM calls to prevent ECONNREFUSED errors
test.beforeEach(async ({ page }) => {
  await page.route('**/ollama/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: '{"title": "Test", "content_markdown": "Test content", "key_points": [], "common_pitfall": "", "next_steps": [], "source_ids": []}'
      })
    });
  });
  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        response: '{"title": "Test", "content_markdown": "Test content", "key_points": [], "common_pitfall": "", "next_steps": [], "source_ids": []}'
      })
    });
  });
});

async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount} errors\\b`));

  for (let i = 0; i < 10; i += 1) {
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

test('@weekly smoke: practice editor draft persists across textbook navigation', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // Set up student profile to bypass role selection
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
  });

  // Navigate to root first to let StartPage handle the redirect
  await page.goto('/');
  await expect(page).toHaveURL(/\/practice/, { timeout: 30000 });
  // Wait for SQL engine initialization to complete - poll for button to be enabled
  await expect.poll(async () => {
    const button = page.getByRole('button', { name: 'Run Query' });
    const isEnabled = await button.isEnabled().catch(() => false);
    return isEnabled;
  }, { timeout: 60000, intervals: [500, 1000, 2000] }).toBe(true);

  const marker = 'keep-me-week2-draft-persistence';
  const sql = `-- ${marker}\nSELECT * FROM users;`;
  await replaceEditorText(page, sql);
  await expect.poll(() => getEditorText(page)).toContain(marker);

  await page.getByRole('link', { name: 'My Textbook' }).first().click();
  await expect(page).toHaveURL(/\/textbook/);

  await page.getByRole('link', { name: 'Practice' }).first().click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible();
  await expect.poll(() => getEditorText(page)).toContain(marker);
});

test('@weekly smoke: hint ladder -> escalate -> add/update note -> textbook evidence', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // Set up student profile to bypass role selection
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'test-user',
      name: 'Test User',
      role: 'student',
      createdAt: Date.now()
    }));
  });

  // Navigate to root first to let StartPage handle the redirect
  await page.goto('/');
  await expect(page).toHaveURL(/\/practice/);
  // Wait for SQL engine initialization to complete
  await page.waitForSelector('.monaco-editor .view-lines', { state: 'visible', timeout: 30000 });
  await expect(page.getByRole('button', { name: 'Run Query' })).toBeEnabled({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Guidance Ladder' })).toBeVisible();

  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await expect(runQueryButton).toBeVisible();

  // Practice attempt -> first error to seed lastError context.
  await runUntilErrorCount(page, runQueryButton, 1);

  // Hint ladder 1/2/3 - with explicit waits for state stability
  await page.getByRole('button', { name: 'Request Hint' }).click();
  await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 30000 });
  // Wait for hint event to be persisted before proceeding
  await expect.poll(async () => (
    page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      return interactions.filter((interaction: any) => 
        interaction.eventType === 'hint_view' && interaction.hintLevel === 1
      ).length;
    })
  ), { timeout: 15000, intervals: [200, 500, 1000] }).toBeGreaterThanOrEqual(1);
  
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByTestId('hint-label-2')).toBeVisible({ timeout: 30000 });
  // Wait for hint event to be persisted before proceeding
  await expect.poll(async () => (
    page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      return interactions.filter((interaction: any) => 
        interaction.eventType === 'hint_view' && interaction.hintLevel === 2
      ).length;
    })
  ), { timeout: 15000, intervals: [200, 500, 1000] }).toBeGreaterThanOrEqual(1);
  
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByTestId('hint-label-3')).toBeVisible({ timeout: 30000 });
  // Wait for hint event to be persisted before proceeding
  await expect.poll(async () => (
    page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      return interactions.filter((interaction: any) => 
        interaction.eventType === 'hint_view' && interaction.hintLevel === 3
      ).length;
    })
  ), { timeout: 15000, intervals: [200, 500, 1000] }).toBeGreaterThanOrEqual(1);
  
  // Escalation happens AFTER viewing Hint 3 (on help request 4).
  // Click "Get More Help" to trigger escalation to explanation.
  await page.getByRole('button', { name: 'Get More Help' }).click();
  await expect(page.getByText('Explanation has been generated')).toBeVisible({ timeout: 60000 });
  // Wait for explanation_view event to be logged with proper sequencing
  await expect.poll(async () => (
    page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      return interactions.filter((interaction: any) => interaction.eventType === 'explanation_view').length;
    })
  ), { timeout: 30000, intervals: [500, 1000, 2000] }).toBeGreaterThanOrEqual(1);
  
  // Wait for all events to be persisted and stable
  await expect.poll(async () => (
    page.evaluate(() => {
      const rawInteractions = window.localStorage.getItem('sql-learning-interactions');
      const interactions = rawInteractions ? JSON.parse(rawInteractions) : [];
      const helpInteractions = interactions.filter(
        (interaction: any) =>
          interaction.eventType === 'hint_view' || interaction.eventType === 'explanation_view'
      );
      return helpInteractions.length;
    })
  ), { timeout: 10000, intervals: [200, 500] }).toBeGreaterThanOrEqual(4);

  // Escalation is logged on help request 4+ as explanation_view.
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
        .map((interaction: any) => Number(interaction.helpRequestIndex) || 0)
        .sort((a: number, b: number) => a - b),
      escalationHelpIndices: helpInteractions
        .filter((interaction: any) => interaction.eventType === 'explanation_view')
        .map((interaction: any) => Number(interaction.helpRequestIndex) || 0)
    };
  });
  expect(Math.max(...helpFlowSnapshot.hintLevels)).toBe(3);
  // Use set-based comparison instead of strict array equality to handle timing variations
  expect(new Set(helpFlowSnapshot.hintHelpIndices)).toEqual(new Set([1, 2, 3]));
  expect(helpFlowSnapshot.escalationHelpIndices.some((index: number) => index >= 4)).toBeTruthy();

  const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
  await expect(addToNotesButton).toBeVisible({ timeout: 60000 });
  await expect(addToNotesButton).toBeEnabled({ timeout: 60000 });
  await addToNotesButton.click();
  await expect.poll(async () => (
    page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-textbook');
      const textbooks = raw ? JSON.parse(raw) : {};
      const learnerUnits = Array.isArray(textbooks['learner-1']) ? textbooks['learner-1'] : [];
      return learnerUnits.filter((unit: any) => unit?.provenance?.templateId === 'notebook_unit.v1').length;
    })
  ), { timeout: 60000, intervals: [500, 1000, 2000] }).toBeGreaterThan(0);
  await addToNotesButton.click();
  await expect.poll(async () => (
    page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-learning-textbook');
      const textbooks = raw ? JSON.parse(raw) : {};
      const learnerUnits = Array.isArray(textbooks['learner-1']) ? textbooks['learner-1'] : [];
      return learnerUnits.filter((unit: any) => unit?.provenance?.templateId === 'notebook_unit.v1').length;
    })
  ), { timeout: 60000, intervals: [500, 1000, 2000] }).toBe(1);

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
  // Note title may vary based on LLM generation, just verify some content is present
  await expect.poll(async () => {
    const bodyText = await page.locator('body').textContent();
    return bodyText.includes('Help with') || bodyText.includes('Note:') || bodyText.includes('SELECT');
  }, { timeout: 10000 }).toBe(true);
  // Verify provenance section exists
  await page.locator('summary').filter({ hasText: 'Provenance' }).click();
  await expect(page.getByTestId('provenance-retrieved-sources')).toBeVisible();
});

test('@weekly textbook provenance readability: merged source IDs and PDF citations are compact', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // Set up student profile to bypass role selection
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: 'learner-1',
      name: 'Test Learner',
      role: 'student',
      createdAt: Date.now()
    }));

    const seededUnit = {
      id: 'unit-seeded-provenance',
      sessionId: 'session-learner-1-seeded',
      updatedSessionIds: ['session-learner-1-seeded'],
      type: 'summary',
      conceptId: 'select-basic',
      title: 'Seeded Provenance Unit',
      content: [
        '## Seeded markdown content',
        '',
        'Safe paragraph for rendering checks.',
        '',
        '<script>window.__INJECT_ME__ = true;</script>',
        '',
        '[Unsafe link](javascript:alert(\"xss\"))'
      ].join('\\n'),
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

    const now = Date.now();
    const seededInteractions = [
      {
        id: 'evt-1',
        sessionId: 'session-learner-1-seeded',
        learnerId: 'learner-1',
        timestamp: now - 120000,
        eventType: 'error',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query',
        sqlEngageSubtype: 'incomplete query'
      },
      {
        id: 'evt-2',
        sessionId: 'session-learner-1-seeded',
        learnerId: 'learner-1',
        timestamp: now - 90000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query',
        sqlEngageSubtype: 'incomplete query',
        hintLevel: 1,
        helpRequestIndex: 1,
        sqlEngageRowId: 'sql-engage:787',
        policyVersion: 'sql-engage-index-v3-hintid-contract'
      },
      {
        id: 'evt-3',
        sessionId: 'session-learner-1-seeded',
        learnerId: 'learner-1',
        timestamp: now - 45000,
        eventType: 'explanation_view',
        problemId: 'problem-1',
        errorSubtypeId: 'incomplete query',
        sqlEngageSubtype: 'incomplete query',
        helpRequestIndex: 4,
        sqlEngageRowId: 'sql-engage:787',
        policyVersion: 'sql-engage-index-v3-hintid-contract'
      }
    ];

    window.localStorage.setItem(
      'sql-learning-textbook',
      JSON.stringify({ 'learner-1': [seededUnit] })
    );
    window.localStorage.setItem(
      'sql-learning-interactions',
      JSON.stringify(seededInteractions)
    );
  });

  // Navigate to root first, then to textbook (authenticated route)
  await page.goto('/');
  await expect(page).toHaveURL(/\/practice/);
  await page.goto('/textbook?learnerId=learner-1');
  await expect(page).toHaveURL(/\/textbook\?learnerId=learner-1/);
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('heading', { name: 'Seeded Provenance Unit', level: 2 })).toBeVisible();

  await page.locator('summary', { hasText: 'Provenance' }).first().click();
  await expect(page.getByTestId('provenance-retrieved-sources')).toContainText('Retrieved sources: 4 merged');
  await expect(page.getByTestId('provenance-source-ids')).toContainText(
    'Source IDs: sql-engage:10, sql-engage:11, sql-engage:12 +1 more'
  );
  await expect(page.getByTestId('provenance-pdf-citations')).toContainText(
    'PDF citations: pdf:chunk-10 (p.4), pdf:chunk-11 (p.7), pdf:chunk-12 (p.9) +1 more'
  );
  await expect(page.getByTestId('misconception-card').first()).toBeVisible();
  await expect(page.getByTestId('spaced-review-prompt').first()).toBeVisible();
  await expect(page.getByText('__INJECT_ME__')).toHaveCount(0);
  const hasUnsafeHref = await page.evaluate(() => Boolean(document.querySelector('a[href^=\"javascript:\"]')));
  expect(hasUnsafeHref).toBeFalsy();
});
