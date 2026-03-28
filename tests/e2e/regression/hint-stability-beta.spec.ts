import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { replaceEditorText } from '../../helpers/test-helpers';
import { resolveApiBaseUrl } from '../helpers/auth-env';
import { sqlProblems } from '../../../apps/web/src/app/data/problems';

const API_BASE_URL = resolveApiBaseUrl();
const TARGET_PROBLEM_IDS = sqlProblems.slice(0, 10).map((problem) => problem.id);
const SQL_LEAK_REGEX = /\bselect\s+.+\s+from\s+.+/i;

type HintArtifact = {
  problemId: string;
  rung: 1 | 2 | 3;
  hintText: string;
  helpRequestIndex: number | null;
  retrievedSourceIds: string[];
  retrievedChunkIds: string[];
  fallbackReason: string | null;
  retrievalConfidence: number;
  safetyFilterApplied: boolean;
  relevancePass: boolean;
  nonLeakinessPass: boolean;
  escalationQualityPass: boolean;
  fallbackSafetyPass: boolean;
};

type AuthIdentity = {
  learnerId: string | null;
};

async function getAuthIdentity(page: import('@playwright/test').Page): Promise<AuthIdentity> {
  return page.evaluate(async ({ apiBaseUrl }) => {
    try {
      const response = await fetch(`${apiBaseUrl}/api/auth/me`, { credentials: 'include' });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.user?.learnerId) {
        return { learnerId: body.user.learnerId as string };
      }
    } catch {
      // Ignore and fall through.
    }
    return { learnerId: null };
  }, { apiBaseUrl: API_BASE_URL });
}

async function fetchHintEvents(
  page: import('@playwright/test').Page,
  learnerId: string,
  problemId: string,
): Promise<any[]> {
  return page.evaluate(async ({ apiBaseUrl, hydratedLearnerId, targetProblemId }) => {
    const response = await fetch(
      `${apiBaseUrl}/api/interactions?learnerId=${encodeURIComponent(hydratedLearnerId)}&limit=5000`,
      { credentials: 'include' },
    );
    const body = await response.json().catch(() => null);
    const events = Array.isArray(body?.data) ? body.data : [];
    return events
      .filter((event) => event?.eventType === 'hint_view' && event?.problemId === targetProblemId)
      .sort((a, b) => Number(a?.timestamp ?? 0) - Number(b?.timestamp ?? 0));
  }, { apiBaseUrl: API_BASE_URL, hydratedLearnerId: learnerId, targetProblemId: problemId });
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function evaluateHint({
  hintText,
  rung,
  previousHintText,
  fallbackReason,
}: {
  hintText: string;
  rung: 1 | 2 | 3;
  previousHintText?: string;
  fallbackReason: string | null;
}) {
  const normalized = hintText.trim();
  const relevancePass = normalized.length >= 20 && !/review your sql syntax/i.test(normalized);
  const nonLeakinessPass = !SQL_LEAK_REGEX.test(normalized) || normalized.includes('___');
  const escalationQualityPass = rung === 1
    ? true
    : Boolean(previousHintText && normalized !== previousHintText && normalized.length >= Math.floor(previousHintText.length * 0.8));
  const fallbackSafetyPass = fallbackReason
    ? normalized.length > 0 && nonLeakinessPass
    : true;

  return { relevancePass, nonLeakinessPass, escalationQualityPass, fallbackSafetyPass };
}

test.describe('@deployed-auth-smoke @hint-stability-beta live hint stability gate', () => {
  test('runs 30-case hint ladder gate and emits report artifacts', async ({ page }) => {
    await page.goto('/practice', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('button', { name: 'Run Query' }),
    ).toBeVisible({ timeout: 30_000 });

    const identity = await getAuthIdentity(page);
    if (!identity.learnerId) {
      test.skip();
      return;
    }

    const artifacts: HintArtifact[] = [];

    for (const problemId of TARGET_PROBLEM_IDS) {
      await page.goto(`/practice?problemId=${encodeURIComponent(problemId)}`, { waitUntil: 'domcontentloaded' });
      await expect(
        page.getByRole('button', { name: 'Run Query' }),
      ).toBeVisible({ timeout: 15_000 });

      await replaceEditorText(page, 'SELECT name FROM employees WHERE department = Engineering');
      await page.getByRole('button', { name: 'Run Query' }).click();

      let priorHintText = '';
      let priorCount = (await fetchHintEvents(page, identity.learnerId, problemId)).length;

      for (const rung of [1, 2, 3] as const) {
        const triggerButton = page
          .getByRole('button', { name: /Request Hint|Next Hint|Get More Help/i })
          .first();
        await expect(triggerButton).toBeVisible({ timeout: 15_000 });
        await triggerButton.click();

        let hintEvents: any[] = [];
        await expect.poll(async () => {
          hintEvents = await fetchHintEvents(page, identity.learnerId!, problemId);
          return hintEvents.length;
        }, {
          timeout: 30_000,
          intervals: [250, 500, 1000, 2000],
        }).toBeGreaterThan(priorCount);

        priorCount = hintEvents.length;
        const hintEvent = hintEvents[hintEvents.length - 1];

        const hintCard = page.getByTestId(`hint-card-${rung - 1}`);
        const hintText = (await hintCard.textContent())?.trim() || String(hintEvent?.hintText ?? '');
        const outputs = (hintEvent?.outputs && typeof hintEvent.outputs === 'object') ? hintEvent.outputs : {};
        const fallbackReason = typeof outputs.fallback_reason === 'string' ? outputs.fallback_reason : null;
        const retrievedSourceIds = asArray(outputs.retrieved_source_ids).length > 0
          ? asArray(outputs.retrieved_source_ids)
          : asArray(hintEvent?.retrievedSourceIds);
        const retrievedChunkIds = asArray(outputs.retrieved_chunk_ids);
        const retrievalConfidence = toNumber(outputs.retrieval_confidence, 0);
        const safetyFilterApplied = Boolean(outputs.safety_filter_applied);

        const evaluation = evaluateHint({
          hintText,
          rung,
          previousHintText: priorHintText || undefined,
          fallbackReason,
        });

        artifacts.push({
          problemId,
          rung,
          hintText,
          helpRequestIndex: typeof hintEvent?.helpRequestIndex === 'number' ? hintEvent.helpRequestIndex : null,
          retrievedSourceIds,
          retrievedChunkIds,
          fallbackReason,
          retrievalConfidence,
          safetyFilterApplied,
          ...evaluation,
        });
        priorHintText = hintText;
      }
    }

    expect(artifacts.length).toBe(30);

    const relevanceRate = artifacts.filter((item) => item.relevancePass).length / artifacts.length;
    const nonLeakinessRate = artifacts.filter((item) => item.nonLeakinessPass).length / artifacts.length;
    const escalationItems = artifacts.filter((item) => item.rung >= 2);
    const escalationRate = escalationItems.length
      ? escalationItems.filter((item) => item.escalationQualityPass).length / escalationItems.length
      : 1;
    const fallbackItems = artifacts.filter((item) => item.fallbackReason);
    const fallbackSafetyRate = fallbackItems.length
      ? fallbackItems.filter((item) => item.fallbackSafetyPass).length / fallbackItems.length
      : 1;

    const report = {
      generatedAt: new Date().toISOString(),
      apiBaseUrl: API_BASE_URL,
      learnerId: identity.learnerId,
      caseCount: artifacts.length,
      thresholds: {
        relevance: 0.8,
        nonLeakiness: 0.9,
        escalationQuality: 0.75,
        fallbackSafety: 1.0,
      },
      scores: {
        relevance: Number(relevanceRate.toFixed(4)),
        nonLeakiness: Number(nonLeakinessRate.toFixed(4)),
        escalationQuality: Number(escalationRate.toFixed(4)),
        fallbackSafety: Number(fallbackSafetyRate.toFixed(4)),
      },
      pass: (
        relevanceRate >= 0.8 &&
        nonLeakinessRate >= 0.9 &&
        escalationRate >= 0.75 &&
        fallbackSafetyRate >= 1
      ),
    };

    const scored = artifacts.map((artifact) => {
      const score =
        Number(artifact.relevancePass) +
        Number(artifact.nonLeakinessPass) +
        Number(artifact.escalationQualityPass) +
        Number(artifact.fallbackSafetyPass);
      return { score, artifact };
    });
    const goodExamples = scored
      .filter((entry) => entry.score >= 3)
      .slice(0, 10)
      .map((entry) => entry.artifact);
    const badExamples = scored
      .filter((entry) => entry.score < 3)
      .slice(0, 10)
      .map((entry) => entry.artifact);

    const runId = new Date().toISOString().replace(/[^\d]/g, '').slice(0, 14);
    const outputDir = path.resolve(process.cwd(), 'dist', 'beta', 'hint-stability', runId);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(path.join(outputDir, 'hint-stability-report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(outputDir, 'hint-stability-cases.json'), JSON.stringify(artifacts, null, 2));
    fs.writeFileSync(
      path.join(outputDir, 'hint-stability-good-bad.json'),
      JSON.stringify({ goodExamples, badExamples }, null, 2),
    );

    test.info().annotations.push({
      type: 'hint-stability-artifacts',
      description: outputDir,
    });

    expect(report.scores.relevance).toBeGreaterThanOrEqual(report.thresholds.relevance);
    expect(report.scores.nonLeakiness).toBeGreaterThanOrEqual(report.thresholds.nonLeakiness);
    expect(report.scores.escalationQuality).toBeGreaterThanOrEqual(report.thresholds.escalationQuality);
    expect(report.scores.fallbackSafety).toBeGreaterThanOrEqual(report.thresholds.fallbackSafety);
  });
});
