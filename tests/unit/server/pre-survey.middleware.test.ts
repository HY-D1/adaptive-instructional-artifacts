/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSurveyInvitationsMock = vi.fn();

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  getSurveyInvitations: getSurveyInvitationsMock,
}));

function createResponse() {
  let statusCode = 200;
  let payload: unknown = null;
  const response = {
    status(code: number) {
      statusCode = code;
      return response;
    },
    json(data: unknown) {
      payload = data;
      return response;
    },
    getStatus: () => statusCode,
    getPayload: () => payload,
  };
  return response;
}

describe('requirePreSurveyCompleted', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls next when the pre-survey is completed', async () => {
    getSurveyInvitationsMock.mockResolvedValue([{ instance: 'pre', status: 'completed' }]);
    const { requirePreSurveyCompleted } = await import('../../../apps/server/src/middleware/pre-survey.js');
    const response = createResponse();
    const next = vi.fn();

    await requirePreSurveyCompleted(
      { auth: { role: 'student', learnerId: 'manual-middleware-student' } } as never,
      response as never,
      next,
    );

    expect(next).toHaveBeenCalledOnce();
    expect(response.getStatus()).toBe(200);
  });

  it.each([
    ['incomplete', [{ instance: 'pre', status: 'pending' }]],
    ['missing', []],
  ])('returns 403 when the pre-survey is %s', async (_label, invitations) => {
    getSurveyInvitationsMock.mockResolvedValue(invitations);
    const { requirePreSurveyCompleted } = await import('../../../apps/server/src/middleware/pre-survey.js');
    const response = createResponse();
    const next = vi.fn();

    await requirePreSurveyCompleted(
      { auth: { role: 'student', learnerId: 'manual-middleware-student' } } as never,
      response as never,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.getStatus()).toBe(403);
    expect(response.getPayload()).toEqual(expect.objectContaining({ code: 'PRE_SURVEY_REQUIRED' }));
  });

  it('returns 500 when the survey lookup fails', async () => {
    getSurveyInvitationsMock.mockRejectedValue(new Error('survey lookup failed'));
    const { requirePreSurveyCompleted } = await import('../../../apps/server/src/middleware/pre-survey.js');
    const response = createResponse();
    const next = vi.fn();

    await requirePreSurveyCompleted(
      { auth: { role: 'student', learnerId: 'manual-middleware-student' } } as never,
      response as never,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(response.getStatus()).toBe(500);
    expect(response.getPayload()).toEqual(expect.objectContaining({ error: 'Unable to verify pre-survey status' }));
  });
});
