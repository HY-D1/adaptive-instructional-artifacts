import { expect, test, type Page } from '@playwright/test';

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((next) => {
    document.documentElement.classList.toggle('dark', next === 'dark');
  }, theme);
}

async function setupStudentProfile(page: Page, name: string) {
  await page.addInitScript((userName) => {
    localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: `student-${userName.toLowerCase().replace(/\s+/g, '-')}`,
      name: userName,
      role: 'student',
      createdAt: Date.now(),
    }));
    localStorage.setItem('sql-adapt-welcome-seen', 'true');
  }, name);
}

async function goToPractice(page: Page) {
  await page.goto('/practice');
  await expect(page.getByRole('heading', { name: 'Practice SQL', exact: true })).toBeVisible({ timeout: 10000 });
}

test.describe('@no-external Login + Practice Minimal Terminal polish', () => {
  test('practice problem header uses the atlas label style inside a bordered panel', async ({ page }) => {
    await setupStudentProfile(page, 'MinimalTerminalTester');
    await goToPractice(page);

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      const label = page.locator('.atlas-label', { hasText: /Problem \d+ of \d+/ });
      await expect(label).toBeVisible();

      const panel = page.locator('.atlas-panel-border').first();
      await expect(panel).toBeVisible();

      // Prove .atlas-panel-border actually changes rendering rather than being a
      // no-op: compare its computed border-color against a plain default Card
      // ("Session Stats") on the same page, which only carries the shared
      // `border` utility (--atlas-line). The panel additionally applies
      // .atlas-panel-border, which uses --atlas-line-strong, so the two must
      // differ in both light and dark mode.
      const defaultCard = page.locator('[data-slot="card"]', { hasText: 'Session Stats' }).first();
      await expect(defaultCard).toBeVisible();

      const [panelBorderColor, defaultBorderColor] = await Promise.all([
        panel.evaluate((el) => getComputedStyle(el).borderColor),
        defaultCard.evaluate((el) => getComputedStyle(el).borderColor),
      ]);

      expect(panelBorderColor).not.toBe(defaultBorderColor);
    }
  });

  test('practice editor uses the custom atlas-console theme in both app light and dark mode', async ({ page }) => {
    await setupStudentProfile(page, 'EditorThemeTester');
    await goToPractice(page);
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    for (const theme of ['light', 'dark'] as const) {
      await setTheme(page, theme);
      const bg = await page.locator('.monaco-editor-background').first()
        .evaluate((el) => getComputedStyle(el).backgroundColor);
      expect(bg).toBe('rgb(20, 34, 56)'); // #142238, the atlas-console theme background
    }
  });

  test('practice atlas-label and the login fallback state keep a single main landmark and do not overflow at 320px', async ({ page }) => {
    await setupStudentProfile(page, 'A11yViewportTester');

    for (const path of ['/login', '/practice'] as const) {
      await page.setViewportSize({ width: 320, height: 800 });
      if (path === '/practice') {
        await goToPractice(page);
      } else {
        await page.goto(path);
        // Note: not asserting the 'Welcome back' heading here. In this build
        // (test:e2e:no-external, no VITE_API_BASE_URL) AUTH_ENABLED is false,
        // so AuthPage's early-return branch renders "Account system not
        // available" instead of the login form/heading (see AuthPage.tsx,
        // gate predates this plan — introduced in a7d187d). Waiting on the
        // main landmark keeps this test valid across both branches while
        // still exercising the real assertions below.
        await expect(page.getByRole('main')).toBeVisible({ timeout: 10000 });
      }

      await expect(page.getByRole('main')).toHaveCount(1);
      await expect(page.locator('a', { hasText: 'Skip to main content' })).toHaveCount(1);

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1); // +1 rounding tolerance
    }
  });
});
