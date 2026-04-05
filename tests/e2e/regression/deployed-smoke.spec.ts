/**
 * @deployed-smoke Deployment-grade public hosted smoke
 *
 * Verifies the unauthenticated hosted contract on a live deployment:
 *   root page shows the auth gate →
 *   Create Account routes to hosted signup →
 *   signup page exposes role-specific access-code fields →
 *   public corpus JSON files are valid →
 *   known-bad concept corpus entries expose learner-safe fallback metadata
 *
 * This spec intentionally avoids authenticated flows. Those are covered by the
 * auth-backed production suite (`deployed-auth-smoke.spec.ts`,
 * `student-script-production.spec.ts`, etc.) once deterministic E2E credentials
 * are available.
 *
 * Tags:
 *   @deployed-smoke  — run against the deployed app (PLAYWRIGHT_BASE_URL required)
 *   @ux-bugs         — subset of UX regression coverage for CI gating
 *
 * How to run:
 *   # Against a Vercel preview (no protection):
 *   PLAYWRIGHT_BASE_URL="https://<your-preview>.vercel.app" \
 *     npx playwright test -c playwright.config.ts --grep "@deployed-smoke"
 *
 *   # Against a protected Vercel preview:
 *   PLAYWRIGHT_BASE_URL="https://<your-preview>.vercel.app" \
 *   VERCEL_AUTOMATION_BYPASS_SECRET="<secret>" \
 *     npx playwright test -c playwright.config.ts --grep "@deployed-smoke"
 *
 *   # Full regression suite (local + deployed):
 *   PLAYWRIGHT_BASE_URL="https://<your-preview>.vercel.app" \
 *     npx playwright test -c playwright.config.ts --grep "@ux-bugs|@deployed-smoke"
 */

import { expect, test, type Page } from '@playwright/test';

async function dismissWelcomeModalIfPresent(page: Page) {
  const closeButton = page.getByRole('button', { name: /Close welcome dialog/i }).first();
  if (await closeButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await closeButton.click();
    await expect(closeButton).not.toBeVisible({ timeout: 5_000 }).catch(() => {});
  }
}

test.describe('@deployed-smoke @ux-bugs Public hosted deployment smoke', () => {
  test('root page routes to hosted signup and shows role-specific access codes', async ({ page }) => {
    await page.goto('/');
    await dismissWelcomeModalIfPresent(page);

    await expect(page.getByText(/Sign in required/i)).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByText(/Students: use your instructor's class code/i),
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /^Sign In$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Create Account$/i })).toBeVisible();

    await page.getByRole('button', { name: /^Create Account$/i }).click();
    await expect(page).toHaveURL(/\/login(\?tab=signup)?$/, { timeout: 10_000 });
    await expect(page.getByRole('heading', { name: /Create your account/i })).toBeVisible();

    await page.getByRole('button', { name: /Student\s+Practice SQL/i }).click();
    await expect(page.getByLabel(/Class code/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Enter the class code/i)).toBeVisible();

    await page.getByRole('button', { name: /Instructor\s+View analytics/i }).click();
    await expect(page.getByLabel(/Instructor code/i)).toBeVisible();
    await expect(page.getByPlaceholder(/Enter the instructor code/i)).toBeVisible();
  });

  test('known bad concept corpus entry exposes learner-safe fallback metadata', async ({ page }) => {
    const conceptRes = await page.goto('/textbook-static/concepts/murachs-mysql-3rd-edition/mysql-intro.md');
    expect(conceptRes?.status()).toBe(200);
    await expect(page.locator('body')).toContainText(/title:\s*Introduction to MySQL/i);

    const qualityBody = await page.evaluate(() =>
      fetch('/textbook-static/concept-quality.json').then(r => r.json()),
    );

    const qualityStore =
      qualityBody.schemaVersion === 'concept-quality-v1'
        ? qualityBody.qualityByConcept
        : qualityBody.quality;

    const mysqlIntro = qualityStore?.['murachs-mysql-3rd-edition/mysql-intro'];
    expect(mysqlIntro).toBeDefined();
    expect(['garbled', 'fallback_only']).toContain(mysqlIntro?.readabilityStatus);
    expect(typeof mysqlIntro?.learnerSafeSummary).toBe('string');
    expect((mysqlIntro?.learnerSafeSummary as string).length).toBeGreaterThan(20);
  });

  test('concept-quality.json is present and valid in deployed corpus', async ({ page }) => {
    const res = await page.goto('/textbook-static/concept-quality.json');
    expect(res?.status()).toBe(200);

    const body = await page.evaluate(() => fetch('/textbook-static/concept-quality.json').then(r => r.json()));

    const isV1 = body.schemaVersion === 'concept-quality-v1';
    const qualityStore = isV1 ? body.qualityByConcept : body.quality;
    expect(qualityStore).toBeDefined();
    expect(typeof qualityStore).toBe('object');

    const mysqlIntro = qualityStore?.['murachs-mysql-3rd-edition/mysql-intro'];
    expect(mysqlIntro).toBeDefined();

    const status = mysqlIntro?.readabilityStatus as string;
    expect(['garbled', 'fallback_only']).toContain(status);

    expect(typeof mysqlIntro?.learnerSafeSummary).toBe('string');
    expect((mysqlIntro?.learnerSafeSummary as string).length).toBeGreaterThan(20);
  });

  test('textbook-units.json is present and valid in deployed corpus', async ({ page }) => {
    const res = await page.goto('/textbook-static/textbook-units.json');
    expect(res?.status()).toBe(200);

    const body = await page.evaluate(() => fetch('/textbook-static/textbook-units.json').then(r => r.json()));
    expect(body).toHaveProperty('units');
    expect(Array.isArray(body.units)).toBe(true);
    expect(body.units.length).toBeGreaterThan(0);

    for (const unit of body.units.slice(0, 5)) {
      const unitIdentifier = unit.unitId ?? unit.id;
      expect(typeof unitIdentifier).toBe('string');
      expect(unitIdentifier.length).toBeGreaterThan(0);
    }
  });
});
