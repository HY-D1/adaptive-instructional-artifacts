import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { safeSetMock, loadConceptMapMock } = vi.hoisted(() => ({
  safeSetMock: vi.fn(),
  loadConceptMapMock: vi.fn(),
}));

vi.mock('../lib/storage/safe-storage', () => ({
  safeSet: safeSetMock,
}));

vi.mock('../lib/content/concept-loader', () => ({
  loadConceptMap: loadConceptMapMock,
}));

vi.mock('../data/problems', () => ({
  sqlProblems: [],
}));

import { useCommandSearch } from './useCommandSearch';

describe('useCommandSearch', () => {
  beforeEach(() => {
    localStorage.clear();
    safeSetMock.mockReset();
    loadConceptMapMock.mockReset();
    loadConceptMapMock.mockResolvedValue({ concepts: {} });
  });

  it('writes recent searches through safeSet with cache priority', async () => {
    safeSetMock.mockReturnValue({ success: true });

    const { result } = renderHook(() => useCommandSearch());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const item = {
      id: 'concept-1',
      type: 'concept' as const,
      title: 'Join conditions',
      url: '/concepts/join-conditions',
      keywords: ['joins'],
    };

    act(() => {
      result.current.saveRecentSearch(item);
    });

    expect(result.current.recentSearches[0]).toEqual(item);
    expect(safeSetMock).toHaveBeenCalledTimes(1);
    expect(safeSetMock).toHaveBeenCalledWith(
      'sqladapt:recent-searches',
      [item],
      { priority: 'cache' },
    );
  });
});
