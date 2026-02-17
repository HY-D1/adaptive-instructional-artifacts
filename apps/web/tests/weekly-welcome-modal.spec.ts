import { expect, test } from '@playwright/test';

test.describe('@weekly welcome modal ui', () => {
  test('mobile layout keeps footer and next chevron visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome to SQL-Adapt' })).toBeVisible();

    const nextButton = page.getByTestId('welcome-next-button');
    await expect(nextButton).toBeVisible();
    await expect(nextButton.locator('svg')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const card = document.querySelector('[data-testid="welcome-modal"]');
      const footer = document.querySelector('[data-testid="welcome-modal-footer"]');
      const content = document.querySelector('[data-testid="welcome-modal-content"]');
      if (!card || !footer || !content) return null;

      const cardRect = card.getBoundingClientRect();
      const footerRect = footer.getBoundingClientRect();
      const contentNode = content as HTMLElement;
      return {
        cardTop: cardRect.top,
        cardBottom: cardRect.bottom,
        footerTop: footerRect.top,
        footerBottom: footerRect.bottom,
        contentCanScroll: contentNode.scrollHeight > contentNode.clientHeight,
      };
    });

    if (!geometry) {
      throw new Error('Welcome modal geometry could not be measured.');
    }

    expect(geometry.footerTop).toBeGreaterThanOrEqual(geometry.cardTop - 1);
    expect(geometry.footerBottom).toBeLessThanOrEqual(geometry.cardBottom + 1);
    expect(geometry.contentCanScroll).toBeTruthy();
  });

  test('dark mode keeps next button contrast and icon visibility', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome to SQL-Adapt' })).toBeVisible();

    await page.evaluate(() => {
      document.documentElement.classList.add('dark');
    });

    const nextButton = page.getByTestId('welcome-next-button');
    await expect(nextButton).toBeVisible();
    await expect(nextButton.locator('svg')).toBeVisible();

    const styles = await nextButton.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        backgroundColor: computed.backgroundColor,
        color: computed.color,
      };
    });

    expect(styles.backgroundColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(styles.backgroundColor).not.toBe(styles.color);
  });
});
