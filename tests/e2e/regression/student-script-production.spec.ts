/**
 * @deployed-auth-smoke @student-script-production
 *
 * Production walkthrough regression for the supervised student script:
 * - wrong attempt -> hints (L1 then L2) -> Save to Notes -> My Textbook
 * - return to practice -> attempt next problem
 * - refresh once -> in-progress editor work is still present
 *
 * Includes local + backend interaction assertions for:
 * - error
 * - guidance_request
 * - hint_view (help_request_index progression)
 * - textbook_add|textbook_update|textbook_unit_upsert
 */

import { expect, test } from '@playwright/test';
import fs from 'fs';
import { getEditorText, replaceEditorText } from '../../helpers/test-helpers';
import { STUDENT_AUTH_FILE } from '../helpers/auth-state-paths';
import { resolveApiBaseUrl } from '../helpers/auth-env';

const API_BASE_URL = resolveApiBaseUrl();

type AuthIdentity = {
  email: string | null;
  learnerId: string | null;
};

type InteractionLike = {
  eventType?: string;
  sessionId?: string | null;
  problemId?: string | null;
  timestamp?: number | string;
  helpRequestIndex?: number | null;
  payload?: Record<string, unknown> | null;
};

let _authAvailable: boolean | null = null;

function toEpochMs(timestamp: number | string | undefined): number {
  if (typeof timestamp === 'number' && Number.isFinite(timestamp)) {
    return timestamp;
  }
  if (typeof timestamp === 'string' && timestamp.trim().length > 0) {
    const parsed = Date.parse(timestamp);
    if (Number.isFinite(parsed)) return parsed;
    const numeric = Number(timestamp);
    if (Number.isFinite(numeric)) return numeric;
  }
  return 0;
}

function getHelpRequestIndex(interaction: InteractionLike): number | null {
  if (typeof interaction.helpRequestIndex === 'number' && Number.isFinite(interaction.helpRequestIndex)) {
    return interaction.helpRequestIndex;
  }
  const payload = interaction.payload && typeof interaction.payload === 'object'
    ? interaction.payload
    : null;
  const value = payload?.helpRequestIndex;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function scopeFlowEvents(
  interactions: InteractionLike[],
  sessionId: string,
  problemId: string,
  sinceMs: number,
): InteractionLike[] {
  return interactions.filter(
    (interaction) =>
      interaction.sessionId === sessionId &&
      interaction.problemId === problemId &&
      toEpochMs(interaction.timestamp) >= sinceMs,
  );
}

async function authIsAvailable(): Promise<boolean> {
  if (_authAvailable !== null) return _authAvailable;
  try {
    if (!fs.existsSync(STUDENT_AUTH_FILE)) {
      _authAvailable = false;
      return false;
    }
    const state = JSON.parse(fs.readFileSync(STUDENT_AUTH_FILE, 'utf-8'));
    _authAvailable = Array.isArray(state.cookies) && state.cookies.length > 0;
  } catch {
    _authAvailable = false;
  }
  return _authAvailable;
}

async function getAuthIdentity(page: import('@playwright/test').Page): Promise<AuthIdentity> {
  return page.evaluate(async ({ apiBaseUrl }) => {
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
      // Fallback to local profile below.
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
  }, { apiBaseUrl: API_BASE_URL });
}

async function getLocalInteractions(page: import('@playwright/test').Page): Promise<InteractionLike[]> {
  return page.evaluate(() => {
    const raw = window.localStorage.getItem('sql-learning-interactions');
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  });
}

async function getBackendInteractions(
  page: import('@playwright/test').Page,
  learnerId: string,
): Promise<InteractionLike[]> {
  return page.evaluate(async ({ apiBaseUrl, hydratedLearnerId }) => {
    try {
      const response = await fetch(
        `${apiBaseUrl}/api/interactions?learnerId=${encodeURIComponent(hydratedLearnerId)}`,
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

test.describe('@deployed-auth-smoke production student walkthrough', () => {
  let skipAll = false;

  test.beforeAll(async () => {
    skipAll = !(await authIsAvailable());
    if (skipAll) {
      console.warn('[student-script-production] No JWT cookie in student auth state — skipping.');
    }
  });

  test.beforeEach(async ({}, testInfo) => {
    if (skipAll) testInfo.skip();
  });

  test('full walkthrough and post-refresh continuity', async ({ page }) => {
    const flowStartedAt = Date.now();

    await page.goto('/practice');
    await expect.poll(
      async () => page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false),
      { timeout: 30_000, intervals: [500] },
    ).toBe(true);

    const activeSessionId = await page.evaluate(() => window.localStorage.getItem('sql-learning-active-session'));
    expect(activeSessionId).toBeTruthy();
    const sessionId = activeSessionId as string;

    const initialProblemLabel = (await page.getByTestId('problem-select-trigger').innerText()).trim();

    // Step 1: Wrong attempt with visible feedback.
    await replaceEditorText(page, "SELECT product FROM orders WHERE amount >");
    await page.getByRole('button', { name: 'Run Query' }).click();
    const errorBanner = page.getByTestId('sql-error-alert').first();
    await expect(errorBanner).toBeVisible({ timeout: 10_000 });

    const localAfterError = await getLocalInteractions(page);
    const firstError = [...localAfterError]
      .reverse()
      .find(
        (event) =>
          event.eventType === 'error' &&
          event.sessionId === sessionId &&
          toEpochMs(event.timestamp) >= flowStartedAt,
      );
    expect(firstError).toBeTruthy();
    expect(firstError?.problemId).toBeTruthy();
    const firstProblemId = firstError?.problemId as string;

    // Step 2: First help request, then retry.
    const helpButton = page.getByTestId('hint-action-button');
    await expect(helpButton).toBeEnabled({ timeout: 10_000 });
    await helpButton.click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 15_000 });

    await replaceEditorText(page, "SELECT product FROM orders WHERE amount > 'abc'");
    await page.getByRole('button', { name: 'Run Query' }).click();
    await expect(errorBanner).toBeVisible({ timeout: 10_000 });

    // Step 3: Second help request should advance ladder.
    await expect(helpButton).toBeEnabled({ timeout: 10_000 });
    await helpButton.click();
    await expect.poll(
      async () => {
        const secondHintVisible = await page.getByTestId('hint-label-2').isVisible().catch(() => false);
        const explanationVisible = await page
          .locator('text=/Full Explanation Unlocked|Explanation has been generated/i')
          .first()
          .isVisible()
          .catch(() => false);
        return secondHintVisible || explanationVisible;
      },
      { timeout: 15_000, intervals: [300, 700, 1200] },
    ).toBe(true);

    // Step 4: Save to Notes and verify textbook visibility.
    const saveButton = page.getByRole('button', { name: /Save to Notes/i }).first();
    await expect(saveButton).toBeEnabled({ timeout: 15_000 });
    await saveButton.click();
    await expect(
      page.locator('text=/Saved.*My Textbook|Updated.*My Textbook/i').first(),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole('link', { name: 'My Textbook' }).first().click();
    await expect(page).toHaveURL(/\/textbook/, { timeout: 10_000 });

    const identity = await getAuthIdentity(page);
    expect(identity.learnerId).toBeTruthy();
    const learnerId = identity.learnerId as string;

    await expect.poll(
      async () => (await getBackendTextbookUnits(page, learnerId)).length,
      { timeout: 45_000, intervals: [500, 1000, 2000] },
    ).toBeGreaterThan(0);

    // Step 5: Explicit flow event checks (local interaction trace).
    await expect.poll(
      async () => {
        const events = scopeFlowEvents(await getLocalInteractions(page), sessionId, firstProblemId, flowStartedAt);
        const hintViews = events.filter((event) => event.eventType === 'hint_view');
        const helpIndexes = hintViews
          .map((event) => getHelpRequestIndex(event))
          .filter((value): value is number => typeof value === 'number');
        const explanationViews = events.filter((event) => event.eventType === 'explanation_view').length;
        const textbookEvents = events.filter((event) =>
          event.eventType === 'textbook_add' ||
          event.eventType === 'textbook_update' ||
          event.eventType === 'textbook_unit_upsert',
        );
        return (
          events.some((event) => event.eventType === 'error') &&
          events.filter((event) => event.eventType === 'guidance_request').length >= 2 &&
          helpIndexes.includes(1) &&
          (helpIndexes.some((idx) => idx >= 2) || explanationViews > 0) &&
          textbookEvents.length > 0
        );
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    ).toBe(true);

    // Step 6: Same event-sequence checks against backend interactions.
    await expect.poll(
      async () => {
        const events = scopeFlowEvents(await getBackendInteractions(page, learnerId), sessionId, firstProblemId, flowStartedAt);
        const hintViews = events.filter((event) => event.eventType === 'hint_view');
        const helpIndexes = hintViews
          .map((event) => getHelpRequestIndex(event))
          .filter((value): value is number => typeof value === 'number');
        const explanationViews = events.filter((event) => event.eventType === 'explanation_view').length;
        const guidanceRequests = events.filter((event) => event.eventType === 'guidance_request').length;
        const explanationIndexes = events
          .filter((event) => event.eventType === 'explanation_view')
          .map((event) => getHelpRequestIndex(event))
          .filter((value): value is number => typeof value === 'number');
        const textbookEvents = events.filter((event) =>
          event.eventType === 'textbook_add' ||
          event.eventType === 'textbook_update' ||
          event.eventType === 'textbook_unit_upsert',
        );
        const hasHelpSignal = guidanceRequests > 0 || hintViews.length > 0 || explanationViews > 0;
        const hasHelpIndexEvidence = helpIndexes.some((idx) => idx >= 1) || explanationIndexes.some((idx) => idx >= 1);
        return (
          events.some((event) => event.eventType === 'error') &&
          hasHelpSignal &&
          hasHelpIndexEvidence &&
          textbookEvents.length > 0
        );
      },
      { timeout: 60_000, intervals: [1000, 2000, 4000] },
    ).toBe(true);

    // Step 7: Return to Practice and attempt one more problem.
    await page.getByRole('link', { name: 'Practice' }).first().click();
    await expect(page).toHaveURL(/\/practice/, { timeout: 10_000 });

    const nextProblemButton = page.getByRole('button', { name: /Next problem/i });
    await expect(nextProblemButton).toBeEnabled({ timeout: 10_000 });
    await nextProblemButton.click();

    await expect.poll(
      async () => {
        const current = (await page.getByTestId('problem-select-trigger').innerText()).trim();
        return current !== initialProblemLabel;
      },
      { timeout: 10_000, intervals: [200, 500] },
    ).toBe(true);

    const secondProblemStartedAt = Date.now();
    await replaceEditorText(page, 'SELECT * FROM users');
    await page.getByRole('button', { name: 'Run Query' }).click();

    await expect.poll(
      async () => {
        const events = await getLocalInteractions(page);
        return events.some(
          (event) =>
            event.sessionId === sessionId &&
            (event.eventType === 'execution' || event.eventType === 'error') &&
            toEpochMs(event.timestamp) >= secondProblemStartedAt,
        );
      },
      { timeout: 20_000, intervals: [500, 1000] },
    ).toBe(true);

    // Step 8: Refresh once and confirm current in-progress work persists.
    const continuityDraft = 'SELECT city FROM users ORDER BY city';
    await replaceEditorText(page, continuityDraft);
    await page.waitForTimeout(500);
    const beforeRefreshEditor = await getEditorText(page);
    expect(beforeRefreshEditor).toContain(continuityDraft);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect.poll(
      async () => page.getByRole('button', { name: 'Run Query' }).isEnabled().catch(() => false),
      { timeout: 30_000, intervals: [500] },
    ).toBe(true);

    const afterRefreshEditor = await getEditorText(page);
    expect(afterRefreshEditor).toContain(continuityDraft);

    const sessionIdAfterRefresh = await page.evaluate(() => window.localStorage.getItem('sql-learning-active-session'));
    expect(sessionIdAfterRefresh).toBeTruthy();
  });
});
