/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const queryMock = vi.fn();
vi.mock('../../../apps/server/node_modules/@neondatabase/serverless/index.mjs', () => ({
  neon: () => queryMock,
  neonConfig: {},
}));
vi.mock('../../../apps/server/src/db/env-resolver.js', () => ({
  resolveDbEnv: () => ({ url: 'postgresql://example.invalid/test', source: 'test' }),
}));

describe('Neon interaction field persistence', () => {
  beforeEach(() => queryMock.mockReset());

  it('writes all three fields and preserves zero execution time', async () => {
    queryMock.mockResolvedValue([]);
    const { createInteraction } = await import('../../../apps/server/src/db/neon');
    await createInteraction({
      id: 'event-1', learnerId: 'learner-1', sectionId: 'section-1',
      timestamp: '2026-01-01T00:00:00.000Z', eventType: 'execution',
      problemId: 'problem-1', payload: {
        conditionId: 'adaptive', executionTimeMs: 0, metadata: { source: 'test' },
      },
    });
    const [strings, ...values] = queryMock.mock.calls[0];
    const sql = strings.join('?');
    expect(sql).toContain('condition_id, execution_time_ms, metadata');
    expect(values.slice(9, 12)).toEqual(['adaptive', 0, '{"source":"test"}']);
    const columns = sql.match(/INSERT INTO interaction_events\s*\(([\s\S]*?)\)\s*VALUES/)![1]
      .split(',').map((column: string) => column.trim());
    expect(new Set(columns).size).toBe(columns.length);
    expect(columns).toHaveLength(values.length);
    expect(values[columns.indexOf('condition_id')]).toBe('adaptive');
    expect(values[columns.indexOf('execution_time_ms')]).toBe(0);
    expect(values[columns.indexOf('metadata')]).toBe('{"source":"test"}');
  });

  it('restores new fields and tolerates legacy rows without them', async () => {
    const { getInteractionById } = await import('../../../apps/server/src/db/neon');
    const row = { id: 'event-1', user_id: 'learner-1', session_id: 'session-1',
      timestamp: '2026-01-01T00:00:00.000Z', event_type: 'execution',
      problem_id: 'problem-1', reward_total: null, condition_id: 'adaptive',
      execution_time_ms: 0, metadata: '{"source":"test"}' };
    queryMock.mockResolvedValueOnce([row]);
    expect(await getInteractionById('event-1')).toMatchObject({
      conditionId: 'adaptive', executionTimeMs: 0, metadata: { source: 'test' },
    });
    queryMock.mockResolvedValueOnce([{ ...row, condition_id: null, execution_time_ms: null, metadata: null }]);
    expect(await getInteractionById('event-1')).toMatchObject({
      conditionId: undefined, executionTimeMs: undefined, metadata: undefined,
    });
  });
});
