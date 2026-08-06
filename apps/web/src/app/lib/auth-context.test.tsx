import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from './api/auth-client';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

const mocks = vi.hoisted(() => ({
  getMe: vi.fn(),
  probeAuthSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  signup: vi.fn(),
  getUserProfile: vi.fn(),
  saveUserProfile: vi.fn(),
  hydrateLearner: vi.fn(),
  hydrateInstructorDashboard: vi.fn(),
  clearUserProfile: vi.fn(),
  clearUiStateForActor: vi.fn(),
  clearCache: vi.fn(),
  setActiveSyncPrincipal: vi.fn(),
}));

vi.mock('./api/auth-client', () => ({
  AUTH_ENABLED: true,
  AUTH_BACKEND_CONFIGURED: true,
  getMe: mocks.getMe,
  probeAuthSession: mocks.probeAuthSession,
  login: mocks.login,
  logout: mocks.logout,
  signup: mocks.signup,
}));

vi.mock('./storage/index', () => ({
  storage: {
    getUserProfile: mocks.getUserProfile,
    saveUserProfile: mocks.saveUserProfile,
    hydrateLearner: mocks.hydrateLearner,
    hydrateInstructorDashboard: mocks.hydrateInstructorDashboard,
    clearUserProfile: mocks.clearUserProfile,
  },
}));

vi.mock('./ui-state', () => ({
  clearUiStateForActor: mocks.clearUiStateForActor,
}));

vi.mock('./api/learner-profile-client', () => ({
  default: { clearCache: mocks.clearCache },
}));

vi.mock('./storage/sync-owner', () => ({
  setActiveSyncPrincipal: mocks.setActiveSyncPrincipal,
}));

import { AuthProvider, useAuth } from './auth-context';

const userA: AuthUser = {
  id: 'account-A',
  email: 'a@example.test',
  role: 'student',
  learnerId: 'learner-A',
  name: 'Account A',
  createdAt: '2026-01-01T00:00:00.000Z',
};

const userB: AuthUser = {
  id: 'account-B',
  email: 'b@example.test',
  role: 'student',
  learnerId: 'learner-B',
  name: 'Account B',
  createdAt: '2026-01-02T00:00:00.000Z',
};

let currentAuth: ReturnType<typeof useAuth> | null = null;

function AuthProbe() {
  currentAuth = useAuth();
  return <div data-testid="auth-state">{currentAuth.isLoading ? 'loading' : currentAuth.user?.id ?? 'none'}</div>;
}

async function renderAuthProvider(initialUser: AuthUser | null) {
  mocks.getMe.mockResolvedValueOnce(initialUser);
  render(
    <AuthProvider>
      <AuthProbe />
    </AuthProvider>,
  );
  await waitFor(() => {
    expect(currentAuth?.isLoading).toBe(false);
  });
}

describe('AuthProvider sync-owner ordering', () => {
  beforeEach(() => {
    currentAuth = null;
    for (const mock of Object.values(mocks)) mock.mockReset();
    mocks.getUserProfile.mockReturnValue(null);
    mocks.saveUserProfile.mockReturnValue({ success: true });
    mocks.hydrateLearner.mockResolvedValue(true);
    mocks.hydrateInstructorDashboard.mockResolvedValue({
      ok: true,
      scopeEmpty: true,
      sectionCount: 0,
      learnerCount: 0,
    });
    mocks.probeAuthSession.mockImplementation(async () => {
      const authenticatedUser = await mocks.getMe();
      return authenticatedUser
        ? { state: 'authenticated', user: authenticatedUser }
        : { state: 'unauthenticated' };
    });
    mocks.logout.mockResolvedValue({ success: true });
  });

  it('sets null at startup and establishes getMe ownership before profile storage and hydration', async () => {
    await renderAuthProvider(userA);

    expect(mocks.setActiveSyncPrincipal.mock.calls).toEqual([
      [null],
      [{ accountId: 'account-A', learnerId: 'learner-A' }],
    ]);
    expect(mocks.setActiveSyncPrincipal.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.saveUserProfile.mock.invocationCallOrder[0],
    );
    expect(mocks.setActiveSyncPrincipal.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.hydrateLearner.mock.invocationCallOrder[0],
    );
    expect(mocks.clearCache).not.toHaveBeenCalled();
  });

  it('nulls ownership before login, then sets the returned account before switch hydration without deleting cache', async () => {
    mocks.getUserProfile.mockReturnValue({
      id: 'learner-A',
      name: 'Account A',
      role: 'student',
      createdAt: 1_700_000_000_000,
    });
    await renderAuthProvider(userA);
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.login.mockResolvedValueOnce({ success: true, user: userB });

    await act(async () => {
      await currentAuth?.login('b@example.test', 'password');
    });

    expect(mocks.setActiveSyncPrincipal.mock.calls).toEqual([
      [null],
      [{ accountId: 'account-B', learnerId: 'learner-B' }],
    ]);
    expect(mocks.setActiveSyncPrincipal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.login.mock.invocationCallOrder[0],
    );
    expect(mocks.setActiveSyncPrincipal.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.saveUserProfile.mock.invocationCallOrder[0],
    );
    expect(mocks.setActiveSyncPrincipal.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.hydrateLearner.mock.invocationCallOrder[0],
    );
    expect(mocks.clearCache).not.toHaveBeenCalled();
  });

  it('orders signup ownership before local profile storage and preserves cached records', async () => {
    await renderAuthProvider(null);
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.signup.mockResolvedValueOnce({ success: true, user: userA });

    await act(async () => {
      await currentAuth?.signup({
        name: 'Account A',
        email: 'a@example.test',
        password: 'password',
        role: 'student',
      });
    });

    expect(mocks.setActiveSyncPrincipal.mock.calls).toEqual([
      [null],
      [{ accountId: 'account-A', learnerId: 'learner-A' }],
    ]);
    expect(mocks.setActiveSyncPrincipal.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signup.mock.invocationCallOrder[0],
    );
    expect(mocks.setActiveSyncPrincipal.mock.invocationCallOrder[1]).toBeLessThan(
      mocks.saveUserProfile.mock.invocationCallOrder[0],
    );
    expect(mocks.clearCache).not.toHaveBeenCalled();
  });

  it('lets logout capture the active owner before nulling ownership and preserves durable profile cache', async () => {
    await renderAuthProvider(userA);
    for (const mock of Object.values(mocks)) mock.mockClear();

    await act(async () => {
      await currentAuth?.logout();
    });

    expect(mocks.setActiveSyncPrincipal).toHaveBeenCalledWith(null);
    expect(mocks.logout.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.setActiveSyncPrincipal.mock.invocationCallOrder[0],
    );
    expect(mocks.clearCache).not.toHaveBeenCalled();
    expect(mocks.clearUserProfile).toHaveBeenCalledTimes(1);
    expect(currentAuth?.user).toBeNull();
  });

  it('ignores a stale failed login after a newer account has completed login', async () => {
    await renderAuthProvider(userA);
    for (const mock of Object.values(mocks)) mock.mockClear();
    const staleFailure = deferred<{ success: false; error: string }>();
    mocks.login
      .mockReturnValueOnce(staleFailure.promise)
      .mockResolvedValueOnce({ success: true, user: userB });

    let staleRequest!: Promise<{ success: boolean; error?: string }>;
    await act(async () => {
      staleRequest = currentAuth!.login('stale@example.test', 'wrong-password');
      await Promise.resolve();
    });
    await act(async () => {
      await currentAuth!.login('b@example.test', 'password');
    });
    expect(currentAuth?.user?.id).toBe('account-B');
    const callsAfterB = mocks.setActiveSyncPrincipal.mock.calls.length;

    staleFailure.resolve({ success: false, error: 'Invalid credentials' });
    await expect(staleRequest).resolves.toEqual({ success: false, error: 'Invalid credentials' });

    expect(currentAuth?.user?.id).toBe('account-B');
    expect(mocks.setActiveSyncPrincipal.mock.calls).toHaveLength(callsAfterB);
    expect(mocks.setActiveSyncPrincipal.mock.calls[mocks.setActiveSyncPrincipal.mock.calls.length - 1]).toEqual([
      { accountId: 'account-B', learnerId: 'learner-B' },
    ]);
  });

  it('does not commit stale user or hydration state while a newer hydration is active', async () => {
    await renderAuthProvider(null);
    for (const mock of Object.values(mocks)) mock.mockClear();
    const hydrationA = deferred<boolean>();
    const hydrationB = deferred<boolean>();
    mocks.login
      .mockResolvedValueOnce({ success: true, user: userA })
      .mockResolvedValueOnce({ success: true, user: userB });
    mocks.hydrateLearner.mockImplementation((learnerId: string) =>
      learnerId === 'learner-A' ? hydrationA.promise : hydrationB.promise,
    );

    let requestA!: Promise<{ success: boolean }>;
    let requestB!: Promise<{ success: boolean }>;
    await act(async () => {
      requestA = currentAuth!.login('a@example.test', 'password');
      await Promise.resolve();
    });
    await waitFor(() => expect(mocks.hydrateLearner).toHaveBeenCalledWith('learner-A'));
    await act(async () => {
      requestB = currentAuth!.login('b@example.test', 'password');
      await Promise.resolve();
    });
    await waitFor(() => expect(mocks.hydrateLearner).toHaveBeenCalledWith('learner-B'));
    expect(currentAuth?.isHydrating).toBe(true);

    await act(async () => {
      hydrationA.resolve(true);
      await requestA;
    });

    expect(currentAuth?.user).toBeNull();
    expect(currentAuth?.isHydrating).toBe(true);
    expect(mocks.setActiveSyncPrincipal.mock.calls[mocks.setActiveSyncPrincipal.mock.calls.length - 1]).toEqual([
      { accountId: 'account-B', learnerId: 'learner-B' },
    ]);

    await act(async () => {
      hydrationB.resolve(true);
      await requestB;
    });
    expect(currentAuth?.user?.id).toBe('account-B');
    expect(currentAuth?.isHydrating).toBe(false);
  });

  it('does not let a stale logout clear a newer login', async () => {
    await renderAuthProvider(userA);
    for (const mock of Object.values(mocks)) mock.mockClear();
    const staleLogout = deferred<{ success: true }>();
    mocks.logout.mockReturnValueOnce(staleLogout.promise);
    mocks.login.mockResolvedValueOnce({ success: true, user: userB });

    let logoutRequest!: Promise<{ success: boolean }>;
    await act(async () => {
      logoutRequest = currentAuth!.logout();
      await Promise.resolve();
    });
    await act(async () => {
      await currentAuth!.login('b@example.test', 'password');
    });
    expect(currentAuth?.user?.id).toBe('account-B');
    const clearProfileCallsAfterB = mocks.clearUserProfile.mock.calls.length;
    const principalCallsAfterB = mocks.setActiveSyncPrincipal.mock.calls.length;

    staleLogout.resolve({ success: true });
    await expect(logoutRequest).resolves.toEqual({ success: true });

    expect(currentAuth?.user?.id).toBe('account-B');
    expect(mocks.clearUserProfile).toHaveBeenCalledTimes(clearProfileCallsAfterB);
    expect(mocks.setActiveSyncPrincipal.mock.calls).toHaveLength(principalCallsAfterB);
    expect(mocks.setActiveSyncPrincipal.mock.calls[mocks.setActiveSyncPrincipal.mock.calls.length - 1]).toEqual([
      { accountId: 'account-B', learnerId: 'learner-B' },
    ]);
  });

  it('ignores a stale startup getMe result after an explicit login', async () => {
    const startup = deferred<AuthUser | null>();
    mocks.getMe.mockReturnValueOnce(startup.promise);
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );
    await waitFor(() => expect(mocks.getMe).toHaveBeenCalledTimes(1));
    mocks.login.mockResolvedValueOnce({ success: true, user: userB });

    await act(async () => {
      await currentAuth!.login('b@example.test', 'password');
    });
    expect(currentAuth?.user?.id).toBe('account-B');
    const principalCallsAfterB = mocks.setActiveSyncPrincipal.mock.calls.length;

    await act(async () => {
      startup.resolve(userA);
      await startup.promise;
      await Promise.resolve();
    });

    expect(currentAuth?.user?.id).toBe('account-B');
    expect(currentAuth?.isLoading).toBe(false);
    expect(mocks.setActiveSyncPrincipal.mock.calls).toHaveLength(principalCallsAfterB);
    expect(mocks.hydrateLearner).not.toHaveBeenCalledWith('learner-A');
  });

  it('does not let a deferred signup overwrite a newer completed login', async () => {
    await renderAuthProvider(null);
    for (const mock of Object.values(mocks)) mock.mockClear();
    const staleSignup = deferred<{ success: true; user: AuthUser }>();
    mocks.signup.mockReturnValueOnce(staleSignup.promise);
    mocks.login.mockResolvedValueOnce({ success: true, user: userB });

    let signupRequest!: Promise<{ success: boolean }>;
    await act(async () => {
      signupRequest = currentAuth!.signup({
        name: userA.name,
        email: userA.email,
        password: 'password',
        role: 'student',
      });
      await Promise.resolve();
    });
    await act(async () => {
      await currentAuth!.login(userB.email, 'password');
    });
    const principalCallsAfterLogin = mocks.setActiveSyncPrincipal.mock.calls.length;

    staleSignup.resolve({ success: true, user: userA });
    await expect(signupRequest).resolves.toEqual({ success: true, user: userA });

    expect(currentAuth?.user?.id).toBe(userB.id);
    expect(mocks.setActiveSyncPrincipal.mock.calls).toHaveLength(principalCallsAfterLogin);
    expect(mocks.hydrateLearner).not.toHaveBeenCalledWith(userA.learnerId);
  });

  it('reconciles to a stale successful login session when a newer signup fails', async () => {
    await renderAuthProvider(userA);
    for (const mock of Object.values(mocks)) mock.mockClear();
    const staleLogin = deferred<{ success: true; user: AuthUser }>();
    const newerSignup = deferred<{ success: false; error: string }>();
    mocks.login.mockReturnValueOnce(staleLogin.promise);
    mocks.signup.mockReturnValueOnce(newerSignup.promise);
    mocks.getMe.mockResolvedValueOnce(userB);

    let loginRequest!: Promise<{ success: boolean }>;
    let signupRequest!: Promise<{ success: boolean; error?: string }>;
    await act(async () => {
      loginRequest = currentAuth!.login(userB.email, 'password');
      signupRequest = currentAuth!.signup({
        name: 'Rejected signup',
        email: 'rejected@example.test',
        password: 'password',
        role: 'student',
      });
      await Promise.resolve();
    });

    await act(async () => {
      staleLogin.resolve({ success: true, user: userB });
      await loginRequest;
      newerSignup.resolve({ success: false, error: 'Duplicate email' });
      await signupRequest;
    });

    expect(currentAuth?.user?.id).toBe(userB.id);
    expect(mocks.getMe).toHaveBeenCalledTimes(1);
    expect(mocks.setActiveSyncPrincipal.mock.calls[mocks.setActiveSyncPrincipal.mock.calls.length - 1]).toEqual([
      { accountId: userB.id, learnerId: userB.learnerId },
    ]);
    expect(mocks.hydrateLearner).toHaveBeenCalledWith(userB.learnerId);
    await expect(signupRequest).resolves.toEqual({ success: false, error: 'Duplicate email' });
  });

  it('reconciles a signed-out UI to a stale successful signup session when a newer login fails', async () => {
    await renderAuthProvider(null);
    for (const mock of Object.values(mocks)) mock.mockClear();
    const staleSignup = deferred<{ success: true; user: AuthUser }>();
    const newerLogin = deferred<{ success: false; error: string }>();
    mocks.signup.mockReturnValueOnce(staleSignup.promise);
    mocks.login.mockReturnValueOnce(newerLogin.promise);
    mocks.getMe.mockResolvedValueOnce(userA);

    let signupRequest!: Promise<{ success: boolean }>;
    let loginRequest!: Promise<{ success: boolean; error?: string }>;
    await act(async () => {
      signupRequest = currentAuth!.signup({
        name: userA.name,
        email: userA.email,
        password: 'password',
        role: 'student',
      });
      loginRequest = currentAuth!.login('rejected@example.test', 'wrong-password');
      await Promise.resolve();
    });

    await act(async () => {
      staleSignup.resolve({ success: true, user: userA });
      await signupRequest;
      newerLogin.resolve({ success: false, error: 'Invalid credentials' });
      await loginRequest;
    });

    expect(currentAuth?.user?.id).toBe(userA.id);
    expect(mocks.getMe).toHaveBeenCalledTimes(1);
    expect(mocks.setActiveSyncPrincipal.mock.calls[mocks.setActiveSyncPrincipal.mock.calls.length - 1]).toEqual([
      { accountId: userA.id, learnerId: userA.learnerId },
    ]);
    expect(mocks.hydrateLearner).toHaveBeenCalledWith(userA.learnerId);
    await expect(loginRequest).resolves.toEqual({ success: false, error: 'Invalid credentials' });
  });

  it('keeps the prior authenticated session when a failed login is confirmed by getMe', async () => {
    await renderAuthProvider(userA);
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.login.mockResolvedValueOnce({ success: false, error: 'Invalid credentials' });
    mocks.getMe.mockResolvedValueOnce(userA);

    let result!: { success: boolean; error?: string };
    await act(async () => {
      result = await currentAuth!.login('rejected@example.test', 'wrong-password');
    });

    expect(result).toEqual({ success: false, error: 'Invalid credentials' });
    expect(currentAuth?.user?.id).toBe(userA.id);
    expect(mocks.getMe).toHaveBeenCalledTimes(1);
    expect(mocks.setActiveSyncPrincipal.mock.calls[mocks.setActiveSyncPrincipal.mock.calls.length - 1]).toEqual([
      { accountId: userA.id, learnerId: userA.learnerId },
    ]);
  });

  it('does not restore a prior local principal when getMe no longer confirms a session', async () => {
    await renderAuthProvider(userA);
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.login.mockResolvedValueOnce({ success: false, error: 'Invalid credentials' });
    mocks.getMe.mockResolvedValueOnce(null);

    await act(async () => {
      await currentAuth!.login('rejected@example.test', 'wrong-password');
    });

    expect(currentAuth?.user).toBeNull();
    expect(mocks.setActiveSyncPrincipal.mock.calls).toEqual([[null]]);
    expect(mocks.hydrateLearner).not.toHaveBeenCalled();
  });

  it('preserves the prior signed-in UI when failed-login reconciliation is transiently indeterminate', async () => {
    await renderAuthProvider(userA);
    for (const mock of Object.values(mocks)) mock.mockClear();
    mocks.login.mockResolvedValueOnce({ success: false, error: 'Invalid credentials' });
    mocks.getMe.mockResolvedValueOnce(null);
    mocks.probeAuthSession.mockResolvedValueOnce({ state: 'indeterminate' });

    let result!: { success: boolean; error?: string };
    await act(async () => {
      result = await currentAuth!.login('rejected@example.test', 'wrong-password');
    });

    expect(result).toEqual({ success: false, error: 'Invalid credentials' });
    expect(currentAuth?.user?.id).toBe(userA.id);
    expect(mocks.probeAuthSession).toHaveBeenCalledTimes(1);
  });
});
