import fs from 'fs';
import { expect, test } from '@playwright/test';

import { INSTRUCTOR_AUTH_FILE } from '../helpers/auth-state-paths';
import { createApiContext, resolveApiBaseUrl } from '../helpers/auth-env';

const API_BASE_URL = resolveApiBaseUrl();

let authAvailable: boolean | null = null;

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

async function getInstructorSectionCode(
  playwright: import('@playwright/test').Playwright,
): Promise<string | null> {
  const cookieHeader = buildInstructorApiCookieHeader();
  if (!cookieHeader) return null;

  const api = await createApiContext(playwright, API_BASE_URL);
  try {
    const response = await api.get('/api/auth/me', {
      headers: {
        Cookie: cookieHeader,
      },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok()) return null;
    return body?.user?.ownedSections?.[0]?.studentSignupCode ?? null;
  } finally {
    await api.dispose();
  }
}

async function signupStudent(
  playwright: import('@playwright/test').Playwright,
  classCode: string,
  email: string,
  password: string,
): Promise<{ learnerId: string; name: string }> {
  const api = await createApiContext(playwright, API_BASE_URL);
  try {
    const response = await api.post('/api/auth/signup', {
      data: {
        name: 'Student Visible',
        email,
        password,
        role: 'student',
        classCode,
      },
    });
    const body = await response.json();
    expect(response.ok(), JSON.stringify(body)).toBeTruthy();
    expect(body.user?.learnerId).toBeTruthy();
    return {
      learnerId: body.user.learnerId as string,
      name: 'Student Visible',
    };
  } finally {
    await api.dispose();
  }
}

test.use({ storageState: INSTRUCTOR_AUTH_FILE });

test.describe('@authz instructor dashboard profile visibility', () => {
  let skipAll = false;

  test.beforeAll(async () => {
    skipAll = !(await instructorAuthIsAvailable());
    if (skipAll) {
      console.warn('[instructor-dashboard-profiles] Instructor auth state unavailable; skipping.');
    }
  });

  test.beforeEach(async ({}, testInfo) => {
    if (skipAll) testInfo.skip();
  });

  test('newly enrolled student appears in the instructor dashboard without visiting Practice', async ({
    playwright,
    page,
  }) => {
    const timestamp = Date.now();
    const studentEmail = `student-${timestamp}@sql-adapt.test`;
    const password = 'DashboardVisibility!123';

    await page.goto('/instructor-dashboard', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Instructor Dashboard' })).toBeVisible({
      timeout: 20_000,
    });

    let classCode: string | null = null;
    await expect.poll(async () => {
      classCode = await getInstructorSectionCode(playwright);
      return classCode;
    }, {
      timeout: 20_000,
      intervals: [500, 1000, 2000],
    }).toBeTruthy();

    const student = await signupStudent(playwright, classCode!, studentEmail, password);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Student Adaptive Profiles' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('cell', { name: student.name }).first()).toBeVisible({
      timeout: 30_000,
    });
  });
});
