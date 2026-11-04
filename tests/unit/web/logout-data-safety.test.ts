// @vitest-environment jsdom
import type { InteractionEvent } from '@/app/types';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  LEARNER_CACHE_KEYS,
  UNSYNCED_QUEUE_KEYS,
  clearLearnerCachesAfterLogout,
  shouldKeepSharedLearnerCaches,
} from '../../../apps/web/src/app/lib/auth/logout-learner';

type DualStorageModule = typeof import('../../../apps/web/src/app/lib/storage/dual-storage');
let mod: DualStorageModule;

beforeAll(async () => {
  vi.stubEnv('VITE_API_BASE_URL', 'https://api.example.test');
  vi.doMock('../../../apps/web/src/app/lib/api/storage-client', () => ({
    isBackendAvailable: vi.fn(async () => false),
    checkBackendHealth: vi.fn(async () => false),
    storageClient: {},
  }));
  mod = await import('../../../apps/web/src/app/lib/storage/dual-storage');
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

type Internals = {
  pendingStore: {
    clear: () => void;
    add: (e: InteractionEvent) => unknown;
    markDeadLetter: (id: string, reason: string) => void;
    get: (id: string) => { status: string } | undefined;
  };
  offlineQueue: {
    queue: unknown[];
    add: (item: { id: string; type: 'interaction'; data: InteractionEvent }) => void;
  };
};
const internals = () => mod.dualStorage as unknown as Internals;
const event = (id: string, learnerId: string): InteractionEvent => ({
  id, learnerId, sessionId: `s-${learnerId}`, timestamp: Date.now(),
  eventType: 'execution', problemId: 'p1',
});

function memoryStorage(keys: string[]) {
  const map = new Map(keys.map((key) => [key, 'x']));
  return {
    map,
    get length() { return map.size; },
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => { map.delete(key); },
  };
}

beforeEach(() => {
  internals().pendingStore.clear();
  internals().offlineQueue.queue = [];
});

describe('logout keeps unsynced data', () => {
  const all = [...LEARNER_CACHE_KEYS, ...UNSYNCED_QUEUE_KEYS, 'sql-adapt-dead-letter', 'sql-learning-practice-drafts'];

  it("keeps queue keys that hold another learner's events", () => {
    const local = memoryStorage(all);
    clearLearnerCachesAfterLogout(local, null, { keepUnsyncedData: false });
    for (const key of UNSYNCED_QUEUE_KEYS) expect(local.map.has(key)).toBe(true);
    expect(local.map.has('sql-adapt-dead-letter')).toBe(true);
  });

  it("keeps A's local interactions and textbook when A has unsynced events", () => {
    const local = memoryStorage(all);
    clearLearnerCachesAfterLogout(local, null, { keepUnsyncedData: true });
    expect(local.map.has('sql-learning-interactions')).toBe(true);
    expect(local.map.has('sql-learning-textbook')).toBe(true);
    expect(local.map.has('sql-learning-profiles')).toBe(false);
    for (const key of UNSYNCED_QUEUE_KEYS) expect(local.map.has(key)).toBe(true);
  });

  it("clears A's cached interactions/textbook only when hasUnsyncedForLearner(A) is false", () => {
    const local = memoryStorage(all);
    clearLearnerCachesAfterLogout(local, null, {
      keepUnsyncedData: mod.dualStorage.hasUnsyncedForLearner('learner-a'),
    });
    expect(local.map.has('sql-learning-interactions')).toBe(false);
    expect(local.map.has('sql-learning-textbook')).toBe(false);

    internals().offlineQueue.add({ id: 'ev-a1', type: 'interaction', data: event('ev-a1', 'learner-a') });
    expect(mod.dualStorage.hasUnsyncedForLearner('learner-a')).toBe(true);
    expect(mod.dualStorage.hasUnsyncedForLearner('learner-b')).toBe(false);
    const local2 = memoryStorage(all);
    clearLearnerCachesAfterLogout(local2, null, {
      keepUnsyncedData: mod.dualStorage.hasUnsyncedForLearner('learner-a'),
    });
    expect(local2.map.has('sql-learning-interactions')).toBe(true);
  });

  it('counts pending-store and dead-letter items for that learner only', () => {
    internals().pendingStore.add(event('ev-b1', 'learner-b'));
    expect(mod.dualStorage.hasUnsyncedForLearner('learner-b')).toBe(true);
    expect(mod.dualStorage.hasUnsyncedForLearner('learner-a')).toBe(false);
    internals().pendingStore.markDeadLetter('ev-b1', 'http_403');
    expect(mod.dualStorage.hasUnsyncedForLearner('learner-b')).toBe(true);
  });

  it("keeps the shared interaction/textbook keys when B logs out while A has unsynced events", () => {
    internals().offlineQueue.add({ id: 'ev-a2', type: 'interaction', data: event('ev-a2', 'learner-a') });
    expect(mod.dualStorage.hasUnsyncedForLearner('learner-b')).toBe(false);
    expect(mod.dualStorage.hasAnyUnsynced()).toBe(true);

    const local = memoryStorage(all);
    clearLearnerCachesAfterLogout(local, null, {
      keepUnsyncedData: shouldKeepSharedLearnerCaches('learner-b', mod.dualStorage),
    });
    expect(local.map.has('sql-learning-interactions')).toBe(true);
    expect(local.map.has('sql-learning-textbook')).toBe(true);
    expect(local.map.has('sql-learning-profiles')).toBe(false);
  });

  it('hasAnyUnsynced sees pending-store and dead-letter items of any learner', () => {
    expect(mod.dualStorage.hasAnyUnsynced()).toBe(false);
    internals().pendingStore.add(event('ev-c1', 'learner-c'));
    expect(mod.dualStorage.hasAnyUnsynced()).toBe(true);
    internals().pendingStore.markDeadLetter('ev-c1', 'http_400');
    expect(mod.dualStorage.hasAnyUnsynced()).toBe(true);
  });

  it('clears the shared keys when nothing on the device is unsynced, and keeps them when the learner is unknown', () => {
    expect(shouldKeepSharedLearnerCaches('learner-b', mod.dualStorage)).toBe(false);
    expect(shouldKeepSharedLearnerCaches(null, mod.dualStorage)).toBe(true);
  });

  it('drafts survive logout', () => {
    const local = memoryStorage(all);
    clearLearnerCachesAfterLogout(local, null, { keepUnsyncedData: false });
    expect(local.map.has('sql-learning-practice-drafts')).toBe(true);
  });
});

describe('requeueDeadLettersOnce', () => {
  it('moves http_403 dead letters to backend_pending exactly once', () => {
    const store = internals().pendingStore;
    store.add(event('dl-1', 'learner-a'));
    store.markDeadLetter('dl-1', 'http_403');
    expect(store.get('dl-1')?.status).toBe('dead_letter');
    localStorage.removeItem('sql-adapt-deadletter-requeue-v1');

    expect(mod.dualStorage.requeueDeadLettersOnce()).toBe(1);
    expect(store.get('dl-1')?.status).toBe('backend_pending');
    expect(localStorage.getItem('sql-adapt-deadletter-requeue-v1')).toBeTruthy();
    const queued = internals().offlineQueue.queue as Array<{ id: string }>;
    expect(queued.filter((q) => q.id === 'dl-1')).toHaveLength(1);

    store.markDeadLetter('dl-1', 'http_400');
    expect(mod.dualStorage.requeueDeadLettersOnce()).toBe(0);
    expect(store.get('dl-1')?.status).toBe('dead_letter');
  });

  it('does not throw when storage throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    expect(() => mod.dualStorage.requeueDeadLettersOnce()).not.toThrow();
    spy.mockRestore();
  });
});
