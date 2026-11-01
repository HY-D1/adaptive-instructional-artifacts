/* @vitest-environment node */

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

const createInteractionMock = vi.fn();
const updateProblemProgressMock = vi.fn();
const linkTextbookRetrievalsMock = vi.fn();
const getInteractionsByUserMock = vi.fn();
const getInteractionByIdMock = vi.fn();
const validateResearchEventMock = vi.fn();
const validateResearchBatchForWriteMock = vi.fn();
const getSectionForLearnerInInstructorScopeMock = vi.fn();
const getSectionForStudentMock = vi.fn();

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  createInteraction: createInteractionMock,
  updateProblemProgress: updateProblemProgressMock,
  linkTextbookRetrievals: linkTextbookRetrievalsMock,
  getInteractionsByUser: getInteractionsByUserMock,
  getInteractionById: getInteractionByIdMock,
}));

vi.mock('../../../apps/server/src/db/index.js', () => ({
  validateResearchEvent: validateResearchEventMock,
  validateResearchBatchForWrite: validateResearchBatchForWriteMock,
}));

vi.mock('../../../apps/server/src/db/sections.js', () => ({
  getSectionForLearnerInInstructorScope: getSectionForLearnerInInstructorScopeMock,
  getSectionForStudent: getSectionForStudentMock,
}));

function getRouteHandler(
  router: { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
  method: 'post' | 'put' | 'get',
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

async function invokeJsonHandler(
  handler: Function,
  body: Record<string, unknown>,
): Promise<{ status: number; json: unknown }> {
  let statusCode = 200;
  let payload: unknown = null;
  const req = {
    method: 'POST',
    baseUrl: '/api/interactions',
    path: '/',
    body,
    auth: undefined,
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

async function invokeGetHandler(
  handler: Function,
  query: Record<string, unknown>,
  auth?: { learnerId: string; role: 'student' | 'instructor' },
): Promise<{ status: number; json: unknown }> {
  let statusCode = 200;
  let payload: unknown = null;
  const req = {
    method: 'GET',
    baseUrl: '/api/interactions',
    path: '/',
    query,
    auth,
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
  createInteractionMock.mockReset();
  updateProblemProgressMock.mockReset();
  linkTextbookRetrievalsMock.mockReset();
  getInteractionsByUserMock.mockReset();
  getInteractionByIdMock.mockReset();
  validateResearchEventMock.mockReset();
  validateResearchBatchForWriteMock.mockReset();
  getSectionForLearnerInInstructorScopeMock.mockReset();
  getSectionForStudentMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('neon-interactions single-event contract', () => {
  it('retains condition, execution timing and metadata on an existing event', async () => {
    const { neonInteractionsRouter } = await import('../../../apps/server/src/routes/neon-interactions');
    const handler = getRouteHandler(neonInteractionsRouter as unknown as Parameters<typeof getRouteHandler>[0], 'post', '/');
    createInteractionMock.mockImplementation(async (data) => data);
    const result = await invokeJsonHandler(handler, {
      id: 'execution-fields', learnerId: 'learner-1', sessionId: 'session-1',
      eventType: 'execution', problemId: 'problem-1', conditionId: 'condition-1',
      executionTimeMs: 0, metadata: { source: 'test', attempt: 1 },
    });
    expect(result.status).toBe(201);
    expect(createInteractionMock).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ conditionId: 'condition-1', executionTimeMs: 0, metadata: { source: 'test', attempt: 1 } }),
    }));
  });
  it('accepts and persists execution fields emitted by the frontend alongside legacy payload', async () => {
    const { neonInteractionsRouter } = await import('../../../apps/server/src/routes/neon-interactions');
    const postInteraction = getRouteHandler(neonInteractionsRouter as unknown as Parameters<typeof getRouteHandler>[0], 'post', '/');
    createInteractionMock.mockImplementation(async (data) => data);
    const result = await invokeJsonHandler(postInteraction, {
      id: 'execution-1', learnerId: 'learner-1', sessionId: 'session-1',
      eventType: 'execution', problemId: 'problem-1', code: 'SELECT 1',
      successful: true, policyVersion: 'policy-v1', conceptIds: ['select-basic'],
      timeSpent: 120, payload: { legacy: 'preserved' },
    });
    expect(result.status).toBe(201);
    expect(updateProblemProgressMock).toHaveBeenCalledWith('learner-1', 'problem-1', {
      eventId: 'execution-1', solved: true, incrementAttempts: true, lastCode: 'SELECT 1',
    });
    expect(createInteractionMock).toHaveBeenCalledWith(expect.objectContaining({
      id: 'execution-1', payload: expect.objectContaining({
        legacy: 'preserved', policyVersion: 'policy-v1', conceptIds: ['select-basic'], timeSpent: 120,
      }),
    }));
  });

  it('accepts and persists a frontend hint event in a verified batch', async () => {
    const { neonInteractionsRouter } = await import('../../../apps/server/src/routes/neon-interactions');
    const postBatch = getRouteHandler(neonInteractionsRouter as unknown as Parameters<typeof getRouteHandler>[0], 'post', '/batch');
    createInteractionMock.mockImplementation(async (data) => data);
    const result = await invokeJsonHandler(postBatch, { events: [{
      id: 'hint-1', learnerId: 'learner-1', sessionId: 'session-1',
      eventType: 'hint_view', problemId: 'problem-1', hintId: 'hint-1',
      hintText: 'Check the filter', hintLevel: 1, helpRequestIndex: 1,
      sqlEngageSubtype: 'incomplete query', sqlEngageRowId: 'row-1',
      policyVersion: 'policy-v1', templateId: 'hint-template', conceptIds: ['where-clause'],
    }] });
    expect(result.status).toBe(201);
    expect(result.json).toEqual(expect.objectContaining({ data: expect.objectContaining({ confirmedIds: ['hint-1'] }) }));
    expect(createInteractionMock).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ policyVersion: 'policy-v1', helpRequestIndex: 1, conceptIds: ['where-clause'] }),
    }));
  });

  it('does not confirm a batch event when its progress write fails, and can retry it', async () => {
    const { neonInteractionsRouter } = await import('../../../apps/server/src/routes/neon-interactions');
    const handler = getRouteHandler(neonInteractionsRouter as unknown as Parameters<typeof getRouteHandler>[0], 'post', '/batch');
    createInteractionMock.mockImplementation(async (data) => data);
    updateProblemProgressMock.mockRejectedValueOnce(new Error('progress unavailable'));
    const body = { events: [{ id: 'exec-retry', learnerId: 'learner-1', eventType: 'execution',
      problemId: 'problem-1', code: 'SELECT 1', successful: true }] };
    const failed = await invokeJsonHandler(handler, structuredClone(body));
    expect(failed.status).toBe(500);
    expect(failed.json).toMatchObject({ success: false, failedEvents: [{ eventId: 'exec-retry' }] });
    const retry = await invokeJsonHandler(handler, structuredClone(body));
    expect(retry.status).toBe(201);
    expect(retry.json).toMatchObject({ data: { confirmedIds: ['exec-retry'] } });
    expect(updateProblemProgressMock).toHaveBeenLastCalledWith('learner-1', 'problem-1',
      expect.objectContaining({ eventId: 'exec-retry', lastCode: 'SELECT 1', solved: true }));
  });

  it('rejects invalid types for frontend fields', async () => {
    const { neonInteractionsRouter } = await import('../../../apps/server/src/routes/neon-interactions');
    const postInteraction = getRouteHandler(neonInteractionsRouter as unknown as Parameters<typeof getRouteHandler>[0], 'post', '/');
    const result = await invokeJsonHandler(postInteraction, {
      learnerId: 'learner-1', eventType: 'execution', problemId: 'problem-1',
      policyVersion: 4, conceptIds: 'select-basic', timeSpent: '120',
    });
    expect(result.status).toBe(400);
    expect(createInteractionMock).not.toHaveBeenCalled();
  });

  it('rejects unknown fields before creating an interaction', async () => {
    const { neonInteractionsRouter } = await import('../../../apps/server/src/routes/neon-interactions');
    const postInteraction = getRouteHandler(
      neonInteractionsRouter as unknown as {
        stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }>;
      },
      'post',
      '/',
    );

    const result = await invokeJsonHandler(postInteraction, {
      learnerId: 'learner-1',
      eventType: 'execution',
      problemId: 'problem-1',
      unexpectedField: 'not-allowed',
    });

    expect(result.status).toBe(400);
    expect(result.json).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Schema validation failed',
        issues: expect.arrayContaining([expect.any(String)]),
      }),
    );
    expect(createInteractionMock).not.toHaveBeenCalled();
  });

  it('rejects oversized string input before creating an interaction', async () => {
    const { neonInteractionsRouter } = await import('../../../apps/server/src/routes/neon-interactions');
    const postInteraction = getRouteHandler(
      neonInteractionsRouter as unknown as {
        stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }>;
      },
      'post',
      '/',
    );

    const result = await invokeJsonHandler(postInteraction, {
      learnerId: 'learner-1',
      eventType: 'execution',
      problemId: 'problem-1',
      code: 'x'.repeat(50001),
    });

    expect(result.status).toBe(400);
    expect(result.json).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Schema validation failed',
        issues: expect.arrayContaining([expect.any(String)]),
      }),
    );
    expect(createInteractionMock).not.toHaveBeenCalled();
  });

  it('keeps GET /api/interactions scoped to the authenticated learner', async () => {
    const { neonInteractionsRouter } = await import('../../../apps/server/src/routes/neon-interactions');
    const getInteractions = getRouteHandler(
      neonInteractionsRouter as unknown as {
        stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }>;
      },
      'get',
      '/',
    );

    getSectionForStudentMock.mockResolvedValue({ id: 'section-1' });
    getInteractionsByUserMock.mockResolvedValue({
      interactions: [
        {
          id: 'event-1',
          learnerId: 'learner-1',
          eventType: 'execution',
          problemId: 'problem-1',
        },
      ],
      total: 1,
    });

    const result = await invokeGetHandler(
      getInteractions,
      { learnerId: 'spoofed-learner', limit: '25', offset: '0' },
      { learnerId: 'learner-1', role: 'student' },
    );

    expect(result.status).toBe(403);

    const ownResult = await invokeGetHandler(
      getInteractions,
      { limit: '25', offset: '0' },
      { learnerId: 'learner-1', role: 'student' },
    );

    expect(ownResult.status).toBe(200);
    expect(getInteractionsByUserMock).toHaveBeenCalledWith('learner-1', {
      sessionId: undefined,
      eventType: undefined,
      problemId: undefined,
      limit: 25,
      offset: 0,
    });
    expect(ownResult.json).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            learnerId: 'learner-1',
          }),
        ]),
      }),
    );
  });
});
