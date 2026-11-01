/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getInstructorScopedLearnerIdsMock = vi.fn();
const getLearnerProfilesByIdsMock = vi.fn();
const updateProblemProgressMock = vi.fn();
const getProblemProgressMock = vi.fn();
const updateLearnerProfileFromEventMock = vi.fn();
const getLearnerProfileMock = vi.fn();
const assignStudentConditionMock = vi.fn();
class StudentConditionAssignmentErrorMock extends Error {
  readonly status = 400;
}
const requireInstructorMock = vi.fn((_req, _res, next) => next?.());
const requireOwnershipMock = vi.fn((_req, _res, next) => next?.());

vi.mock('../../../apps/server/src/db/sections.js', () => ({
  getInstructorScopedLearnerIds: getInstructorScopedLearnerIdsMock,
}));

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  getLearnerProfilesByIds: getLearnerProfilesByIdsMock,
  updateProblemProgress: updateProblemProgressMock,
  getProblemProgress: getProblemProgressMock,
  updateLearnerProfileFromEvent: updateLearnerProfileFromEventMock,
  getLearnerProfile: getLearnerProfileMock,
  assignStudentCondition: assignStudentConditionMock,
  StudentConditionAssignmentError: StudentConditionAssignmentErrorMock,
  getUserById: vi.fn(),
  getAllUsers: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  getActiveSession: vi.fn(),
  saveSession: vi.fn(),
  getSession: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock('../../../apps/server/src/middleware/auth.js', () => ({
  requireInstructor: requireInstructorMock,
  requireOwnership: requireOwnershipMock,
}));

function getRouteHandler(
  router: { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
  method: 'get' | 'post',
  path: string,
): Function {
  const layer = router.stack?.find(
    (entry) => entry.route?.path === path && entry.route?.methods?.[method],
  );
  const stack = layer?.route?.stack ?? [];
  const handle = stack[stack.length - 1]?.handle;
  if (!handle) {
    throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  }
  return handle;
}

async function invokeStatusPostHandler(handler: Function, body: unknown): Promise<number> {
  let status = 200;
  const res = {
    status(code: number) { status = code; return this; },
    json() { return this; },
  };
  await handler({ body, params: { id: 'learner-1', problemId: 'problem-1' } }, res);
  return status;
}

async function invokeGetHandler(handler: Function): Promise<{ status: number; json: unknown }> {
  let statusCode = 200;
  let payload: unknown = null;
  const req = {
    method: 'GET',
    baseUrl: '/api/learners',
    path: '/profiles',
    auth: { learnerId: 'instructor-1', role: 'instructor' },
  } as Record<string, unknown>;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      payload = data;
      return this;
    },
  } as Record<string, unknown>;

  await handler(req, res);
  return { status: statusCode, json: payload };
}

async function invokePostHandler(
  handler: Function,
  body: Record<string, unknown>,
): Promise<{ status: number; json: unknown }> {
  let statusCode = 200;
  let payload: unknown = null;
  const req = {
    method: 'POST',
    baseUrl: '/api/learners',
    path: '/student-1/condition-assignment',
    params: { id: 'student-1' },
    body,
  } as Record<string, unknown>;
  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(data: unknown) {
      payload = data;
      return this;
    },
  } as Record<string, unknown>;

  await handler(req, res);
  return { status: statusCode, json: payload };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('neon learners profile contract', () => {
  it('validates optional event IDs before direct and profile writes, including the whole batch', async () => {
    const { neonLearnersRouter } = await import('../../../apps/server/src/routes/neon-learners');
    const router = neonLearnersRouter as unknown as Parameters<typeof getRouteHandler>[0];
    const progress = getRouteHandler(router, 'post', '/:id/progress/:problemId');
    const profile = getRouteHandler(router, 'post', '/:id/profile/events');
    const batch = getRouteHandler(router, 'post', '/:id/profile/events/batch');
    for (const eventId of ['', '  ', null, 123, {}, 'x'.repeat(257)]) {
      expect(await invokeStatusPostHandler(progress, { eventId })).toBe(400);
      expect(await invokeStatusPostHandler(profile, { event: { eventId } })).toBe(400);
      expect(await invokeStatusPostHandler(batch, { events: [{ eventId: 'valid' }, { eventId }] })).toBe(400);
    }
    expect(updateProblemProgressMock).not.toHaveBeenCalled();
    expect(updateLearnerProfileFromEventMock).not.toHaveBeenCalled();
    expect(getLearnerProfileMock).not.toHaveBeenCalled();

    getProblemProgressMock.mockResolvedValue({});
    updateLearnerProfileFromEventMock.mockResolvedValue({});
    getLearnerProfileMock.mockResolvedValue({});
    expect(await invokeStatusPostHandler(progress, {})).toBe(200);
    expect(await invokeStatusPostHandler(profile, { event: {} })).toBe(200);
    expect(await invokeStatusPostHandler(batch, { events: [{}] })).toBe(200);
    expect(await invokeStatusPostHandler(progress, { eventId: 'x'.repeat(256) })).toBe(200);
    expect(await invokeStatusPostHandler(profile, { event: { eventId: 'valid' } })).toBe(200);
  });
  it('fetches scoped learner profiles in one batch call', async () => {
    const { neonLearnersRouter } = await import('../../../apps/server/src/routes/neon-learners');
    const getProfiles = getRouteHandler(
      neonLearnersRouter as unknown as {
        stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }>;
      },
      'get',
      '/profiles',
    );

    getInstructorScopedLearnerIdsMock.mockResolvedValue(['learner-1', 'learner-2', 'learner-3']);
    getLearnerProfilesByIdsMock.mockResolvedValue([
      { id: 'learner-1', conceptsCovered: ['joins'] },
      { id: 'learner-2', conceptsCovered: ['aggregates'] },
    ]);

    const result = await invokeGetHandler(getProfiles);

    expect(result.status).toBe(200);
    expect(getInstructorScopedLearnerIdsMock).toHaveBeenCalledWith('instructor-1');
    expect(getLearnerProfilesByIdsMock).toHaveBeenCalledTimes(1);
    expect(getLearnerProfilesByIdsMock).toHaveBeenCalledWith(['learner-1', 'learner-2', 'learner-3']);
    expect(result.json).toEqual({
      success: true,
      data: [
        { id: 'learner-1', conceptsCovered: ['joins'] },
        { id: 'learner-2', conceptsCovered: ['aggregates'] },
      ],
    });
  });

  it('rejects an assignment section that is not eligible for the student', async () => {
    const { neonLearnersRouter } = await import('../../../apps/server/src/routes/neon-learners');
    const assignCondition = getRouteHandler(
      neonLearnersRouter as unknown as {
        stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }>;
      },
      'post',
      '/:id/condition-assignment',
    );

    assignStudentConditionMock.mockRejectedValue(
      new StudentConditionAssignmentErrorMock(
        'Student is not enrolled in an eligible production section',
      ),
    );

    const result = await invokePostHandler(assignCondition, {
      firstSectionId: 'qa-section',
    });

    expect(result.status).toBe(400);
    expect(result.json).toEqual({
      success: false,
      error: 'Student is not enrolled in an eligible production section',
    });
  });
});
