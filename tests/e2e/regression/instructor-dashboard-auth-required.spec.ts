import { test, expect } from '@playwright/test';

function resolveInstructorApiBaseUrl(): string | null {
  const explicitApiBase =
    process.env.PLAYWRIGHT_API_BASE_URL?.trim() ||
    process.env.VITE_API_BASE_URL?.trim();
  if (explicitApiBase) {
    return explicitApiBase.replace(/\/+$/, '');
  }

  const frontendBase = process.env.PLAYWRIGHT_BASE_URL?.trim();
  if (!frontendBase || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(frontendBase)) {
    return 'http://127.0.0.1:3001';
  }

  return null;
}

test.describe('Instructor Dashboard Authentication', () => {
  test('shows authentication boundary when not logged in', async ({ page }) => {
    await page.goto('/research');

    await expect(page).toHaveURL(/.*login|.*\/research/);

    if (page.url().includes('/research')) {
      await expect(page.getByRole('heading', { name: /Sign in required/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /^Sign In$/i })).toBeVisible();
    }
  });
});

test.describe('Instructor Dashboard API Authentication', () => {
  test('instructor overview endpoint requires authentication', async ({ playwright }) => {
    const apiBaseUrl = resolveInstructorApiBaseUrl();
    test.skip(!apiBaseUrl, 'PLAYWRIGHT_API_BASE_URL is required to validate deployed API auth.');

    const api = await playwright.request.newContext({ baseURL: apiBaseUrl! });
    const response = await api.get('/api/instructor/overview');
    expect(response.status()).toBe(401);
    await api.dispose();
  });

  test('instructor learners endpoint requires authentication', async ({ playwright }) => {
    const apiBaseUrl = resolveInstructorApiBaseUrl();
    test.skip(!apiBaseUrl, 'PLAYWRIGHT_API_BASE_URL is required to validate deployed API auth.');

    const api = await playwright.request.newContext({ baseURL: apiBaseUrl! });
    const response = await api.get('/api/instructor/learners');
    expect(response.status()).toBe(401);
    await api.dispose();
  });

  test('learners profiles endpoint requires authentication', async ({ playwright }) => {
    const apiBaseUrl = resolveInstructorApiBaseUrl();
    test.skip(!apiBaseUrl, 'PLAYWRIGHT_API_BASE_URL is required to validate deployed API auth.');

    const api = await playwright.request.newContext({ baseURL: apiBaseUrl! });
    const response = await api.get('/api/learners/profiles');
    expect(response.status()).toBe(401);
    await api.dispose();
  });
});
