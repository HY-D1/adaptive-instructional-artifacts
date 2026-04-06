/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest';

const getDbMock = vi.fn();
const getAuthAccountByEmailMock = vi.fn();
const createAuthEventMock = vi.fn();
const signTokenMock = vi.fn(() => 'signed-token');
const setAuthCookieMock = vi.fn();
const createCsrfTokenMock = vi.fn(() => 'csrf-token');
const setCsrfCookieMock = vi.fn();
const getSectionForStudentMock = vi.fn();
const getOwnedSectionsByInstructorMock = vi.fn();

vi.mock('../../../apps/server/src/db/index.js', () => ({
  isUsingNeon: () => true,
  createUser: vi.fn(),
}));

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  getDb: getDbMock,
  createAuthEvent: createAuthEventMock,
}));

vi.mock('../../../apps/server/src/db/auth.js', () => ({
  createAuthAccount: vi.fn(),
  getAuthAccountByEmail: getAuthAccountByEmailMock,
  getAuthAccountById: vi.fn(),
  toPublicAccount: (account: Record<string, unknown>) => ({
    id: account.id,
    email: account.email,
    role: account.role,
    learnerId: account.learnerId,
    name: account.name,
    createdAt: account.createdAt,
  }),
}));

vi.mock('../../../apps/server/src/middleware/auth.js', () => ({
  signToken: signTokenMock,
  setAuthCookie: setAuthCookieMock,
  clearAuthCookie: vi.fn(),
  COOKIE_NAME: 'sql_adapt_auth',
  verifyToken: vi.fn(),
}));

vi.mock('../../../apps/server/src/middleware/csrf.js', () => ({
  createCsrfToken: createCsrfTokenMock,
  setCsrfCookie: setCsrfCookieMock,
  CSRF_COOKIE_NAME: 'sql_adapt_csrf',
  clearCsrfCookie: vi.fn(),
  requireCsrf: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../apps/server/src/db/sections.js', () => ({
  createSectionForInstructor: vi.fn(),
  enrollStudentInSection: vi.fn(),
  getOwnedSectionsByInstructor: getOwnedSectionsByInstructorMock,
  getSectionBySignupCode: vi.fn(),
  getSectionForStudent: getSectionForStudentMock,
}));

vi.mock('../../../apps/server/src/config.js', () => ({
  INSTRUCTOR_SIGNUP_CODE: 'instructor-code',
}));

function getRouteHandler(
  router: { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
  method: 'post',
  path: string,
): Function {
  const layer = router.stack?.find(
    (entry) => entry.route?.path === path && entry.route?.methods?.[method],
  );
  const handle = layer?.route?.stack?.[0]?.handle;
  if (!handle) {
    throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  }
  return handle;
}

async function invokeJsonHandler(
  handler: Function,
  body: Record<string, unknown>,
): Promise<{ status: number; json: unknown }> {
  let statusCode = 200;
  let payload: unknown = null;
  const req = {
    body,
    cookies: {},
  };
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      payload = data;
      return this;
    },
  };

  await handler(req, res);
  return { status: statusCode, json: payload };
}

afterEach(() => {
  getDbMock.mockReset().mockReturnValue({});
  getAuthAccountByEmailMock.mockReset();
  createAuthEventMock.mockReset();
  signTokenMock.mockClear();
  setAuthCookieMock.mockClear();
  createCsrfTokenMock.mockClear();
  setCsrfCookieMock.mockClear();
  getSectionForStudentMock.mockReset();
  getOwnedSectionsByInstructorMock.mockReset();
  vi.resetModules();
});

describe('auth login telemetry contract', () => {
  it('records a success auth event without changing the login response shape', async () => {
    const { authRouter } = await import('../../../apps/server/src/routes/auth');
    const loginHandler = getRouteHandler(
      authRouter as unknown as { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
      'post',
      '/login',
    );

    getAuthAccountByEmailMock.mockResolvedValue({
      id: 'account-1',
      email: 'student@example.com',
      passwordHash: '$2b$04$tSeIZObzjWyt2cVD4Grhx.FT6lKp1DntUEdquZ7e8f8LgElCdS0Fq',
      role: 'student',
      learnerId: 'learner-1',
      name: 'Student One',
      createdAt: '2026-04-05T00:00:00.000Z',
      updatedAt: '2026-04-05T00:00:00.000Z',
    });
    getSectionForStudentMock.mockResolvedValue({ id: 'section-1', name: 'Section 1' });

    const result = await invokeJsonHandler(loginHandler, {
      email: 'student@example.com',
      password: 'correct horse battery staple',
    });

    expect(getAuthAccountByEmailMock).toHaveBeenCalledWith(undefined, 'student@example.com');
    expect(result.status).toBe(200);
    expect((result.json as { success?: boolean; user?: { learnerId?: string } }).success).toBe(true);
    expect((result.json as { user?: { learnerId?: string } }).user?.learnerId).toBe('learner-1');
    expect(createAuthEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'success',
        email: 'student@example.com',
        accountId: 'account-1',
        learnerId: 'learner-1',
        role: 'student',
      }),
    );
  });

  it('records a failure auth event for invalid credentials', async () => {
    const { authRouter } = await import('../../../apps/server/src/routes/auth');
    const loginHandler = getRouteHandler(
      authRouter as unknown as { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
      'post',
      '/login',
    );

    getAuthAccountByEmailMock.mockResolvedValue(null);

    const result = await invokeJsonHandler(loginHandler, {
      email: 'missing@example.com',
      password: 'wrong',
    });

    expect(result.status).toBe(401);
    expect(result.json).toEqual({
      success: false,
      error: 'Invalid email or password',
    });
    expect(createAuthEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'failure',
        email: 'missing@example.com',
        failureReason: 'invalid_credentials',
      }),
    );
  });
});
