/**
 * @regression Hint no-op recovery in adaptive hint panel
 *
 * Covers the adaptive edge case where explanation-only history existed and the
 * primary hint action previously no-op'd into explanation mode with zero hint cards.
 *
 * How to run:
 *   npx playwright test -c playwright.config.ts --project=chromium tests/e2e/regression/2026-04-05-hint-noop-reset.spec.ts --reporter=line
 */

import { expect, Page, test } from '@playwright/test';

const LEARNER_ID = 'hint-noop-regression';
const CURRENT_SESSION_ID = `session-${LEARNER_ID}-current`;
const OTHER_SESSION_ID = `session-${LEARNER_ID}-stale`;
const TARGET_PROBLEM_ID = 'problem-14';

type SeedInteraction = Record<string, unknown>;

async function seedPracticeState(page: Page, interactions: SeedInteraction[]) {
  await page.addInitScript(
    ({
      learnerId,
      currentSessionId,
      interactionsSeed,
    }: {
      learnerId: string;
      currentSessionId: string;
      interactionsSeed: SeedInteraction[];
    }) => {
      const now = Date.now();

      window.localStorage.clear();
      window.sessionStorage.clear();
      window.localStorage.setItem('sql-adapt-welcome-seen', 'true');

      // Auth profile (StudentRoute access)
      window.localStorage.setItem('sql-adapt-user-profile', JSON.stringify({
        id: learnerId,
        name: 'Hint No-op Tester',
        role: 'student',
        createdAt: now,
      }));

      // Learning profile (HintSystem enablement)
      window.localStorage.setItem('sql-learning-profiles', JSON.stringify([{
        id: learnerId,
        name: 'Hint No-op Tester',
        conceptsCovered: [],
        conceptCoverageEvidence: [],
        errorHistory: [],
        interactionCount: 0,
        version: 1,
        currentStrategy: 'adaptive-medium',
        preferences: { escalationThreshold: 3, aggregationDelay: 300000 },
      }]));

      // Active session + deterministic adaptive condition
      window.localStorage.setItem('sql-learning-active-session', currentSessionId);
      window.localStorage.setItem('sql-adapt-session-config', JSON.stringify({
        sessionId: currentSessionId,
        learnerId,
        textbookDisabled: false,
        adaptiveLadderDisabled: false,
        immediateExplanationMode: false,
        staticHintMode: false,
        escalationPolicy: 'adaptive',
        conditionId: 'adaptive',
        createdAt: now,
      }));

      window.localStorage.setItem('sql-learning-interactions', JSON.stringify(interactionsSeed));
    },
    {
      learnerId: LEARNER_ID,
      currentSessionId: CURRENT_SESSION_ID,
      interactionsSeed: interactions,
    }
  );
}

async function getHelpCounts(page: Page, sessionId: string, problemId: string) {
  return page.evaluate(
    ({ sid, pid }) => {
      const raw = window.localStorage.getItem('sql-learning-interactions');
      const interactions = raw ? JSON.parse(raw) : [];
      const filtered = interactions.filter(
        (interaction: any) =>
          interaction.sessionId === sid && interaction.problemId === pid
      );
      const hintViews = filtered.filter((interaction: any) => interaction.eventType === 'hint_view');
      const explanationViews = filtered.filter((interaction: any) => interaction.eventType === 'explanation_view');
      return {
        hintViews,
        explanationViews,
      };
    },
    { sid: sessionId, pid: problemId }
  );
}

test.beforeEach(async ({ page }) => {
  // Stub LLM generation to keep hint creation deterministic and offline-safe.
  let hintRequestCount = 0;
  const getHintResponse = () => {
    hintRequestCount += 1;
    if (hintRequestCount === 1) return 'L1 regression hint.';
    if (hintRequestCount === 2) return 'L2 regression hint.';
    return 'L3 regression hint.';
  };

  await page.route('**/ollama/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: getHintResponse() }),
    });
  });

  await page.route('**/api/generate', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ response: getHintResponse() }),
    });
  });

  await page.route('**/ollama/api/tags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'qwen3:4b' }] }),
    });
  });

  await page.route('**/api/tags', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ models: [{ name: 'qwen3:4b' }] }),
    });
  });
});

test.describe('@regression adaptive hint panel no-op recovery', () => {
  test('explanation-only current session history resets to L1 hint and logs hint_view', async ({ page }) => {
    const now = Date.now();

    await seedPracticeState(page, [
      // Explanation-only seeded history in current session.
      {
        id: 'seed-exp-current',
        sessionId: CURRENT_SESSION_ID,
        learnerId: LEARNER_ID,
        timestamp: now - 1000 * 60 * 90,
        eventType: 'explanation_view',
        problemId: TARGET_PROBLEM_ID,
        explanationId: 'seeded-explanation',
        helpRequestIndex: 19,
        sqlEngageSubtype: 'incomplete query',
      },
      // Retry history that drives orchestrator to upsert_textbook_unit path.
      {
        id: 'seed-err-1',
        sessionId: CURRENT_SESSION_ID,
        learnerId: LEARNER_ID,
        timestamp: now - 1000 * 60 * 89,
        eventType: 'error',
        problemId: TARGET_PROBLEM_ID,
        errorSubtypeId: 'missing-from',
      },
      {
        id: 'seed-err-2',
        sessionId: CURRENT_SESSION_ID,
        learnerId: LEARNER_ID,
        timestamp: now - 1000 * 60 * 88,
        eventType: 'error',
        problemId: TARGET_PROBLEM_ID,
        errorSubtypeId: 'missing-from',
      },
      {
        id: 'seed-err-3',
        sessionId: CURRENT_SESSION_ID,
        learnerId: LEARNER_ID,
        timestamp: now - 1000 * 60 * 87,
        eventType: 'error',
        problemId: TARGET_PROBLEM_ID,
        errorSubtypeId: 'missing-from',
      },
      {
        id: 'seed-err-4',
        sessionId: CURRENT_SESSION_ID,
        learnerId: LEARNER_ID,
        timestamp: now - 1000 * 60 * 86,
        eventType: 'error',
        problemId: TARGET_PROBLEM_ID,
        errorSubtypeId: 'missing-from',
      },
    ]);

    await page.goto(`/practice?problemId=${TARGET_PROBLEM_ID}`);
    await expect(page).toHaveURL(/\/practice/);
    await expect(page.getByTestId('hint-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('hint-action-button')).toBeEnabled();
    await expect(page.getByTestId('hint-action-button')).toContainText('Request Hint');
    await expect(page.locator('[data-testid^="hint-card-"]')).toHaveCount(0);

    const before = await getHelpCounts(page, CURRENT_SESSION_ID, TARGET_PROBLEM_ID);
    expect(before.hintViews.length).toBe(0);
    expect(before.explanationViews.length).toBeGreaterThan(0);

    await page.getByTestId('hint-action-button').click();

    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 10_000 });
    await expect.poll(async () => page.locator('[data-testid^="hint-card-"]').count()).toBeGreaterThan(0);

    const after = await getHelpCounts(page, CURRENT_SESSION_ID, TARGET_PROBLEM_ID);
    expect(after.hintViews.length).toBeGreaterThan(before.hintViews.length);
    expect(after.explanationViews.length).toBe(before.explanationViews.length);

    const latestHint = after.hintViews[after.hintViews.length - 1];
    expect(latestHint.helpRequestIndex).toBe(1);
    expect(['upsert_textbook_unit', 'prompt_reflective_note']).toContain(
      latestHint.outputs?.orchestration_action
    );
  });

  test('stale different-session history does not inflate current session ladder', async ({ page }) => {
    const now = Date.now();

    await seedPracticeState(page, [
      // Stale history in another session should not affect current session reconstruction.
      {
        id: 'seed-exp-stale',
        sessionId: OTHER_SESSION_ID,
        learnerId: LEARNER_ID,
        timestamp: now - 1000 * 60 * 120,
        eventType: 'explanation_view',
        problemId: TARGET_PROBLEM_ID,
        explanationId: 'stale-explanation',
        helpRequestIndex: 22,
        sqlEngageSubtype: 'incomplete query',
      },
      {
        id: 'seed-hint-stale',
        sessionId: OTHER_SESSION_ID,
        learnerId: LEARNER_ID,
        timestamp: now - 1000 * 60 * 119,
        eventType: 'hint_view',
        problemId: TARGET_PROBLEM_ID,
        hintLevel: 3,
        helpRequestIndex: 21,
        hintText: 'Stale hint in old session',
      },
    ]);

    await page.goto(`/practice?problemId=${TARGET_PROBLEM_ID}`);
    await expect(page).toHaveURL(/\/practice/);
    await expect(page.getByTestId('hint-panel')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('hint-action-button')).toBeEnabled();
    await expect(page.getByTestId('hint-action-button')).toContainText('Request Hint');
    await expect(page.getByTestId('hint-action-button')).not.toContainText('Get More Help');

    const beforeCurrent = await getHelpCounts(page, CURRENT_SESSION_ID, TARGET_PROBLEM_ID);
    expect(beforeCurrent.hintViews.length).toBe(0);
    expect(beforeCurrent.explanationViews.length).toBe(0);

    await page.getByTestId('hint-action-button').click();
    await expect(page.getByTestId('hint-label-1')).toBeVisible({ timeout: 10_000 });

    const afterCurrent = await getHelpCounts(page, CURRENT_SESSION_ID, TARGET_PROBLEM_ID);
    expect(afterCurrent.hintViews.length).toBe(1);
    expect(afterCurrent.explanationViews.length).toBe(0);
    expect(afterCurrent.hintViews[0].helpRequestIndex).toBe(1);
    expect(afterCurrent.hintViews[0].outputs?.orchestration_action).toBe('stay_hint');
  });
});
