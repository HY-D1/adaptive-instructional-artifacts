/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest';

const getActiveSessionMock = vi.fn();
const saveSessionMock = vi.fn();
const getSessionMock = vi.fn();

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  getActiveSession: getActiveSessionMock,
  saveSession: saveSessionMock,
  getSession: getSessionMock,
}));

vi.mock('../../../apps/server/src/middleware/auth.js', () => ({
  requireOwnership: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

function getRouteHandler(
  router: { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
  method: 'post' | 'put' | 'get',
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
  {
    params,
    body,
  }: {
    params: Record<string, string>;
    body?: Record<string, unknown>;
  },
): Promise<{ status: number; json: unknown }> {
  let statusCode = 200;
  let payload: unknown = null;
  const req = {
    method: 'POST',
    baseUrl: '/api/sessions',
    path: '/:learnerId/active',
    params,
    body: body ?? {},
    auth: { role: 'student', learnerId: params.learnerId },
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

afterEach(() => {
  getActiveSessionMock.mockReset();
  saveSessionMock.mockReset();
  getSessionMock.mockReset();
});

describe('neon-sessions contract', () => {
  it('keeps sessionId and currentProblemId distinct in POST mapping', async () => {
    const { neonSessionsRouter } = await import('../../../apps/server/src/routes/neon-sessions');
    const postActive = getRouteHandler(
      neonSessionsRouter as unknown as { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
      'post',
      '/:learnerId/active',
    );

    getActiveSessionMock.mockResolvedValue(null);
    saveSessionMock.mockResolvedValue(undefined);
    getSessionMock.mockResolvedValue({
      sessionId: 'session-abc',
      currentProblemId: 'problem-2',
      sectionId: null,
      lastCode: 'SELECT * FROM employees WHERE salary > 70000',
      guidanceState: { source: 'seed' },
      hdiState: null,
      banditState: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const result = await invokeJsonHandler(postActive, {
      params: { learnerId: 'learner-1' },
      body: {
        sessionId: 'session-abc',
        currentProblemId: 'problem-2',
        currentCode: 'SELECT * FROM employees WHERE salary > 70000',
      },
    });

    expect(result.status).toBe(200);
    expect(saveSessionMock).toHaveBeenCalledWith(
      'learner-1',
      'session-abc',
      'default',
      expect.objectContaining({
        currentProblemId: 'problem-2',
        currentCode: 'SELECT * FROM employees WHERE salary > 70000',
      }),
    );
    expect((result.json as { data?: { sessionId?: string; currentProblemId?: string } }).data).toEqual(
      expect.objectContaining({
        sessionId: 'session-abc',
        currentProblemId: 'problem-2',
      }),
    );
  });

  it('treats heartbeat payloads as read-through and does not clobber state', async () => {
    const { neonSessionsRouter } = await import('../../../apps/server/src/routes/neon-sessions');
    const postActive = getRouteHandler(
      neonSessionsRouter as unknown as { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
      'post',
      '/:learnerId/active',
    );

    getActiveSessionMock.mockResolvedValue({
      sessionId: 'session-existing',
      currentProblemId: 'problem-2',
      sectionId: null,
      lastCode: 'SELECT * FROM employees WHERE salary > 70000',
      guidanceState: { source: 'existing' },
      hdiState: null,
      banditState: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActivity: Date.now(),
    });

    const result = await invokeJsonHandler(postActive, {
      params: { learnerId: 'learner-1' },
      body: {},
    });

    expect(result.status).toBe(200);
    expect(saveSessionMock).not.toHaveBeenCalled();
    expect((result.json as { data?: { currentCode?: string; currentProblemId?: string } }).data).toEqual(
      expect.objectContaining({
        currentProblemId: 'problem-2',
        currentCode: 'SELECT * FROM employees WHERE salary > 70000',
      }),
    );
  });

  it('preserves existing condition flags when partial updates omit them', async () => {
    const { neonSessionsRouter } = await import('../../../apps/server/src/routes/neon-sessions');
    const postActive = getRouteHandler(
      neonSessionsRouter as unknown as { stack?: Array<{ route?: { path?: string; methods?: Record<string, boolean>; stack?: Array<{ handle?: Function }> } }> },
      'post',
      '/:learnerId/active',
    );

    getActiveSessionMock.mockResolvedValue({
      sessionId: 'session-existing',
      currentProblemId: 'problem-2',
      sectionId: 'section-1',
      conditionId: 'adaptive-bandit',
      textbookDisabled: true,
      adaptiveLadderDisabled: true,
      immediateExplanationMode: true,
      staticHintMode: false,
      escalationPolicy: 'explanation_first',
      lastCode: 'SELECT 1',
      guidanceState: { source: 'existing' },
      hdiState: { hdi: 0.8 },
      banditState: { selectedArm: 'arm-a' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActivity: Date.now(),
    });
    saveSessionMock.mockResolvedValue(undefined);
    getSessionMock.mockResolvedValue({
      sessionId: 'session-existing',
      currentProblemId: 'problem-2',
      sectionId: 'section-1',
      conditionId: 'adaptive-bandit',
      textbookDisabled: true,
      adaptiveLadderDisabled: true,
      immediateExplanationMode: true,
      staticHintMode: false,
      escalationPolicy: 'explanation_first',
      lastCode: 'SELECT updated_value FROM employees',
      guidanceState: { source: 'existing' },
      hdiState: { hdi: 0.8 },
      banditState: { selectedArm: 'arm-a' },
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastActivity: Date.now(),
    });

    const result = await invokeJsonHandler(postActive, {
      params: { learnerId: 'learner-1' },
      body: {
        currentCode: 'SELECT updated_value FROM employees',
        lastActivity: new Date().toISOString(),
      },
    });

    expect(result.status).toBe(200);
    expect(saveSessionMock).toHaveBeenCalledWith(
      'learner-1',
      'session-existing',
      'adaptive-bandit',
      expect.objectContaining({
        currentProblemId: 'problem-2',
        textbookDisabled: true,
        adaptiveLadderDisabled: true,
        immediateExplanationMode: true,
        staticHintMode: false,
        escalationPolicy: 'explanation_first',
        currentCode: 'SELECT updated_value FROM employees',
        guidanceState: { source: 'existing' },
        hdiState: { hdi: 0.8 },
        banditState: { selectedArm: 'arm-a' },
      }),
    );
    expect((result.json as { data?: Record<string, unknown> }).data).toEqual(
      expect.objectContaining({
        sessionId: 'session-existing',
        conditionId: 'adaptive-bandit',
        textbookDisabled: true,
        adaptiveLadderDisabled: true,
        immediateExplanationMode: true,
        staticHintMode: false,
        escalationPolicy: 'explanation_first',
      }),
    );
  });
});
