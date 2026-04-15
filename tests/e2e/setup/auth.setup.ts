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
 *   PLAYWRIGHT_FRONTEND_SHARE_URL optional Vercel share URL for protected preview frontend
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
  getVercelBypassHeaders,
} from '../helpers/auth-env';
import { STUDENT_AUTH_FILE, INSTRUCTOR_AUTH_FILE } from '../helpers/auth-state-paths';

const API_BASE_URL = resolveApiBaseUrl();
const FRONTEND_BASE_URL = resolveFrontendBaseUrl();
const FRONTEND_SHARE_URL = process.env.PLAYWRIGHT_FRONTEND_SHARE_URL?.trim();
const API_SHARE_URL = process.env.PLAYWRIGHT_API_SHARE_URL?.trim();

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

// Test seed configuration for deterministic preview accounts
const TEST_SEED_SECRET = process.env.E2E_TEST_SEED_SECRET ?? 'sql-adapt-e2e-test-secret';

interface TestSeedCredentials {
  instructor: {
    email: string;
    password: string;
    sectionCode: string;
  };
  student: {
    email: string;
    password: string;
    classCode: string;
  };
}

let _testSeedCredentials: TestSeedCredentials | null = null;

/**
 * Attempt to provision deterministic test accounts via the test-seed endpoint.
 * This is the preferred method for deployed preview testing as it doesn't
 * require manual env var configuration.
 */
async function provisionTestSeedCredentials(): Promise<TestSeedCredentials | null> {
  try {
    const bypassHeaders = getVercelBypassHeaders();
    const response = await fetch(`${API_BASE_URL}/api/auth/test-seed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-e2e-test-seed-secret': TEST_SEED_SECRET,
        ...bypassHeaders,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown' }));
      console.log(`[auth-setup] Test seed not available: ${error.error || response.status}`);
      return null;
    }

    const data = await response.json() as { success: boolean; credentials: TestSeedCredentials };
    if (data.success && data.credentials) {
      console.log('[auth-setup] Using deterministic test-seed credentials');
      return data.credentials;
    }
    return null;
  } catch (error) {
    console.log('[auth-setup] Test seed endpoint unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

function requireDeterministicEnvForDeployed(): void {
  if (!IS_DEPLOYED_AUTH_TARGET) return;

  // If test-seed is configured, we don't need manual env vars
  if (process.env.E2E_TEST_SEED_SECRET || process.env.E2E_ALLOW_TEST_SEED !== 'false') {
    return; // Will try test-seed during setup
  }

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
      '. Or set E2E_TEST_SEED_SECRET to use automatic test account provisioning.',
    );
  }
}

async function bootstrapPreviewFrontendAccess(page: Page): Promise<void> {
  if (!IS_DEPLOYED_AUTH_TARGET) return;
  if (!FRONTEND_SHARE_URL || FRONTEND_SHARE_URL.length === 0) return;
  try {
    await page.goto(FRONTEND_SHARE_URL, { waitUntil: 'domcontentloaded' });
  } catch {
    // Best-effort cookie bootstrap for protected previews.
  }
}

/**
 * API-first authentication for deployed targets.
 * Bypasses UI login issues with cross-origin cookie handling in headless browsers.
 */
async function apiLoginAndCaptureState(
  page: Page,
  email: string,
  password: string,
  _role: 'student' | 'instructor',
  targetPath: '/practice' | '/instructor-dashboard',
): Promise<void> {
  // Use Node.js fetch directly for API login to get cookies
  const loginUrl = `${API_BASE_URL}/api/auth/login`;
  const bypassHeaders = getVercelBypassHeaders();

  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...bypassHeaders,
    },
    body: JSON.stringify({ email, password }),
  });

  if (!loginRes.ok) {
    const body = await loginRes.json().catch(() => ({ error: 'Unknown' }));
    throw new Error(`API login failed: ${(body as { error?: string }).error ?? loginRes.status}`);
  }

  const loginData = await loginRes.json() as { success: boolean; user?: { id: string; name: string; role: string; learnerId: string }; error?: string };
  if (!loginData.success || !loginData.user) {
    throw new Error(`API login unsuccessful: ${loginData.error ?? 'Unknown'}`);
  }

  // Extract cookies from response headers
  const setCookieHeader = loginRes.headers.get('set-cookie');
  if (!setCookieHeader) {
    throw new Error('API login did not return cookies');
  }

  // Parse cookies
  const apiUrl = new URL(API_BASE_URL);
  const cookies: { name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite: 'None' | 'Lax' | 'Strict' }[] = [];

  // Handle multiple cookies - split by comma but be careful of cookie attributes that may contain commas
  const cookieStrings = setCookieHeader.split(/,(?=[^;]*=)/).map(s => s.trim());
  for (const cs of cookieStrings) {
    const parts = cs.split(';').map(s => s.trim());
    const [nameValue] = parts;
    const [name, ...valueParts] = nameValue.split('=');
    const value = valueParts.join('='); // Handle values with = in them
    if (name && value) {
      const attrLower = parts.map(p => p.toLowerCase());
      const sameSiteAttr = parts.find(p => p.toLowerCase().startsWith('samesite='));
      const sameSite = sameSiteAttr ? (sameSiteAttr.split('=')[1] as 'None' | 'Lax' | 'Strict') : 'Lax';
      cookies.push({
        name: name.trim(),
        value: value.trim(),
        domain: apiUrl.hostname,
        path: '/',
        httpOnly: attrLower.some(a => a === 'httponly'),
        secure: attrLower.some(a => a === 'secure'),
        sameSite: sameSite,
      });
    }
  }

  // Add cookies to page context
  await page.context().addCookies(cookies);

  // Inject user profile to localStorage
  const user = loginData.user;
  await page.addInitScript((userData: { id: string; name: string; role: string; learnerId: string }) => {
    window.localStorage.setItem('sql-adapt-welcome-seen', 'true');
    window.localStorage.setItem('sql-adapt-welcome-disabled', 'true');
    window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
      id: userData.learnerId,
      name: userData.name,
      role: userData.role,
      createdAt: Date.now(),
    }));
  }, user);

  // Navigate to target page
  await page.goto(targetPath, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000); // Wait for JS hydration
}

async function bootstrapPreviewApiAccess(page: Page): Promise<void> {
  if (!IS_DEPLOYED_AUTH_TARGET) return;

  // If we have a share URL, use it to get the bypass cookie
  if (API_SHARE_URL && API_SHARE_URL.length > 0) {
    try {
      await page.goto(API_SHARE_URL, { waitUntil: 'domcontentloaded' });
    } catch {
      // Best-effort cookie bootstrap for protected previews.
    }
    return;
  }

  // Otherwise, use route interception to proxy API requests
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || process.env.E2E_VERCEL_BYPASS_SECRET;
  if (!bypassSecret) return;

  // Store route handlers for cleanup
  const routes: Array<{ url: string; handler: (route: any) => Promise<void> }> = [];

  // Intercept all API requests and proxy them with bypass headers
  const apiRouteHandler = async (route: any) => {
    const request = route.request();
    const url = request.url();

    try {
      // Make the request with bypass headers using Node fetch
      const headers: Record<string, string> = {
        ...await request.allHeaders(),
        'x-vercel-protection-bypass': bypassSecret,
        'x-vercel-set-bypass-cookie': 'true',
      };

      const fetchOptions: RequestInit = {
        method: request.method(),
        headers,
        redirect: 'manual',
      };

      const postData = request.postData();
      if (postData) {
        fetchOptions.body = postData;
      }

      const response = await fetch(url, fetchOptions);

      // Get response headers
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Get response body
      const bodyBuffer = await response.arrayBuffer();

      // Fulfill the route with the response
      await route.fulfill({
        status: response.status,
        headers: responseHeaders,
        body: Buffer.from(bodyBuffer),
      });
    } catch (error) {
      console.error(`[auth-setup] Route proxy error for ${url}:`, error);
      await route.abort('failed');
    }
  };

  await page.route(`${API_BASE_URL}/**/*`, apiRouteHandler);

  // Store for potential cleanup
  (page as any).__apiRouteHandler__ = apiRouteHandler;
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
  await bootstrapPreviewFrontendAccess(page);
  await bootstrapPreviewApiAccess(page);
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
  await bootstrapPreviewFrontendAccess(page);
  await bootstrapPreviewApiAccess(page);
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
  await bootstrapPreviewFrontendAccess(page);
  await bootstrapPreviewApiAccess(page);
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

    // Skip auth setup entirely if backend is not reachable (local dev / CI without backend)
    try {
      const preflight = await runNeonPreflight(API_BASE_URL);
      console.log(
        `[auth-setup] frontendBaseUrl=${FRONTEND_BASE_URL} apiBaseUrl=${API_BASE_URL} ` +
        `dbMode=${String(preflight.persistenceStatus.dbMode)} ` +
        `resolvedEnvSource=${String(preflight.persistenceStatus.resolvedEnvSource)}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.log(`[auth-setup] Backend unreachable, skipping auth setup. ${message}`);
      setup.skip();
      return;
    }

    // Try to provision deterministic credentials via test-seed endpoint
    if (IS_DEPLOYED_AUTH_TARGET && !process.env.E2E_STUDENT_CLASS_CODE) {
      _testSeedCredentials = await provisionTestSeedCredentials();
      if (_testSeedCredentials) {
        console.log('[auth-setup] Using test-seed credentials for deployed auth');
      }
    }
  });

  setup('capture student auth state', async ({ page, playwright }) => {
    fs.mkdirSync(path.dirname(STUDENT_AUTH_FILE), { recursive: true });

    // Use API-first auth for deployed targets to avoid cross-origin cookie issues in headless browsers
    if (IS_DEPLOYED_AUTH_TARGET) {
      console.log('[auth-setup] Using API-first auth for student (deployed target)');

      // Use test-seed credentials if available
      const testSeedStudent = _testSeedCredentials?.student;
      const studentEmail = testSeedStudent?.email ?? STUDENT_EMAIL;
      const studentPassword = testSeedStudent?.password ?? STUDENT_PASSWORD;
      let studentClassCode = testSeedStudent?.classCode ?? STUDENT_CLASS_CODE;

      const apiContext = await createApiContext(playwright, API_BASE_URL);
      try {
        if (!studentClassCode && !_testSeedCredentials) {
          // Fallback: Provision instructor account to get class code
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
            throw new Error(
              '[auth-setup] Failed to provision class code: ' +
              `${provisionBody?.error ?? provisionResponse.status()}`,
            );
          }
        }

        // Create student account via API (idempotent - will fail gracefully if exists)
        const signupRes = await apiContext.post('/api/auth/signup', {
          data: {
            name: STUDENT_NAME,
            email: studentEmail,
            password: studentPassword,
            role: 'student',
            classCode: studentClassCode,
          },
        });

        if (!signupRes.ok()) {
          const body = await signupRes.json().catch(() => ({ error: 'Unknown' }));
          // Account may already exist, try login
          if (!/already exists/i.test(body.error)) {
            console.log(`[auth-setup] Student signup failed: ${body.error}, will try login`);
          }
        }
      } finally {
        await apiContext.dispose();
      }

      if (!studentClassCode) {
        throw new Error('[auth-setup] Missing student class code for deployed run');
      }

      // Use API login to capture auth state
      await apiLoginAndCaptureState(page, studentEmail, studentPassword, 'student', '/practice');

      // Verify we're on the practice page
      await expect(page).toHaveURL(/\/practice/, { timeout: 15_000 });

      await page.context().storageState({ path: STUDENT_AUTH_FILE });
      assertAuthCookieSaved(STUDENT_AUTH_FILE, 'student');
      console.log(`[auth-setup] Student auth state saved → ${STUDENT_AUTH_FILE}`);
      return;
    }

    // Local testing: use UI-based auth
    await assertAuthUiAvailable(page);

    let studentClassCode = STUDENT_CLASS_CODE;
    const apiContext = await createApiContext(playwright, API_BASE_URL);
    try {
      if (!studentClassCode) {
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
        }
      }
    } finally {
      await apiContext.dispose();
    }

    if (!studentClassCode) {
      throw new Error('[auth-setup] Missing student class code');
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
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  setup('capture instructor auth state', async ({ page, playwright }) => {
    fs.mkdirSync(path.dirname(INSTRUCTOR_AUTH_FILE), { recursive: true });

    // Use API-first auth for deployed targets to avoid cross-origin cookie issues in headless browsers
    if (IS_DEPLOYED_AUTH_TARGET) {
      console.log('[auth-setup] Using API-first auth for instructor (deployed target)');

      // Use test-seed credentials if available
      const testSeedInstructor = _testSeedCredentials?.instructor;
      const instructorEmail = testSeedInstructor?.email ?? INSTRUCTOR_EMAIL;
      const instructorPassword = testSeedInstructor?.password ?? INSTRUCTOR_PASSWORD;
      // For test-seed, we don't need instructorCode (account already exists)
      const instructorCode = testSeedInstructor ? undefined : INSTRUCTOR_CODE;

      const apiContext = await createApiContext(playwright, API_BASE_URL);
      try {
        // Create instructor account via API if needed (idempotent - will fail gracefully if exists)
        const signupRes = await apiContext.post('/api/auth/signup', {
          data: {
            name: INSTRUCTOR_NAME,
            email: instructorEmail,
            password: instructorPassword,
            role: 'instructor',
            instructorCode,
          },
        });

        if (!signupRes.ok()) {
          const body = await signupRes.json().catch(() => ({ error: 'Unknown' }));
          // Account may already exist, try login
          if (!/already exists/i.test(body.error)) {
            console.log(`[auth-setup] Instructor signup failed: ${body.error}, will try login`);
          }
        }
      } finally {
        await apiContext.dispose();
      }

      // Use API login to capture auth state
      await apiLoginAndCaptureState(
        page,
        instructorEmail,
        instructorPassword,
        'instructor',
        '/instructor-dashboard',
      );

      // Verify we're on the instructor dashboard
      await expect(page).toHaveURL(/\/(instructor-dashboard|practice)/, { timeout: 15_000 });

      await page.context().storageState({ path: INSTRUCTOR_AUTH_FILE });
      assertAuthCookieSaved(INSTRUCTOR_AUTH_FILE, 'instructor');
      console.log(`[auth-setup] Instructor auth state saved → ${INSTRUCTOR_AUTH_FILE}`);
      return;
    }

    // Local testing: use UI-based auth
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
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });
});
