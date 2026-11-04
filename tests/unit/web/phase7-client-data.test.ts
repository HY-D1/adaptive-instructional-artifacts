import { describe, expect, it } from 'vitest';
import {
  LEARNER_CACHE_KEYS,
  UNSYNCED_QUEUE_KEYS,
  clearLearnerCachesAfterLogout,
} from '../../../apps/web/src/app/lib/auth/logout-learner';
import { isPermanentClientFailure } from '../../../apps/web/src/app/lib/api/storage-client';

function memoryStorage(keys: string[]) {
  const map = new Map(keys.map((key) => [key, 'x']));
  return {
    map,
    get length() { return map.size; },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
  };
}

describe('logout cache cleanup', () => {
  const keep = ['sql-learning-practice-drafts', 'unrelated-key'];
  const all = [...LEARNER_CACHE_KEYS, ...UNSYNCED_QUEUE_KEYS, 'chat-history-a-p1', 'hint-cache:abc', ...keep];

  it('removes learner caches but never the unsynced queues', () => {
    const local = memoryStorage(all);
    const removedSession: string[] = [];
    clearLearnerCachesAfterLogout(local, { removeItem: (key) => removedSession.push(key) }, { keepUnsyncedData: false });
    for (const key of LEARNER_CACHE_KEYS) expect(local.map.has(key)).toBe(false);
    for (const key of UNSYNCED_QUEUE_KEYS) expect(local.map.has(key)).toBe(true);
    expect(local.map.has('chat-history-a-p1')).toBe(false);
    expect(local.map.has('hint-cache:abc')).toBe(false);
    for (const key of keep) expect(local.map.has(key)).toBe(true);
    expect(removedSession).toEqual(['sql-adapt-session-config']);
  });
});

describe('dead-letter classification', () => {
  it('keeps auth and CSRF failures retryable', () => {
    expect(isPermanentClientFailure(401)).toBe(false);
    expect(isPermanentClientFailure(403)).toBe(false);
    expect(isPermanentClientFailure(429)).toBe(false);
  });

  it('still treats validation failures as permanent', () => {
    expect(isPermanentClientFailure(400)).toBe(true);
    expect(isPermanentClientFailure(413)).toBe(true);
    expect(isPermanentClientFailure(500)).toBe(false);
  });
});

describe('bandit reward gating (source contract)', () => {
  it('returns before recording a bandit outcome when the result is not correct', async () => {
    const { readFileSync } = await import('node:fs');
    const source = readFileSync('apps/web/src/app/pages/LearningInterface.tsx', 'utf8');
    const handler = source.slice(source.indexOf('const handleExecute = async'));
    const gate = handler.indexOf('if (!actuallyCorrect) {');
    expect(gate).toBeGreaterThan(0);
    const beforeGate = handler.slice(0, gate);
    expect(beforeGate).not.toContain('banditManager.recordOutcome(');
    expect(beforeGate).not.toContain('recordSharedBanditReward(');
    expect(beforeGate).not.toContain('updatePathAfterSuccess(');
    expect(handler.indexOf('banditManager.recordOutcome(')).toBeGreaterThan(gate);
  });
});

describe('profile merge does not compound error counts', () => {
  it('keeps error counts stable when the same cumulative profile is merged repeatedly', async () => {
    const { storage } = await import('../../../apps/web/src/app/lib/storage/storage');
    const id = `merge-test-${Date.now()}`;
    const base = {
      id,
      name: 'M',
      conceptsCovered: new Set<string>(),
      conceptCoverageEvidence: new Map(),
      errorHistory: new Map([['missing commas', 3]]),
      interactionCount: 0,
      currentStrategy: 'adaptive-medium',
      preferences: { escalationThreshold: 3, aggregationDelay: 300000 },
      solvedProblemIds: new Set<string>(),
    };
    storage.saveProfile(base as never, true);
    storage.saveProfile(base as never, true); // local version is now ahead
    for (let i = 0; i < 3; i += 1) {
      // A versionless snapshot (as hydration provides) takes the merge path.
      storage.saveProfile({ ...base, errorHistory: new Map([['missing commas', 3]]) } as never);
    }
    expect(storage.getProfile(id)?.errorHistory.get('missing commas')).toBe(3);
  });
});
