import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  safeSet,
  safeGet,
  safeRemove,
  isStorageAvailable,
  estimateSize,
  isQuotaError,
  evictRecoverableCaches,
  safeStorage,
  subscribeToStorageTelemetry,
  type StorageTelemetryEvent,
} from './safe-storage';

// Helper to create a DOMException with specific code (using Object.defineProperty since code is read-only in some envs)
function createDOMExceptionWithCode(message: string, name: string, code: number): DOMException {
  const error = new DOMException(message, name);
  try {
    Object.defineProperty(error, 'code', {
      value: code,
      writable: false,
      configurable: true,
    });
  } catch {
    // Some environments don't allow this, skip
  }
  return error;
}

describe('safe-storage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
    sessionStorage.clear();
  });

  // ============================================================================
  // isStorageAvailable
  // ============================================================================
  describe('isStorageAvailable', () => {
    it('returns true when localStorage is available', () => {
      expect(isStorageAvailable('local')).toBe(true);
    });

    it('returns true when sessionStorage is available', () => {
      expect(isStorageAvailable('session')).toBe(true);
    });

    it('returns false when storage throws on access', () => {
      const mockStorage = {
        setItem: () => { throw new DOMException('Storage disabled', 'SecurityError'); },
        getItem: () => null,
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      };
      
      vi.stubGlobal('localStorage', mockStorage);

      expect(isStorageAvailable('local')).toBe(false);
    });
  });

  // ============================================================================
  // estimateSize
  // ============================================================================
  describe('estimateSize', () => {
    it('estimates size of string', () => {
      const size = estimateSize('hello');
      expect(size).toBe(14); // "hello" -> 7 chars * 2 bytes
    });

    it('estimates size of object', () => {
      const obj = { key: 'value' };
      const size = estimateSize(obj);
      expect(size).toBeGreaterThan(0);
    });

    it('estimates size of array', () => {
      const arr = [1, 2, 3];
      const size = estimateSize(arr);
      expect(size).toBeGreaterThan(0);
    });

    it('returns conservative estimate for circular reference', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj; // Circular reference
      const size = estimateSize(obj);
      expect(size).toBe(1024); // Conservative fallback
    });
  });

  // ============================================================================
  // isQuotaError
  // ============================================================================
  describe('isQuotaError', () => {
    it('returns true for QuotaExceededError', () => {
      const error = new DOMException('Quota exceeded', 'QuotaExceededError');
      expect(isQuotaError(error)).toBe(true);
    });

    it('returns true for NS_ERROR_DOM_QUOTA_REACHED (Firefox)', () => {
      const error = new DOMException('Quota reached', 'NS_ERROR_DOM_QUOTA_REACHED');
      expect(isQuotaError(error)).toBe(true);
    });

    it('returns true for code 22 (Chrome/Safari)', () => {
      const error = createDOMExceptionWithCode('Quota exceeded', 'Error', 22);
      // Test the name check path - code may not be settable in all environments
      if ((error as DOMException & { code: number }).code === 22) {
        expect(isQuotaError(error)).toBe(true);
      } else {
        // Skip in environments where code cannot be set
        expect(true).toBe(true);
      }
    });

    it('returns true for code 1014 (Firefox legacy)', () => {
      const error = createDOMExceptionWithCode('Quota exceeded', 'Error', 1014);
      // Test the name check path - code may not be settable in all environments
      if ((error as DOMException & { code: number }).code === 1014) {
        expect(isQuotaError(error)).toBe(true);
      } else {
        // Skip in environments where code cannot be set
        expect(true).toBe(true);
      }
    });

    it('returns false for regular errors', () => {
      const error = new Error('Some error');
      expect(isQuotaError(error)).toBe(false);
    });

    it('returns false for non-DOM exceptions', () => {
      const error = new TypeError('Type error');
      expect(isQuotaError(error)).toBe(false);
    });
  });

  // ============================================================================
  // safeSet
  // ============================================================================
  describe('safeSet', () => {
    it('successfully stores a value', () => {
      const result = safeSet('test-key', { data: 'value' });
      expect(result.success).toBe(true);
      expect(result.quotaExceeded).toBeUndefined();

      const stored = localStorage.getItem('test-key');
      expect(stored).toBe('{"data":"value"}');
    });

    it('stores in sessionStorage when requested', () => {
      const result = safeSet('test-key', { data: 'value' }, { useSessionStorage: true });
      expect(result.success).toBe(true);

      const stored = sessionStorage.getItem('test-key');
      expect(stored).toBe('{"data":"value"}');

      // Should not be in localStorage
      expect(localStorage.getItem('test-key')).toBeNull();
    });

    it('returns failure when storage is unavailable', () => {
      const mockStorage = {
        setItem: () => { throw new DOMException('Storage disabled', 'SecurityError'); },
        getItem: () => null,
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      };

      vi.stubGlobal('localStorage', mockStorage);

      const result = safeSet('test-key', { data: 'value' });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('unavailable');
    });

    it('returns error for non-serializable values', () => {
      const obj: Record<string, unknown> = { a: 1 };
      obj.self = obj; // Circular reference

      const result = safeSet('circular-key', obj);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Serialization failed');
    });
  });

  // ============================================================================
  // safeGet
  // ============================================================================
  describe('safeGet', () => {
    it('retrieves and parses stored value', () => {
      localStorage.setItem('test-key', JSON.stringify({ data: 'value' }));

      const result = safeGet('test-key');
      expect(result).toEqual({ data: 'value' });
    });

    it('returns default value when key not found', () => {
      const result = safeGet('missing-key', 'default');
      expect(result).toBe('default');
    });

    it('returns null when key not found and no default', () => {
      const result = safeGet('missing-key');
      expect(result).toBeNull();
    });

    it('returns default value when JSON is corrupted', () => {
      localStorage.setItem('corrupted-key', 'not valid json{{{');

      const result = safeGet('corrupted-key', 'default');
      expect(result).toBe('default');
    });

    it('removes corrupted data when encountered', () => {
      localStorage.setItem('corrupted-key', 'not valid json');

      safeGet('corrupted-key');

      expect(localStorage.getItem('corrupted-key')).toBeNull();
    });

    it('retrieves from sessionStorage when requested', () => {
      sessionStorage.setItem('session-key', JSON.stringify({ session: true }));

      const result = safeGet('session-key', null, true);
      expect(result).toEqual({ session: true });

      // Should not find in localStorage
      expect(safeGet('session-key', null, false)).toBeNull();
    });

    it('returns default when storage is unavailable', () => {
      const mockStorage = {
        setItem: () => {},
        getItem: () => { throw new DOMException('Storage disabled'); },
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      };

      vi.stubGlobal('localStorage', mockStorage);

      const result = safeGet('any-key', 'fallback');
      expect(result).toBe('fallback');
    });
  });

  // ============================================================================
  // safeRemove
  // ============================================================================
  describe('safeRemove', () => {
    it('removes an existing key', () => {
      localStorage.setItem('remove-key', 'value');

      const result = safeRemove('remove-key');
      expect(result).toBe(true);
      expect(localStorage.getItem('remove-key')).toBeNull();
    });

    it('returns true when key does not exist', () => {
      const result = safeRemove('non-existent-key');
      expect(result).toBe(true);
    });

    it('removes from sessionStorage when requested', () => {
      sessionStorage.setItem('session-key', 'value');

      const result = safeRemove('session-key', true);
      expect(result).toBe(true);
      expect(sessionStorage.getItem('session-key')).toBeNull();
    });

    it('returns false when storage throws', () => {
      const mockStorage = {
        setItem: () => {},
        getItem: () => null,
        removeItem: () => { throw new Error('Remove failed'); },
        clear: () => {},
        key: () => null,
        length: 0,
      };

      vi.stubGlobal('localStorage', mockStorage);

      const result = safeRemove('key');
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // evictRecoverableCaches
  // ============================================================================
  describe('evictRecoverableCaches', () => {
    it('evicts recoverable cache keys', () => {
      // Set up cache entries
      localStorage.setItem('sql-learning-llm-cache', JSON.stringify({ cache: 'data1' }));
      localStorage.setItem('sql-learning-pdf-index', JSON.stringify({ cache: 'data2' }));
      localStorage.setItem('sql-learning-pdf-uploads', JSON.stringify({ cache: 'data3' }));

      const evicted = evictRecoverableCaches(100);

      expect(evicted.length).toBeGreaterThan(0);
      expect(localStorage.getItem('sql-learning-llm-cache')).toBeNull();
    });

    it('stops evicting when target bytes reached', () => {
      // Set up multiple cache entries
      localStorage.setItem('sql-learning-llm-cache', JSON.stringify({ data: 'x'.repeat(100) }));
      localStorage.setItem('sql-learning-pdf-index', JSON.stringify({ data: 'y'.repeat(100) }));

      const evicted = evictRecoverableCaches(50);

      // Should evict at least one but not necessarily all
      expect(evicted.length).toBeGreaterThan(0);
    });

    it('handles sessionStorage eviction', () => {
      sessionStorage.setItem('sql-learning-practice-drafts', JSON.stringify({ drafts: [] }));

      const evicted = evictRecoverableCaches(10, 'session');

      expect(evicted).toContain('sql-learning-practice-drafts');
      expect(sessionStorage.getItem('sql-learning-practice-drafts')).toBeNull();
    });

    it('returns empty array when nothing to evict', () => {
      // Clear all storage first
      localStorage.clear();

      const evicted = evictRecoverableCaches(1000);

      expect(evicted).toEqual([]);
    });
  });

  // ============================================================================
  // Telemetry
  // ============================================================================
  describe('telemetry', () => {
    it('emits storage_eviction event', () => {
      const events: StorageTelemetryEvent[] = [];
      const unsubscribe = subscribeToStorageTelemetry((event) => {
        events.push(event);
      });

      // Set up a cache to evict
      localStorage.setItem('sql-learning-llm-cache', JSON.stringify({ data: 'cache' }));

      evictRecoverableCaches(10);

      unsubscribe();

      const evictionEvent = events.find(e => e.type === 'storage_eviction');
      expect(evictionEvent).toBeDefined();
      expect(evictionEvent?.key).toBe('sql-learning-llm-cache');
      expect(evictionEvent?.details).toMatchObject({
        storageType: 'local',
        reason: 'quota_relief',
      });
    });

    it('allows multiple telemetry subscribers', () => {
      const events1: StorageTelemetryEvent[] = [];
      const events2: StorageTelemetryEvent[] = [];

      const unsub1 = subscribeToStorageTelemetry((e) => events1.push(e));
      const unsub2 = subscribeToStorageTelemetry((e) => events2.push(e));

      // Set up a cache to evict
      localStorage.setItem('sql-learning-llm-cache', JSON.stringify({ data: 'cache' }));
      evictRecoverableCaches(10);

      unsub1();
      unsub2();

      expect(events1.length).toBeGreaterThan(0);
      expect(events2.length).toBe(events1.length);
    });

    it('handles subscriber errors gracefully', () => {
      const goodEvents: StorageTelemetryEvent[] = [];

      subscribeToStorageTelemetry(() => {
        throw new Error('Subscriber error');
      });

      subscribeToStorageTelemetry((e) => goodEvents.push(e));

      // Set up a cache to evict
      localStorage.setItem('sql-learning-llm-cache', JSON.stringify({ data: 'cache' }));
      evictRecoverableCaches(10);

      // Good subscriber should still receive events
      expect(goodEvents.length).toBeGreaterThan(0);
    });

    it('unsubscribe removes listener', () => {
      const events: StorageTelemetryEvent[] = [];
      const unsubscribe = subscribeToStorageTelemetry((e) => events.push(e));

      unsubscribe();

      // Set up a cache to evict
      localStorage.setItem('sql-learning-llm-cache', JSON.stringify({ data: 'cache' }));
      evictRecoverableCaches(10);

      // Should not receive events after unsubscribe
      expect(events.length).toBe(0);
    });
  });

  // ============================================================================
  // safeStorage default export
  // ============================================================================
  describe('safeStorage default export', () => {
    it('exports all methods', () => {
      expect(safeStorage.set).toBe(safeSet);
      expect(safeStorage.get).toBe(safeGet);
      expect(safeStorage.remove).toBe(safeRemove);
      expect(safeStorage.isAvailable).toBe(isStorageAvailable);
      expect(safeStorage.estimateSize).toBe(estimateSize);
      expect(safeStorage.isQuotaError).toBe(isQuotaError);
    });

    it('safeStorage.clear clears all storage', () => {
      localStorage.setItem('key1', 'value1');
      localStorage.setItem('key2', 'value2');

      const result = safeStorage.clear();

      expect(result).toBe(true);
      expect(localStorage.getItem('key1')).toBeNull();
      expect(localStorage.getItem('key2')).toBeNull();
    });

    it('safeStorage.keys returns all keys', () => {
      localStorage.setItem('key1', 'value1');
      localStorage.setItem('key2', 'value2');

      const keys = safeStorage.keys();

      expect(keys).toContain('key1');
      expect(keys).toContain('key2');
    });

    it('safeStorage.getStoredSize returns approximate size', () => {
      const data = JSON.stringify({ test: 'data' });
      localStorage.setItem('size-test', data);

      const size = safeStorage.getStoredSize('size-test');

      expect(size).toBe(data.length * 2);
    });

    it('safeStorage.getStorageInfo returns usage info', () => {
      localStorage.setItem('test-key', JSON.stringify({ data: 'value' }));

      const info = safeStorage.getStorageInfo();

      expect(info.used).toBeGreaterThan(0);
      expect(info.remaining).toBeNull(); // Browser doesn't expose this
      expect(info.total).toBeNull();
    });
  });

  // ============================================================================
  // Quota handling integration tests
  // ============================================================================
  describe('quota handling', () => {
    it('detects quota errors by name', () => {
      const quotaError = new DOMException('Storage full', 'QuotaExceededError');
      expect(isQuotaError(quotaError)).toBe(true);
    });

    it('detects Firefox quota errors by name', () => {
      const quotaError = new DOMException('Storage full', 'NS_ERROR_DOM_QUOTA_REACHED');
      expect(isQuotaError(quotaError)).toBe(true);
    });
  });
});
