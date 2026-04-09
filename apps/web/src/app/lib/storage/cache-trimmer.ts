/**
 * Cache Trimmer Module (Workstream 4/6)
 * 
 * Provides size-aware trimming for noncritical local caches:
 * - Chat history: cap at 50 messages per learner/problem, FIFO eviction
 * - Hint backup: cap at 20 hints per learner/problem (handled by hint-cache.ts)
 * - LLM cache: already has LRU eviction at 100 entries
 * - PDF index: already has memory fallback
 * 
 * Also provides a startup trim pass that evicts recoverable caches
 * when approaching quota, emitting 'storage_eviction' telemetry.
 */

import { cleanupHintCache } from './hint-cache';

// Cache key patterns
const CHAT_HISTORY_PREFIX = 'chat-history-';
const LLM_CACHE_KEY = 'sql-learning-llm-cache';
const PDF_INDEX_KEY = 'sql-learning-pdf-index';

// Size limits
export const MAX_CHAT_MESSAGES = 50;
export const MAX_HINT_BACKUP_PER_LEARNER_PROBLEM = 20; // Per learner/problem as per requirement

// Storage quota thresholds
const QUOTA_WARNING_THRESHOLD = 0.85; // 85% full triggers warning
const QUOTA_CRITICAL_THRESHOLD = 0.95; // 95% full triggers eviction

// Telemetry event type
export type StorageEvictionTelemetry = {
  eventType: 'storage_eviction';
  timestamp: number;
  keyClass: 'chat_history' | 'hint_backup' | 'llm_cache' | 'pdf_index' | 'mixed';
  bytesRemoved: number;
  entriesRemoved: number;
  trigger: 'startup_trim' | 'quota_exceeded' | 'manual';
  quotaPercentBefore?: number;
  quotaPercentAfter?: number;
};

// Cache statistics
export type CacheStats = {
  chatHistoryKeys: number;
  hintCacheKeys: number;
  llmCacheEntries: number;
  pdfIndexSize: number;
  estimatedBytes: number;
};

/**
 * Check if storage is approaching quota
 * Returns percentage used (0-1) or null if unable to determine
 */
export function checkStorageQuota(): {
  used: number;
  total: number | null;
  percent: number | null;
} {
  let used = 0;
  let total: number | null = null;
  let percent: number | null = null;

  // Calculate used bytes
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) || '';
      used += key.length + value.length;
    }
  }

  // Try to get quota info (not supported in all browsers)
  if (typeof navigator !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
    // Async, but we'll return what we have for now
    // The startup trim will use estimates
  }

  // Estimate total (typically 5-10MB for localStorage)
  // Use a conservative estimate of 5MB
  total = 5 * 1024 * 1024; // 5MB
  percent = used / total;

  return { used, total, percent };
}

/**
 * Get cache statistics
 */
export function getCacheStats(): CacheStats {
  let chatHistoryKeys = 0;
  let hintCacheKeys = 0;
  let llmCacheEntries = 0;
  let pdfIndexSize = 0;
  let estimatedBytes = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key) continue;

    const value = localStorage.getItem(key) || '';
    const size = key.length + value.length;

    if (key.startsWith(CHAT_HISTORY_PREFIX)) {
      chatHistoryKeys++;
      estimatedBytes += size;
    } else if (key.startsWith('hint-cache:')) {
      hintCacheKeys++;
      estimatedBytes += size;
    } else if (key === LLM_CACHE_KEY) {
      try {
        const cache = JSON.parse(value);
        llmCacheEntries = Object.keys(cache).length;
      } catch {
        llmCacheEntries = 0;
      }
      estimatedBytes += size;
    } else if (key === PDF_INDEX_KEY) {
      pdfIndexSize = value.length;
      estimatedBytes += size;
    }
  }

  return {
    chatHistoryKeys,
    hintCacheKeys,
    llmCacheEntries,
    pdfIndexSize,
    estimatedBytes
  };
}

/**
 * Trim chat history for a specific key
 * Caps at MAX_CHAT_MESSAGES with FIFO eviction
 * Returns bytes removed
 */
/**
 * Trim chat history for a specific key
 * Caps at MAX_CHAT_MESSAGES with FIFO eviction
 * Returns bytes removed
 */
export function trimChatHistory(learnerId: string, problemId: string): number {
  const key = `${CHAT_HISTORY_PREFIX}${learnerId}-${problemId}`;
  const raw = localStorage.getItem(key);
  if (!raw) return 0;

  try {
    const messages = JSON.parse(raw);
    if (!Array.isArray(messages) || messages.length <= MAX_CHAT_MESSAGES) {
      return 0;
    }

    const originalSize = raw.length;
    const trimmed = messages.slice(-MAX_CHAT_MESSAGES);
    const trimmedRaw = JSON.stringify(trimmed);
    
    localStorage.setItem(key, trimmedRaw);
    
    return originalSize - trimmedRaw.length;
  } catch {
    // Invalid JSON, remove the key
    localStorage.removeItem(key);
    return raw.length;
  }
}

/**
 * Count hint cache entries per learner/problem
 * The hint-cache key format is: hint-cache:{learnerId}:{problemId}
 */
function countHintCachePerLearnerProblem(): Map<string, number> {
  const counts = new Map<string, number>();
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith('hint-cache:')) {
      // Parse learnerId and problemId from hint-cache:{learnerId}:{problemId}
      const parts = key.split(':');
      if (parts.length >= 3) {
        const learnerId = parts[1];
        const problemId = parts[2];
        const compositeKey = `${learnerId}:${problemId}`;
        counts.set(compositeKey, (counts.get(compositeKey) || 0) + 1);
      }
    }
  }
  
  return counts;
}

/**
 * Trim all chat histories to MAX_CHAT_MESSAGES
 * Returns telemetry data for evictions
 */
export function trimAllChatHistories(): StorageEvictionTelemetry {
  let totalBytesRemoved = 0;
  let totalEntriesRemoved = 0;

  // Collect keys first to avoid issues with changing length during iteration
  const keysToTrim: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CHAT_HISTORY_PREFIX)) {
      keysToTrim.push(key);
    }
  }

  for (const key of keysToTrim) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const messages = JSON.parse(raw);
      if (!Array.isArray(messages) || messages.length <= MAX_CHAT_MESSAGES) {
        continue;
      }

      const originalSize = raw.length;
      const entriesBefore = messages.length;
      const trimmed = messages.slice(-MAX_CHAT_MESSAGES);
      const trimmedRaw = JSON.stringify(trimmed);
      
      localStorage.setItem(key, trimmedRaw);
      
      totalBytesRemoved += originalSize - trimmedRaw.length;
      totalEntriesRemoved += entriesBefore - trimmed.length;
    } catch {
      // Invalid JSON, remove the key
      const size = raw.length;
      localStorage.removeItem(key);
      totalBytesRemoved += size;
      totalEntriesRemoved += 1;
    }
  }

  return {
    eventType: 'storage_eviction',
    timestamp: Date.now(),
    keyClass: 'chat_history',
    bytesRemoved: totalBytesRemoved,
    entriesRemoved: totalEntriesRemoved,
    trigger: 'startup_trim'
  };
}

/**
 * Clear LLM cache entries oldest first
 * Returns bytes removed
 */
export function trimLLMCache(targetEntries: number = 100): number {
  const raw = localStorage.getItem(LLM_CACHE_KEY);
  if (!raw) return 0;

  try {
    const cache: Record<string, { createdAt?: number }> = JSON.parse(raw);
    const entries = Object.entries(cache);
    
    if (entries.length <= targetEntries) {
      return 0;
    }

    const originalSize = raw.length;
    
    // Sort by createdAt (oldest first)
    const sorted = entries.sort((a, b) => {
      const aTime = a[1]?.createdAt || 0;
      const bTime = b[1]?.createdAt || 0;
      return aTime - bTime;
    });

    // Keep only the most recent targetEntries
    const toKeep = sorted.slice(-targetEntries);
    const trimmedCache = Object.fromEntries(toKeep);
    
    const trimmedRaw = JSON.stringify(trimmedCache);
    localStorage.setItem(LLM_CACHE_KEY, trimmedRaw);

    return originalSize - trimmedRaw.length;
  } catch {
    return 0;
  }
}

/**
 * Clear PDF index from localStorage (keeps memory fallback)
 * Returns bytes removed
 */
export function clearPdfIndex(): number {
  const raw = localStorage.getItem(PDF_INDEX_KEY);
  if (!raw) return 0;

  localStorage.removeItem(PDF_INDEX_KEY);
  return raw.length;
}

/**
 * Perform startup trim pass
 * - If approaching quota, evict recoverable caches first
 * - Emits 'storage_eviction' telemetry
 * Returns summary of actions taken
 */
export function runStartupTrimPass(): {
  action: 'none' | 'trimmed' | 'evicted';
  telemetry: StorageEvictionTelemetry[];
  freedBytes: number;
  quotaPercentBefore: number | null;
  quotaPercentAfter: number | null;
} {
  const { percent: quotaPercentBefore } = checkStorageQuota();
  const telemetry: StorageEvictionTelemetry[] = [];
  let freedBytes = 0;

  // Always trim chat histories to cap (non-destructive, FIFO)
  const chatTelemetry = trimAllChatHistories();
  if (chatTelemetry.bytesRemoved > 0 || chatTelemetry.entriesRemoved > 0) {
    telemetry.push(chatTelemetry);
    freedBytes += chatTelemetry.bytesRemoved;
  }

  // Always run hint cache cleanup
  const hintResult = cleanupHintCache();
  if (hintResult.removedCount && hintResult.removedCount > 0) {
    telemetry.push({
      eventType: 'storage_eviction',
      timestamp: Date.now(),
      keyClass: 'hint_backup',
      bytesRemoved: hintResult.bytes || 0,
      entriesRemoved: hintResult.removedCount,
      trigger: 'startup_trim'
    });
    freedBytes += hintResult.bytes || 0;
  }

  // Check if we need aggressive eviction
  const needsEviction = quotaPercentBefore !== null && quotaPercentBefore > QUOTA_WARNING_THRESHOLD;

  if (needsEviction) {
    // Trim LLM cache to ensure it's within limits
    const llmBytesRemoved = trimLLMCache(80); // More aggressive than default 100
    if (llmBytesRemoved > 0) {
      telemetry.push({
        eventType: 'storage_eviction',
        timestamp: Date.now(),
        keyClass: 'llm_cache',
        bytesRemoved: llmBytesRemoved,
        entriesRemoved: 0, // We don't track exact count here
        trigger: 'quota_exceeded'
      });
      freedBytes += llmBytesRemoved;
    }

    // If critically full, evict PDF index (has memory fallback)
    if (quotaPercentBefore !== null && quotaPercentBefore > QUOTA_CRITICAL_THRESHOLD) {
      const pdfBytesRemoved = clearPdfIndex();
      if (pdfBytesRemoved > 0) {
        telemetry.push({
          eventType: 'storage_eviction',
          timestamp: Date.now(),
          keyClass: 'pdf_index',
          bytesRemoved: pdfBytesRemoved,
          entriesRemoved: 1,
          trigger: 'quota_exceeded'
        });
        freedBytes += pdfBytesRemoved;
      }
    }
  }

  // Calculate new quota after trimming
  const { percent: quotaPercentAfter } = checkStorageQuota();

  // Emit telemetry events
  for (const event of telemetry) {
    event.quotaPercentBefore = quotaPercentBefore ?? undefined;
    event.quotaPercentAfter = quotaPercentAfter ?? undefined;
    emitStorageTelemetry(event);
  }

  return {
    action: telemetry.length > 0 ? (needsEviction ? 'evicted' : 'trimmed') : 'none',
    telemetry,
    freedBytes,
    quotaPercentBefore,
    quotaPercentAfter
  };
}

/**
 * Emit storage telemetry event
 */
function emitStorageTelemetry(event: StorageEvictionTelemetry): void {
  // Log to console for now (could be sent to analytics service)
  console.info('[storage_eviction]', {
    keyClass: event.keyClass,
    bytesRemoved: event.bytesRemoved,
    entriesRemoved: event.entriesRemoved,
    trigger: event.trigger,
    quotaPercentBefore: event.quotaPercentBefore,
    quotaPercentAfter: event.quotaPercentAfter
  });

  // Dispatch custom event for any listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('storage_eviction', { detail: event }));
  }
}

/**
 * Emergency eviction - clear all recoverable caches
 * Called when a critical write fails due to quota exceeded
 * Returns total bytes freed
 */
export function emergencyEviction(): number {
  let freedBytes = 0;

  // Clear all chat histories
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CHAT_HISTORY_PREFIX) || key?.startsWith('hint-cache:')) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    const value = localStorage.getItem(key) || '';
    freedBytes += key.length + value.length;
    localStorage.removeItem(key);
  }

  // Clear LLM cache
  const llmRaw = localStorage.getItem(LLM_CACHE_KEY);
  if (llmRaw) {
    freedBytes += LLM_CACHE_KEY.length + llmRaw.length;
    localStorage.removeItem(LLM_CACHE_KEY);
  }

  // Clear PDF index
  const pdfRaw = localStorage.getItem(PDF_INDEX_KEY);
  if (pdfRaw) {
    freedBytes += PDF_INDEX_KEY.length + pdfRaw.length;
    localStorage.removeItem(PDF_INDEX_KEY);
  }

  emitStorageTelemetry({
    eventType: 'storage_eviction',
    timestamp: Date.now(),
    keyClass: 'mixed',
    bytesRemoved: freedBytes,
    entriesRemoved: keysToRemove.length + (llmRaw ? 1 : 0) + (pdfRaw ? 1 : 0),
    trigger: 'manual'
  });

  return freedBytes;
}

/**
 * Initialize cache trimmer
 * Runs startup trim pass and sets up listeners
 */
export function initializeCacheTrimmer(): void {
  // Run startup trim pass
  const result = runStartupTrimPass();
  
  if (result.action !== 'none') {
    console.info('[CacheTrimmer] Startup trim complete:', {
      action: result.action,
      freedBytes: result.freedBytes,
      quotaBefore: result.quotaPercentBefore,
      quotaAfter: result.quotaPercentAfter
    });
  }

  // Listen for quota exceeded errors from other components
  if (typeof window !== 'undefined') {
    window.addEventListener('storage_quota_exceeded', () => {
      console.warn('[CacheTrimmer] Quota exceeded event received, running emergency eviction');
      emergencyEviction();
    });
  }
}
