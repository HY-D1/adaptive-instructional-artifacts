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

describe('Neon progress event claims', () => {
  beforeEach(() => queryMock.mockReset());

  it('claims an event and updates progress in the same SQL statement', async () => {
    queryMock.mockResolvedValueOnce([{ user_id: 'learner-1' }]);
    const { updateProblemProgress } = await import('../../../apps/server/src/db/neon');
    await updateProblemProgress('learner-1', 'problem-1', {
      eventId: 'event-1', incrementAttempts: true, solved: true, lastCode: 'SELECT 1',
    });
    expect(queryMock).toHaveBeenCalledTimes(1);
    const [parts, ...values] = queryMock.mock.calls[0];
    const sql = parts.join('?');
    expect(sql).toContain('WITH claimed AS');
    expect(sql).toContain('INSERT INTO problem_progress_events');
    expect(sql).toContain('FROM claimed');
    expect(values).toEqual(expect.arrayContaining(['event-1', 'learner-1', 'problem-1', 'SELECT 1', true]));
  });

  it('accepts a matching duplicate and rejects an ID reused for another problem', async () => {
    const { updateProblemProgress } = await import('../../../apps/server/src/db/neon');
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ user_id: 'learner-1', problem_id: 'problem-1' }]);
    await expect(updateProblemProgress('learner-1', 'problem-1', { eventId: 'event-1' })).resolves.toBeUndefined();
    queryMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ user_id: 'learner-1', problem_id: 'other' }]);
    await expect(updateProblemProgress('learner-1', 'problem-1', { eventId: 'event-1' })).rejects.toThrow('different problem');
  });

  it('keeps the legacy no-event-ID upsert', async () => {
    queryMock.mockResolvedValueOnce([]);
    const { updateProblemProgress } = await import('../../../apps/server/src/db/neon');
    await updateProblemProgress('learner-1', 'problem-1', { incrementAttempts: true });
    expect(queryMock).toHaveBeenCalledTimes(1);
    const sql = queryMock.mock.calls[0][0].join('?');
    expect(sql).toContain('INSERT INTO problem_progress');
    expect(sql).not.toContain('problem_progress_events');
  });

  it('propagates a failed progress statement instead of acknowledging a claim', async () => {
    queryMock.mockRejectedValueOnce(new Error('database unavailable'));
    const { updateProblemProgress } = await import('../../../apps/server/src/db/neon');
    await expect(updateProblemProgress('learner-1', 'problem-1', { eventId: 'event-1' }))
      .rejects.toThrow('database unavailable');
    expect(queryMock).toHaveBeenCalledTimes(1);
  });
});
