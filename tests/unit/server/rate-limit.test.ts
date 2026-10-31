/* @vitest-environment node */

import { afterEach, describe, expect, it, vi } from 'vitest';

const rateLimitMock = vi.hoisted(() => vi.fn((options: unknown) => options));

vi.mock('express-rate-limit', () => ({ rateLimit: rateLimitMock }));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  rateLimitMock.mockClear();
});

describe('student data rate limiter', () => {
  it('defaults to 600 requests per 15 minutes and sets Retry-After', async () => {
    const { STUDENT_DATA_RATE_LIMIT, studentDataLimiterOptions } = await import('../../../apps/server/src/middleware/rate-limit.js');
    const limiter = studentDataLimiterOptions;
    const response = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };

    expect(STUDENT_DATA_RATE_LIMIT).toBe(600);
    expect(limiter.windowMs).toBe(15 * 60 * 1000);
    expect(limiter.limit).toBe(600);
    limiter.handler({}, response);
    expect(response.setHeader).toHaveBeenCalledWith('Retry-After', '900');
    expect(response.status).toHaveBeenCalledWith(429);
  });

  it('uses a positive STUDENT_DATA_RATE_LIMIT override', async () => {
    vi.stubEnv('STUDENT_DATA_RATE_LIMIT', '750');
    const { STUDENT_DATA_RATE_LIMIT } = await import('../../../apps/server/src/middleware/rate-limit.js');

    expect(STUDENT_DATA_RATE_LIMIT).toBe(750);
  });

  it('uses classroom-safe defaults for signup and dedicated service limits', async () => {
    const {
      SIGNUP_RATE_LIMIT,
      LLM_RATE_LIMIT,
      BANDIT_READ_RATE_LIMIT,
      BANDIT_REWARD_RATE_LIMIT,
      SURVEY_RATE_LIMIT,
    } = await import('../../../apps/server/src/middleware/rate-limit.js');

    expect(SIGNUP_RATE_LIMIT).toBeGreaterThanOrEqual(100);
    expect(LLM_RATE_LIMIT).toBe(60);
    expect(BANDIT_READ_RATE_LIMIT).toBe(300);
    expect(BANDIT_REWARD_RATE_LIMIT).toBe(60);
    expect(SURVEY_RATE_LIMIT).toBeGreaterThanOrEqual(100);
  });
});