import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSurveyInvitationsMock } = vi.hoisted(() => ({
  getSurveyInvitationsMock: vi.fn(),
}));

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  getSurveyInvitations: getSurveyInvitationsMock,
}));

import { requirePreSurveyCompleted } from '../../../apps/server/src/middleware/pre-survey.js';

function makeResponse() {
  const response = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(body: unknown) {
      response.body = body;
      return response;
    },
  };
  return response;
}

describe('pre-survey gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks a student with no completed pre-survey', async () => {
    getSurveyInvitationsMock.mockResolvedValue([
      { instance: 'pre', status: 'pending' },
    ]);
    const response = makeResponse();
    const next = vi.fn();

    await requirePreSurveyCompleted(
      { auth: { role: 'student', learnerId: 'student-1' } } as never,
      response as never,
      next,
    );

    expect(response.statusCode).toBe(403);
    expect(response.body).toMatchObject({ code: 'PRE_SURVEY_REQUIRED' });
    expect(next).not.toHaveBeenCalled();
  });

  it('allows a student with a completed pre-survey', async () => {
    getSurveyInvitationsMock.mockResolvedValue([
      { instance: 'pre', status: 'completed' },
      { instance: 'post', status: 'pending' },
    ]);
    const response = makeResponse();
    const next = vi.fn();

    await requirePreSurveyCompleted(
      { auth: { role: 'student', learnerId: 'student-1' } } as never,
      response as never,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(response.statusCode).toBe(200);
  });

  it('does not gate instructor activity', async () => {
    const response = makeResponse();
    const next = vi.fn();

    await requirePreSurveyCompleted(
      { auth: { role: 'instructor', learnerId: 'instructor-1' } } as never,
      response as never,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(getSurveyInvitationsMock).not.toHaveBeenCalled();
  });
});