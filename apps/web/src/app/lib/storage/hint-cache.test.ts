import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  cleanupHintCache,
  loadHintInfo,
  migrateLegacyHintKeys,
  saveHintSnapshot,
} from './hint-cache';

const quotaError = () => {
  const error = new DOMException('Quota exceeded', 'QuotaExceededError');
  Object.defineProperty(error, 'code', { value: 22 });
  return error;
};

describe('hint-cache', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('returns quotaExceeded instead of throwing when localStorage is full', () => {
    const setItemSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw quotaError();
    });

    const result = saveHintSnapshot({
      learnerId: 'learner-1',
      problemId: 'problem-1',
      currentRung: 2,
      visibleHintCount: 2,
      lastHintId: 'hint-2',
      lastHelpRequestIndex: 2,
      lastHintPreview: 'Use a WHERE clause to filter rows.',
      enhancedHintInfo: [
        {
          isEnhanced: false,
          sources: { sqlEngage: true, textbook: false, llm: false, pdfPassages: false },
        },
      ],
    });

    expect(setItemSpy).toHaveBeenCalled();
    expect(result).toMatchObject({
      success: false,
      quotaExceeded: true,
      diagnostic: 'hint_cache_write_skipped_quota',
    });
  });

  it('does not persist raw multi-hint arrays and keeps payload under budget', () => {
    const hintsPayload = Array.from({ length: 8 }, (_, index) => `hint-${index}-${'x'.repeat(500)}`);

    const result = saveHintSnapshot({
      learnerId: 'learner-1',
      problemId: 'problem-2',
      currentRung: 3,
      visibleHintCount: 8,
      lastHintId: 'hint-8',
      lastHelpRequestIndex: 8,
      lastHintPreview: hintsPayload.join(' '),
      enhancedHintInfo: Array.from({ length: 8 }, () => ({
        isEnhanced: true,
        sources: { sqlEngage: true, textbook: true, llm: true, pdfPassages: true },
        llmErrorMessage: 'y'.repeat(400),
      })),
    });

    const saved = loadHintInfo({ learnerId: 'learner-1', problemId: 'problem-2' });

    expect(result.success).toBe(true);
    expect(result.bytes).toBeGreaterThan(0);
    expect(result.bytes).toBeLessThanOrEqual(result.budgetBytes ?? Number.MAX_SAFE_INTEGER);
    expect(saved.snapshot).not.toBeNull();
    expect(saved.snapshot).not.toHaveProperty('hints');
    expect(saved.snapshot?.lastHintPreview?.length ?? 0).toBeLessThan(hintsPayload.join(' ').length);
  });

  it('removes legacy hints keys during migration and reports how many were removed', () => {
    localStorage.setItem('hints-learner-1-problem-1', JSON.stringify(['legacy hint']));
    localStorage.setItem('hints-learner-1-problem-2', JSON.stringify(['legacy hint']));
    localStorage.setItem('hint-info-learner-1-problem-1', JSON.stringify([{ isEnhanced: true }]));

    const result = migrateLegacyHintKeys();

    expect(result.removedCount).toBe(2);
    expect(localStorage.getItem('hints-learner-1-problem-1')).toBeNull();
    expect(localStorage.getItem('hints-learner-1-problem-2')).toBeNull();
  });

  it('evicts oldest stale hint-cache entries during cleanup', () => {
    const now = Date.now();

    saveHintSnapshot({
      learnerId: 'learner-1',
      problemId: 'old-problem',
      currentRung: 1,
      visibleHintCount: 1,
      lastHintId: 'old-hint',
      lastHelpRequestIndex: 1,
      enhancedHintInfo: [],
      updatedAt: now - 1000 * 60 * 60 * 24 * 10,
    });

    saveHintSnapshot({
      learnerId: 'learner-1',
      problemId: 'fresh-problem',
      currentRung: 1,
      visibleHintCount: 1,
      lastHintId: 'fresh-hint',
      lastHelpRequestIndex: 1,
      enhancedHintInfo: [],
      updatedAt: now,
    });

    const result = cleanupHintCache({ now });

    expect(result.success).toBe(true);
    expect(loadHintInfo({ learnerId: 'learner-1', problemId: 'old-problem' }).snapshot).toBeNull();
    expect(loadHintInfo({ learnerId: 'learner-1', problemId: 'fresh-problem' }).snapshot).not.toBeNull();
  });
});
