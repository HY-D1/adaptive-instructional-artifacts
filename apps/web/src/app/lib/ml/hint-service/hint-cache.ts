import { safeGet, safeSet } from '../../storage/safe-storage';
import { HINT_PROMPT_VERSION } from './types';

const HINT_CACHE_KEY = 'sql-adapt-hint-cache-v1';

export type HintCacheEntry = {
  content: string;
  conceptIds: string[];
  retrievedSourceIds: string[];
  timestamp: number;
};

function getCache(): Record<string, HintCacheEntry> {
  try {
    return safeGet<Record<string, HintCacheEntry>>(HINT_CACHE_KEY, {}) ?? {};
  } catch {
    return {};
  }
}

function buildKey(problemId: string, subtype: string, rung: number, promptVersion: string): string {
  return `${promptVersion}::${problemId}::${subtype}::${rung}`;
}

export function getCachedHint(
  problemId: string,
  subtype: string,
  rung: number,
  promptVersion: string = HINT_PROMPT_VERSION
): HintCacheEntry | null {
  return getCache()[buildKey(problemId, subtype, rung, promptVersion)] || null;
}

export function saveCachedHint(
  problemId: string,
  subtype: string,
  rung: number,
  entry: Omit<HintCacheEntry, 'timestamp'>,
  promptVersion: string = HINT_PROMPT_VERSION
): void {
  const cache = getCache();
  cache[buildKey(problemId, subtype, rung, promptVersion)] = { ...entry, timestamp: Date.now() };
  safeSet(HINT_CACHE_KEY, JSON.stringify(cache), { priority: 'cache' });
}
