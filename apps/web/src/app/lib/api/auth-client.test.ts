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

function authUser(id: string) {
  return {
    id: `account-${id}`,
    email: `${id}@example.test`,
    role: 'student' as const,
    learnerId: `learner-${id}`,
    name: `Learner ${id}`,
    createdAt: '2026-08-06T00:00:00.000Z',
  };
}

function requestHeader(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

describe('auth-client transport ordering', () => {
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

  it('prevents an older deferred signup response from overwriting a newer login CSRF token', async () => {
    const signupResponse = deferred<Response>();
    const loginResponse = deferred<Response>();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/signup')) return signupResponse.promise;
      if (url.endsWith('/login')) return loginResponse.promise;
      if (url.endsWith('/logout')) return jsonResponse({ success: true });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const authClient = await import('./auth-client');
    const signupRequest = authClient.signup({
      name: 'Older signup',
      email: 'signup@example.test',
      password: 'password123',
      role: 'student',
      classCode: 'ClassSQL2024',
    });
    const loginRequest = authClient.login('newer@example.test', 'password123');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const callsBeforeFirstResponse = fetchMock.mock.calls.length;
    if (callsBeforeFirstResponse > 1) {
      loginResponse.resolve(jsonResponse({
        success: true,
        user: authUser('newer'),
        csrfToken: 'csrf-newer-login',
      }));
      await loginRequest;
      signupResponse.resolve(jsonResponse({
        success: true,
        user: authUser('older'),
        csrfToken: 'csrf-older-signup',
      }, 201));
    } else {
      signupResponse.resolve(jsonResponse({
        success: true,
        user: authUser('older'),
        csrfToken: 'csrf-older-signup',
      }, 201));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      loginResponse.resolve(jsonResponse({
        success: true,
        user: authUser('newer'),
        csrfToken: 'csrf-newer-login',
      }));
    }

    await expect(signupRequest).resolves.toMatchObject({ success: true, user: authUser('older') });
    await expect(loginRequest).resolves.toMatchObject({ success: true, user: authUser('newer') });
    await authClient.logout();

    const logoutCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/logout'));
    expect(callsBeforeFirstResponse).toBe(1);
    expect(requestHeader(logoutCall?.[1], 'x-csrf-token')).toBe('csrf-newer-login');
  });

  it('prevents an older deferred logout response from clearing a newer login CSRF token', async () => {
    const logoutResponse = deferred<Response>();
    const loginResponse = deferred<Response>();
    let logoutCalls = 0;
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/login')) return loginResponse.promise;
      if (url.endsWith('/logout')) {
        logoutCalls += 1;
        return logoutCalls === 1
          ? logoutResponse.promise
          : jsonResponse({ success: true });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-older', learnerId: 'learner-older' });
    const authClient = await import('./auth-client');
    const { setCsrfToken } = await import('./csrf-client');
    setCsrfToken('csrf-before-logout');

    const logoutRequest = authClient.logout();
    const loginRequest = authClient.login('newer@example.test', 'password123');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const callsBeforeFirstResponse = fetchMock.mock.calls.length;
    if (callsBeforeFirstResponse > 1) {
      loginResponse.resolve(jsonResponse({
        success: true,
        user: authUser('newer'),
        csrfToken: 'csrf-newer-login',
      }));
      await loginRequest;
      logoutResponse.resolve(jsonResponse({ success: true }));
    } else {
      logoutResponse.resolve(jsonResponse({ success: true }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      loginResponse.resolve(jsonResponse({
        success: true,
        user: authUser('newer'),
        csrfToken: 'csrf-newer-login',
      }));
    }

    await expect(logoutRequest).resolves.toEqual({ success: true });
    await expect(loginRequest).resolves.toMatchObject({ success: true, user: authUser('newer') });
    await authClient.logout();

    const logoutFetchCalls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith('/logout'));
    const finalLogoutCall = logoutFetchCalls[logoutFetchCalls.length - 1];
    expect(callsBeforeFirstResponse).toBe(1);
    expect(requestHeader(finalLogoutCall?.[1], 'x-csrf-token')).toBe('csrf-newer-login');
  });

  it('keeps logout CSRF refresh and retry atomic ahead of a newer login', async () => {
    const firstLogoutResponse = deferred<Response>();
    const loginResponse = deferred<Response>();
    const paths: string[] = [];
    let logoutCalls = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      if (path.endsWith('/logout')) {
        logoutCalls += 1;
        if (logoutCalls === 1) return firstLogoutResponse.promise;
        expect(requestHeader(init, 'x-csrf-token')).toBe('csrf-refreshed');
        return jsonResponse({ success: true });
      }
      if (path.endsWith('/me')) {
        return jsonResponse({
          success: true,
          user: authUser('older'),
          csrfToken: 'csrf-refreshed',
        });
      }
      if (path.endsWith('/login')) return loginResponse.promise;
      throw new Error(`Unexpected path: ${path}`);
    });

    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-older', learnerId: 'learner-older' });
    const authClient = await import('./auth-client');
    const { setCsrfToken } = await import('./csrf-client');
    setCsrfToken('csrf-stale');

    const logoutRequest = authClient.logout();
    const loginRequest = authClient.login('newer@example.test', 'password123');
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const callsBeforeFirstResponse = fetchMock.mock.calls.length;

    firstLogoutResponse.resolve(jsonResponse({ success: false, error: 'Invalid CSRF token' }, 403));
    await vi.waitFor(() => expect(paths).toContain('/api/auth/login'));
    loginResponse.resolve(jsonResponse({
      success: true,
      user: authUser('newer'),
      csrfToken: 'csrf-newer-login',
    }));

    await expect(logoutRequest).resolves.toEqual({ success: true });
    await expect(loginRequest).resolves.toMatchObject({ success: true, user: authUser('newer') });
    expect(callsBeforeFirstResponse).toBe(1);
    expect(paths).toEqual([
      '/api/auth/logout',
      '/api/auth/me',
      '/api/auth/logout',
      '/api/auth/login',
    ]);
  });

  it('does not retry an account A logout after auth me observes a cross-tab account B session', async () => {
    const paths: string[] = [];
    fetchMock.mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      if (path.endsWith('/logout')) {
        return paths.filter((candidate) => candidate.endsWith('/logout')).length === 1
          ? jsonResponse({ success: false, error: 'Invalid CSRF token' }, 403)
          : jsonResponse({ success: true });
      }
      if (path.endsWith('/me')) {
        return jsonResponse({
          success: true,
          user: authUser('B'),
          csrfToken: 'csrf-account-B',
        });
      }
      throw new Error(`Unexpected path: ${path}`);
    });

    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-A' });
    const authClient = await import('./auth-client');
    const csrfClient = await import('./csrf-client');
    csrfClient.setCsrfToken('csrf-account-A');

    await expect(authClient.logout()).resolves.toMatchObject({
      success: false,
      status: 403,
    });

    expect(paths).toEqual(['/api/auth/logout', '/api/auth/me']);
    expect(csrfClient.getCsrfHeaders()).toEqual({ 'x-csrf-token': 'csrf-account-A' });
  });

  it('does not retry logout when the captured principal revision changes during auth me', async () => {
    const meResponse = deferred<Response>();
    const paths: string[] = [];
    fetchMock.mockImplementation(async (input) => {
      const path = new URL(String(input)).pathname;
      paths.push(path);
      if (path.endsWith('/logout')) {
        return paths.filter((candidate) => candidate.endsWith('/logout')).length === 1
          ? jsonResponse({ success: false, error: 'Invalid CSRF token' }, 403)
          : jsonResponse({ success: true });
      }
      if (path.endsWith('/me')) return meResponse.promise;
      throw new Error(`Unexpected path: ${path}`);
    });

    const syncOwner = await import('../storage/sync-owner');
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-A' });
    const authClient = await import('./auth-client');
    const csrfClient = await import('./csrf-client');
    csrfClient.setCsrfToken('csrf-before-refresh');

    const logoutRequest = authClient.logout();
    await vi.waitFor(() => expect(paths).toContain('/api/auth/me'));
    syncOwner.setActiveSyncPrincipal({ accountId: 'account-A', learnerId: 'learner-A' });
    meResponse.resolve(jsonResponse({
      success: true,
      user: authUser('A'),
      csrfToken: 'csrf-from-stale-refresh',
    }));

    await expect(logoutRequest).resolves.toMatchObject({ success: false, status: 403 });
    expect(paths).toEqual(['/api/auth/logout', '/api/auth/me']);
    expect(csrfClient.getCsrfHeaders()).toEqual({ 'x-csrf-token': 'csrf-before-refresh' });
  });

  it('prevents an older deferred getMe response from overwriting a newer login CSRF token', async () => {
    const meResponse = deferred<Response>();
    const loginResponse = deferred<Response>();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/me')) return meResponse.promise;
      if (url.endsWith('/login')) return loginResponse.promise;
      if (url.endsWith('/logout')) return jsonResponse({ success: true });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const authClient = await import('./auth-client');
    const meRequest = authClient.getMe();
    const loginRequest = authClient.login('newer@example.test', 'password123');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const callsBeforeFirstResponse = fetchMock.mock.calls.length;
    if (callsBeforeFirstResponse > 1) {
      loginResponse.resolve(jsonResponse({
        success: true,
        user: authUser('newer'),
        csrfToken: 'csrf-newer-login',
      }));
      await loginRequest;
      meResponse.resolve(jsonResponse({
        success: true,
        user: authUser('older'),
        csrfToken: 'csrf-older-me',
      }));
    } else {
      meResponse.resolve(jsonResponse({
        success: true,
        user: authUser('older'),
        csrfToken: 'csrf-older-me',
      }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      loginResponse.resolve(jsonResponse({
        success: true,
        user: authUser('newer'),
        csrfToken: 'csrf-newer-login',
      }));
    }

    await expect(meRequest).resolves.toEqual(authUser('older'));
    await expect(loginRequest).resolves.toMatchObject({ success: true, user: authUser('newer') });
    await authClient.logout();

    const logoutCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/logout'));
    expect(callsBeforeFirstResponse).toBe(1);
    expect(requestHeader(logoutCall?.[1], 'x-csrf-token')).toBe('csrf-newer-login');
  });

  it('orders a shared CSRF refresh ahead of a newer login', async () => {
    const refreshResponse = deferred<Response>();
    const loginResponse = deferred<Response>();
    fetchMock.mockImplementation(async (input) => {
      const url = String(input);
      if (url.endsWith('/refresh-me')) return refreshResponse.promise;
      if (url.endsWith('/login')) return loginResponse.promise;
      if (url.endsWith('/logout')) return jsonResponse({ success: true });
      throw new Error(`Unexpected URL: ${url}`);
    });

    const authClient = await import('./auth-client');
    const csrfClient = await import('./csrf-client');
    const refreshRequest = csrfClient.refreshCsrfTokenFromAuthMe('https://api.example.test/refresh-me');
    const loginRequest = authClient.login('newer@example.test', 'password123');

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const callsBeforeFirstResponse = fetchMock.mock.calls.length;
    if (callsBeforeFirstResponse > 1) {
      loginResponse.resolve(jsonResponse({
        success: true,
        user: authUser('newer'),
        csrfToken: 'csrf-newer-login',
      }));
      await loginRequest;
      refreshResponse.resolve(jsonResponse({ csrfToken: 'csrf-older-refresh' }));
    } else {
      refreshResponse.resolve(jsonResponse({ csrfToken: 'csrf-older-refresh' }));
      await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
      loginResponse.resolve(jsonResponse({
        success: true,
        user: authUser('newer'),
        csrfToken: 'csrf-newer-login',
      }));
    }

    await expect(refreshRequest).resolves.toBe(true);
    await expect(loginRequest).resolves.toMatchObject({ success: true, user: authUser('newer') });
    await authClient.logout();

    const logoutCall = fetchMock.mock.calls.find(([input]) => String(input).endsWith('/logout'));
    expect(callsBeforeFirstResponse).toBe(1);
    expect(requestHeader(logoutCall?.[1], 'x-csrf-token')).toBe('csrf-newer-login');
  });

  it('aborts a hung shared CSRF refresh so the auth FIFO can continue', async () => {
    vi.useFakeTimers();
    try {
      const signalCapture: { current?: AbortSignal } = {};
      fetchMock.mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.endsWith('/refresh-me')) {
          signalCapture.current = init?.signal ?? undefined;
          return new Promise<Response>((_resolve, reject) => {
            signalCapture.current?.addEventListener('abort', () => {
              reject(new DOMException('Timed out', 'AbortError'));
            }, { once: true });
          });
        }
        if (url.endsWith('/login')) {
          return jsonResponse({
            success: true,
            user: authUser('after-timeout'),
            csrfToken: 'csrf-after-timeout',
          });
        }
        throw new Error(`Unexpected URL: ${url}`);
      });

      const authClient = await import('./auth-client');
      const csrfClient = await import('./csrf-client');
      const refreshRequest = csrfClient.refreshCsrfTokenFromAuthMe('https://api.example.test/refresh-me');
      const loginRequest = authClient.login('after-timeout@example.test', 'password123');
      await Promise.resolve();
      await Promise.resolve();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(signalCapture.current?.aborted).toBe(false);

      await vi.advanceTimersByTimeAsync(10_000);

      await expect(refreshRequest).resolves.toBe(false);
      await expect(loginRequest).resolves.toMatchObject({
        success: true,
        user: authUser('after-timeout'),
      });
      expect(signalCapture.current?.aborted).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('classifies only 401 auth probes as unauthenticated', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ success: false, error: 'Unauthorized' }, 401))
      .mockResolvedValueOnce(jsonResponse({ success: false, error: 'Unavailable' }, 503))
      .mockResolvedValueOnce(new Response('{not-json', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }))
      .mockRejectedValueOnce(new TypeError('network unavailable'));

    const authClient = await import('./auth-client');

    await expect(authClient.probeAuthSession()).resolves.toEqual({ state: 'unauthenticated' });
    await expect(authClient.probeAuthSession()).resolves.toEqual({ state: 'indeterminate' });
    await expect(authClient.probeAuthSession()).resolves.toEqual({ state: 'indeterminate' });
    await expect(authClient.probeAuthSession()).resolves.toEqual({ state: 'indeterminate' });
  });
});
