import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./csrf-client', () => ({
  withCsrfHeader: (options: RequestInit) => options,
}));

describe('learner-profile-client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    localStorage.clear();
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('converts backend solvedProblemIds into a Set', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            id: 'learner-1',
            name: 'Learner 1',
            conceptsCovered: [],
            conceptCoverageEvidence: {},
            errorHistory: {},
            solvedProblemIds: ['problem-1', 'problem-2'],
            interactionCount: 2,
            currentStrategy: 'adaptive-medium',
            preferences: {
              escalationThreshold: 3,
              aggregationDelay: 5000,
            },
            createdAt: 1_700_000_000_000,
            lastActive: 1_700_000_001_000,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { getProfile } = await import('./learner-profile-client');
    const profile = await getProfile('learner-1', true);

    expect(profile?.solvedProblemIds).toEqual(new Set(['problem-1', 'problem-2']));
  });

  it('sends its revision and caches the authoritative conflict without replay', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const latest = { id: 'learner-1', name: 'Latest', serverRevision: 8, conceptsCovered: [], conceptCoverageEvidence: {}, errorHistory: {}, solvedProblemIds: [], interactionCount: 0, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 5000 }, createdAt: 1, lastActive: 1 };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, code: 'PROFILE_REVISION_CONFLICT', data: latest }), { status: 409 }));
    const notify = vi.fn();
    window.addEventListener('sql-adapt-profile-conflict', notify);
    const { saveProfile } = await import('./learner-profile-client');
    expect(await saveProfile({ ...latest, name: 'Stale', serverRevision: 7, conceptsCovered: new Set(), conceptCoverageEvidence: new Map(), errorHistory: new Map(), solvedProblemIds: new Set(), currentStrategy: 'adaptive-medium' })).toBe(false);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).expectedRevision).toBe(7);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const cached = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') || '{}');
    expect(cached['learner-1'].profile).toMatchObject({ name: 'Latest', serverRevision: 8 });
    expect(notify).toHaveBeenCalledOnce();
    window.removeEventListener('sql-adapt-profile-conflict', notify);
  });

  it('caches the new server revision on a successful profile save', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const latest = { id: 'learner-1', name: 'Saved', serverRevision: 8, conceptsCovered: [], conceptCoverageEvidence: {}, errorHistory: {}, solvedProblemIds: [], interactionCount: 0, currentStrategy: 'adaptive-medium', preferences: { escalationThreshold: 3, aggregationDelay: 5000 }, createdAt: 1, lastActive: 1 };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true, data: latest }), { status: 200 }));
    const { saveProfile } = await import('./learner-profile-client');
    expect(await saveProfile({ ...latest, serverRevision: 7, conceptsCovered: new Set(), conceptCoverageEvidence: new Map(), errorHistory: new Map(), solvedProblemIds: new Set(), currentStrategy: 'adaptive-medium' })).toBe(true);
    const cached = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') || '{}');
    expect(cached['learner-1'].profile.serverRevision).toBe(8);
  });

  it('adds solvedProblemIds during optimistic successful execution updates', async () => {
    vi.unstubAllEnvs();

    const { updateProfileFromEvent } = await import('./learner-profile-client');
    const profile = await updateProfileFromEvent('learner-1', {
      id: 'execution-1',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-9',
      successful: true,
    });

    expect(profile?.solvedProblemIds.has('problem-9')).toBe(true);
  });

  it('sends successful as a top-level field for profile event updates', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            id: 'learner-1',
            name: 'Learner 1',
            conceptsCovered: [],
            conceptCoverageEvidence: {},
            errorHistory: {},
            solvedProblemIds: ['problem-9'],
            interactionCount: 1,
            currentStrategy: 'adaptive-medium',
            preferences: {
              escalationThreshold: 3,
              aggregationDelay: 5000,
            },
            createdAt: 1_700_000_000_000,
            lastActive: 1_700_000_001_000,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );

    const { updateProfileFromEvent } = await import('./learner-profile-client');
    await updateProfileFromEvent('learner-1', {
      id: 'execution-1',
      learnerId: 'learner-1',
      sessionId: 'session-1',
      timestamp: 1_700_000_000_000,
      eventType: 'execution',
      problemId: 'problem-9',
      successful: true,
      code: 'SELECT 1',
      metadata: {
        foo: 'bar',
      },
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.event).toMatchObject({
      eventType: 'execution',
      eventId: 'execution-1',
      problemId: 'problem-9',
      successful: true,
      code: 'SELECT 1',
      metadata: { foo: 'bar' },
    });
  });

  it('retains an ambiguous failed event and sends its ID and grading fields on retry', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    fetchMock.mockRejectedValueOnce(new Error('connection lost after write'));
    const { updateProfileFromEvent, getPendingUpdateCount, syncPendingUpdates } = await import('./learner-profile-client');
    await updateProfileFromEvent('learner-1', {
      id: 'execution-retry', learnerId: 'learner-1', sessionId: 'session-1',
      timestamp: 1_700_000_000_000, eventType: 'execution', problemId: 'problem-9',
      successful: true, code: 'SELECT 1', conceptIds: ['select-basic'],
    });
    expect(getPendingUpdateCount('learner-1')).toBe(1);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    }));
    expect(await syncPendingUpdates('learner-1')).toBe(true);
    const body = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(body.events).toEqual([expect.objectContaining({
      eventId: 'execution-retry', problemId: 'problem-9', successful: true,
      code: 'SELECT 1', conceptIds: ['select-basic'],
    })]);
    expect(getPendingUpdateCount('learner-1')).toBe(0);
  });

  it('does not clear a new pending event while an earlier retry is in flight', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    const { updateProfileFromEvent, getPendingUpdateCount, syncPendingUpdates } = await import('./learner-profile-client');
    const event = { learnerId: 'learner-1', sessionId: 'session-1', timestamp: 1_700_000_000_000,
      eventType: 'hint_view' as const, problemId: 'problem-9' };
    await updateProfileFromEvent('learner-1', { ...event, id: 'hint-1' });
    let complete!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const retry = syncPendingUpdates('learner-1');
    fetchMock.mockRejectedValueOnce(new Error('still offline'));
    await updateProfileFromEvent('learner-1', { ...event, id: 'hint-2' });
    expect(getPendingUpdateCount('learner-1')).toBe(2);
    complete(new Response(JSON.stringify({ success: true }), { status: 200 }));
    expect(await retry).toBe(true);
    expect(getPendingUpdateCount('learner-1')).toBe(1);
  });
});
