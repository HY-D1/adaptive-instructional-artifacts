import { describe, it, expect, vi, afterEach } from 'vitest';

afterEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('createProtectedLoader account-mode auth', () => {
  it('rejects stale local-only auth when backend session is missing', async () => {
    const getMe = vi.fn().mockResolvedValue(null);
    const protectRoute = vi.fn().mockReturnValue({ allowed: true });

    vi.doMock('./api/auth-client', () => ({
      AUTH_BACKEND_CONFIGURED: true,
      getMe,
    }));
    vi.doMock('./auth-guard', () => ({
      ROUTES: {
        HOME: '/',
        LOGIN: '/login',
      },
      protectRoute,
      getDefaultRouteForRole: () => '/',
      isPreviewModeActive: () => false,
    }));

    const { createProtectedLoader } = await import('./auth-route-loader');
    const loader = createProtectedLoader({ requiredRole: 'student' });
    const result = await loader({} as never);

    expect(getMe).toHaveBeenCalledTimes(1);
    expect(protectRoute).not.toHaveBeenCalled();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(302);
  });

  it('allows protected route when backend auth user is valid', async () => {
    const getMe = vi.fn().mockResolvedValue({
      learnerId: 'learner-1',
      role: 'student',
    });
    const protectRoute = vi.fn();

    vi.doMock('./api/auth-client', () => ({
      AUTH_BACKEND_CONFIGURED: true,
      getMe,
    }));
    vi.doMock('./auth-guard', () => ({
      ROUTES: {
        HOME: '/',
        LOGIN: '/login',
      },
      protectRoute,
      getDefaultRouteForRole: () => '/',
      isPreviewModeActive: () => false,
    }));

    const { createProtectedLoader } = await import('./auth-route-loader');
    const loader = createProtectedLoader({ requiredRole: 'student' });
    const result = await loader({} as never);

    expect(getMe).toHaveBeenCalledTimes(1);
    expect(protectRoute).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('redirects a pending student before practice loads', async () => {
    const getMe = vi.fn().mockResolvedValue({ learnerId: 'student-1', role: 'student' });
    const getPreSurveyStatus = vi.fn().mockResolvedValue({ completed: false, username: 'student-abc123' });
    vi.doMock('./api/auth-client', () => ({
      AUTH_BACKEND_CONFIGURED: true,
      getMe,
      getPreSurveyStatus,
    }));
    vi.doMock('./auth-guard', () => ({
      ROUTES: { HOME: '/', LOGIN: '/login' },
      protectRoute: vi.fn(),
      getDefaultRouteForRole: () => '/',
      isPreviewModeActive: () => false,
    }));

    const { createProtectedLoader } = await import('./auth-route-loader');
    const result = await createProtectedLoader({ requiredRole: 'student', requirePreSurvey: true })({} as never);

    expect(getPreSurveyStatus).toHaveBeenCalledTimes(1);
    expect((result as Response).headers.get('Location')).toBe('/pre-survey-required');
  });

  it('allows a completed student to load practice', async () => {
    const getMe = vi.fn().mockResolvedValue({ learnerId: 'student-1', role: 'student' });
    const getPreSurveyStatus = vi.fn().mockResolvedValue({ completed: true, username: 'student-abc123' });
    vi.doMock('./api/auth-client', () => ({
      AUTH_BACKEND_CONFIGURED: true,
      getMe,
      getPreSurveyStatus,
    }));
    vi.doMock('./auth-guard', () => ({
      ROUTES: { HOME: '/', LOGIN: '/login' },
      protectRoute: vi.fn(),
      getDefaultRouteForRole: () => '/',
      isPreviewModeActive: () => false,
    }));

    const { createProtectedLoader } = await import('./auth-route-loader');
    const result = await createProtectedLoader({ requiredRole: 'student', requirePreSurvey: true })({} as never);

    expect(result).toBeNull();
  });
});
