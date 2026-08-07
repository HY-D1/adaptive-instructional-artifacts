import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InteractionEvent } from '@/app/types';

vi.mock('./csrf-client', () => ({
  withCsrfHeader: (options: RequestInit) => options,
}));

describe('learner-profile-client', () => {
  const fetchMock = vi.fn<typeof fetch>();

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    return { promise, resolve, reject };
  }

  function makeProfile(id: string, name: string) {
    return {
      id,
      name,
      conceptsCovered: new Set(['joins']),
      conceptCoverageEvidence: new Map([
        ['joins', {
          conceptId: 'joins',
          score: 70,
          confidence: 'medium' as const,
          lastUpdated: 1_700_000_000_000,
          evidenceCounts: {
            successfulExecution: 1,
            hintViewed: 0,
            explanationViewed: 0,
            errorEncountered: 0,
            notesAdded: 0,
          },
          streakCorrect: 1,
          streakIncorrect: 0,
        }],
      ]),
      errorHistory: new Map([['syntax', 2]]),
      solvedProblemIds: new Set(['problem-1']),
      interactionCount: 3,
      currentStrategy: 'adaptive-medium' as const,
      preferences: {
        escalationThreshold: 3,
        aggregationDelay: 5000,
      },
      createdAt: 1_700_000_000_000,
      lastActive: 1_700_000_001_000,
    };
  }

  function makeBackendProfile(id: string, name: string) {
    return {
      id,
      name,
      conceptsCovered: ['joins'],
      conceptCoverageEvidence: {},
      errorHistory: {},
      solvedProblemIds: ['problem-1'],
      interactionCount: 3,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 3, aggregationDelay: 5000 },
      createdAt: 1_700_000_000_000,
      lastActive: 1_700_000_001_000,
    };
  }

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
    const { setActiveSyncPrincipal } = await import('../storage/sync-owner');
    setActiveSyncPrincipal({ accountId: 'account-1', learnerId: 'learner-1' });
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
    const { setActiveSyncPrincipal } = await import('../storage/sync-owner');
    setActiveSyncPrincipal({ accountId: 'account-1', learnerId: 'learner-1' });
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

  it('deserializes cached profile arrays and records into real Sets and Maps without deleting corrupt entries', async () => {
    vi.unstubAllEnvs();
    const validProfile = makeProfile('cached-valid', 'Cached Valid');
    localStorage.setItem('sql-adapt-profile-cache', JSON.stringify({
      'cached-valid': {
        profile: {
          ...validProfile,
          conceptsCovered: ['joins'],
          conceptCoverageEvidence: Object.fromEntries(validProfile.conceptCoverageEvidence),
          errorHistory: [['syntax', 2]],
          solvedProblemIds: ['problem-1'],
        },
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [],
      },
      corrupt: {
        profile: null,
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [],
      },
    }));

    const { getAllProfiles } = await import('./learner-profile-client');
    const profiles = await getAllProfiles();

    expect(profiles).toHaveLength(1);
    expect(profiles[0].conceptsCovered).toBeInstanceOf(Set);
    expect(profiles[0].conceptCoverageEvidence).toBeInstanceOf(Map);
    expect(profiles[0].errorHistory).toBeInstanceOf(Map);
    expect(profiles[0].solvedProblemIds).toBeInstanceOf(Set);

    const { dualStorage } = await import('../storage/dual-storage');
    expect(() => dualStorage.cacheProfiles(profiles)).not.toThrow();
    expect(JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}')).toHaveProperty('corrupt');
  });

  it('keeps identical learner ids isolated by owner and omits envelope ownership from API bodies', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = await import('./learner-profile-client');

    await client.saveProfile(makeProfile('learner-shared', 'Owner A'));
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    await client.saveProfile(makeProfile('learner-shared', 'Owner B'));

    const cache = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, Record<string, unknown>>;
    expect(Object.values(cache).map((entry) => entry.syncOwnerId).sort()).toEqual([
      'v1:["account-A","learner-shared"]',
      'v1:["account-B","learner-shared"]',
    ]);
    for (const [, request] of fetchMock.mock.calls) {
      expect(JSON.parse(String(request?.body))).not.toHaveProperty('syncOwnerId');
    }

    fetchMock.mockReset().mockResolvedValue(
      new Response(JSON.stringify({ success: false, error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    await expect(client.getAllProfiles()).resolves.toEqual([
      expect.objectContaining({ id: 'learner-shared', name: 'Owner A' }),
    ]);
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    await expect(client.getAllProfiles()).resolves.toEqual([
      expect.objectContaining({ id: 'learner-shared', name: 'Owner B' }),
    ]);
  });

  it('keeps unauthenticated full-profile writes local, then stamps exact-self ownership before retry', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal(null);
    const client = await import('./learner-profile-client');

    await expect(client.saveProfile(makeProfile('learner-self', 'Legacy Self'))).resolves.toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    let cache = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, Record<string, unknown>>;
    expect(Object.values(cache)).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(Object.values(cache)[0], 'syncOwnerId')).toBe(false);

    syncOwner.setActiveSyncPrincipal({ accountId: 'account-self', learnerId: 'learner-self' });
    fetchMock.mockImplementationOnce(async (_input, request) => {
      cache = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}');
      expect(Object.values(cache)[0].syncOwnerId).toBe('v1:["account-self","learner-self"]');
      expect(JSON.parse(String(request?.body))).not.toHaveProperty('syncOwnerId');
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    await expect(client.syncPendingUpdates('learner-self')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.method).toBe('PUT');
  });

  it('syncs only active-owner pending events and retains ambiguous selected-learner legacy data', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const exactEvent = {
      id: 'pending-self',
      learnerId: 'learner-self',
      sessionId: 'session-self',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-self',
      errorSubtypeId: 'syntax',
    };
    const selectedEvent = {
      ...exactEvent,
      id: 'pending-selected',
      learnerId: 'student-selected',
      sessionId: 'session-selected',
    };
    localStorage.setItem('sql-adapt-profile-cache', JSON.stringify({
      'learner-self': {
        profile: {
          ...makeProfile('learner-self', 'Legacy Self'),
          conceptsCovered: [],
          conceptCoverageEvidence: {},
          errorHistory: {},
          solvedProblemIds: [],
        },
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [exactEvent],
      },
      'student-selected': {
        profile: {
          ...makeProfile('student-selected', 'Selected Legacy'),
          conceptsCovered: [],
          conceptCoverageEvidence: {},
          errorHistory: {},
          solvedProblemIds: [],
        },
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [selectedEvent],
      },
    }));
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-self', learnerId: 'learner-self' });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const client = await import('./learner-profile-client');

    await client.syncAllPendingUpdates();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(body.events).toEqual([expect.objectContaining({ learnerId: 'learner-self' })]);
    expect(JSON.stringify(body)).not.toContain('syncOwnerId');
    const retained = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, {
      profile: { id: string };
      pendingUpdates: unknown[];
      syncOwnerId?: string;
    }>;
    const selected = Object.values(retained).find((entry) => entry.profile.id === 'student-selected');
    expect(selected?.pendingUpdates).toHaveLength(1);
    expect(Object.prototype.hasOwnProperty.call(selected ?? {}, 'syncOwnerId')).toBe(false);
  });

  it('prevents direct, manual, and interval profile sync while the principal is null', async () => {
    vi.useFakeTimers();
    try {
      vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
      const syncOwner = await import('../storage/sync-owner');
      syncOwner.setActiveSyncPrincipal(null);
      const client = await import('./learner-profile-client');
      await client.updateProfileFromEvent('learner-no-owner', {
        id: 'pending-no-owner',
        learnerId: 'learner-no-owner',
        sessionId: 'session-no-owner',
        timestamp: 1_700_000_000_000,
        eventType: 'error',
        problemId: 'problem-no-owner',
        errorSubtypeId: 'syntax',
      });

      await expect(client.syncPendingUpdates('learner-no-owner')).resolves.toBe(false);
      const stop = client.startAutoSync('learner-no-owner');
      await vi.advanceTimersByTimeAsync(60_000);
      stop();

      expect(fetchMock).not.toHaveBeenCalled();
      const retained = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, {
        pendingUpdates: unknown[];
        syncOwnerId?: string;
      }>;
      expect(Object.values(retained)[0].pendingUpdates).toHaveLength(1);
      expect(Object.prototype.hasOwnProperty.call(Object.values(retained)[0], 'syncOwnerId')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps expired pending profile updates eligible for authenticated retry', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-05T20:00:00.000Z'));
      vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
      const syncOwner = await import('../storage/sync-owner');
      syncOwner.setActiveSyncPrincipal(null);
      const client = await import('./learner-profile-client');

      await client.updateProfileFromEvent('learner-expired-pending', {
        id: 'pending-expired',
        learnerId: 'learner-expired-pending',
        sessionId: 'session-expired',
        timestamp: Date.now(),
        eventType: 'error',
        problemId: 'problem-expired',
        errorSubtypeId: 'syntax',
      });

      vi.setSystemTime(new Date('2026-08-05T20:06:00.000Z'));
      syncOwner.setActiveSyncPrincipal({
        accountId: 'account-expired-pending',
        learnerId: 'learner-expired-pending',
      });

      expect(client.hasPendingUpdates('learner-expired-pending')).toBe(true);
      expect(client.getPendingUpdateCount('learner-expired-pending')).toBe(1);

      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      await expect(client.syncPendingUpdates('learner-expired-pending')).resolves.toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });

  it('discards getProfile results after the authenticated owner changes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    const client = await import('./learner-profile-client');

    const request = client.getProfile('learner-shared', true);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    response.resolve(new Response(JSON.stringify({
      success: true,
      data: makeBackendProfile('learner-shared', 'Owner A response'),
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(request).resolves.toBeNull();
    expect(localStorage.getItem('sql-adapt-profile-cache') ?? '').not.toContain('Owner A response');
  });

  it('discards getAllProfiles results after the authenticated owner changes', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    const client = await import('./learner-profile-client');

    const request = client.getAllProfiles();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    response.resolve(new Response(JSON.stringify({
      success: true,
      data: [makeBackendProfile('learner-shared', 'Owner A dashboard')],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));

    await expect(request).resolves.toEqual([]);
    expect(localStorage.getItem('sql-adapt-profile-cache') ?? '').not.toContain('Owner A dashboard');
  });

  it('keeps an owner A save pending when its response arrives after switching to B', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    const client = await import('./learner-profile-client');

    const request = client.saveProfile(makeProfile('learner-shared', 'Owner A pending'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    response.resolve(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(request).resolves.toBe(false);
    const cache = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, {
      synced: boolean;
      syncOwnerId?: string;
    }>;
    expect(Object.values(cache)).toEqual([
      expect.objectContaining({ synced: false, syncOwnerId: 'v1:["account-A","learner-shared"]' }),
    ]);
  });

  it('keeps an owner A save pending after an A-to-B-to-A principal cycle', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    const client = await import('./learner-profile-client');

    const request = client.saveProfile(makeProfile('learner-shared', 'Owner A ABA pending'));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    response.resolve(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(request).resolves.toBe(false);
    const cache = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, {
      synced: boolean;
      syncOwnerId?: string;
    }>;
    expect(Object.values(cache)).toEqual([
      expect.objectContaining({ synced: false, syncOwnerId: 'v1:["account-A","learner-shared"]' }),
    ]);
  });

  it('does not apply updateProfileFromEvent failure fallback to a replacement owner', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    const client = await import('./learner-profile-client');
    const event = {
      id: 'profile-update-owner-race',
      learnerId: 'learner-shared',
      sessionId: 'session-owner-A',
      timestamp: 1_700_000_000_000,
      eventType: 'error' as const,
      problemId: 'problem-owner-race',
      errorSubtypeId: 'syntax',
    };

    const request = client.updateProfileFromEvent('learner-shared', event);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    response.resolve(new Response(JSON.stringify({ success: false, error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(request).resolves.toBeNull();
    const cache = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, {
      pendingUpdates: unknown[];
      syncOwnerId?: string;
    }>;
    expect(Object.values(cache)).toEqual([
      expect.objectContaining({
        syncOwnerId: 'v1:["account-A","learner-shared"]',
        pendingUpdates: [expect.objectContaining({ id: 'profile-update-owner-race' })],
      }),
    ]);
  });

  it('does not apply batchUpdateProfile failure fallback to a replacement owner', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);
    const client = await import('./learner-profile-client');
    const event = {
      id: 'profile-batch-owner-race',
      learnerId: 'learner-shared',
      sessionId: 'session-owner-A',
      timestamp: 1_700_000_000_000,
      eventType: 'error' as const,
      problemId: 'problem-owner-race',
      errorSubtypeId: 'syntax',
    };

    const request = client.batchUpdateProfile('learner-shared', [event]);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    response.resolve(new Response(JSON.stringify({ success: false, error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(request).resolves.toBeNull();
    const cache = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, {
      pendingUpdates: unknown[];
      syncOwnerId?: string;
    }>;
    expect(Object.values(cache)).toEqual([
      expect.objectContaining({
        syncOwnerId: 'v1:["account-A","learner-shared"]',
        pendingUpdates: [expect.objectContaining({ id: 'profile-batch-owner-race' })],
      }),
    ]);
  });

  it('does not clear owner A pending sync when its response arrives under owner B', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal(null);
    const client = await import('./learner-profile-client');
    await client.saveProfile(makeProfile('learner-shared', 'Owner A offline'));
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const response = deferred<Response>();
    fetchMock.mockReturnValueOnce(response.promise);

    const request = client.syncPendingUpdates('learner-shared');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-B', learnerId: 'learner-shared' });
    response.resolve(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));

    await expect(request).resolves.toBe(false);
    const cache = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, {
      synced: boolean;
      syncOwnerId?: string;
    }>;
    expect(Object.values(cache)).toEqual([
      expect.objectContaining({ synced: false, syncOwnerId: 'v1:["account-A","learner-shared"]' }),
    ]);
  });

  it('treats null and array cache roots as empty without rewriting them', async () => {
    vi.unstubAllEnvs();
    const client = await import('./learner-profile-client');
    for (const raw of ['null', '[]']) {
      localStorage.setItem('sql-adapt-profile-cache', raw);
      await expect(client.getAllProfiles()).resolves.toEqual([]);
      expect(localStorage.getItem('sql-adapt-profile-cache')).toBe(raw);
    }
  });

  it('skips malformed cache envelopes and retains their exact stored bytes', async () => {
    vi.unstubAllEnvs();
    const raw = JSON.stringify({
      invalidPendingContainer: {
        profile: {
          ...makeBackendProfile('invalid-container', 'Invalid container'),
          conceptsCovered: [],
          solvedProblemIds: [],
        },
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: {},
      },
      invalidPendingEvent: {
        profile: {
          ...makeBackendProfile('invalid-event', 'Invalid event'),
          conceptsCovered: [],
          solvedProblemIds: [],
        },
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [{ id: 'missing-required-fields' }],
      },
    });
    localStorage.setItem('sql-adapt-profile-cache', raw);
    const client = await import('./learner-profile-client');

    await expect(client.getAllProfiles()).resolves.toEqual([]);
    expect(localStorage.getItem('sql-adapt-profile-cache')).toBe(raw);
  });

  it('does not send an exact-self legacy profile when its ownership stamp cannot persist', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const profile = makeBackendProfile('learner-self', 'Legacy self');
    localStorage.setItem('sql-adapt-profile-cache', JSON.stringify({
      'learner-self': {
        profile,
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [],
      },
    }));
    const original = localStorage.setItem.bind(localStorage);
    let blockedWrites = 0;
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-profile-cache') {
        blockedWrites += 1;
        throw new DOMException('profile cache write blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-self', learnerId: 'learner-self' });
    const client = await import('./learner-profile-client');

    const result = await client.syncPendingUpdates('learner-self');
    setItem.mockRestore();

    expect(result).toBe(false);
    expect(blockedWrites).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
    const stored = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, Record<string, unknown>>;
    expect(Object.prototype.hasOwnProperty.call(stored['learner-self'] ?? {}, 'syncOwnerId')).toBe(false);
  });

  it('mutates an expired owned profile without replacing its populated learning state', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-08-06T20:00:00.000Z'));
      vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
      const syncOwner = await import('../storage/sync-owner');
      syncOwner.setActiveSyncPrincipal({ accountId: 'account-expired', learnerId: 'learner-expired' });
      const original = {
        ...makeProfile('learner-expired', 'Expired populated learner'),
        currentStrategy: 'adaptive-high' as const,
        preferences: {
          escalationThreshold: 5,
          aggregationDelay: 9000,
          autoTextbookEnabled: false,
          notificationsEnabled: true,
          theme: 'dark' as const,
        },
      };
      localStorage.setItem('sql-adapt-profile-cache', JSON.stringify({
        'v1:["account-expired","learner-expired"]\u0000learner-expired': {
          profile: {
            ...original,
            conceptsCovered: Array.from(original.conceptsCovered),
            conceptCoverageEvidence: Array.from(original.conceptCoverageEvidence.entries()),
            errorHistory: Array.from(original.errorHistory.entries()),
            solvedProblemIds: Array.from(original.solvedProblemIds),
          },
          timestamp: Date.now() - (6 * 60 * 1000),
          synced: true,
          pendingUpdates: [],
          syncOwnerId: 'v1:["account-expired","learner-expired"]',
        },
      }));
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }));
      const client = await import('./learner-profile-client');
      const event = {
        id: 'expired-owned-event',
        learnerId: 'learner-expired',
        sessionId: 'session-expired-owned',
        timestamp: Date.now(),
        eventType: 'error',
        problemId: 'problem-expired-owned',
        errorSubtypeId: 'syntax',
        conceptIds: ['joins'],
      } satisfies InteractionEvent;

      const updated = await client.updateProfileFromEvent('learner-expired', event);

      expect(updated).toMatchObject({
        id: original.id,
        name: original.name,
        currentStrategy: original.currentStrategy,
        preferences: original.preferences,
      });
      expect(updated?.conceptsCovered).toEqual(original.conceptsCovered);
      expect(updated?.solvedProblemIds).toEqual(original.solvedProblemIds);
      expect(updated?.errorHistory.get('syntax')).toBe(3);
      expect(updated?.conceptCoverageEvidence.get('joins')?.evidenceCounts.errorEncountered).toBe(1);
      const cache = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, {
        profile: { name: string; currentStrategy: string; solvedProblemIds: string[] };
        pendingUpdates: Array<{ id: string }>;
      }>;
      const envelope = Object.values(cache)[0];
      expect(envelope.profile.name).toBe(original.name);
      expect(envelope.profile.currentStrategy).toBe(original.currentStrategy);
      expect(envelope.profile.solvedProblemIds).toEqual(['problem-1']);
      expect(envelope.pendingUpdates).toEqual([expect.objectContaining({ id: event.id })]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not replace a populated legacy profile when its ownership claim cannot persist', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const legacy = makeBackendProfile('learner-claim-failure', 'Populated legacy learner');
    const raw = JSON.stringify({
      'learner-claim-failure': {
        profile: legacy,
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [],
      },
    });
    localStorage.setItem('sql-adapt-profile-cache', raw);
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-profile-cache') {
        throw new DOMException('claim blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({
      accountId: 'account-claim-failure',
      learnerId: 'learner-claim-failure',
    });
    const client = await import('./learner-profile-client');

    await expect(client.updateProfileFromEvent('learner-claim-failure', {
      id: 'claim-failure-event',
      learnerId: 'learner-claim-failure',
      sessionId: 'session-claim-failure',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-claim-failure',
    })).resolves.toBeNull();
    setItem.mockRestore();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-profile-cache')).toBe(raw);
  });

  it('keeps malformed owner-B cache isolated while owner A creates its own envelope', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const ownerB = 'v1:["account-B","learner-shared"]';
    localStorage.setItem('sql-adapt-profile-cache', JSON.stringify({
      'learner-shared': {
        profile: {
          ...makeBackendProfile('learner-shared', 'Malformed owner B'),
          conceptCoverageEvidence: [['joins', { conceptId: 'joins' }]],
        },
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [],
        syncOwnerId: ownerB,
      },
    }));
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: false, error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    }));
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-shared' });
    const client = await import('./learner-profile-client');

    await expect(client.updateProfileFromEvent('learner-shared', {
      id: 'owner-A-new-event',
      learnerId: 'learner-shared',
      sessionId: 'session-owner-A-new',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-owner-A-new',
    })).resolves.toMatchObject({ id: 'learner-shared' });

    const stored = JSON.parse(localStorage.getItem('sql-adapt-profile-cache') ?? '{}') as Record<string, {
      syncOwnerId?: string;
      profile?: { name?: string };
    }>;
    expect(Object.values(stored)).toEqual(expect.arrayContaining([
      expect.objectContaining({ syncOwnerId: ownerB }),
      expect.objectContaining({ syncOwnerId: 'v1:["account-A","learner-shared"]' }),
    ]));
    expect(Object.values(stored).find((entry) => entry.syncOwnerId === ownerB)?.profile?.name)
      .toBe('Malformed owner B');
  });

  it('fails closed on duplicate owned profile envelopes without losing either record', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const owner = 'v1:["account-duplicate","learner-duplicate"]';
    const envelope = {
      profile: makeBackendProfile('learner-duplicate', 'Duplicate learner'),
      timestamp: Date.now(),
      synced: false,
      pendingUpdates: [],
      syncOwnerId: owner,
    };
    const raw = JSON.stringify({ first: envelope, second: { ...envelope, timestamp: Date.now() - 1 } });
    localStorage.setItem('sql-adapt-profile-cache', raw);
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-duplicate', learnerId: 'learner-duplicate' });
    const client = await import('./learner-profile-client');

    await expect(client.updateProfileFromEvent('learner-duplicate', {
      id: 'duplicate-profile-event',
      learnerId: 'learner-duplicate',
      sessionId: 'session-duplicate-profile',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-duplicate-profile',
    })).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-profile-cache')).toBe(raw);
  });

  it.each([
    ['duplicate evidence keys', {
      conceptCoverageEvidence: [
        ['joins', makeProfile('unused', 'unused').conceptCoverageEvidence.get('joins')],
        ['joins', makeProfile('unused', 'unused').conceptCoverageEvidence.get('joins')],
      ],
    }],
    ['malformed error history', { errorHistory: [['syntax', -1]] }],
    ['malformed string collection', { conceptsCovered: ['joins', 42] }],
    ['missing interaction count', { interactionCount: undefined }],
    ['invalid strategy', { currentStrategy: 'unknown-strategy' }],
    ['incomplete preferences', { preferences: { escalationThreshold: 3 } }],
  ])('keeps %s inert instead of filtering and overwriting it', async (_label, malformedFields) => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const owner = 'v1:["account-nested","learner-nested"]';
    const raw = JSON.stringify({
      [`${owner}\u0000learner-nested`]: {
        profile: { ...makeBackendProfile('learner-nested', 'Nested malformed'), ...malformedFields },
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [],
        syncOwnerId: owner,
      },
    });
    localStorage.setItem('sql-adapt-profile-cache', raw);
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-nested', learnerId: 'learner-nested' });
    const client = await import('./learner-profile-client');

    await expect(client.updateProfileFromEvent('learner-nested', {
      id: 'nested-malformed-event',
      learnerId: 'learner-nested',
      sessionId: 'session-nested-malformed',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-nested-malformed',
    })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-profile-cache')).toBe(raw);
  });

  it('treats a valid and malformed same-owner pair as pending ambiguity', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const owner = 'v1:["account-pair","learner-pair"]';
    const valid = {
      profile: makeBackendProfile('learner-pair', 'Valid half'),
      timestamp: Date.now(),
      synced: false,
      pendingUpdates: [],
      syncOwnerId: owner,
    };
    const malformed = {
      ...valid,
      profile: { ...valid.profile, interactionCount: 'unknown' },
    };
    const raw = JSON.stringify({ valid, malformed });
    localStorage.setItem('sql-adapt-profile-cache', raw);
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-pair', learnerId: 'learner-pair' });
    const client = await import('./learner-profile-client');

    await expect(client.syncPendingUpdates('learner-pair')).resolves.toBe(false);
    expect(client.hasPendingUpdates('learner-pair')).toBe(true);
    expect(client.getPendingUpdateCount('learner-pair')).toBe(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-profile-cache')).toBe(raw);
  });

  it('keeps a profile envelope inert when a pending event names another learner', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const owner = 'v1:["account-event-owner","learner-event-owner"]';
    const raw = JSON.stringify({
      [`${owner}\u0000learner-event-owner`]: {
        profile: makeBackendProfile('learner-event-owner', 'Event owner'),
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [{
          id: 'wrong-learner-event',
          learnerId: 'learner-other',
          sessionId: 'session-wrong-learner',
          timestamp: 1_700_000_000_000,
          eventType: 'error',
        }],
        syncOwnerId: owner,
      },
    });
    localStorage.setItem('sql-adapt-profile-cache', raw);
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-event-owner', learnerId: 'learner-event-owner' });
    const client = await import('./learner-profile-client');

    await expect(client.syncPendingUpdates('learner-event-owner')).resolves.toBe(false);
    expect(client.hasPendingUpdates('learner-event-owner')).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-profile-cache')).toBe(raw);
  });

  it('keeps malformed nested evidence inert without crashing, overwriting, or sending it', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const owner = 'v1:["account-malformed","learner-malformed"]';
    const raw = JSON.stringify({
      [`${owner}\u0000learner-malformed`]: {
        profile: {
          ...makeBackendProfile('learner-malformed', 'Malformed evidence learner'),
          conceptCoverageEvidence: [['joins', {
            conceptId: 'joins',
            score: 70,
            confidence: 'medium',
            lastUpdated: 1_700_000_000_000,
            evidenceCounts: { successfulExecution: 1 },
            streakCorrect: 1,
            streakIncorrect: 0,
          }]],
        },
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [],
        syncOwnerId: owner,
      },
    });
    localStorage.setItem('sql-adapt-profile-cache', raw);
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-malformed', learnerId: 'learner-malformed' });
    const client = await import('./learner-profile-client');

    await expect(client.updateProfileFromEvent('learner-malformed', {
      id: 'malformed-evidence-event',
      learnerId: 'learner-malformed',
      sessionId: 'session-malformed-evidence',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-malformed-evidence',
      errorSubtypeId: 'syntax',
      conceptIds: ['joins'],
    })).resolves.toBeNull();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-profile-cache')).toBe(raw);
  });

  it.each(['null', '[]', '{not-json'])('does not overwrite a malformed cache root or send a profile for %s', async (raw) => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    localStorage.setItem('sql-adapt-profile-cache', raw);
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-root', learnerId: 'learner-root' });
    const client = await import('./learner-profile-client');

    await expect(client.saveProfile(makeProfile('learner-root', 'Root preserved'))).resolves.toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-profile-cache')).toBe(raw);
    expect(client.hasPendingUpdates('learner-root')).toBe(true);
  });

  it('does not send a profile unless its unsynced cache proof persists', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-proof', learnerId: 'learner-proof' });
    const client = await import('./learner-profile-client');
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-profile-cache') {
        throw new DOMException('profile cache blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    const saved = await client.saveProfile(makeProfile('learner-proof', 'Proof required'));
    setItem.mockRestore();

    expect(saved).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('sql-adapt-profile-cache')).toBeNull();
  });

  it('reports sync failure and retains pending evidence when the post-ack clear cannot persist', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    const owner = 'v1:["account-clear","learner-clear"]';
    const event = {
      id: 'pending-clear-proof',
      learnerId: 'learner-clear',
      sessionId: 'session-clear-proof',
      timestamp: 1_700_000_000_000,
      eventType: 'error',
      problemId: 'problem-clear-proof',
    } satisfies InteractionEvent;
    const raw = JSON.stringify({
      [`${owner}\u0000learner-clear`]: {
        profile: {
          ...makeBackendProfile('learner-clear', 'Clear proof'),
          conceptCoverageEvidence: [],
          errorHistory: [],
        },
        timestamp: Date.now(),
        synced: false,
        pendingUpdates: [event],
        syncOwnerId: owner,
      },
    });
    localStorage.setItem('sql-adapt-profile-cache', raw);
    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-clear', learnerId: 'learner-clear' });
    const client = await import('./learner-profile-client');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const original = localStorage.setItem.bind(localStorage);
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === 'sql-adapt-profile-cache') {
        throw new DOMException('pending clear blocked', 'QuotaExceededError');
      }
      return original(key, value);
    });

    const synced = await client.syncPendingUpdates('learner-clear');
    setItem.mockRestore();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(synced).toBe(false);
    expect(localStorage.getItem('sql-adapt-profile-cache')).toBe(raw);
    expect(client.hasPendingUpdates('learner-clear')).toBe(true);
  });
});
