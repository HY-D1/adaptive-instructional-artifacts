import { beforeEach, describe, expect, it, vi } from 'vitest';

const { safeSetMock } = vi.hoisted(() => ({
  safeSetMock: vi.fn(),
}));

vi.mock('./safe-storage', () => ({
  safeSet: safeSetMock,
}));

import { BACKUP_VERSION, importAllData, type AppBackup } from './backup-restore';

describe('backup-restore importAllData', () => {
  beforeEach(() => {
    localStorage.clear();
    safeSetMock.mockReset();
    safeSetMock.mockReturnValue({ success: true });
  });

  it('uses safeSet for structured payloads and keeps lastActive as a raw string', () => {
    const backup: AppBackup = {
      version: BACKUP_VERSION,
      createdAt: '2024-04-01T00:00:00.000Z',
      app: 'sql-adapt',
      userProfile: {
        id: 'learner-1',
        name: 'Ada Lovelace',
        role: 'student',
        createdAt: 1711929600000,
      },
      interactions: [{ id: 'interaction-1' }],
      textbook: [{ id: 'textbook-1' }],
      sessions: [{ id: 'session-1' }],
      learnerProfiles: { learnerId: 'learner-1' },
      reinforcementSchedules: [{ id: 'schedule-1' }],
      pdfIndex: { version: 1 },
      settings: {
        lastActive: '2024-04-01T12:34:56.000Z',
        sessionConfig: { theme: 'midnight' },
      },
    };

    const setItemSpy = vi.spyOn(localStorage, 'setItem');

    const result = importAllData(backup);

    expect(result.success).toBe(true);
    expect(safeSetMock).toHaveBeenCalledTimes(8);
    expect(safeSetMock.mock.calls.map(([key]) => key)).toEqual([
      'sql-adapt-user-profile',
      'sql-learning-interactions',
      'sql-learning-textbook',
      'sql-learning-active-session',
      'sql-learning-profiles',
      'sql-learning-reinforcement-schedules',
      'sql-learning-pdf-index',
      'sql-adapt-session-config',
    ]);
    for (const call of safeSetMock.mock.calls) {
      expect(call[2]).toEqual({ priority: 'critical' });
    }
    expect(setItemSpy).toHaveBeenCalledTimes(1);
    expect(setItemSpy).toHaveBeenCalledWith(
      'sql-adapt-last-active',
      '2024-04-01T12:34:56.000Z',
    );
  });
});
