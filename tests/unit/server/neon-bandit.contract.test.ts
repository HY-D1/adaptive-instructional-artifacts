/* @vitest-environment node */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getAssignment = vi.fn();
const getState = vi.fn();
const recordReward = vi.fn();
const { requireAuth } = { requireAuth: vi.fn((_req: any, _res: any, next: () => void) => next()) };

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  getStudentConditionAssignment: getAssignment,
  getSharedBanditState: getState,
  recordSharedBanditReward: recordReward,
}));
vi.mock('../../../apps/server/src/middleware/rate-limit.js', () => ({
  strictRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  banditReadRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
  banditRewardRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

function getHandler(router: any, method: string, path: string) {
  const layer = router.stack.find((entry: any) => entry.route?.path === path && entry.route?.methods?.[method]);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function response() {
  const result: any = { statusCode: 200, body: null };
  result.status = (code: number) => { result.statusCode = code; return result; };
  result.json = (body: unknown) => { result.body = body; return result; };
  return result;
}

beforeEach(() => vi.clearAllMocks());

describe('shared bandit routes', () => {
  it('allows adaptive students to read shared state', async () => {
    const { neonBanditRouter } = await import('../../../apps/server/src/routes/neon-bandit.js');
    getAssignment.mockResolvedValue({ conditionId: 'adaptive' });
    getState.mockResolvedValue([{ armId: 'adaptive', alpha: 2, beta: 1, pullCount: 1 }]);
    const res = response();
    await getHandler(neonBanditRouter, 'get', '/state')({ auth: { role: 'student', learnerId: 's1' } }, res, () => {});
    expect(res.statusCode).toBe(200);
    expect(getState).toHaveBeenCalledOnce();
  });

  it('blocks control students from reading or updating', async () => {
    const { neonBanditRouter } = await import('../../../apps/server/src/routes/neon-bandit.js');
    getAssignment.mockResolvedValue({ conditionId: 'control' });
    const getRes = response();
    await getHandler(neonBanditRouter, 'get', '/state')({ auth: { role: 'student', learnerId: 's1' } }, getRes, () => {});
    expect(getRes.statusCode).toBe(403);
    const postRes = response();
    await getHandler(neonBanditRouter, 'post', '/reward')({ auth: { role: 'student', learnerId: 's1' }, body: { eventId: 'e', selectionEventId: 's', armId: 'adaptive', reward: 0.5, assignmentStrategy: 'bandit' } }, postRes, () => {});
    expect(postRes.statusCode).toBe(403);
  });

  it('rejects invalid arm and reward values before persistence', async () => {
    const { neonBanditRouter } = await import('../../../apps/server/src/routes/neon-bandit.js');
    const res = response();
    await getHandler(neonBanditRouter, 'post', '/reward')({ auth: { role: 'student', learnerId: 's1' }, body: { eventId: 'e', selectionEventId: 's', armId: 'not-an-arm', reward: 2, assignmentStrategy: 'bandit' } }, res, () => {});
    expect(res.statusCode).toBe(400);
    expect(recordReward).not.toHaveBeenCalled();
  });
});
