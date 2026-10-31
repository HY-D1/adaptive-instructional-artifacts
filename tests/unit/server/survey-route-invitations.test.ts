import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSurveyInvitationsMock, ensureSurveyInvitationMock } = vi.hoisted(() => ({
  getSurveyInvitationsMock: vi.fn(),
  ensureSurveyInvitationMock: vi.fn(),
}));

vi.mock('../../../apps/server/src/db/neon.js', () => ({
  getSurveyInvitations: getSurveyInvitationsMock,
  ensureSurveyInvitation: ensureSurveyInvitationMock,
}));
vi.mock('../../../apps/server/src/lib/survey-links.js', () => ({ verifySurveyCompletionToken: vi.fn() }));
vi.mock('../../../apps/server/src/middleware/rate-limit.js', () => ({ strictRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next() }));
vi.mock('../../../apps/server/src/middleware/auth.js', () => ({ requireAuth: (_req: unknown, _res: unknown, next: () => void) => next() }));

import { getSurveyInvitationsForViewer } from '../../../apps/server/src/routes/surveys.js';

const pendingPre = { instance: 'pre', status: 'pending', username: 'student-abc123' };

describe('student pre-invitation creation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a missing pre invitation for a student', async () => {
    getSurveyInvitationsMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([pendingPre]);
    ensureSurveyInvitationMock.mockResolvedValue(pendingPre);

    const result = await getSurveyInvitationsForViewer('student-1', 'student');

    expect(ensureSurveyInvitationMock).toHaveBeenCalledWith('student-1', 'pre');
    expect(result).toEqual([pendingPre]);
  });

  it('is race-safe when two student requests arrive together', async () => {
    const rows: any[] = [];
    getSurveyInvitationsMock.mockImplementation(async () => [...rows]);
    ensureSurveyInvitationMock.mockImplementation(async () => {
      if (!rows.some((row) => row.instance === 'pre')) rows.push(pendingPre);
      return pendingPre;
    });

    await Promise.all([
      getSurveyInvitationsForViewer('student-1', 'student'),
      getSurveyInvitationsForViewer('student-1', 'student'),
    ]);

    expect(rows.filter((row) => row.instance === 'pre')).toHaveLength(1);
    expect(ensureSurveyInvitationMock).toHaveBeenCalledTimes(2);
  });

  it('does not create invitations for instructors', async () => {
    getSurveyInvitationsMock.mockResolvedValue([]);

    expect(await getSurveyInvitationsForViewer('instructor-1', 'instructor')).toEqual([]);
    expect(ensureSurveyInvitationMock).not.toHaveBeenCalled();
  });
});