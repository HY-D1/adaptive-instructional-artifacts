import { beforeEach, describe, expect, it, vi } from 'vitest';

const { safeSetMock } = vi.hoisted(() => ({
  safeSetMock: vi.fn(),
}));

vi.mock('./safe-storage', () => ({
  safeSet: safeSetMock,
}));

import { saveHintSnapshot } from './hint-cache';

describe('hint-cache safe storage integration', () => {
  beforeEach(() => {
    localStorage.clear();
    safeSetMock.mockReset();
  });

  it('writes hint snapshots through safeSet with cache priority', () => {
    safeSetMock.mockReturnValue({ success: true });

    const result = saveHintSnapshot({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      currentRung: 2,
      visibleHintCount: 1,
      lastHintId: 'hint-1',
      lastHelpRequestIndex: 1,
      enhancedHintInfo: [],
    });

    expect(result.success).toBe(true);
    expect(safeSetMock).toHaveBeenCalledTimes(1);
    expect(safeSetMock).toHaveBeenCalledWith(
      'hint-cache:learner-1:problem-1',
      expect.objectContaining({
        learnerId: 'learner-1',
        problemId: 'problem-1',
      }),
      { priority: 'cache' },
    );
  });

  it('returns the quota diagnostic when safeSet reports quotaExceeded', () => {
    safeSetMock.mockReturnValue({
      success: false,
      quotaExceeded: true,
      error: 'Storage quota exceeded',
    });

    const result = saveHintSnapshot({
      learnerId: 'learner-1',
      problemId: 'problem-2',
      currentRung: 1,
      visibleHintCount: 1,
      lastHintId: 'hint-2',
      lastHelpRequestIndex: 1,
      enhancedHintInfo: [],
    });

    expect(result).toMatchObject({
      success: false,
      quotaExceeded: true,
      diagnostic: 'hint_cache_write_skipped_quota',
    });
  });

  it('throws when safeSet reports a non-quota storage failure', () => {
    safeSetMock.mockReturnValue({
      success: false,
      error: 'Storage error: disk failure',
    });

    expect(() =>
      saveHintSnapshot({
        learnerId: 'learner-1',
        problemId: 'problem-3',
        currentRung: 1,
        visibleHintCount: 1,
        lastHintId: 'hint-3',
        lastHelpRequestIndex: 1,
        enhancedHintInfo: [],
      }),
    ).toThrow('Storage error: disk failure');
  });
});
