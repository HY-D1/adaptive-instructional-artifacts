import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./csrf-client', () => ({
  withCsrfHeader: (options: RequestInit) => options,
  getCsrfHeaders: () => ({}),
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

  it('computes a stable hintId fallback when hint_view omits one', async () => {
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
      hintLevel: 1,
      sqlEngageSubtype: 'incomplete query',
      sqlEngageRowId: 'sql-engage-enhanced',
    });

    const [, request] = fetchMock.mock.calls[0];
    expect(JSON.parse(String(request?.body))).toMatchObject({
      eventType: 'hint_view',
      hintId: 'sql-engage:incomplete query:hint:sql-engage-enhanced:L1',
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

  // RESEARCH-4: ID preservation for flush verification and cross-event references
  it('preserves client event id in convertToBackendInteraction for single events', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: 'client-event-id-123' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { logInteraction } = await import('./storage-client');

    await logInteraction({
      id: 'client-event-id-123',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_000_000,
      eventType: 'hint_view',
      problemId: 'problem-1',
      hintId: 'hint-1',
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.id).toBe('client-event-id-123');
  });

  it('preserves client event ids in batch logging', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { count: 2 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { logInteractionsBatch } = await import('./storage-client');

    await logInteractionsBatch([
      {
        id: 'event-1',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        hintId: 'hint-1',
      },
      {
        id: 'event-2',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_001_000,
        eventType: 'concept_view',
        problemId: 'problem-1',
        conceptId: 'joins',
        source: 'hint',
      },
    ]);

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.events).toHaveLength(2);
    expect(body.events[0].id).toBe('event-1');
    expect(body.events[1].id).toBe('event-2');
  });

  it('preserves hintId in batch logging', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { count: 2 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { logInteractionsBatch } = await import('./storage-client');

    await logInteractionsBatch([
      {
        id: 'hint-1',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        hintId: 'sql-engage:joins:hint:1:L2',
        hintLevel: 2,
      },
      {
        id: 'hint-2',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_001_000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        hintId: 'sql-engage:joins:hint:1:L3',
        hintLevel: 3,
      },
    ]);

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.events[0].hintId).toBe('sql-engage:joins:hint:1:L2');
    expect(body.events[1].hintId).toBe('sql-engage:joins:hint:1:L3');
  });

  it('preserves session_end summary fields', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: 'session-end-1' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { logInteraction } = await import('./storage-client');

    await logInteraction({
      id: 'session-end-1',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_000_000,
      eventType: 'session_end',
      problemId: 'problem-1',
      totalTime: 3600000,
      problemsAttempted: 5,
      problemsSolved: 3,
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      id: 'session-end-1',
      eventType: 'session_end',
      totalTime: 3600000,
      problemsAttempted: 5,
      problemsSolved: 3,
    });
  });

  it('does not confirm a single interaction when backend returns a different id', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: 'backend-generated-id' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { logInteraction } = await import('./storage-client');

    const result = await logInteraction({
      id: 'client-event-id',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
    });

    expect(result).toEqual({ success: true, confirmed: false });
  });

  it('does not assume batch confirmation when backend omits confirmed ids', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { count: 2 },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { logInteractionsBatchVerified } = await import('./storage-client');

    const result = await logInteractionsBatchVerified([
      {
        id: 'batch-unconfirmed-1',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_000,
        eventType: 'execution',
        problemId: 'problem-1',
      },
      {
        id: 'batch-unconfirmed-2',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_001_000,
        eventType: 'concept_view',
        problemId: 'problem-1',
        conceptId: 'joins',
        source: 'problem',
      },
    ]);

    expect(result).toEqual({
      confirmed: [],
      failed: ['batch-unconfirmed-1', 'batch-unconfirmed-2'],
    });
  });

  it('surfaces server-reported invalid batch ids separately from transient failures', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid research-critical event batch',
          failedIds: ['invalid-hint-1'],
          errors: [
            {
              eventId: 'invalid-hint-1',
              eventType: 'hint_view',
              missingFields: ['templateId'],
            },
          ],
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { logInteractionsBatchVerified } = await import('./storage-client');

    const result = await logInteractionsBatchVerified([
      {
        id: 'invalid-hint-1',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_000,
        eventType: 'hint_view',
        problemId: 'problem-1',
        hintId: 'hint-1',
        hintText: 'Check the join.',
        hintLevel: 2,
        sqlEngageSubtype: 'joins',
        sqlEngageRowId: 'sql-engage:joins:1',
        policyVersion: 'policy-definitions-v1',
        helpRequestIndex: 1,
      },
    ]);

    expect(result).toEqual({
      confirmed: [],
      failed: ['invalid-hint-1'],
      invalid: ['invalid-hint-1'],
    });
  });

  it('does not assume keepalive batch confirmation when backend omits confirmed ids', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { count: 1 },
        }),
        {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { logInteractionsBatchKeepalive } = await import('./storage-client');

    const result = await logInteractionsBatchKeepalive([
      {
        id: 'keepalive-unconfirmed-1',
        learnerId: 'learner-1',
        sessionId: 'session-1',
        timestamp: 1_700_000_000_000,
        eventType: 'execution',
        problemId: 'problem-1',
      },
    ]);

    expect(result).toEqual({ success: true, confirmedIds: [] });
  });

  it('serializes queued profiles when Set and Map fields are missing', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: { id: 'learner-1' },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { saveProfile } = await import('./storage-client');

    await expect(
      saveProfile({
        id: 'learner-1',
        name: 'Learner 1',
        interactionCount: 3,
        currentStrategy: 'adaptive-medium',
        preferences: {
          escalationThreshold: 3,
          aggregationDelay: 5000,
        },
        createdAt: 1_700_000_000_000,
        lastActive: 1_700_000_100_000,
      } as Parameters<typeof saveProfile>[0]),
    ).resolves.toBe(true);

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body).toMatchObject({
      name: 'Learner 1',
      conceptsCovered: [],
      conceptCoverageEvidence: {},
      errorHistory: {},
      interactionCount: 3,
      currentStrategy: 'adaptive-medium',
    });
  });
});
