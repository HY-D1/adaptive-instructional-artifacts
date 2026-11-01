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
    const stored = safeGet<Record<string, HintCacheEntry> | string>(HINT_CACHE_KEY, {});
    if (typeof stored === 'string') {
      try {
        const parsed: unknown = JSON.parse(stored);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          return parsed as Record<string, HintCacheEntry>;
        }
      } catch (error) {
        console.warn('[HintCache] Failed to parse stringified cache; resetting cache.', error);
      }
      return {};
    }
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      return stored;
    }
  } catch (error) {
    console.warn('[HintCache] Failed to read cache; using an empty cache.', error);
  }
  return {};
}

function logCacheWriteFailure(error: unknown): void {
  console.warn('[HintCache] Failed to write cache; continuing without cache persistence.', error);
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
  try {
    return getCache()[buildHintCacheKey(problemId, subtype, rung, promptVersion, studentSql, errorMessage)] || null;
  } catch (error) {
    console.warn('[HintCache] Failed to read cached hint; continuing without cache.', error);
    return null;
  }
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
  try {
    const cache = getCache();
    cache[buildHintCacheKey(problemId, subtype, rung, promptVersion, studentSql, errorMessage)] = {
      ...entry,
      timestamp: Date.now(),
    };
    const result = safeSet(HINT_CACHE_KEY, cache, { priority: 'cache' });
    if (!result.success) {
      logCacheWriteFailure(result.error ?? 'Storage rejected cache write');
    }
  } catch (error) {
    logCacheWriteFailure(error);
  }
}
