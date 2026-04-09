/**
 * Safe Storage Adapter
 * 
 * Centralized safe storage layer that all production code must use.
 * Handles quota exceeded errors gracefully with eviction support.
 * 
 * Features:
 * - Quota error detection (QuotaExceededError, NS_ERROR_DOM_QUOTA_REACHED, code 22/1014)
 * - Automatic eviction of recoverable caches before critical writes fail
 * - Telemetry events for monitoring storage health
 * - sessionStorage support for session-only data
 * - Never throws uncaught exceptions
 * 
 * @module storage/safe-storage
 */

// ============================================================================
// Types
// ============================================================================

export interface SafeSetOptions {
  /** Priority of the write - affects eviction strategy */
  priority?: 'critical' | 'standard' | 'cache';
  /** Whether to attempt eviction on quota exceeded */
  allowEviction?: boolean;
  /** Use sessionStorage instead of localStorage */
  useSessionStorage?: boolean;
}

export interface SafeSetResult {
  success: boolean;
  quotaExceeded?: boolean;
  evicted?: string[];
  error?: string;
}

export interface SafeGetResult<T> {
  value: T | null;
  success: boolean;
  usedDefault?: boolean;
  error?: string;
}

export interface StorageEvictionEntry {
  key: string;
  storage: 'local' | 'session';
  priority: 'cache' | 'standard' | 'critical';
  estimatedSize: number;
}

export interface StorageTelemetryEvent {
  type: 'storage_write_failed' | 'storage_eviction' | 'storage_unavailable';
  key?: string;
  timestamp: number;
  details?: Record<string, unknown>;
}

// ============================================================================
// Telemetry
// ============================================================================

const telemetryListeners: Set<(event: StorageTelemetryEvent) => void> = new Set();

/**
 * Subscribe to storage telemetry events
 */
export function subscribeToStorageTelemetry(callback: (event: StorageTelemetryEvent) => void): () => void {
  telemetryListeners.add(callback);
  return () => telemetryListeners.delete(callback);
}

/**
 * Emit a telemetry event
 */
function emitTelemetry(event: StorageTelemetryEvent): void {
  // Log to console for monitoring
  const prefix = `[telemetry_${event.type}]`;
  if (event.type === 'storage_write_failed') {
    console.warn(prefix, {
      key: event.key,
      timestamp: event.timestamp,
      ...event.details,
    });
  } else if (event.type === 'storage_eviction') {
    console.info(prefix, {
      key: event.key,
      timestamp: event.timestamp,
      ...event.details,
    });
  } else {
    console.info(prefix, {
      key: event.key,
      timestamp: event.timestamp,
      ...event.details,
    });
  }

  // Notify subscribers
  for (const listener of telemetryListeners) {
    try {
      listener(event);
    } catch {
      // Ignore listener errors
    }
  }
}

// ============================================================================
// Storage Availability
// ============================================================================

/**
 * Check if a storage type is available and working
 */
export function isStorageAvailable(storageType: 'local' | 'session' = 'local'): boolean {
  try {
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    const testKey = `__storage_test_${Date.now()}`;
    storage.setItem(testKey, 'test');
    storage.removeItem(testKey);
    return true;
  } catch {
    return false;
 safely }
}

/**
 * Get the appropriate storage object
 */
function getStorage(useSessionStorage: boolean): Storage | null {
  const storageType = useSessionStorage ? 'session' : 'local';
  if (!isStorageAvailable(storageType)) {
    return null;
  }
  return useSessionStorage ? sessionStorage : localStorage;
}

// ============================================================================
// Size Estimation
// ============================================================================

/**
 * Estimate the byte size of a value when serialized
 * Uses a rough estimation based on JSON serialization
 */
export function estimateSize(value: unknown): number {
  try {
    const serialized = JSON.stringify(value);
    // UTF-16 encoding (2 bytes per character for most common cases)
    // This is a rough estimate - actual storage may vary by browser
    return serialized.length * 2;
  } catch {
    // If serialization fails, return a conservative estimate
    return 1024;
  }
}

/**
 * Get the approximate size of a storage key in bytes
 */
export function getStoredSize(key: string, storageType: 'local' | 'session' = 'local'): number {
  try {
    const storage = storageType === 'local' ? localStorage : sessionStorage;
    const value = storage.getItem(key);
    return value ? value.length * 2 : 0;
  } catch {
    return 0;
  }
}

// ============================================================================
// Eviction Strategy
// ============================================================================

// Known recoverable cache keys (in order of eviction priority)
const RECOVERABLE_CACHE_KEYS: string[] = [
  'sql-learning-llm-cache',
  'sql-learning-pdf-index',
  'sql-learning-pdf-uploads',
  'sql-adapt-offline-queue',
  'sql-adapt-pending-interactions',
  'sql-adapt-dead-letter',
];

// Session-only keys that can be evicted
const SESSION_RECOVERABLE_KEYS: string[] = [
  'sql-learning-practice-drafts',
  'sql-learning-active-session',
];

/**
 * Attempt to free up storage space by evicting recoverable caches
 * Returns list of evicted keys
 */
export function evictRecoverableCaches(
  targetBytes: number,
  storageType: 'local' | 'session' = 'local'
): string[] {
  const evicted: string[] = [];
  let freedBytes = 0;

  const keysToCheck = storageType === 'local' 
    ? RECOVERABLE_CACHE_KEYS 
    : SESSION_RECOVERABLE_KEYS;

  for (const key of keysToCheck) {
    if (freedBytes >= targetBytes) {
      break;
    }

    try {
      const size = getStoredSize(key, storageType);
      if (size > 0) {
        const storage = storageType === 'local' ? localStorage : sessionStorage;
        storage.removeItem(key);
        evicted.push(key);
        freedBytes += size;

        emitTelemetry({
          type: 'storage_eviction',
          key,
          timestamp: Date.now(),
          details: {
            freedBytes: size,
            storageType,
            reason: 'quota_relief',
          },
        });
      }
    } catch {
      // Continue to next key on error
    }
  }

  return evicted;
}

// ============================================================================
// Quota Error Detection
// ============================================================================

/**
 * Check if an error is a quota exceeded error
 * Handles cross-browser variations
 */
export function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) {
    return false;
  }

  // Standard name check
  if (error.name === 'QuotaExceededError') {
    return true;
  }

  // Firefox-specific
  if (error.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
    return true;
  }

  // Legacy code checks
  // Chrome/Safari use code 22
  // Firefox uses code 1014
  if (error.code === 22 || error.code === 1014) {
    return true;
  }

  return false;
}

// ============================================================================
// Safe Storage Operations
// ============================================================================

/**
 * Safely set a value in storage
 * Handles quota exceeded errors with optional eviction
 * 
 * @param key - Storage key
 * @param value - Value to store (will be JSON serialized)
 * @param options - Storage options
 * @returns Result with success flag and optional eviction info
 */
export function safeSet<T>(
  key: string,
  value: T,
  options: SafeSetOptions = {}
): SafeSetResult {
  const { priority = 'standard', allowEviction = true, useSessionStorage = false } = options;

  // Check storage availability
  const storageType = useSessionStorage ? 'session' : 'local';
  if (!isStorageAvailable(storageType)) {
    const error = `Storage unavailable: ${storageType}Storage`;
    emitTelemetry({
      type: 'storage_unavailable',
      key,
      timestamp: Date.now(),
      details: { storageType },
    });
    return { success: false, error };
  }

  const storage = getStorage(useSessionStorage);
  if (!storage) {
    return { success: false, error: 'Storage not accessible' };
  }

  // Serialize value
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch (error) {
    return { 
      success: false, 
      error: `Serialization failed: ${error instanceof Error ? error.message : 'unknown error'}` 
    };
  }

  // Attempt to store
  try {
    storage.setItem(key, serialized);
    return { success: true };
  } catch (error) {
    if (!isQuotaError(error)) {
      // Non-quota error - re-throw for critical writes, fail silently for others
      if (priority === 'critical') {
        throw error;
      }
      return { 
        success: false, 
        error: `Storage error: ${error instanceof Error ? error.message : 'unknown error'}` 
      };
    }

    // Quota exceeded - attempt eviction if allowed and priority warrants it
    if (allowEviction && priority !== 'cache') {
      const targetBytes = estimateSize(value);
      const evicted = evictRecoverableCaches(targetBytes, storageType);

      // Retry after eviction
      try {
        storage.setItem(key, serialized);
        return { success: true, evicted };
      } catch (retryError) {
        // Still failed after eviction
        emitTelemetry({
          type: 'storage_write_failed',
          key,
          timestamp: Date.now(),
          details: {
            reason: 'quota_exceeded_post_eviction',
            evicted,
            valueSize: serialized.length,
            priority,
            storageType,
          },
        });

        if (priority === 'critical') {
          // For critical writes, throw to allow caller to handle
          throw retryError;
        }

        return {
          success: false,
          quotaExceeded: true,
          evicted,
          error: 'Storage quota exceeded even after eviction',
        };
      }
    }

    // Quota exceeded but eviction not allowed or not applicable
    emitTelemetry({
      type: 'storage_write_failed',
      key,
      timestamp: Date.now(),
      details: {
        reason: 'quota_exceeded',
        valueSize: serialized.length,
        priority,
        storageType,
        allowEviction,
      },
    });

    if (priority === 'critical') {
      throw error;
    }

    return {
      success: false,
      quotaExceeded: true,
      error: 'Storage quota exceeded',
    };
  }
}

/**
 * Safely get a value from storage
 * Returns default value if key not found, corrupted, or storage unavailable
 * 
 * @param key - Storage key
 * @param defaultValue - Default value if not found or error
 * @param useSessionStorage - Use sessionStorage instead of localStorage
 * @returns Parsed value or default
 */
export function safeGet<T>(
  key: string,
  defaultValue?: T,
  useSessionStorage: boolean = false
): T | null {
  const storageType = useSessionStorage ? 'session' : 'local';
  if (!isStorageAvailable(storageType)) {
    return defaultValue ?? null;
  }

  const storage = getStorage(useSessionStorage);
  if (!storage) {
    return defaultValue ?? null;
  }

  try {
    const raw = storage.getItem(key);
    if (raw === null) {
      return defaultValue ?? null;
    }

    const parsed = JSON.parse(raw) as T;
    return parsed;
  } catch {
    // Corrupted data - remove it and return default
    try {
      storage.removeItem(key);
    } catch {
      // Ignore cleanup errors
    }
    return defaultValue ?? null;
  }
}

/**
 * Safely remove a key from storage
 * 
 * @param key - Storage key to remove
 * @param useSessionStorage - Use sessionStorage instead of localStorage
 * @returns True if successful (or key didn't exist)
 */
export function safeRemove(key: string, useSessionStorage: boolean = false): boolean {
  const storageType = useSessionStorage ? 'session' : 'local';
  if (!isStorageAvailable(storageType)) {
    return false;
  }

  const storage = getStorage(useSessionStorage);
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely clear all items from storage (use with caution)
 * 
 * @param useSessionStorage - Use sessionStorage instead of localStorage
 * @returns True if successful
 */
export function safeClear(useSessionStorage: boolean = false): boolean {
  const storageType = useSessionStorage ? 'session' : 'local';
  if (!isStorageAvailable(storageType)) {
    return false;
  }

  const storage = getStorage(useSessionStorage);
  if (!storage) {
    return false;
  }

  try {
    storage.clear();
    return true;
  } catch {
    return false;
  }
}

/**
 * Get all keys in storage (safely)
 * 
 * @param useSessionStorage - Use sessionStorage instead of localStorage
 * @returns Array of keys or empty array on error
 */
export function safeKeys(useSessionStorage: boolean = false): string[] {
  const storageType = useSessionStorage ? 'session' : 'local';
  if (!isStorageAvailable(storageType)) {
    return [];
  }

  const storage = getStorage(useSessionStorage);
  if (!storage) {
    return [];
  }

  try {
    // Use Storage API (length + key(index)) instead of Object.keys
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key !== null) {
        keys.push(key);
      }
    }
    return keys;
  } catch {
    return [];
  }
}

// ============================================================================
// Storage Info
// ============================================================================

export interface StorageInfo {
  used: number;
  remaining: number | null;
  total: number | null;
  percentUsed: number | null;
}

/**
 * Get storage usage information (best effort)
 * Note: Most browsers don't expose precise storage limits
 */
export function getStorageInfo(storageType: 'local' | 'session' = 'local'): StorageInfo {
  if (!isStorageAvailable(storageType)) {
    return { used: 0, remaining: null, total: null, percentUsed: null };
  }

  const storage = storageType === 'local' ? localStorage : sessionStorage;
  let used = 0;

  try {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (key) {
        const value = storage.getItem(key);
        if (value) {
          used += value.length * 2; // UTF-16 estimate
        }
      }
    }
  } catch {
    // Fallback: can't calculate usage
    return { used: 0, remaining: null, total: null, percentUsed: null };
  }

  return {
    used,
    remaining: null, // Browser doesn't expose this
    total: null,     // Browser doesn't expose this
    percentUsed: null,
  };
}

// ============================================================================
// Default Export
// ============================================================================

export const safeStorage = {
  set: safeSet,
  get: safeGet,
  remove: safeRemove,
  clear: safeClear,
  keys: safeKeys,
  isAvailable: isStorageAvailable,
  estimateSize,
  getStoredSize,
  evictRecoverableCaches,
  isQuotaError,
  getStorageInfo,
  subscribeToStorageTelemetry,
};

export default safeStorage;
