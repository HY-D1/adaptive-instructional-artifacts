import fs from 'fs';
import { expect, test } from '@playwright/test';

import { INSTRUCTOR_AUTH_FILE } from '../helpers/auth-state-paths';
import { createApiContext, resolveApiBaseUrl } from '../helpers/auth-env';

const API_BASE_URL = resolveApiBaseUrl();

let authAvailable: boolean | null = null;
let backendAvailable: boolean | null = null;

async function instructorAuthIsAvailable(): Promise<boolean> {
  if (authAvailable !== null) return authAvailable;
  try {
    if (!fs.existsSync(INSTRUCTOR_AUTH_FILE)) {
      authAvailable = false;
      return false;
    }

    const state = JSON.parse(fs.readFileSync(INSTRUCTOR_AUTH_FILE, 'utf-8'));
    authAvailable = Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    authAvailable = false;
  }

  return authAvailable;
}

async function instructorBackendIsAvailable(
  playwright: import('@playwright/test').Playwright,
): Promise<boolean> {
  if (backendAvailable !== null) return backendAvailable;
  const api = await createApiContext(playwright, API_BASE_URL);
  try {
    const response = await api.get('/health');
    backendAvailable = response.ok();
  } catch {
    backendAvailable = false;
  } finally {
    await api.dispose();
  }
  return backendAvailable;
}

function buildInstructorApiCookieHeader(): string {
  const apiHost = new URL(API_BASE_URL).hostname;
  const state = JSON.parse(fs.readFileSync(INSTRUCTOR_AUTH_FILE, 'utf-8')) as {
    cookies?: Array<{ name: string; value: string; domain: string }>;
  };

  return (state.cookies ?? [])
    .filter((cookie) => {
      const cookieDomain = cookie.domain.replace(/^\./, '');
      return apiHost === cookieDomain || apiHost.endsWith(`.${cookieDomain}`);
    })
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
}

async function fetchInstructorAnalyticsSummary(
  playwright: import('@playwright/test').Playwright,
): Promise<{
  totalStudents: number;
  activeToday: number;
  avgConceptCoverage: number;
  totalInteractions: number;
}> {
  const api = await createApiContext(playwright, API_BASE_URL);
  try {
    const cookieHeader = buildInstructorApiCookieHeader();
    const response = await api.get('/api/instructor/analytics/summary', {
      headers: cookieHeader ? { Cookie: cookieHeader } : undefined,
    });
    const body = await response.json();
    expect(response.ok(), JSON.stringify(body)).toBeTruthy();
    expect(body?.data).toBeTruthy();
    return {
      totalStudents: body.data.totalStudents as number,
      activeToday: body.data.activeToday as number,
      avgConceptCoverage: body.data.avgConceptCoverage as number,
      totalInteractions: body.data.totalInteractions as number,
    };
  } finally {
    await api.dispose();
  }
}

test.use({ storageState: INSTRUCTOR_AUTH_FILE });

test.describe('@deployed-auth-smoke instructor dashboard analytics summary', () => {
  let skipAll = false;

  test.beforeAll(async ({ playwright }) => {
    const [authReady, backendReady] = await Promise.all([
      instructorAuthIsAvailable(),
      instructorBackendIsAvailable(playwright),
    ]);
    skipAll = !authReady || !backendReady;
    if (skipAll) {
      console.warn('[instructor-dashboard-analytics-summary] Instructor auth state or backend API unavailable; skipping.');
    }
  });

  test.beforeEach(async ({}, testInfo) => {
    if (skipAll) testInfo.skip();
  });

  test('hero metrics match the instructor analytics summary API', async ({ playwright, page }) => {
    const summary = await fetchInstructorAnalyticsSummary(playwright);

    await page.goto('/instructor-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Instructor Dashboard' })).toBeVisible({
      timeout: 20_000,
    });

    await expect.poll(
      async () => page.getByTestId('instructor-total-students-value').textContent(),
      { timeout: 20_000, intervals: [500, 1000, 2000] },
    ).toBe(String(summary.totalStudents));

    await expect(page.getByTestId('instructor-active-today-value')).toHaveText(
      String(summary.activeToday),
    );
    await expect(page.getByTestId('instructor-avg-progress-value')).toHaveText(
      `${summary.avgConceptCoverage}%`,
    );
    await expect(page.getByTestId('instructor-total-interactions-value')).toHaveText(
      String(summary.totalInteractions),
    );
  });
});
