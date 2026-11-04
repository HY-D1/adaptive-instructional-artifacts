/* @vitest-environment node */
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const db = {
  getAllProblemProgress: vi.fn(async () => []),
  updateProblemProgress: vi.fn(async () => undefined),
  getProblemProgress: vi.fn(async () => ({ solved: true })),
  getStudentConditionAssignment: vi.fn(),
  createInteraction: vi.fn(async (data: Record<string, unknown>) => data),
  getActiveSession: vi.fn(),
  saveSession: vi.fn(async () => undefined),
  getSession: vi.fn(),
};

vi.mock('../../../apps/server/src/db/sections.js', () => ({
  getSectionForLearnerInInstructorScope: vi.fn(async () => null),
  getInstructorScopedLearnerIds: vi.fn(async () => []),
  getSectionForStudent: vi.fn(async () => ({ id: 'sec-1' })),
}));

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  ...db,
  BanditSelectionNotFoundError: class extends Error {},
  StudentConditionAssignmentError: class extends Error {},
  ProfileRevisionConflict: class extends Error {},
}));

vi.mock('../../../apps/server/src/db/index.js', () => ({
  validateResearchEvent: () => ({ valid: true, missing: [] }),
  validateResearchBatchForWrite: () => ({ valid: true, failedIds: [], errors: [] }),
}));

vi.mock('../../../apps/server/src/middleware/pre-survey.js', () => ({
  requirePreSurveyCompleted: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

function asStudent(req: Request, _res: Response, next: NextFunction) {
  req.auth = {
    role: 'student',
    learnerId: 'student-1',
    accountId: 'acct-student-1',
    email: 'x@example.test',
    name: 'X',
  } as Request['auth'];
  next();
}

let server: Server;
let base: string;

beforeAll(async () => {
  const { neonInteractionsRouter } = await import('../../../apps/server/src/routes/neon-interactions.js');
  const { neonSessionsRouter } = await import('../../../apps/server/src/routes/neon-sessions.js');
  const app = express();
  app.use(express.json());
  app.use(asStudent);
  app.use('/api/interactions', neonInteractionsRouter);
  app.use('/api/sessions', neonSessionsRouter);
  server = await new Promise<Server>((done) => {
    const listening = app.listen(0, '127.0.0.1', () => done(listening));
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing test port');
  base = `http://127.0.0.1:${address.port}`;
});

afterAll(async () => {
  await new Promise<void>((done, fail) => server.close((error) => (error ? fail(error) : done())));
});

beforeEach(() => {
  vi.clearAllMocks();
  db.getStudentConditionAssignment.mockResolvedValue(null);
  db.getActiveSession.mockResolvedValue(null);
  db.getSession.mockImplementation(async (_learnerId: string, sessionId: string) => ({ sessionId }));
});

function post(path: string, body: unknown) {
  return fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function storedConditionIds(): unknown[] {
  return db.createInteraction.mock.calls.map(
    ([data]) => (data as { payload?: { conditionId?: unknown } }).payload?.conditionId,
  );
}

describe('server-authoritative condition on interactions', () => {
  it("client 'adaptive' + assignment 'control' -> stored 'control'", async () => {
    db.getStudentConditionAssignment.mockResolvedValue({ conditionId: 'control' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const response = await post('/api/interactions', {
      learnerId: 'student-1',
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
      conditionId: 'adaptive',
    });

    expect(response.status).toBe(201);
    expect(storedConditionIds()).toEqual(['control']);
    expect(warn).toHaveBeenCalledWith(
      '[condition/override]',
      expect.objectContaining({ learnerId: 'student-1', clientConditionId: 'adaptive', assignedConditionId: 'control' }),
    );
    warn.mockRestore();
  });

  it("client 'adaptive' + assignment 'control' -> adaptive bandit event rejected 400", async () => {
    db.getStudentConditionAssignment.mockResolvedValue({ conditionId: 'control' });

    const response = await post('/api/interactions', {
      learnerId: 'student-1',
      eventType: 'bandit_arm_selected',
      problemId: 'problem-1',
      selectedArm: 'adaptive',
      conditionId: 'adaptive',
    });

    expect(response.status).toBe(400);
    expect(db.createInteraction).not.toHaveBeenCalled();
  });

  it('no assignment row -> client value kept', async () => {
    db.getStudentConditionAssignment.mockResolvedValue(null);

    const response = await post('/api/interactions', {
      learnerId: 'student-1',
      eventType: 'execution',
      problemId: 'problem-1',
      successful: true,
      conditionId: 'adaptive',
    });

    expect(response.status).toBe(201);
    expect(storedConditionIds()).toEqual(['adaptive']);
  });

  it('batch path: assignment overrides client value and rejects bandit events for control', async () => {
    db.getStudentConditionAssignment.mockResolvedValue({ conditionId: 'control' });

    const response = await post('/api/interactions/batch', {
      events: [
        { id: 'e1', learnerId: 'student-1', eventType: 'execution', problemId: 'problem-1', successful: true, conditionId: 'adaptive' },
        { id: 'e2', learnerId: 'student-1', eventType: 'bandit_arm_selected', problemId: 'problem-1', selectedArm: 'adaptive', conditionId: 'adaptive' },
      ],
    });

    expect(response.status).toBeLessThan(500);
    expect(storedConditionIds()).toEqual(['control']);
  });

  it('batch path: no assignment row -> client value kept', async () => {
    db.getStudentConditionAssignment.mockResolvedValue(null);

    await post('/api/interactions/batch', {
      events: [
        { id: 'e1', learnerId: 'student-1', eventType: 'execution', problemId: 'problem-1', successful: true, conditionId: 'adaptive' },
      ],
    });

    expect(storedConditionIds()).toEqual(['adaptive']);
  });
});

describe('server-authoritative condition on sessions', () => {
  it('session create uses the assignment over body.conditionId', async () => {
    db.getStudentConditionAssignment.mockResolvedValue({ conditionId: 'control' });

    const response = await post('/api/sessions/student-1/active', {
      sessionId: 'session-1',
      conditionId: 'adaptive',
      currentProblemId: 'problem-1',
    });

    expect(response.status).toBe(200);
    expect(db.saveSession).toHaveBeenCalledWith('student-1', 'session-1', 'control', expect.any(Object));
  });

  it('session create with no assignment row keeps body.conditionId', async () => {
    db.getStudentConditionAssignment.mockResolvedValue(null);

    const response = await post('/api/sessions/student-1/active', {
      sessionId: 'session-1',
      conditionId: 'adaptive',
      currentProblemId: 'problem-1',
    });

    expect(response.status).toBe(200);
    expect(db.saveSession).toHaveBeenCalledWith('student-1', 'session-1', 'adaptive', expect.any(Object));
  });
});
