/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../../apps/server/node_modules/@neondatabase/serverless/index.mjs', () => ({
  neon: () => queryMock, neonConfig: {},
}));
vi.mock('../../../apps/server/src/db/env-resolver.js', () => ({
  resolveDbEnv: () => ({ url: 'postgresql://example.invalid/test', source: 'test' }),
}));

describe('identified profile event delivery', () => {
  let row: Record<string, any>;
  let claims: Map<string, { problem_id: string; event_type: string }>;
  let failNextClaim: boolean;
  let conflicts: number;
  let failNextProgress: boolean;
  let progressCount: number;
  let progressClaims: Set<string>;
  beforeEach(() => {
    row = { learner_id: 'learner-1', name: 'Student', version: 1, interaction_count: 0,
      concept_coverage: '[]', concept_evidence: '{}', error_history: '{}' };
    claims = new Map();
    failNextClaim = false;
    conflicts = 0;
    failNextProgress = false;
    progressCount = 0;
    progressClaims = new Set();
    queryMock.mockReset().mockImplementation(async (parts: TemplateStringsArray, ...values: any[]) => {
      const sql = parts.join('?');
      if (sql.includes('INSERT INTO learner_profiles')) return [];
      if (!sql.includes('WITH eligible AS') && sql.includes('SET interaction_count = interaction_count + 1')) {
        row = { ...row, interaction_count: row.interaction_count + 1, version: row.version + 1 };
        return [];
      }
      if (sql.includes('SET error_history =')) {
        row = { ...row, error_history: values[0], concept_evidence: values[1],
          concept_coverage: values[2], version: row.version + 1 };
        return [];
      }
      if (sql.includes('WITH eligible AS')) {
        if (failNextClaim) { failNextClaim = false; throw new Error('injected write failure'); }
        const [, version, , eventId, problemId, eventType, , , errorHistory, , evidence, , coverage, versionDelta] = values;
        if (version !== row.version) { conflicts++; return []; }
        if (claims.has(eventId)) return [];
        claims.set(eventId, { problem_id: problemId, event_type: eventType });
        row = { ...row, interaction_count: row.interaction_count + 1, version: row.version + versionDelta,
          error_history: errorHistory, concept_evidence: evidence, concept_coverage: coverage };
        return [{ learner_id: 'learner-1' }];
      }
      if (sql.includes('FROM learner_profile_events')) return claims.has(values[1]) ? [claims.get(values[1])] : [];
      if (sql.includes('WITH claimed AS') && sql.includes('problem_progress_events')) {
        if (failNextProgress) { failNextProgress = false; throw new Error('progress failure'); }
        if (progressClaims.has(values[0])) return [];
        progressClaims.add(values[0]);
        progressCount++;
        return [{ user_id: 'learner-1' }];
      }
      if (sql.includes('FROM problem_progress_events')) return [{ user_id: 'learner-1', problem_id: 'problem-1' }];
      if (sql.includes('attempted_problem_count')) return [{ attempted_problem_count: 0 }];
      if (sql.includes('SELECT * FROM learner_profiles')) return [{ ...row }];
      if (sql.includes('FROM problem_progress')) return [];
      throw new Error(`Unexpected SQL: ${sql}`);
    });
  });

  const event = { eventId: 'hint-1', learnerId: 'learner-1', timestamp: '2026-01-01T00:00:00Z',
    eventType: 'hint_view' as const, problemId: 'problem-1', conceptIds: ['select-basic'] };

  it('counts the same event once after a retry', async () => {
    const { updateLearnerProfileFromEvent } = await import('../../../apps/server/src/db/neon');
    await updateLearnerProfileFromEvent('learner-1', event);
    const profile = await updateLearnerProfileFromEvent('learner-1', event);
    expect(profile?.interactionCount).toBe(1);
    expect(profile?.conceptCoverageEvidence['select-basic'].evidenceCounts.hintViewed).toBe(1);
  });

  it('rejects reuse of an event ID for a different problem or event type', async () => {
    const { updateLearnerProfileFromEvent } = await import('../../../apps/server/src/db/neon');
    await updateLearnerProfileFromEvent('learner-1', event);
    await expect(updateLearnerProfileFromEvent('learner-1', { ...event, problemId: 'problem-2' }))
      .rejects.toThrow('different event');
    expect(row.interaction_count).toBe(1);
  });

  it('preserves legacy behavior for callers that do not provide an event ID', async () => {
    const { updateLearnerProfileFromEvent } = await import('../../../apps/server/src/db/neon');
    const { eventId: _unused, ...legacyEvent } = event;
    await updateLearnerProfileFromEvent('learner-1', legacyEvent);
    await updateLearnerProfileFromEvent('learner-1', legacyEvent);
    expect(row.interaction_count).toBe(2);
    expect(JSON.parse(row.concept_evidence)['select-basic'].evidenceCounts.hintViewed).toBe(2);
  });

  it('retries a concurrent version conflict without dropping distinct evidence', async () => {
    const { updateLearnerProfileFromEvent } = await import('../../../apps/server/src/db/neon');
    await Promise.all([
      updateLearnerProfileFromEvent('learner-1', event),
      updateLearnerProfileFromEvent('learner-1', { ...event, eventId: 'hint-2' }),
    ]);
    expect(conflicts).toBeGreaterThan(0);
    expect(row.interaction_count).toBe(2);
    expect(JSON.parse(row.concept_evidence)['select-basic'].evidenceCounts.hintViewed).toBe(2);
  });

  it('does not consume an ID on a failed write and permits a later retry', async () => {
    const { updateLearnerProfileFromEvent } = await import('../../../apps/server/src/db/neon');
    failNextClaim = true;
    await expect(updateLearnerProfileFromEvent('learner-1', event)).rejects.toThrow('injected write failure');
    expect(claims.size).toBe(0);
    await updateLearnerProfileFromEvent('learner-1', event);
    expect(row.interaction_count).toBe(1);
  });

  it('retries failed progress without counting the same profile event twice', async () => {
    const { updateLearnerProfileFromEvent } = await import('../../../apps/server/src/db/neon');
    const execution = { ...event, eventId: 'exec-1', eventType: 'execution' as const, successful: true };
    failNextProgress = true;
    await expect(updateLearnerProfileFromEvent('learner-1', execution)).rejects.toThrow('progress failure');
    expect(row.interaction_count).toBe(1);
    await updateLearnerProfileFromEvent('learner-1', execution);
    expect(row.interaction_count).toBe(1);
    expect(progressCount).toBe(1);
    expect(JSON.parse(row.concept_evidence)['select-basic'].evidenceCounts.successfulExecution).toBe(1);
  });
});
