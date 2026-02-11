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
  await expect(page.getByText('Hint 1')).toBeVisible();
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByText('Hint 2')).toBeVisible();
  await page.getByRole('button', { name: 'Next Hint' }).click();
  await expect(page.getByText('Hint 3')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Max Hints Reached' })).toBeDisabled();

  // Another failed attempt should trigger auto-escalation after 3 hints.
  await runUntilErrorCount(page, runQueryButton, 2);

  const addToNotesButton = page.getByRole('button', { name: 'Add to My Notes' });
  await expect(addToNotesButton).toBeVisible();
  await addToNotesButton.click();
  await expect(page.getByText(/Added to My Notes|Updated existing note/)).toBeVisible();

  // Verify note surfaced in textbook view.
  await page.getByRole('link', { name: 'My Textbook' }).first().click();
  await expect(page).toHaveURL(/\/textbook/);
  await expect(page.getByRole('heading', { name: 'My Textbook', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Help with Select All Users', level: 2 })).toBeVisible();
  await expect(page.getByText(/This content was generated from/)).toBeVisible();
});
