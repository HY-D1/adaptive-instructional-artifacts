/* @vitest-environment node */
import express, { type NextFunction, type Request, type Response } from 'express';
import type { Server } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const sectionLookup = vi.fn();
const db = {
  getUserById: vi.fn(),
  createUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
  getAllProblemProgress: vi.fn(async () => []),
  updateProblemProgress: vi.fn(async () => undefined),
  getProblemProgress: vi.fn(async () => ({ solved: true })),
  getStudentConditionAssignment: vi.fn(),
  recordSharedBanditReward: vi.fn(),
  createInteraction: vi.fn(async (data: Record<string, unknown>) => data),
};

class BanditSelectionNotFoundError extends Error {
  readonly status = 409;
}

vi.mock('../../../apps/server/src/db/sections.js', () => ({
  getSectionForLearnerInInstructorScope: sectionLookup,
  getInstructorScopedLearnerIds: vi.fn(async () => []),
  getSectionForStudent: vi.fn(async () => ({ id: 'sec-1' })),
}));

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  ...db,
  BanditSelectionNotFoundError,
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

vi.mock('../../../apps/server/src/middleware/rate-limit.js', () => ({
  banditReadRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  banditRewardRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

type Actor = { role: 'student' | 'instructor'; learnerId: string };

function asActor(req: Request, _res: Response, next: NextFunction) {
  const header = req.get('x-test-actor');
  if (header) {
    const actor = JSON.parse(header) as Actor;
    req.auth = { ...actor, accountId: `acct-${actor.learnerId}`, email: 'x@example.test', name: 'X' };
  }
  next();
}

let server: Server;
let base: string;

beforeAll(async () => {
  const { neonLearnersRouter } = await import('../../../apps/server/src/routes/neon-learners.js');
  const { neonInteractionsRouter } = await import('../../../apps/server/src/routes/neon-interactions.js');
  const { neonBanditRouter } = await import('../../../apps/server/src/routes/neon-bandit.js');
  const app = express();
  app.use(express.json());
  app.use(asActor);
  app.use('/api/learners', neonLearnersRouter);
  app.use('/api/interactions', neonInteractionsRouter);
  app.use('/api/bandit', neonBanditRouter);
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
  sectionLookup.mockResolvedValue({ id: 'sec-1', name: 'Section' });
});

const student: Actor = { role: 'student', learnerId: 'student-1' };
const instructor: Actor = { role: 'instructor', learnerId: 'instructor-1' };

function call(actor: Actor, method: string, path: string, body?: unknown) {
  return fetch(`${base}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'x-test-actor': JSON.stringify(actor) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('learner deletion is not exposed', () => {
  it('returns 405 for a student deleting themself and never touches the database', async () => {
    const response = await call(student, 'DELETE', '/api/learners/student-1');
    expect(response.status).toBe(405);
    expect(db.deleteUser).not.toHaveBeenCalled();
  });

  it('blocks an instructor from deleting an in-section student', async () => {
    const response = await call(instructor, 'DELETE', '/api/learners/student-1');
    expect(response.status).toBe(403);
    expect(db.deleteUser).not.toHaveBeenCalled();
  });
});

describe('instructors are read-only on student records', () => {
  it('lets an instructor read an in-section student progress', async () => {
    expect((await call(instructor, 'GET', '/api/learners/student-1/progress')).status).toBe(200);
  });

  it('rejects instructor progress writes for a student', async () => {
    const response = await call(instructor, 'POST', '/api/learners/student-1/progress/p1', { solved: true });
    expect(response.status).toBe(403);
    expect(db.updateProblemProgress).not.toHaveBeenCalled();
  });

  it('still lets the student write their own progress', async () => {
    const response = await call(student, 'POST', '/api/learners/student-1/progress/p1', { solved: true, eventId: 'e1' });
    expect(response.status).toBe(200);
    expect(db.updateProblemProgress).toHaveBeenCalledOnce();
  });

  it('rejects instructor interaction writes on behalf of a student', async () => {
    const response = await call(instructor, 'POST', '/api/interactions', {
      learnerId: 'student-1', eventType: 'execution', problemId: 'p1', id: 'evt-1',
    });
    expect(response.status).toBe(403);
    expect(db.createInteraction).not.toHaveBeenCalled();
  });
});

describe('learner rows cannot be forged', () => {
  it('rejects role changes through PUT', async () => {
    const response = await call(student, 'PUT', '/api/learners/student-1', { role: 'instructor' });
    expect(response.status).toBe(400);
    expect(db.updateUser).not.toHaveBeenCalled();
  });

  it('rejects creating a learner row for another id', async () => {
    const response = await call(student, 'POST', '/api/learners', { id: 'someone-else', name: 'X', role: 'instructor' });
    expect(response.status).toBe(403);
    expect(db.createUser).not.toHaveBeenCalled();
  });

  it('creates the caller row with the role from the token', async () => {
    db.getUserById.mockResolvedValue(null);
    db.createUser.mockResolvedValue({ id: 'student-1' });
    const response = await call(student, 'POST', '/api/learners', { id: 'student-1', name: 'S', role: 'instructor' });
    expect(response.status).toBe(201);
    expect(db.createUser).toHaveBeenCalledWith('student-1', { name: 'S', role: 'student' });
  });
});

describe('bandit reward provenance', () => {
  const reward = { eventId: 'r1', selectionEventId: 'sel-1', armId: 'adaptive', reward: 0.5, assignmentStrategy: 'bandit' };

  it('returns 409 when no matching selection event was logged', async () => {
    db.getStudentConditionAssignment.mockResolvedValue({ conditionId: 'adaptive' });
    db.recordSharedBanditReward.mockRejectedValue(new BanditSelectionNotFoundError('missing'));
    expect((await call(student, 'POST', '/api/bandit/reward', reward)).status).toBe(409);
  });

  it('applies a reward tied to a logged selection', async () => {
    db.getStudentConditionAssignment.mockResolvedValue({ conditionId: 'adaptive' });
    db.recordSharedBanditReward.mockResolvedValue({ armId: 'adaptive', applied: true });
    expect((await call(student, 'POST', '/api/bandit/reward', reward)).status).toBe(200);
  });

  it('guards the reward SQL with the selection event lookup', () => {
    const source = readFileSync(resolve('apps/server/src/db/neon.ts'), 'utf8');
    const fn = source.slice(source.indexOf('export async function recordSharedBanditReward'));
    expect(fn).toContain("event_type = 'bandit_arm_selected'");
    expect(fn).toContain('selected_arm = ${params.armId}');
    expect(fn).toContain('WHERE EXISTS (SELECT 1 FROM selection)');
  });
});

describe('schema provisioning', () => {
  it('creates the retrieval provenance table in initializeSchema', () => {
    const source = readFileSync(resolve('apps/server/src/db/neon.ts'), 'utf8');
    const init = source.slice(source.indexOf('export async function initializeSchema'), source.indexOf('// User Operations'));
    expect(init).toContain('CREATE TABLE IF NOT EXISTS interaction_textbook_unit_retrievals');
  });
});
