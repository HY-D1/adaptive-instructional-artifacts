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

export function hashHintInput(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function buildHintCacheKey(
  problemId: string,
  subtype: string,
  rung: number,
  promptVersion: string,
  studentSql = '',
  errorMessage = '',
): string {
  return `${promptVersion}::${problemId}::${subtype}::${rung}::${hashHintInput(`${studentSql}\n${errorMessage}`)}`;
}

export function getCachedHint(
  problemId: string,
  subtype: string,
  rung: number,
  promptVersion: string = HINT_PROMPT_VERSION,
  studentSql = '',
  errorMessage = '',
): HintCacheEntry | null {
  return getCache()[buildHintCacheKey(problemId, subtype, rung, promptVersion, studentSql, errorMessage)] || null;
}

export function saveCachedHint(
  problemId: string,
  subtype: string,
  rung: number,
  entry: Omit<HintCacheEntry, 'timestamp'>,
  promptVersion: string = HINT_PROMPT_VERSION,
  studentSql = '',
  errorMessage = '',
): void {
  const cache = getCache();
  cache[buildHintCacheKey(problemId, subtype, rung, promptVersion, studentSql, errorMessage)] = { ...entry, timestamp: Date.now() };
  safeSet(HINT_CACHE_KEY, JSON.stringify(cache), { priority: 'cache' });
}
