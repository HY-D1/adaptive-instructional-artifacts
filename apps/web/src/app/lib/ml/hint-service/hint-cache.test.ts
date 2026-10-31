import { beforeEach, describe, expect, it } from 'vitest';
import {
  getCachedHint,
  saveCachedHint,
} from './hint-cache';

const firstEntry = {
  content: 'Check the selected columns.',
  conceptIds: ['select-basic'],
  retrievedSourceIds: ['sql-engage:select-basic'],
};

const secondEntry = {
  content: 'Compare the requested columns with your query.',
  conceptIds: ['select-basic'],
  retrievedSourceIds: ['sql-engage:select-basic'],
};

describe('LLM hint cache storage compatibility', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('keeps both hint entries when caching successive personalized hints', () => {
    saveCachedHint('problem-1', 'missing commas', 1, firstEntry, 'adaptive-hint-v2', 'SELECT id', 'syntax');
    saveCachedHint('problem-1', 'missing commas', 2, secondEntry, 'adaptive-hint-v2', 'SELECT id, name', 'syntax');

    expect(getCachedHint('problem-1', 'missing commas', 1, 'adaptive-hint-v2', 'SELECT id', 'syntax'))
      .toMatchObject(firstEntry);
    expect(getCachedHint('problem-1', 'missing commas', 2, 'adaptive-hint-v2', 'SELECT id, name', 'syntax'))
      .toMatchObject(secondEntry);
  });

  it('recovers when storage already contains a stringified cache object', () => {
    const storedCache = JSON.stringify({
      'adaptive-hint-v2::problem-1::missing commas::1::deadbeef': {
        ...firstEntry,
        timestamp: Date.now(),
      },
    });
    localStorage.setItem('sql-adapt-hint-cache-v1', JSON.stringify(storedCache));

    saveCachedHint('problem-1', 'missing commas', 2, secondEntry, 'adaptive-hint-v2', 'SELECT id, name', 'syntax');

    expect(getCachedHint('problem-1', 'missing commas', 2, 'adaptive-hint-v2', 'SELECT id, name', 'syntax'))
      .toMatchObject(secondEntry);
  });

  it('does not throw when storage rejects a cache write', () => {
    const setItem = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('storage unavailable');
    });

    expect(() => saveCachedHint(
      'problem-1',
      'missing commas',
      1,
      firstEntry,
      'adaptive-hint-v2',
      'SELECT id',
      'syntax',
    )).not.toThrow();
    expect(setItem).toHaveBeenCalled();
  });
});
