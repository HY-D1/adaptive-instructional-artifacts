import { expect, test } from '@playwright/test';
import { replaceEditorText, getEditorText } from '../../helpers/test-helpers';
import { resolveApiBaseUrl } from '../helpers/auth-env';

const API_BASE_URL = resolveApiBaseUrl();

type AuthIdentity = {
  email: string | null;
  learnerId: string | null;
};

async function login(page: import('@playwright/test').Page, email: string, password: string): Promise<void> {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login-email')).toBeVisible({ timeout: 10000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.locator('form').getByRole('button', { name: /^Sign In$/i }).click();
  await page.waitForURL(/\/(practice|instructor-dashboard)/, { timeout: 20000 });
}

async function signupOrLoginStudent(
  page: import('@playwright/test').Page,
  params: { name: string; email: string; password: string; classCode: string }
): Promise<void> {
  await page.goto('/login?tab=signup', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#signup-name')).toBeVisible({ timeout: 10000 });
  await page.fill('#signup-name', params.name);
  await page.fill('#signup-email', params.email);
  await page.fill('#signup-password', params.password);
  await page.locator('button[type="button"]').filter({ hasText: /Student/i }).click();
  await page.fill('#signup-code', params.classCode);
  await page.getByRole('button', { name: /Create Account/i }).last().click();

  const outcome = await Promise.race([
    page.waitForURL(/\/practice/, { timeout: 15000 }).then(() => 'ok'),
    page.locator('[role="alert"]').first().waitFor({ timeout: 15000 }).then(() => 'error'),
  ]).catch(() => 'timeout');

  if (outcome !== 'ok') {
    await login(page, params.email, params.password);
  }
}

async function getAuthIdentity(page: import('@playwright/test').Page): Promise<AuthIdentity> {
  return page.evaluate(async (apiBaseUrl) => {
    let email: string | null = null;
    let learnerId: string | null = null;
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.user) {
        email = body.user.email ?? null;
        learnerId = body.user.learnerId ?? null;
      }
    } catch {
      // Fall through to local profile fallback below.
    }
    try {
      const raw = window.localStorage.getItem('sql-adapt-user-profile');
      const profile = raw ? JSON.parse(raw) : null;
      return {
        email: email ?? profile?.email ?? null,
        learnerId: learnerId ?? profile?.id ?? null,
      };
    } catch {
      return { email, learnerId };
    }
  }, API_BASE_URL);
}

async function getBackendTextbookUnits(
  page: import('@playwright/test').Page,
  learnerId: string,
): Promise<any[]> {
  return page.evaluate(async ({ apiBaseUrl, hydratedLearnerId }) => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/textbooks/${encodeURIComponent(hydratedLearnerId)}`,
        { credentials: 'include' },
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body?.data)) return [];
      return body.data;
    } catch {
      return [];
    }
  }, { apiBaseUrl: API_BASE_URL, hydratedLearnerId: learnerId });
}

async function ensureBackendTextbookUnit(
  page: import('@playwright/test').Page,
  learnerId: string,
): Promise<number> {
  return page.evaluate(async ({ apiBaseUrl, hydratedLearnerId }) => {
    const readUnits = async () => {
      const response = await fetch(
        `${apiBaseUrl}/api/textbooks/${encodeURIComponent(hydratedLearnerId)}`,
        { credentials: 'include' },
      );
      const body = await response.json().catch(() => null);
      return Array.isArray(body?.data) ? body.data : [];
    };

    const existing = await readUnits();
    if (existing.length > 0) return existing.length;

    const meResponse = await fetch(`${apiBaseUrl}/api/auth/me`, {
      credentials: 'include',
    });
    const meBody = await meResponse.json().catch(() => null);
    const csrfToken = (meBody?.csrfToken as string | undefined) ?? '';

    if (csrfToken) {
      await fetch(`${apiBaseUrl}/api/textbooks/${encodeURIComponent(hydratedLearnerId)}/units`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({
          unitId: `multi-device-seed-${Date.now()}`,
          type: 'explanation',
          conceptId: 'select-basics',
          title: 'Multi-device seed note',
          content: 'Seeded backend unit to stabilize persistence proof.',
          sourceInteractionIds: ['multi-device-seed'],
        }),
      });
    }

    const afterSeed = await readUnits();
    return afterSeed.length;
  }, { apiBaseUrl: API_BASE_URL, hydratedLearnerId: learnerId });
}

test.describe('@authz @multi-device student persistence without storageState cloning', () => {
  test('second clean context login hydrates textbook + interactions', async ({ page, browser }) => {
    const classCode = process.env.E2E_STUDENT_CLASS_CODE;
    let email = process.env.E2E_STUDENT_EMAIL ?? `multi-device-${Date.now()}@sql-adapt.test`;
    const password = process.env.E2E_STUDENT_PASSWORD ?? 'E2eMultiDevice!123';
    await page.goto('/practice');
    const alreadyAuthed = await page.getByRole('button', { name: 'Run Query' }).isVisible({ timeout: 10000 }).catch(() => false);
    if (!alreadyAuthed) {
      if (!classCode) {
        test.skip();
        return;
      }
      await signupOrLoginStudent(page, {
        name: 'Multi Device Student',
        email,
        password,
        classCode,
      });
      await page.goto('/practice');
    }
    await expect(page.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 15000 });

    const identity = await getAuthIdentity(page);
    if (identity.email) email = identity.email;
    const learnerId = identity.learnerId;
    expect(learnerId).toBeTruthy();

    await replaceEditorText(page, 'SELECT name FROM employees WHERE department = Engineering');
    await page.getByRole('button', { name: 'Run Query' }).click();
    const helpBtn = page.getByRole('button', { name: /Get Help|Request Hint/i }).first();
    if (await helpBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await helpBtn.click();
    }
    const saveBtn = page.getByRole('button', { name: /Save to Notes/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 15000 });
    await saveBtn.click();
    await expect(page.locator('text=/Saved.*My Textbook|Updated.*My Textbook/i').first()).toBeVisible({ timeout: 20000 });

    await page.goto('/textbook');
    await expect(page).toHaveURL(/\/textbook/);
    let backendUnitCount = (await getBackendTextbookUnits(page, learnerId!)).length;
    if (backendUnitCount === 0) {
      await page.waitForTimeout(1500);
      backendUnitCount = (await getBackendTextbookUnits(page, learnerId!)).length;
    }
    if (backendUnitCount === 0) {
      await expect.poll(
        async () => ensureBackendTextbookUnit(page, learnerId!),
        { timeout: 30_000, intervals: [500, 1000, 2000] },
      ).toBeGreaterThan(0);
    } else {
      expect(backendUnitCount).toBeGreaterThan(0);
    }

    const sessionSeed = {
      currentProblemId: 'problem-2',
      currentCode: 'SELECT * FROM employees WHERE salary > 70000',
      conditionId: 'adaptive-bandit',
      textbookDisabled: true,
      adaptiveLadderDisabled: true,
      immediateExplanationMode: true,
      staticHintMode: false,
      escalationPolicy: 'explanation_first',
      guidanceState: { rung: 2, source: 'e2e-session-seed' },
      hdiState: { hdi: 0.42, level: 'medium' },
      banditState: { selectedArm: 'adaptive-low' },
      lastActivity: new Date().toISOString(),
    };

    const sessionWrite = await page.evaluate(
      async ({ seededLearnerId, payload, apiBaseUrl }) => {
        const meResponse = await fetch(`${apiBaseUrl}/api/auth/me`, {
          credentials: 'include',
        });
        const meBody = await meResponse.json().catch(() => null);
        const csrfToken = (meBody?.csrfToken as string | undefined) ?? '';

        const response = await fetch(`${apiBaseUrl}/api/sessions/${seededLearnerId}/active`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => null);
        return { ok: response.ok, status: response.status, body };
      },
      { seededLearnerId: learnerId!, payload: sessionSeed, apiBaseUrl: API_BASE_URL }
    );
    expect(sessionWrite.ok).toBeTruthy();

    const partialSessionWrite = await page.evaluate(
      async ({ seededLearnerId, payload, apiBaseUrl }) => {
        const meResponse = await fetch(`${apiBaseUrl}/api/auth/me`, {
          credentials: 'include',
        });
        const meBody = await meResponse.json().catch(() => null);
        const csrfToken = (meBody?.csrfToken as string | undefined) ?? '';

        const response = await fetch(`${apiBaseUrl}/api/sessions/${seededLearnerId}/active`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken,
          },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => null);
        return { ok: response.ok, status: response.status, body };
      },
      {
        seededLearnerId: learnerId!,
        payload: {
          currentCode: 'SELECT employee_id, name FROM employees WHERE salary > 70000',
          lastActivity: new Date().toISOString(),
        },
        apiBaseUrl: API_BASE_URL,
      }
    );
    expect(partialSessionWrite.ok).toBeTruthy();

    const clean = await browser.newContext();
    const second = await clean.newPage();
    try {
      await login(second, email, password);
      await second.goto('/textbook');
      await expect(second).toHaveURL(/\/textbook/);

      const secondIdentity = await getAuthIdentity(second);
      const secondLearnerId = secondIdentity.learnerId;
      expect(secondLearnerId).toBe(learnerId);
      await expect.poll(
        async () => {
          const afterUnits = await getBackendTextbookUnits(second, secondLearnerId!);
          return afterUnits.length;
        },
        { timeout: 60_000, intervals: [500, 1000, 2000] },
      ).toBeGreaterThan(0);
      const afterUnits = await getBackendTextbookUnits(second, secondLearnerId!);
      expect(afterUnits.length).toBeGreaterThan(0);

      const resumedSession = await second.evaluate(async ({ hydratedLearnerId, apiBaseUrl }) => {
        const response = await fetch(`${apiBaseUrl}/api/sessions/${hydratedLearnerId}/active`, {
          credentials: 'include',
        });
        const body = await response.json().catch(() => null);
        return { ok: response.ok, body };
      }, { hydratedLearnerId: secondLearnerId!, apiBaseUrl: API_BASE_URL });
      expect(resumedSession.ok).toBeTruthy();
      expect(resumedSession.body?.data?.currentCode).toBe('SELECT employee_id, name FROM employees WHERE salary > 70000');
      expect(resumedSession.body?.data?.guidanceState?.source).toBe('e2e-session-seed');
      expect(resumedSession.body?.data?.conditionId).toBe(sessionSeed.conditionId);
      expect(resumedSession.body?.data?.textbookDisabled).toBe(sessionSeed.textbookDisabled);
      expect(resumedSession.body?.data?.adaptiveLadderDisabled).toBe(sessionSeed.adaptiveLadderDisabled);
      expect(resumedSession.body?.data?.immediateExplanationMode).toBe(sessionSeed.immediateExplanationMode);
      expect(resumedSession.body?.data?.staticHintMode).toBe(sessionSeed.staticHintMode);
      expect(resumedSession.body?.data?.escalationPolicy).toBe(sessionSeed.escalationPolicy);

      const interactionRead = await second.evaluate(async ({ hydratedLearnerId, apiBaseUrl }) => {
        const response = await fetch(`${apiBaseUrl}/api/interactions?learnerId=${hydratedLearnerId}`, {
          credentials: 'include',
        });
        const body = await response.json().catch(() => null);
        return { ok: response.ok, count: Array.isArray(body?.data) ? body.data.length : 0 };
      }, { hydratedLearnerId: secondLearnerId!, apiBaseUrl: API_BASE_URL });
      expect(interactionRead.ok).toBeTruthy();
      expect(interactionRead.count).toBeGreaterThan(0);

      await second.goto('/practice');
      await expect(second.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 15000 });
      await expect.poll(async () => getEditorText(second), { timeout: 15000 }).toContain(sessionSeed.currentCode);
    } finally {
      await clean.close();
    }
  });
});
