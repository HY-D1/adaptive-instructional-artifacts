/* @vitest-environment node */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getAuthAccountByEmailMock = vi.fn();
const createAuthAccountMock = vi.fn();
const createSectionForInstructorMock = vi.fn();
const getOwnedSectionsByInstructorMock = vi.fn();
const getSectionBySignupCodeMock = vi.fn();
const enrollStudentInSectionMock = vi.fn();

vi.mock('bcryptjs', () => ({ default: { hash: vi.fn(async () => 'hashed'), compare: vi.fn() } }));
vi.mock('../../../apps/server/src/db/index.js', () => ({ isUsingNeon: () => true, createUser: vi.fn() }));
vi.mock('../../../apps/server/src/db/neon.js', () => ({ getDb: () => ({}), createAuthEvent: vi.fn() }));
vi.mock('../../../apps/server/src/db/signup-rate-limit.js', () => ({ consumeSignupLimit: vi.fn() }));
vi.mock('../../../apps/server/src/db/auth.js', () => ({
  createStudentAccount: vi.fn(),
  createAuthAccount: createAuthAccountMock,
  getAuthAccountByEmail: getAuthAccountByEmailMock,
  getAuthAccountById: vi.fn(),
  toPublicAccount: vi.fn(),
}));
vi.mock('../../../apps/server/src/middleware/auth.js', () => ({
  signToken: vi.fn(), setAuthCookie: vi.fn(), clearAuthCookie: vi.fn(), COOKIE_NAME: 'c', verifyToken: vi.fn(),
}));
vi.mock('../../../apps/server/src/middleware/csrf.js', () => ({
  createCsrfToken: vi.fn(), setCsrfCookie: vi.fn(), CSRF_COOKIE_NAME: 'x', clearCsrfCookie: vi.fn(),
  requireCsrf: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock('../../../apps/server/src/db/sections.js', () => ({
  createSectionForInstructor: createSectionForInstructorMock,
  enrollStudentInSection: enrollStudentInSectionMock,
  getOwnedSectionsByInstructor: getOwnedSectionsByInstructorMock,
  getSectionBySignupCode: getSectionBySignupCodeMock,
  getSectionForStudent: vi.fn(),
}));
vi.mock('../../../apps/server/src/config.js', () => ({ INSTRUCTOR_SIGNUP_CODE: 'instructor-code' }));

async function invokeSeed() {
  const { authRouter } = await import('../../../apps/server/src/routes/auth.js');
  const stack = (authRouter as unknown as { stack: Array<{ route?: { path?: string; stack: Array<{ handle: Function }> } }> }).stack;
  const layer = stack.find((entry) => entry.route?.path === '/test-seed')!;
  const handler = layer.route!.stack[layer.route!.stack.length - 1].handle;
  let statusCode = 200;
  let payload: any = null;
  const res = {
    status(code: number) { statusCode = code; return this; },
    json(data: unknown) { payload = data; return this; },
  };
  await handler({ headers: { 'x-e2e-test-seed-secret': 'seed-secret' }, body: {} }, res);
  return { statusCode, payload };
}

beforeEach(() => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  vi.stubEnv('DATABASE_URL', 'postgres://preview');
  vi.stubEnv('E2E_TEST_SEED_SECRET', 'seed-secret');
  createSectionForInstructorMock.mockResolvedValue({ id: 'sec-1', studentSignupCode: 'CODE1' });
  getSectionBySignupCodeMock.mockResolvedValue({ id: 'sec-1' });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('POST /api/auth/test-seed created flags', () => {
  it('reports created=true for accounts that did not exist before', async () => {
    getAuthAccountByEmailMock.mockResolvedValue(null);
    createAuthAccountMock.mockImplementation(async (_db: unknown, input: { learnerId: string }) => ({ learnerId: input.learnerId }));
    const { statusCode, payload } = await invokeSeed();
    expect(statusCode).toBe(200);
    expect(payload.results.instructor.created).toBe(true);
    expect(payload.results.student.created).toBe(true);
  });

  it('reports created=false for accounts that already existed', async () => {
    getAuthAccountByEmailMock.mockResolvedValue({ learnerId: 'existing' });
    getOwnedSectionsByInstructorMock.mockResolvedValue([{ studentSignupCode: 'CODE1' }]);
    const { statusCode, payload } = await invokeSeed();
    expect(statusCode).toBe(200);
    expect(payload.results.instructor.created).toBe(false);
    expect(payload.results.student.created).toBe(false);
    expect(createAuthAccountMock).not.toHaveBeenCalled();
  });
});
