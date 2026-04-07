import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./csrf-client', () => ({
  withCsrfHeader: (options: RequestInit) => options,
  isMutatingMethod: (method?: string) => method === 'POST' || method === 'PUT' || method === 'PATCH' || method === 'DELETE',
  refreshCsrfTokenFromAuthMe: vi.fn(async () => true),
}));

describe('storage-client telemetry contract', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('keeps hintId when posting hint_view interactions', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: 'hint-1' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { logInteraction } = await import('./storage-client');

    await logInteraction({
      id: 'hint-1',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_000_000,
      eventType: 'hint_view',
      problemId: 'problem-1',
      hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
      hintLevel: 2,
      sqlEngageSubtype: 'joins',
      sqlEngageRowId: 'sql-engage:joins:1',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      eventType: 'hint_view',
      hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
    });
  });

  it('keeps hintId when reading hint_view interactions from backend', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: [
            {
              id: 'hint-1',
              learnerId: 'learner-1',
              sessionId: 'session-1',
              timestamp: '2026-04-05T00:00:00.000Z',
              eventType: 'hint_view',
              problemId: 'problem-1',
              hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
              hintLevel: 2,
              sqlEngageSubtype: 'joins',
              sqlEngageRowId: 'sql-engage:joins:1',
              createdAt: '2026-04-05T00:00:00.000Z',
            },
          ],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { getInteractions } = await import('./storage-client');

    const result = await getInteractions('learner-1');

    expect(result.total).toBe(1);
    expect(result.events[0]).toMatchObject({
      eventType: 'hint_view',
      hintId: 'sql-engage:joins:hint:sql-engage:joins:1:L2',
    });
  });

  it('posts concept_view with conceptId and source', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: 'concept-1' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { logInteraction } = await import('./storage-client');

    await logInteraction({
      id: 'concept-1',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_100_000,
      eventType: 'concept_view',
      problemId: 'problem-1',
      conceptId: 'joins',
      conceptIds: ['joins'],
      source: 'hint',
    });

    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      eventType: 'concept_view',
      conceptId: 'joins',
      source: 'hint',
    });
  });
});
