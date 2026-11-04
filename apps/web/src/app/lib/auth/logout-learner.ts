interface LogoutLearnerIdCandidates {
  syncedProfileId?: string | null;
  authLearnerId?: string | null;
  cachedProfileId?: string | null;
}

function cleanId(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export function resolveLogoutLearnerId({
  syncedProfileId,
  authLearnerId,
  cachedProfileId,
}: LogoutLearnerIdCandidates): string | null {
  return cleanId(syncedProfileId) ?? cleanId(authLearnerId) ?? cleanId(cachedProfileId);
}

/**
 * Learner caches that the backend can rehydrate on the next login. Cleared on
 * logout in backend mode so the next person on a shared lab machine does not
 * see (or inherit the session id of) the previous learner.
 */
export const LEARNER_CACHE_KEYS = [
  'sql-learning-interactions',
  'sql-learning-profiles',
  'sql-learning-textbook',
  'sql-learning-active-session',
  'sql-learning-llm-cache',
  'sql-learning-reinforcement-schedules',
  'sql-adapt-profile-cache',
  'sql-adapt-profiles',
  'sql-adapt-textbook',
  'sql-adapt-last-active',
] as const;

/** Keys holding events not yet confirmed by the backend. */
export const UNSYNCED_QUEUE_KEYS = [
  'sql-adapt-pending-interactions',
  'sql-adapt-pending-confirmed',
  'sql-adapt-offline-queue',
  'sql-adapt-pending-session-ends',
] as const;

const LEARNER_CACHE_PREFIXES = ['chat-history-', 'hint-cache:'] as const;

interface StorageLike {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

/**
 * Remove the signed-out learner's cached data. Unsynced queues are removed only
 * when the logout sync was confirmed; otherwise they are kept so research events
 * are never discarded (they are retried when that learner signs in again).
 * Practice drafts are local-only and stay.
 */
export function clearLearnerCachesAfterLogout(
  local: StorageLike,
  session: Pick<StorageLike, 'removeItem'> | null,
  options: { syncConfirmed: boolean },
): string[] {
  const removed: string[] = [];
  const keys: string[] = [];
  for (let index = 0; index < local.length; index += 1) {
    const key = local.key(index);
    if (key) keys.push(key);
  }
  const exact = new Set<string>([
    ...LEARNER_CACHE_KEYS,
    ...(options.syncConfirmed ? UNSYNCED_QUEUE_KEYS : []),
  ]);
  for (const key of keys) {
    if (exact.has(key) || LEARNER_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      local.removeItem(key);
      removed.push(key);
    }
  }
  session?.removeItem('sql-adapt-session-config');
  return removed;
}
