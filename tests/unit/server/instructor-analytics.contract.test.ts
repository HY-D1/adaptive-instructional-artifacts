/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getInteractionsByUsersMock = vi.fn();
const getInteractionAggregatesByUsersMock = vi.fn();
const getTextbookUnitCountsByUsersMock = vi.fn();
const getActiveLearnerCountsByUsersMock = vi.fn();
const getLearnerProfilesByIdsMock = vi.fn();
const getInstructorScopedLearnerIdsMock = vi.fn();
const getOwnedSectionsByInstructorMock = vi.fn();
const requireInstructorMock = vi.fn((_req, _res, next) => next?.());

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  getInteractionsByUsers: getInteractionsByUsersMock,
  getInteractionAggregatesByUsers: getInteractionAggregatesByUsersMock,
  getTextbookUnitCountsByUsers: getTextbookUnitCountsByUsersMock,
  getActiveLearnerCountsByUsers: getActiveLearnerCountsByUsersMock,
  getLearnerProfilesByIds: getLearnerProfilesByIdsMock,
  getInteractionsByUser: vi.fn(),
  getTextbookUnitsByUser: vi.fn(),
  getUserById: vi.fn(),
}));

vi.mock('../../../apps/server/src/db/sections.js', () => ({
  getInstructorScopedLearnerIds: getInstructorScopedLearnerIdsMock,
  getOwnedSectionsByInstructor: getOwnedSectionsByInstructorMock,
  getSectionForLearnerInInstructorScope: vi.fn(),
}));

vi.mock('../../../apps/server/src/middleware/auth.js', () => ({
  requireInstructor: requireInstructorMock,
}));

function getRouteHandler(
  router: { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
  method: 'get',
  path: string,
): Function {
  const layer = router.stack?.find(
    (entry) => entry.route?.path === path && entry.route?.methods?.[method],
  );
  const handle = layer?.route?.stack?.[layer.route.stack.length - 1]?.handle;
  if (!handle) {
    throw new Error(`Route handler not found for ${method.toUpperCase()} ${path}`);
  }
  return handle;
}

async function invokeGetHandler(
  handler: Function,
  path: string,
  query: Record<string, unknown> = {},
): Promise<{ status: number; json: unknown }> {
  let statusCode = 200;
  let payload: unknown = null;
  const req = {
    method: 'GET',
    baseUrl: '/api/instructor',
    path,
    query,
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

beforeEach(() => {
  vi.clearAllMocks();
  getInstructorScopedLearnerIdsMock.mockResolvedValue(['learner-1', 'learner-2']);
  getOwnedSectionsByInstructorMock.mockResolvedValue([
    { id: 'section-1', name: 'Section 1', studentSignupCode: 'ABC123' },
  ]);
});

describe('instructor analytics contract', () => {
  it('returns backend-authoritative summary metrics for the instructor scope', async () => {
    const { instructorRouter } = await import('../../../apps/server/src/routes/instructor');
    const getSummary = getRouteHandler(
      instructorRouter as unknown as {
        stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }>;
      },
      'get',
      '/analytics/summary',
    );

    getInteractionAggregatesByUsersMock.mockResolvedValue({
      totalCount: 9,
      interactionsByType: { execution: 5, error: 4 },
      last24Hours: 4,
      last7Days: 8,
      last30Days: 9,
    });
    getTextbookUnitCountsByUsersMock.mockResolvedValue(
      new Map([
        ['learner-1', 2],
        ['learner-2', 1],
      ]),
    );
    getActiveLearnerCountsByUsersMock.mockResolvedValue({
      last24Hours: 1,
      last7Days: 2,
      last30Days: 2,
    });
    getLearnerProfilesByIdsMock.mockResolvedValue([
      { id: 'learner-1', conceptsCovered: ['joins', 'aggregates'] },
      { id: 'learner-2', conceptsCovered: ['joins'] },
    ]);

    const result = await invokeGetHandler(getSummary, '/analytics/summary');

    expect(result.status).toBe(200);
    expect(getInstructorScopedLearnerIdsMock).toHaveBeenCalledWith('instructor-1');
    expect(getInteractionAggregatesByUsersMock).toHaveBeenCalledWith(['learner-1', 'learner-2']);
    expect(getLearnerProfilesByIdsMock).toHaveBeenCalledWith(['learner-1', 'learner-2']);
    expect(result.json).toEqual({
      success: true,
      data: {
        sections: [
          { id: 'section-1', name: 'Section 1', studentSignupCode: 'ABC123' },
        ],
        totalStudents: 2,
        activeToday: 1,
        avgConceptCoverage: 25,
        avgConceptCoverageCount: 1.5,
        totalInteractions: 9,
        totalTextbookUnits: 3,
        interactionsByType: { execution: 5, error: 4 },
        recentActivity: {
          interactionLast24Hours: 4,
          interactionLast7Days: 8,
          interactionLast30Days: 9,
          activeLearnersLast24Hours: 1,
          activeLearnersLast7Days: 2,
          activeLearnersLast30Days: 2,
        },
      },
    });
  });

  it('returns paginated instructor-scoped interactions without widening scope', async () => {
    const { instructorRouter } = await import('../../../apps/server/src/routes/instructor');
    const getInteractions = getRouteHandler(
      instructorRouter as unknown as {
        stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }>;
      },
      'get',
      '/analytics/interactions',
    );

    getInteractionsByUsersMock.mockResolvedValue({
      interactions: [
        { id: 'evt-1', learnerId: 'learner-1', eventType: 'execution', problemId: 'problem-1' },
      ],
      total: 3,
    });

    const result = await invokeGetHandler(getInteractions, '/analytics/interactions', {
      learnerId: 'learner-1',
      limit: '2',
      offset: '1',
      start: '2026-04-18T00:00:00.000Z',
      eventType: 'execution',
    });

    expect(result.status).toBe(200);
    expect(getInteractionsByUsersMock).toHaveBeenCalledWith(['learner-1'], {
      sessionId: undefined,
      eventType: 'execution',
      problemId: undefined,
      startDate: '2026-04-18T00:00:00.000Z',
      endDate: undefined,
      limit: 2,
      offset: 1,
    });
    expect(result.json).toEqual({
      success: true,
      data: [
        { id: 'evt-1', learnerId: 'learner-1', eventType: 'execution', problemId: 'problem-1' },
      ],
      pagination: {
        total: 3,
        limit: 2,
        offset: 1,
        hasMore: true,
      },
    });
  });

  it('rejects interactions queries for learners outside the instructor scope', async () => {
    const { instructorRouter } = await import('../../../apps/server/src/routes/instructor');
    const getInteractions = getRouteHandler(
      instructorRouter as unknown as {
        stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }>;
      },
      'get',
      '/analytics/interactions',
    );

    const result = await invokeGetHandler(getInteractions, '/analytics/interactions', {
      learnerId: 'learner-999',
    });

    expect(result.status).toBe(403);
    expect(getInteractionsByUsersMock).not.toHaveBeenCalled();
    expect(result.json).toEqual({
      success: false,
      error: 'Access denied: learner not in your section',
    });
  });
});
