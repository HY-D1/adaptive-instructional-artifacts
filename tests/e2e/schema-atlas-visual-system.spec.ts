import { expect, test, type Locator, type Page } from '@playwright/test';

const studentProfile = {
  id: 'schema-atlas-student',
  name: 'Atlas Tester',
  role: 'student',
  createdAt: 1_750_000_000_000,
} as const;

const instructorProfile = {
  id: 'schema-atlas-instructor',
  name: 'Atlas Instructor',
  role: 'instructor',
  createdAt: 1_750_000_000_001,
} as const;

type AtlasShell = 'gateway' | 'app' | 'public';
type TestProfile = typeof studentProfile | typeof instructorProfile;

async function setProfile(page: Page, profile: TestProfile | null) {
  await page.evaluate((nextProfile) => {
    if (nextProfile) {
      localStorage.setItem('sql-adapt-user-profile', JSON.stringify(nextProfile));
    } else {
      localStorage.removeItem('sql-adapt-user-profile');
    }
  }, profile);
}

async function expectAtlasLandmarks(page: Page, expectedShell: AtlasShell) {
  const banner = page.getByRole('banner');
  await expect(banner).toHaveCount(1);
  await expect(banner.getByText('Schema Atlas', { exact: true })).toBeVisible();
  await expect(page.getByRole('main')).toHaveCount(1);

  const shells = page.locator('[data-atlas-shell]');
  await expect(shells).toHaveCount(1);
  await expect(page.locator(`[data-atlas-shell="${expectedShell}"]`)).toHaveCount(1);

  const primaryNavigation = page.getByRole('navigation', { name: 'Primary navigation' });
  await expect(primaryNavigation).toHaveCount(expectedShell === 'app' ? 1 : 0);

  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  const mainTarget = page.locator('#main-content');
  await expect(skipLink).toHaveCount(1);
  await expect(skipLink).toHaveAttribute('href', '#main-content');
  await expect(mainTarget).toHaveCount(1);
  await skipLink.focus();
  await page.keyboard.press('Enter');
  await expect(mainTarget).toBeFocused();
}

async function visitAtlasRoute(page: Page, pathname: string, expectedShell: AtlasShell) {
  await page.goto(pathname);
  await expect.poll(() => new URL(page.url()).pathname).toBe(pathname);
  await expectAtlasLandmarks(page, expectedShell);
}

async function setTheme(page: Page, theme: 'light' | 'dark') {
  await page.evaluate((nextTheme) => {
    localStorage.setItem('sql-adapt-theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
  }, theme);
}

async function openStartInTheme(page: Page, theme: 'light' | 'dark') {
  await page.goto('/');
  await setProfile(page, null);
  await setTheme(page, theme);
}

async function readSurfaceColors(locator: Locator) {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderTopColor,
    };
  });
}

test.describe('Schema Atlas visual-system contract', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('sql-adapt-welcome-seen', 'true');
    });
  });

  test('@no-external normalizes every accepted gateway URL variant', async ({ page }) => {
    await page.goto('/');
    await setProfile(page, null);

    for (const pathname of ['/', '/login', '/signup', '/login/', '/signup/', '/Login']) {
      await test.step(pathname, async () => {
        await visitAtlasRoute(page, pathname, 'gateway');
      });
    }

    await expect(page.getByRole('navigation', { name: 'Primary navigation' })).toHaveCount(0);
  });

  test('@no-external covers public routes with the correct Atlas shell', async ({ page }) => {
    await page.goto('/');
    await setProfile(page, null);

    await visitAtlasRoute(page, '/projects', 'public');
    await expect(page.getByRole('heading', { name: 'Research', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back' })).toBeVisible();
  });

  test('@no-external covers every defined student route with the app shell', async ({ page }) => {
    await page.goto('/');
    await setProfile(page, studentProfile);

    for (const pathname of [
      '/concepts',
      '/concepts/murachs-mysql-3rd-edition/mysql-intro',
      '/practice',
      '/textbook',
      '/settings',
    ]) {
      await test.step(pathname, async () => {
        await visitAtlasRoute(page, pathname, 'app');
      });
    }
    await expect(page.getByRole('link', { name: /SQL-Adapt Student/i })).toBeVisible();
  });

  test('@no-external covers every defined instructor route with the app shell', async ({ page }) => {
    await page.goto('/');
    await setProfile(page, instructorProfile);

    for (const pathname of ['/research', '/instructor-dashboard']) {
      await test.step(pathname, async () => {
        await visitAtlasRoute(page, pathname, 'app');
      });
    }
    await expect(page.getByRole('link', { name: /SQL-Adapt Instructor/i })).toBeVisible();
  });

  test('@no-external keeps the projects hero decoration behind its content', async ({ page }) => {
    await page.goto('/projects');

    const layers = await page.locator('.atlas-public-intro').evaluate((intro) => {
      const content = intro.querySelector<HTMLElement>(':scope > .container');
      if (!content) throw new Error('Projects hero content container is missing');

      const contentStyle = getComputedStyle(content);
      const decorationStyle = getComputedStyle(intro, '::after');
      return {
        contentPosition: contentStyle.position,
        contentZIndex: Number(contentStyle.zIndex),
        decorationZIndex: Number(decorationStyle.zIndex),
      };
    });

    expect(layers.contentPosition).not.toBe('static');
    expect(layers.contentZIndex).toBeGreaterThan(layers.decorationZIndex);
  });

  test('@no-external keeps the selected gateway role distinct in both themes', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await test.step(theme, async () => {
        await openStartInTheme(page, theme);

        const studentRole = page.getByRole('radio', { name: 'Student role' });
        const neutralRoleColors = await readSurfaceColors(studentRole);
        await studentRole.click();
        await expect(studentRole).toHaveAttribute('aria-checked', 'true');
        const selectedRoleColors = await readSurfaceColors(studentRole);

        expect(selectedRoleColors.borderColor).not.toBe(neutralRoleColors.borderColor);
        expect(selectedRoleColors.backgroundColor).not.toBe(neutralRoleColors.backgroundColor);
      });
    }
  });

  test('@no-external keeps the invalid gateway username distinct in both themes', async ({ page }) => {
    for (const theme of ['light', 'dark'] as const) {
      await test.step(theme, async () => {
        await openStartInTheme(page, theme);

        const username = page.getByLabel('What should we call you?');
        await username.fill('Atlas Learner');
        await username.blur();
        await expect(username).not.toHaveAttribute('aria-invalid', 'true');
        const validInputColors = await readSurfaceColors(username);

        await username.fill('Atlas!');
        await username.blur();
        await expect(username).toHaveAttribute('aria-invalid', 'true');
        await expect(page.locator('#username-error')).toBeVisible();
        const invalidInputColors = await readSurfaceColors(username);

        expect(invalidInputColors.borderColor).not.toBe(validInputColors.borderColor);
      });
    }
  });

  test('@no-external preserves semantic blue borders while styling exact border-bottom tokens', async ({ page }) => {
    await page.goto('/');
    await setProfile(page, studentProfile);
    await page.goto('/practice');

    for (const theme of ['light', 'dark'] as const) {
      await test.step(theme, async () => {
        await setTheme(page, theme);

        const colors = await page.evaluate(() => {
          const app = document.querySelector<HTMLElement>('[data-atlas-shell="app"]');
          if (!app) throw new Error('Atlas app shell is missing');

          const makeSwatch = (id: string, className: string, parent: HTMLElement) => {
            document.getElementById(id)?.remove();
            const swatch = document.createElement('div');
            swatch.id = id;
            swatch.className = className;
            swatch.setAttribute('aria-hidden', 'true');
            parent.appendChild(swatch);
            return swatch;
          };

          const semanticBlue = makeSwatch('atlas-test-semantic-blue', 'border border-blue-500', app);
          const ordinaryBottom = makeSwatch('atlas-test-ordinary-bottom', 'border-b', app);
          const blueReference = makeSwatch('atlas-test-blue-reference', 'border border-blue-500', document.body);
          const atlasReference = makeSwatch('atlas-test-line-reference', '', document.body);
          atlasReference.style.borderBottom = '1px solid var(--atlas-line)';

          const result = {
            semanticBlue: getComputedStyle(semanticBlue).borderTopColor,
            ordinaryBottom: getComputedStyle(ordinaryBottom).borderBottomColor,
            blueReference: getComputedStyle(blueReference).borderTopColor,
            atlasLine: getComputedStyle(atlasReference).borderBottomColor,
          };

          semanticBlue.remove();
          ordinaryBottom.remove();
          blueReference.remove();
          atlasReference.remove();
          return result;
        });

        expect(colors.semanticBlue).toBe(colors.blueReference);
        expect(colors.semanticBlue).not.toBe(colors.atlasLine);
        expect(colors.ordinaryBottom).toBe(colors.atlasLine);
      });
    }
  });

  test('@no-external preserves combined semantic bottom borders in both themes', async ({ page }) => {
    await page.goto('/');
    await setProfile(page, studentProfile);
    await page.goto('/practice');

    for (const theme of ['light', 'dark'] as const) {
      await test.step(theme, async () => {
        await setTheme(page, theme);

        const result = await page.evaluate(() => {
          const app = document.querySelector<HTMLElement>('[data-atlas-shell="app"]');
          if (!app) throw new Error('Atlas app shell is missing');

          const semanticClasses = [
            { color: 'blue', className: 'border-b border-blue-500' },
            { color: 'amber', className: 'border-b border-amber-500' },
            { color: 'red', className: 'border-b border-red-500' },
            { color: 'green', className: 'border-b border-green-500' },
          ];

          const semanticUtilities = document.createElement('style');
          semanticUtilities.textContent = `
            .border-blue-500 { border-color: var(--color-blue-500); }
            .border-amber-500 { border-color: var(--color-amber-500); }
            .border-red-500 { border-color: var(--color-red-500); }
            .border-green-500 { border-color: var(--color-green-500); }
          `;
          document.head.appendChild(semanticUtilities);

          const colors = semanticClasses.map(({ color, className }) => {
            const inside = document.createElement('div');
            inside.className = className;
            inside.setAttribute('aria-hidden', 'true');
            app.appendChild(inside);

            const reference = document.createElement('div');
            reference.className = className;
            reference.setAttribute('aria-hidden', 'true');
            document.body.appendChild(reference);

            const result = {
              color,
              inside: getComputedStyle(inside).borderBottomColor,
              reference: getComputedStyle(reference).borderBottomColor,
            };

            inside.remove();
            reference.remove();
            return result;
          });

          const atlasReference = document.createElement('div');
          atlasReference.style.borderBottom = '1px solid var(--atlas-line)';
          document.body.appendChild(atlasReference);
          const atlasLine = getComputedStyle(atlasReference).borderBottomColor;
          atlasReference.remove();
          semanticUtilities.remove();

          return { atlasLine, colors };
        });

        for (const color of result.colors) {
          expect.soft(color.reference, `${theme} ${color.color} reference border`).not.toBe(result.atlasLine);
          expect.soft(color.inside, `${theme} ${color.color} bottom border`).toBe(color.reference);
        }
      });
    }
  });
});
