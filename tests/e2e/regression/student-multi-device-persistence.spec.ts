import { expect, test } from '@playwright/test';
import { replaceEditorText, getTextbookUnits } from '../../helpers/test-helpers';

async function login(page: import('@playwright/test').Page, email: string, password: string): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login-email')).toBeVisible({ timeout: 10000 });
  await page.fill('#login-email', email);
  await page.fill('#login-password', password);
  await page.getByRole('button', { name: /^Sign In$/i }).click();
  await page.waitForURL(/\/(practice|instructor-dashboard)/, { timeout: 20000 });
}

async function signupOrLoginStudent(
  page: import('@playwright/test').Page,
  params: { name: string; email: string; password: string; classCode: string }
): Promise<void> {
  await page.goto('/auth', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Create Account/i }).first().click();
  await expect(page.locator('#signup-name')).toBeVisible({ timeout: 10000 });
  await page.fill('#signup-name', params.name);
  await page.fill('#signup-email', params.email);
  await page.fill('#signup-password', params.password);
  await page.locator('button[type="button"]').filter({ hasText: /^Student$/i }).click();
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

    const activeEmail = await page.evaluate(async () => {
      try {
        const response = await fetch('/api/auth/me', { credentials: 'include' });
        if (!response.ok) return null;
        const body = await response.json();
        return body?.user?.email ?? null;
      } catch {
        return null;
      }
    });
    if (activeEmail) {
      email = activeEmail;
    }

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
    const learnerId = await page.evaluate(() => {
      const raw = window.localStorage.getItem('sql-adapt-user-profile');
      return raw ? JSON.parse(raw).id : null;
    });
    expect(learnerId).toBeTruthy();
    const beforeUnits = await getTextbookUnits(page, learnerId!);
    expect(beforeUnits.length).toBeGreaterThan(0);

    const sessionSeed = {
      currentProblemId: 'problem-2',
      currentCode: 'SELECT * FROM employees WHERE salary > 70000',
      guidanceState: { rung: 2, source: 'e2e-session-seed' },
      hdiState: { hdi: 0.42, level: 'medium' },
      banditState: { selectedArm: 'adaptive-low' },
      lastActivity: new Date().toISOString(),
    };

    const sessionWrite = await page.evaluate(
      async ({ seededLearnerId, payload }) => {
        const csrfToken = document.cookie
          .split('; ')
          .find((entry) => entry.startsWith('sql_adapt_csrf='))
          ?.split('=')[1];
        const response = await fetch(`/api/sessions/${seededLearnerId}/active`, {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': csrfToken || '',
          },
          body: JSON.stringify(payload),
        });
        const body = await response.json().catch(() => null);
        return { ok: response.ok, status: response.status, body };
      },
      { seededLearnerId: learnerId!, payload: sessionSeed }
    );
    expect(sessionWrite.ok).toBeTruthy();

    const clean = await browser.newContext();
    const second = await clean.newPage();
    try {
      await login(second, email, password);
      await second.goto('/textbook');
      await expect(second).toHaveURL(/\/textbook/);

      const secondLearnerId = await second.evaluate(() => {
        const raw = window.localStorage.getItem('sql-adapt-user-profile');
        return raw ? JSON.parse(raw).id : null;
      });
      expect(secondLearnerId).toBe(learnerId);
      const afterUnits = await getTextbookUnits(second, secondLearnerId!);
      expect(afterUnits.length).toBeGreaterThan(0);

      const resumedSession = await second.evaluate(async (hydratedLearnerId) => {
        const response = await fetch(`/api/sessions/${hydratedLearnerId}/active`, {
          credentials: 'include',
        });
        const body = await response.json().catch(() => null);
        return { ok: response.ok, body };
      }, secondLearnerId!);
      expect(resumedSession.ok).toBeTruthy();
      expect(resumedSession.body?.data?.currentCode).toBe(sessionSeed.currentCode);
      expect(resumedSession.body?.data?.guidanceState?.source).toBe('e2e-session-seed');

      const interactionRead = await second.evaluate(async (hydratedLearnerId) => {
        const response = await fetch(`/api/interactions?learnerId=${hydratedLearnerId}`, {
          credentials: 'include',
        });
        const body = await response.json().catch(() => null);
        return { ok: response.ok, count: Array.isArray(body?.data) ? body.data.length : 0 };
      }, secondLearnerId!);
      expect(interactionRead.ok).toBeTruthy();
      expect(interactionRead.count).toBeGreaterThan(0);

      await second.goto('/practice');
      await expect(second.getByRole('button', { name: 'Run Query' })).toBeVisible({ timeout: 15000 });
    } finally {
      await clean.close();
    }
  });
});
