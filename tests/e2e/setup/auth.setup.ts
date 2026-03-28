/**
 * @auth-setup  Playwright auth state capture
 *
 * Creates two storageState snapshots that contain the JWT cookie set by the
 * backend plus the localStorage profile written by AuthContext:
 *
 *   playwright/.auth/student.json      — logged-in student
 *   playwright/.auth/instructor.json   — logged-in instructor
 *
 * This setup is strict for launch proof:
 * - backend must be reachable
 * - persistence mode must be neon
 * - resolvedEnvSource must be non-null
 * - auth routes must be reachable
 *
 * Env vars:
 *   PLAYWRIGHT_API_BASE_URL  preferred backend API URL for split frontend/backend proofs
 *   VITE_API_BASE_URL        fallback backend API URL
 *   E2E_STUDENT_EMAIL        default: e2e-student-<ts>@sql-adapt.test
 *   E2E_STUDENT_PASSWORD     default: E2eTestPass!123
 *   E2E_STUDENT_CLASS_CODE   required for deployed runs (local can auto-provision if missing)
 *   E2E_INSTRUCTOR_EMAIL     default: e2e-instructor-<ts>@sql-adapt.test
 *   E2E_INSTRUCTOR_PASSWORD  default: E2eInstrPass!123
 *   E2E_ALLOW_INSTRUCTOR_SIGNUP set true to allow instructor signup fallback in deployed runs
 *   E2E_INSTRUCTOR_CODE      required only when E2E_ALLOW_INSTRUCTOR_SIGNUP=true
 */

import { test as setup, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import {
  createApiContext,
  resolveApiBaseUrl,
  resolveFrontendBaseUrl,
  runNeonPreflight,
} from '../helpers/auth-env';
import { STUDENT_AUTH_FILE, INSTRUCTOR_AUTH_FILE } from '../helpers/auth-state-paths';

const API_BASE_URL = resolveApiBaseUrl();
const FRONTEND_BASE_URL = resolveFrontendBaseUrl();

function isLocalBaseUrl(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
}

const IS_DEPLOYED_AUTH_TARGET = !isLocalBaseUrl(FRONTEND_BASE_URL);
const ALLOW_INSTRUCTOR_SIGNUP = process.env.E2E_ALLOW_INSTRUCTOR_SIGNUP === 'true';

const TS = Date.now();

const STUDENT_NAME = 'E2E Student';
const STUDENT_EMAIL = process.env.E2E_STUDENT_EMAIL ?? `e2e-student-${TS}@sql-adapt.test`;
const STUDENT_PASSWORD = process.env.E2E_STUDENT_PASSWORD ?? 'E2eTestPass!123';
const STUDENT_CLASS_CODE = process.env.E2E_STUDENT_CLASS_CODE;

const INSTRUCTOR_NAME = 'E2E Instructor';
const INSTRUCTOR_EMAIL = process.env.E2E_INSTRUCTOR_EMAIL ?? `e2e-instructor-${TS}@sql-adapt.test`;
const INSTRUCTOR_PASSWORD = process.env.E2E_INSTRUCTOR_PASSWORD ?? 'E2eInstrPass!123';
const INSTRUCTOR_CODE =
  process.env.E2E_INSTRUCTOR_CODE ??
  process.env.VITE_INSTRUCTOR_PASSCODE ??
  (IS_DEPLOYED_AUTH_TARGET ? undefined : 'TeachSQL2024');

function requireDeterministicEnvForDeployed(): void {
  if (!IS_DEPLOYED_AUTH_TARGET) return;

  const missing: string[] = [];
  if (!process.env.E2E_INSTRUCTOR_EMAIL) missing.push('E2E_INSTRUCTOR_EMAIL');
  if (!process.env.E2E_INSTRUCTOR_PASSWORD) missing.push('E2E_INSTRUCTOR_PASSWORD');
  if (!process.env.E2E_STUDENT_CLASS_CODE) missing.push('E2E_STUDENT_CLASS_CODE');
  if (ALLOW_INSTRUCTOR_SIGNUP && !process.env.E2E_INSTRUCTOR_CODE) {
    missing.push('E2E_INSTRUCTOR_CODE');
  }

  if (missing.length > 0) {
    throw new Error(
      '[auth-setup] Deployed auth runs require deterministic env vars: ' +
      missing.join(', ') +
      '. Seed one real instructor account once, capture its studentSignupCode, ' +
      'set stable E2E_* values, then rerun setup:auth.',
    );
  }
}

async function captureAuthDiagnostic(
  page: Page,
  role: 'student' | 'instructor',
  phase: string,
): Promise<string | null> {
  try {
    const directory = 'test-results/auth-setup';
    fs.mkdirSync(directory, { recursive: true });
    const filePath = path.join(directory, `${role}-${phase}-${Date.now()}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    return filePath;
  } catch {
    return null;
  }
}

function assertAuthCookieSaved(filePath: string, label: string): void {
  const state = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as {
    cookies?: Array<{ name?: string }>;
  };
  const hasJwtCookie = Array.isArray(state.cookies) && state.cookies.some((cookie) => cookie.name === 'sql_adapt_auth');
  if (!hasJwtCookie) {
    throw new Error(`[auth-setup] ${label} auth state is missing sql_adapt_auth cookie (${filePath})`);
  }
}

async function assertAuthUiAvailable(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-welcome-disabled', 'true');
  });
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  const unavailable = await page
    .getByText(/Account system not available/i)
    .isVisible({ timeout: 5_000 })
    .catch(() => false);

  if (unavailable) {
    throw new Error(
      '[auth-setup] Frontend auth UI is disabled (Account system not available). ' +
      'Ensure frontend is built with VITE_API_BASE_URL pointing to backend.',
    );
  }

  await expect(page.locator('#login-email')).toBeVisible({ timeout: 10_000 });
}

type AuthOutcome = {
  redirected: boolean;
  alertText: string | null;
  outcome: 'redirected' | 'authenticated' | 'error' | 'timeout';
};

async function hasAuthenticatedSession(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(async (apiBaseUrl) => {
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, {
        credentials: 'include',
      });
      if (!response.ok) return false;
      const body = await response.json().catch(() => null);
      return Boolean(body?.success && body?.user?.id);
    }, API_BASE_URL);
  } catch {
    return false;
  }
}

async function ensureAuthenticatedRoute(page: Page, targetPath: '/practice' | '/instructor-dashboard'): Promise<void> {
  if (await hasAuthenticatedSession(page)) {
    const currentPath = new URL(page.url()).pathname;
    if (currentPath === '/login' || currentPath === '/login/') {
      await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
    }
  }
}

async function submitAndWaitForAuthOutcome(page: Page): Promise<AuthOutcome> {
  const initialOutcome = await Promise.race([
    page
      .waitForURL(/\/(practice|instructor-dashboard)/, { timeout: 15_000 })
      .then(() => 'redirected' as const),
    page
      .locator('[role="alert"]')
      .first()
      .waitFor({ timeout: 15_000 })
      .then(() => 'error' as const),
  ]).catch(() => 'timeout' as const);

  const alertText = initialOutcome === 'error'
    ? await page.locator('[role="alert"]').first().textContent().catch(() => null)
    : null;
  const authenticated = initialOutcome !== 'redirected' && await hasAuthenticatedSession(page);

  return {
    redirected: initialOutcome === 'redirected' || authenticated,
    alertText: alertText?.trim() || null,
    outcome: authenticated ? 'authenticated' : initialOutcome,
  };
}

async function attemptLogin(
  page: Page,
  email: string,
  password: string,
): Promise<AuthOutcome> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login-email')).toBeVisible({ timeout: 10_000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.locator('form').getByRole('button', { name: /^Sign In$/i }).click();
  return submitAndWaitForAuthOutcome(page);
}

async function attemptSignup(
  page: Page,
  name: string,
  email: string,
  password: string,
  role: 'student' | 'instructor',
  classCode?: string,
  instructorCode?: string,
): Promise<AuthOutcome> {
  await page.goto('/login?tab=signup', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#signup-name')).toBeVisible({ timeout: 10_000 });

  await page.fill('#signup-name', name);
  await page.fill('#signup-email', email);
  await page.fill('#signup-password', password);

  const roleLabel = role === 'student' ? 'Student' : 'Instructor';
  const roleButton = page
    .locator('button[type="button"]')
    .filter({ hasText: new RegExp(roleLabel, 'i') })
    .first();
  await expect(roleButton).toBeVisible({ timeout: 10_000 });
  await roleButton.click();

  if (role === 'student' && classCode) {
    await expect(page.locator('#signup-code')).toBeVisible({ timeout: 3_000 });
    await page.fill('#signup-code', classCode);
  }

  if (role === 'instructor' && instructorCode) {
    await expect(page.locator('#signup-code')).toBeVisible({ timeout: 3_000 });
    await page.fill('#signup-code', instructorCode);
  }

  await page.getByRole('button', { name: /Create Account/i }).last().click();
  return submitAndWaitForAuthOutcome(page);
}

async function signupOrLogin(
  page: Page,
  name: string,
  email: string,
  password: string,
  role: 'student' | 'instructor',
  classCode?: string,
  instructorCode?: string,
): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-welcome-disabled', 'true');
  });

  const loginAttempt = await attemptLogin(page, email, password);
  if (loginAttempt.redirected) return;

  if (role === 'instructor' && IS_DEPLOYED_AUTH_TARGET && !ALLOW_INSTRUCTOR_SIGNUP) {
    const screenshotPath = await captureAuthDiagnostic(page, role, 'login1-failure');
    throw new Error(
      '[auth-setup] Deterministic deployed instructor login failed. ' +
      `phase=login1 url=${page.url()} alert=${loginAttempt.alertText ?? 'none'} ` +
      `apiBaseUrl=${API_BASE_URL} screenshot=${screenshotPath ?? 'none'} trace=playwright trace on failure. ` +
      'Set valid E2E_INSTRUCTOR_EMAIL/E2E_INSTRUCTOR_PASSWORD for the deployed account, ' +
      'or opt in to signup fallback with E2E_ALLOW_INSTRUCTOR_SIGNUP=true and E2E_INSTRUCTOR_CODE.',
    );
  }

  console.log(
    `[auth-setup] login returned ${loginAttempt.outcome} for ${email}` +
    (loginAttempt.alertText ? ` (alert="${loginAttempt.alertText}")` : '') +
    ' — attempting signup',
  );

  const signupAttempt = await attemptSignup(
    page,
    name,
    email,
    password,
    role,
    classCode,
    instructorCode,
  );
  if (signupAttempt.redirected) return;

  if (role === 'instructor' && /invalid instructor code/i.test(signupAttempt.alertText ?? '')) {
    const screenshotPath = await captureAuthDiagnostic(page, role, 'signup-invalid-code');
    throw new Error(
      '[auth-setup] Instructor signup failed with "Invalid instructor code". ' +
      `phase=signup url=${page.url()} alert=${signupAttempt.alertText ?? 'none'} ` +
      `apiBaseUrl=${API_BASE_URL} screenshot=${screenshotPath ?? 'none'} trace=playwright trace on failure. ` +
      'Set E2E_INSTRUCTOR_CODE to the deployed backend INSTRUCTOR_SIGNUP_CODE.',
    );
  }

  if (role === 'student' && /invalid class code/i.test(signupAttempt.alertText ?? '')) {
    const screenshotPath = await captureAuthDiagnostic(page, role, 'signup-invalid-class-code');
    throw new Error(
      '[auth-setup] Student signup failed with "Invalid class code". ' +
      `phase=signup url=${page.url()} alert=${signupAttempt.alertText ?? 'none'} ` +
      `apiBaseUrl=${API_BASE_URL} screenshot=${screenshotPath ?? 'none'} trace=playwright trace on failure. ` +
      'Set E2E_STUDENT_CLASS_CODE to a real studentSignupCode from an instructor-owned section.',
    );
  }

  const retryLoginAttempt = await attemptLogin(page, email, password);
  if (retryLoginAttempt.redirected) return;

  const screenshotPath = await captureAuthDiagnostic(page, role, 'auth-final-failure');
  throw new Error(
    `[auth-setup] Could not authenticate ${role} account ${email}. ` +
    `frontendUrl=${page.url()} apiBaseUrl=${API_BASE_URL} ` +
    `login1=${loginAttempt.outcome}` +
    (loginAttempt.alertText ? `("${loginAttempt.alertText}")` : '') +
    ` signup=${signupAttempt.outcome}` +
    (signupAttempt.alertText ? `("${signupAttempt.alertText}")` : '') +
    ` login2=${retryLoginAttempt.outcome}` +
    (retryLoginAttempt.alertText ? `("${retryLoginAttempt.alertText}")` : '') +
    ` screenshot=${screenshotPath ?? 'none'} trace=playwright trace on failure. ` +
    'Verify stable E2E credentials and signup codes for this deployment.',
  );
}

setup.describe('@auth-setup', () => {
  setup.beforeAll(async () => {
    requireDeterministicEnvForDeployed();
    const preflight = await runNeonPreflight(API_BASE_URL);
    console.log(
      `[auth-setup] frontendBaseUrl=${FRONTEND_BASE_URL} apiBaseUrl=${API_BASE_URL} ` +
      `dbMode=${String(preflight.persistenceStatus.dbMode)} ` +
      `resolvedEnvSource=${String(preflight.persistenceStatus.resolvedEnvSource)}`,
    );
  });

  setup('capture student auth state', async ({ page, playwright }) => {
    fs.mkdirSync(path.dirname(STUDENT_AUTH_FILE), { recursive: true });
    await assertAuthUiAvailable(page);

    let studentClassCode = STUDENT_CLASS_CODE;
    const apiContext = await createApiContext(playwright, API_BASE_URL);
    try {
      if (!studentClassCode && !IS_DEPLOYED_AUTH_TARGET) {
        const provisionEmail = `e2e-classcode-${Date.now()}@sql-adapt.test`;
        const provisionPassword = 'E2eCodeProvision!123';
        const provisionResponse = await apiContext.post('/api/auth/signup', {
          data: {
            name: 'E2E ClassCode Provisioner',
            email: provisionEmail,
            password: provisionPassword,
            role: 'instructor',
            instructorCode: INSTRUCTOR_CODE,
          },
        });
        const provisionBody = await provisionResponse.json().catch(() => null);
        if (provisionResponse.ok() && provisionBody?.user?.ownedSections?.[0]?.studentSignupCode) {
          studentClassCode = provisionBody.user.ownedSections[0].studentSignupCode;
        } else {
          if (/invalid instructor code/i.test(String(provisionBody?.error ?? ''))) {
            throw new Error(
              '[auth-setup] class-code auto-provision failed: Invalid instructor code. ' +
              'Set E2E_INSTRUCTOR_CODE to the backend INSTRUCTOR_SIGNUP_CODE and provide ' +
              'E2E_STUDENT_CLASS_CODE for deterministic deployed runs.',
            );
          }
          console.log(
            `[auth-setup] class-code auto-provision failed: status=${provisionResponse.status()} ` +
            `error=${String(provisionBody?.error ?? 'unknown')}`,
          );
        }
      }
    } finally {
      await apiContext.dispose();
    }

    if (!studentClassCode) {
      throw new Error(
        '[auth-setup] Missing student class code and failed to auto-provision one from backend signup. ' +
        'Set E2E_STUDENT_CLASS_CODE (recommended) or set a valid E2E_INSTRUCTOR_CODE for this backend.',
      );
    }

    await signupOrLogin(
      page,
      STUDENT_NAME,
      STUDENT_EMAIL,
      STUDENT_PASSWORD,
      'student',
      studentClassCode,
    );

    await ensureAuthenticatedRoute(page, '/practice');
    await expect(page).toHaveURL(/\/practice/, { timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 20_000 });

    await page.context().storageState({ path: STUDENT_AUTH_FILE });
    assertAuthCookieSaved(STUDENT_AUTH_FILE, 'student');
    console.log(`[auth-setup] Student auth state saved → ${STUDENT_AUTH_FILE}`);
  });

  setup('capture instructor auth state', async ({ page }) => {
    fs.mkdirSync(path.dirname(INSTRUCTOR_AUTH_FILE), { recursive: true });
    await assertAuthUiAvailable(page);

    await signupOrLogin(
      page,
      INSTRUCTOR_NAME,
      INSTRUCTOR_EMAIL,
      INSTRUCTOR_PASSWORD,
      'instructor',
      undefined,
      INSTRUCTOR_CODE,
    );

    await ensureAuthenticatedRoute(page, '/instructor-dashboard');
    await expect(page).toHaveURL(/\/(instructor-dashboard|practice)/, { timeout: 15_000 });

    await page.context().storageState({ path: INSTRUCTOR_AUTH_FILE });
    assertAuthCookieSaved(INSTRUCTOR_AUTH_FILE, 'instructor');
    console.log(`[auth-setup] Instructor auth state saved → ${INSTRUCTOR_AUTH_FILE}`);
  });
});
