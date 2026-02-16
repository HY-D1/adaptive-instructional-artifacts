import { expect, Locator, Page, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  // Clear all storage before each test for isolation
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
  });
});

async function runUntilErrorCount(page: Page, runQueryButton: Locator, expectedErrorCount: number, maxAttempts = 30) {
  const marker = page.getByText(new RegExp(`\\b${expectedErrorCount}\\s+error(s)?\\b`));

  for (let i = 0; i < maxAttempts; i += 1) {
    await runQueryButton.click();
    // Wait a bit for the UI to update
    await page.waitForTimeout(300);
    
    try {
      const isVisible = await marker.first().isVisible({ timeout: 2000 });
      if (isVisible) {
        return;
      }
    } catch {
      // Continue trying
    }
  }

  throw new Error(`Expected error count to reach ${expectedErrorCount}, but it did not.`);
}

async function replaceEditorText(page: Page, text: string) {
  const editorSurface = page.locator('.monaco-editor .view-lines').first();
  await editorSurface.click({ position: { x: 8, y: 8 } });
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+A' : 'Control+A');
  await page.keyboard.type(text);
}

test.describe('@week2 pdf-rag ui', () => {
  // Clean up after each test to prevent state pollution
  test.afterEach(async ({ page }) => {
    await page.evaluate(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });
  });

  test('imported index contributes chunk/page provenance in generated note', async ({ page }) => {
    // Use a session-based reset key to ensure localStorage is only cleared once
    // This allows the PDF index to persist across page reloads during the test
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

    // Navigate to Research page first
    await page.goto('/research', { timeout: 30000 });
    await expect(page).toHaveURL(/\/research/, { timeout: 10000 });

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

    // Load the PDF index
    await page.getByTestId('pdf-index-load-button').click();
    await expect(page.getByTestId('pdf-index-status')).toContainText('ready', { timeout: 10000 });
    await expect(page.getByTestId('pdf-index-summary')).toContainText('1 doc(s), 2 chunk(s)', { timeout: 5000 });
    expect(loadIndexCalls).toBe(1);

    // Reload to verify persistence - the PDF index should be loaded from localStorage
    await page.reload({ timeout: 30000 });
    await expect(page).toHaveURL(/\/research/, { timeout: 10000 });
    
    // After reload, wait for the page to fully load and check status
    // The PDF index should be loaded from localStorage
    await expect.poll(async () => {
      const status = await page.getByTestId('pdf-index-status').textContent().catch(() => '');
      return status.includes('ready') || status.includes('loaded') || status.includes('1 doc');
    }, {
      message: 'Waiting for PDF index to be ready after reload',
      timeout: 15000,
      intervals: [200, 500, 1000]
    }).toBe(true);
    
    // Verify summary shows correct count (flexible matching)
    await expect(page.getByTestId('pdf-index-summary')).toContainText(/1 doc|2 chunk/, { timeout: 5000 });
    // Note: loadIndexCalls stays 1 because the index is loaded from localStorage after reload

    // Navigate to Practice page
    await page.getByRole('link', { name: 'Practice' }).click();
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 });

    const runQueryButton = page.getByRole('button', { name: 'Run Query' });
    await expect(runQueryButton).toBeVisible({ timeout: 10000 });

    // Trigger first error
    await replaceEditorText(page, 'SELECT FROM users;');
    await runUntilErrorCount(page, runQueryButton, 1);

    // Navigate through hints
    const requestHintButton = page.getByRole('button', { name: 'Request Hint' });
    await expect(requestHintButton).toBeVisible({ timeout: 5000 });
    await requestHintButton.click();

    const nextHintButton = page.getByRole('button', { name: 'Next Hint' });
    await expect(nextHintButton).toBeVisible({ timeout: 5000 });
    await nextHintButton.click();
    await nextHintButton.click();

    // Get more help
    const getMoreHelpButton = page.getByRole('button', { name: 'Get More Help' });
    await expect(getMoreHelpButton).toBeVisible({ timeout: 5000 });
    await getMoreHelpButton.click();

    // Trigger second error
    await runUntilErrorCount(page, runQueryButton, 2);

    // Add to notes
    const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
    await expect(addToNotesButton).toBeVisible({ timeout: 15000 });
    await addToNotesButton.click();

    // Verify the note was added - LLM generation can take time
    await expect(page.getByText(/Added to My Notes|Updated existing My Notes entry/)).toBeVisible({ timeout: 30000 });

    // Navigate to My Textbook to verify provenance
    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10000 });

    // Click on Provenance section
    await page.getByText('Provenance').click();

    // Verify PDF citations are shown
    await expect(page.getByText(/PDF citations:/)).toBeVisible({ timeout: 10000 });
    await expect(
      page.getByText(/doc-synthetic:p7:c1 \(p\.7\)|doc-synthetic:p12:c1 \(p\.12\)/)
    ).toBeVisible({ timeout: 5000 });
  });
});
