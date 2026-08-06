import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function event(id = 'event-a') {
  return {
    id,
    learnerId: 'learner-a',
    sessionId: 'session-a',
    timestamp: 1_786_000_000_000,
    eventType: 'execution' as const,
    problemId: 'problem-1',
    code: 'SELECT 1',
    successful: true,
  };
}

function authMeBody(accountId: string, learnerId: string, csrfToken: string) {
  return {
    success: true,
    user: {
      id: accountId,
      learnerId,
      email: `${accountId}@example.test`,
      role: 'student',
      name: accountId,
      createdAt: '2026-08-06T00:00:00.000Z',
    },
    csrfToken,
  };
}

describe('storage-client auth actor retry guard', () => {
  const fetchMock = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('does not refresh or retry an account-A mutation after the active principal changes to B', async () => {
    const firstResponse = deferred<Response>();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/interactions')) {
        if (fetchMock.mock.calls.filter(([called]) => String(called).endsWith('/interactions')).length === 1) {
          return firstResponse.promise;
        }
        return jsonResponse({ success: true, data: { id: 'event-a' } });
      }
      if (url.endsWith('/auth/me')) {
        return jsonResponse(authMeBody('account-b', 'learner-b', 'csrf-b'));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-a', learnerId: 'learner-a' });
    const { logInteraction } = await import('./storage-client');

    const request = logInteraction(event());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-b', learnerId: 'learner-b' });
    firstResponse.resolve(jsonResponse({ success: false, error: 'Invalid CSRF token' }, 403));

    await expect(request).resolves.toEqual({ success: false, confirmed: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the active principal changes away and back before the 403 arrives', async () => {
    const firstResponse = deferred<Response>();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/interactions')) {
        if (fetchMock.mock.calls.filter(([called]) => String(called).endsWith('/interactions')).length === 1) {
          return firstResponse.promise;
        }
        return jsonResponse({ success: true, data: { id: 'event-a' } });
      }
      if (url.endsWith('/auth/me')) {
        return jsonResponse(authMeBody('account-a', 'learner-a', 'csrf-a'));
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-a', learnerId: 'learner-a' });
    const { logInteraction } = await import('./storage-client');

    const request = logInteraction(event());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-b', learnerId: 'learner-b' });
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-a', learnerId: 'learner-a' });
    firstResponse.resolve(jsonResponse({ success: false, error: 'Invalid CSRF token' }, 403));

    await expect(request).resolves.toEqual({ success: false, confirmed: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry when auth/me reports a different account without a local principal change', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Invalid CSRF token' }, 403),
    ).mockResolvedValueOnce(
      jsonResponse(authMeBody('account-b', 'learner-b', 'csrf-b')),
    ).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'event-a' } }),
    );

    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-a', learnerId: 'learner-a' });
    const csrfClient = await import('./csrf-client');
    csrfClient.setCsrfToken('csrf-a-before-refresh');
    const { logInteraction } = await import('./storage-client');

    await expect(logInteraction(event())).resolves.toEqual({ success: false, confirmed: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toMatch(/\/auth\/me$/);
    expect(csrfClient.getCsrfHeaders()).toEqual({ 'x-csrf-token': 'csrf-a-before-refresh' });
  });

  it('does not commit a refresh or retry when the principal changes while auth/me is in flight', async () => {
    const refreshResponse = deferred<Response>();
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Invalid CSRF token' }, 403),
    ).mockReturnValueOnce(
      refreshResponse.promise,
    ).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'event-a' } }),
    );

    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-a', learnerId: 'learner-a' });
    const csrfClient = await import('./csrf-client');
    csrfClient.setCsrfToken('csrf-a-before-refresh');
    const { logInteraction } = await import('./storage-client');

    const request = logInteraction(event());
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(String(fetchMock.mock.calls[1]?.[0])).toMatch(/\/auth\/me$/);
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-b', learnerId: 'learner-b' });
    refreshResponse.resolve(jsonResponse(authMeBody('account-a', 'learner-a', 'csrf-a-refreshed')));

    await expect(request).resolves.toEqual({ success: false, confirmed: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(csrfClient.getCsrfHeaders()).toEqual({ 'x-csrf-token': 'csrf-a-before-refresh' });
  });

  it('does not refresh or retry an ambiguous mutation without an active principal', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Invalid CSRF token' }, 403),
    ).mockResolvedValueOnce(
      jsonResponse(authMeBody('account-b', 'learner-b', 'csrf-b')),
    ).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'event-a' } }),
    );

    const { logInteraction } = await import('./storage-client');

    await expect(logInteraction(event())).resolves.toEqual({ success: false, confirmed: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves the exact payload and retries once when the principal and auth/me identity still match', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ success: false, error: 'Invalid CSRF token' }, 403),
    ).mockResolvedValueOnce(
      jsonResponse(authMeBody('account-a', 'learner-a', 'csrf-a-refreshed')),
    ).mockResolvedValueOnce(
      jsonResponse({ success: true, data: { id: 'event-a' } }),
    );

    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-a', learnerId: 'learner-a' });
    const { logInteraction } = await import('./storage-client');

    await expect(logInteraction(event())).resolves.toEqual({ success: true, confirmed: true });

    const interactionCalls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/interactions'));
    expect(interactionCalls).toHaveLength(2);
    expect(interactionCalls[1]?.[1]?.body).toBe(interactionCalls[0]?.[1]?.body);
    expect(new Headers(interactionCalls[1]?.[1]?.headers).get('x-csrf-token')).toBe('csrf-a-refreshed');
  });
});
