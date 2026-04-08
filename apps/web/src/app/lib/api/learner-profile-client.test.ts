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
      metadata: {
        foo: 'bar',
      },
    });

    const [, request] = fetchMock.mock.calls[0];
    const body = JSON.parse(String(request?.body));
    expect(body.event).toMatchObject({
      eventType: 'execution',
      problemId: 'problem-9',
      successful: true,
      metadata: { foo: 'bar' },
    });
  });
});
