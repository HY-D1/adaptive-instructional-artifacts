import { expect, Locator, Page, test } from '@playwright/test';

async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount}\\s+error(s)?\\b`));

  for (let i = 0; i < 24; i += 1) {
    await runQueryButton.click();
    if (await marker.first().isVisible().catch(() => false)) {
      return;
    }
    await page.waitForTimeout(500);
  }

  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

async function replaceEditorText(page: Page, text: string) {
  const editorSurface = page.locator('.monaco-editor .view-lines').first();
  await editorSurface.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(text);
}

test('@week2 pdf-rag ui: imported index contributes chunk/page provenance in generated note', async ({ page }) => {
  await page.addInitScript(() => {
    const resetKey = '__week2_pdf_rag_reset_done__';
    if (!window.sessionStorage.getItem(resetKey)) {
      window.localStorage.clear();
      window.sessionStorage.clear();
      window.sessionStorage.setItem(resetKey, 'true');
    }
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    // Explicitly ensure replay mode is OFF - this test needs real LLM generation
    window.localStorage.removeItem('sql-learning-policy-replay-mode');
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Research' }).click();
  await expect(page).toHaveURL(/\/research/);

  const pdfIndexPayload = {
    indexId: 'pdf-index-synthetic-v1',
    sourceName: 'synthetic-rag.pdf',
    createdAt: new Date().toISOString(),
    schemaVersion: 'pdf-index-schema-v1',
    chunkerVersion: 'word-window-180-overlap-30-v1',
    embeddingModelId: 'hash-embedding-v1',
    sourceDocs: [
      {
        docId: 'doc-synthetic',
        filename: 'synthetic-rag.pdf',
        sha256: 'synthetic-sha',
        pageCount: 12
      }
    ],
    docCount: 1,
    chunkCount: 2,
    chunks: [
      {
        chunkId: 'doc-synthetic:p7:c1',
        docId: 'doc-synthetic',
        page: 7,
        text: 'Select users query from users table with schema validation for missing columns.'
      },
      {
        chunkId: 'doc-synthetic:p12:c1',
        docId: 'doc-synthetic',
        page: 12,
        text: 'Incomplete query and undefined column errors are fixed by checking SELECT and FROM clauses.'
      }
    ]
  };

  let loadIndexCalls = 0;
  await page.route('**/api/pdf-index/load', async (route) => {
    loadIndexCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'loaded',
        document: pdfIndexPayload,
        message: 'Loaded synthetic test payload.'
      })
    });
  });
  await page.getByTestId('pdf-index-load-button').click();
  await expect(page.getByTestId('pdf-index-status')).toContainText('ready');
  await expect(page.getByTestId('pdf-index-summary')).toContainText('1 doc(s), 2 chunk(s)');
  expect(loadIndexCalls).toBe(1);

  await page.reload();
  await expect(page).toHaveURL(/\/research/);
  await expect(page.getByTestId('pdf-index-status')).toContainText('ready');
  await expect(page.getByTestId('pdf-index-summary')).toContainText('1 doc(s), 2 chunk(s)');
  expect(loadIndexCalls).toBe(1);

  await page.getByRole('link', { name: 'Practice' }).click();
  await expect(page).toHaveURL('/');

  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await expect(runQueryButton).toBeVisible();

  await replaceEditorText(page, 'SELECT FROM users;');
  await runUntilErrorCount(page, runQueryButton, 1);
  await page.getByRole('button', { name: 'Request Hint' }).click();
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await page.getByRole('button', { name: 'Get More Help' }).click();
  await runUntilErrorCount(page, runQueryButton, 2);

  const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
  await expect(addToNotesButton).toBeVisible();
  await addToNotesButton.click();
  await expect(page.getByText(/Added to My Notes|Updated existing My Notes entry/)).toBeVisible();

  await page.getByRole('link', { name: 'My Textbook' }).first().click();
  await expect(page).toHaveURL(/\/textbook/);
  await page.getByText('Provenance').click();

  await expect(page.getByText(/PDF citations:/)).toBeVisible();
  await expect(
    page.getByText(/doc-synthetic:p7:c1 \(p\.7\)|doc-synthetic:p12:c1 \(p\.12\)/)
  ).toBeVisible();
});
