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

test('@week2 pdf-rag ui: imported index contributes chunk/page provenance in generated note', async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-learning-policy-replay-mode', 'true');
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Research' }).click();
  await expect(page).toHaveURL(/\/research/);

  const pdfIndexPayload = {
    sourceName: 'synthetic-rag.pdf',
    createdAt: new Date().toISOString(),
    chunks: [
      {
        chunkId: 'pdf:7:1',
        page: 7,
        text: 'Select users query from users table with schema validation for missing columns.'
      },
      {
        chunkId: 'pdf:12:1',
        page: 12,
        text: 'Incomplete query and undefined column errors are fixed by checking SELECT and FROM clauses.'
      }
    ]
  };

  await page.getByTestId('pdf-index-file-input').setInputFiles({
    name: 'synthetic-pdf-index.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(pdfIndexPayload))
  });
  await expect(page.getByTestId('pdf-index-summary')).toContainText('synthetic-rag.pdf (2 chunks)');

  await page.getByRole('link', { name: 'Practice' }).click();
  await expect(page).toHaveURL('/');

  const runQueryButton = page.getByRole('button', { name: 'Run Query' });
  await expect(runQueryButton).toBeVisible();

  await runUntilErrorCount(page, runQueryButton, 1);
  await page.getByRole('button', { name: 'Request Hint' }).click();
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await runUntilErrorCount(page, runQueryButton, 2);

  const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
  await expect(addToNotesButton).toBeVisible();
  await addToNotesButton.click();
  await expect(page.getByText(/Added to My Notes|Updated existing My Notes entry/)).toBeVisible();

  await page.getByRole('link', { name: 'My Textbook' }).first().click();
  await expect(page).toHaveURL(/\/textbook/);
  await page.getByText('Provenance').click();

  await expect(page.getByText(/PDF citations:/)).toBeVisible();
  await expect(page.getByText(/pdf:7:1 \(p\.7\)|pdf:12:1 \(p\.12\)/)).toBeVisible();
});
