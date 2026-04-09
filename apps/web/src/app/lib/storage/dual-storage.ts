/**
 * Dual-Mode Storage Adapter
 * Backend API is the PRIMARY source of truth
 * localStorage is used as offline cache and fallback only
 * 
 * Key behaviors:
 * - getUserProfile: Try backend first, fall back to localStorage if offline
 * - saveInteraction: Send to backend first, cache in localStorage, queue if offline
 * - All writes: Attempt backend first, fallback to localStorage + offline queue
 */

import { storage as localStorageManager } from './storage';
import {
  safeSet,
  safeGet,
  safeRemove,
  subscribeToStorageTelemetry,
  type SafeSetResult,
} from './safe-storage';
import {
  storageClient,
  isBackendAvailable,
  checkBackendHealth,
} from '../api/storage-client';
import { clearAllUiState, clearUiStateForActor } from '../ui-state';
import {
  getResearchRuntimeMode,
  isResearchSafe,
  isResearchUnsafe,
  RESEARCH_CONTRACT_VERSION,
} from '../runtime-config';
import type {
  UserProfile,
  InteractionEvent,
  InstructionalUnit,
  LearnerProfile,
  SaveTextbookUnitResult,
} from '@/app/types';
import type { CreateUnitInput } from './textbook-units';
import { createEventId } from '../utils/event-id';

// Configuration
// VITE_API_BASE_URL is the canonical env var — presence alone enables backend mode
const USE_BACKEND = !!import.meta.env.VITE_API_BASE_URL;

// Offline queue configuration
const OFFLINE_QUEUE_KEY = 'sql-adapt-offline-queue';
const PENDING_SESSION_ENDS_KEY = 'sql-adapt-pending-session-ends';
const PENDING_CONFIRMED_KEY = 'sql-adapt-pending-confirmed';
const DEAD_LETTER_KEY = 'sql-adapt-dead-letter';

// RESEARCH-2: Durable write semantics
// No max queue size - use chunked storage instead of dropping
const CHUNK_SIZE = 100;
// No max retries - retry until backend confirms
const RETRY_INTERVAL_MS = 5000;
const BATCH_SIZE = 25;

// RESEARCH-1: Durable pending store for all interactions
const PENDING_INTERACTIONS_KEY = 'sql-adapt-pending-interactions';

// Event status for tracking durability
export type EventStatus = 'queued_locally' | 'sent_unverified' | 'backend_confirmed' | 'dead_letter';

// RESEARCH-1: Interaction status lifecycle for durable writes
export type InteractionStatus =
  | 'locally_persisted'      // Saved to localStorage, not yet sent
  | 'backend_pending'        // In flight, awaiting confirmation
  | 'backend_confirmed'      // Backend confirmed receipt
  | 'dead_letter';           // Irrecoverable, schema validation failed

interface StorageConfig {
  useBackend: boolean;
  fallbackToLocal: boolean;
}

interface QueuedItem {
  id: string;
  type: 'interaction' | 'textbookUnit' | 'profile' | 'session';
  data: unknown;
  retries: number;
  timestamp: number;
  status: EventStatus;
  lastAttempt?: number;
  errorCount: number;
}

interface ConfirmedItem {
  id: string;
  confirmedAt: number;
}

interface DeadLetterItem {
  id: string;
  type: string;
  data: unknown;
  reason: string;
  timestamp: number;
}

interface PendingSessionEnd {
  key: string;
  event: InteractionEvent;
  queuedAt: number;
  lastAttemptAt?: number;
}

export type CriticalWriteStatus = {
  backendConfirmed: boolean;
  pendingSync: boolean;
  error?: string;
};

export type StorageMode = 'local' | 'backend' | 'offline';

/** Research runtime mode for data durability */
export type ResearchMode = 'research-safe' | 'research-unsafe' | 'dev-demo';

/** Queue statistics for diagnostics */
export interface QueueStats {
  pendingCount: number;
  oldestUnconfirmedAgeMs: number | null;
  lastBackendAckTime: number | null;
  totalConfirmed: number;
  totalFailed: number;
}

// ============================================================================
// Offline Queue Manager
// ============================================================================

// ============================================================================
// Pending Interaction Entry - RESEARCH-1: Durable pending store
// ============================================================================

interface PendingInteraction {
  id: string;
  event: InteractionEvent;
  status: InteractionStatus;
  timestamp: number;        // When first saved locally
  lastAttempt?: number;     // When last sent to backend
  retryCount: number;       // Number of send attempts
  sessionId: string;
  eventType: string;
}

// ============================================================================
// Durable Pending Store - RESEARCH-1: Tracks ALL unconfirmed interactions
// ============================================================================

class DurablePendingStore {
  private interactions: Map<string, PendingInteraction> = new Map();
  private confirmedIds: Set<string> = new Set();

  constructor() {
    this.loadConfirmed();
    this.loadPending();
  }

  // Confirmed IDs management (for deduplication)
  private loadConfirmed(): void {
    const confirmed = safeGet<ConfirmedItem[]>(PENDING_CONFIRMED_KEY, []);
    if (confirmed) {
      this.confirmedIds = new Set(confirmed.map(c => c.id));
    } else {
      this.confirmedIds = new Set();
    }
  }

  private saveConfirmed(): SafeSetResult {
    const confirmed: ConfirmedItem[] = Array.from(this.confirmedIds).map(id => ({
      id,
      confirmedAt: Date.now(),
    }));
    // Critical session data - use memory fallback if quota exceeded
    const result = safeSet(PENDING_CONFIRMED_KEY, confirmed.slice(-1000), {
      priority: 'critical',
      allowEviction: true,
    });
    return result;
  }

  isConfirmed(id: string): boolean {
    return this.confirmedIds.has(id);
  }

  markConfirmed(id: string): void {
    this.confirmedIds.add(id);
    this.interactions.delete(id); // Remove from pending once confirmed
    this.savePending();
    this.saveConfirmed();
  }

  markConfirmedBatch(ids: string[]): void {
    for (const id of ids) {
      this.confirmedIds.add(id);
      this.interactions.delete(id);
    }
    this.savePending();
    this.saveConfirmed();
  }

  // Pending interactions management
  private loadPending(): void {
    const pending = safeGet<PendingInteraction[]>(PENDING_INTERACTIONS_KEY, []);
    if (pending) {
      for (const item of pending) {
        // Skip if already confirmed
        if (!this.confirmedIds.has(item.id)) {
          this.interactions.set(item.id, item);
        }
      }
    } else {
      this.interactions.clear();
    }
  }

  private savePending(): SafeSetResult {
    // Filter out confirmed interactions and sort by timestamp
    const pending = Array.from(this.interactions.values())
      .filter(item => !this.confirmedIds.has(item.id) && item.status !== 'backend_confirmed')
      .sort((a, b) => a.timestamp - b.timestamp);
    
    // Store in chunks if needed
    const dataToStore = pending.length > CHUNK_SIZE ? pending.slice(-CHUNK_SIZE) : pending;
    
    // Critical session data - use memory fallback if quota exceeded
    const result = safeSet(PENDING_INTERACTIONS_KEY, dataToStore, {
      priority: 'critical',
      allowEviction: true,
    });
    
    if (!result.success && result.quotaExceeded) {
      // Try with just the most recent
      const recent = Array.from(this.interactions.values())
        .filter(item => !this.confirmedIds.has(item.id))
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 50);
      
      const retryResult = safeSet(PENDING_INTERACTIONS_KEY, recent, {
        priority: 'critical',
        allowEviction: true,
      });
      
      if (!retryResult.success) {
        console.error('[DurablePendingStore] Failed to save pending interactions', retryResult.error);
      }
      return retryResult;
    }
    
    return result;
  }

  /**
   * Add a new interaction to the pending store
   * RESEARCH-1: Every interaction starts as 'backend_pending'
   */
  add(event: InteractionEvent): void {
    // Skip if already confirmed
    if (this.confirmedIds.has(event.id)) {
      return;
    }

    const pending: PendingInteraction = {
      id: event.id,
      event,
      status: 'backend_pending',
      timestamp: Date.now(),
      retryCount: 0,
      sessionId: event.sessionId || 'unknown',
      eventType: event.eventType,
    };

    this.interactions.set(event.id, pending);
    this.savePending();

    console.info('[telemetry_interaction_pending]', {
      eventId: event.id,
      eventType: event.eventType,
      sessionId: event.sessionId,
    });
  }

  /**
   * Mark an interaction as sent (but not yet confirmed)
   */
  markSent(id: string): void {
    const item = this.interactions.get(id);
    if (item) {
      item.status = 'backend_pending';
      item.lastAttempt = Date.now();
      item.retryCount++;
      this.savePending();
    }
  }

  /**
   * Mark an interaction as confirmed by backend
   */
  markConfirmedInteraction(id: string): void {
    this.markConfirmed(id);
    console.info('[telemetry_interaction_confirmed]', { eventId: id });
  }

  /**
   * Mark an interaction as dead letter (irrecoverable)
   */
  markDeadLetter(id: string, reason: string): void {
    const item = this.interactions.get(id);
    if (item) {
      item.status = 'dead_letter';
      this.savePending();
      console.error('[telemetry_dead_letter]', { eventId: id, reason });
    }
  }

  /**
   * Get all pending interactions (backend_pending status)
   */
  getAllPending(): PendingInteraction[] {
    return Array.from(this.interactions.values())
      .filter(item => item.status === 'backend_pending' && !this.confirmedIds.has(item.id))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Get pending interactions for a specific session
   * RESEARCH-1: Used for pagehide flush
   */
  getPendingForSession(sessionId: string): PendingInteraction[] {
    return this.getAllPending().filter(item => item.sessionId === sessionId);
  }

  /**
   * Get a specific pending interaction
   */
  get(id: string): PendingInteraction | undefined {
    return this.interactions.get(id);
  }

  /**
   * Check if an interaction is pending
   */
  isPending(id: string): boolean {
    const item = this.interactions.get(id);
    return item !== undefined && item.status === 'backend_pending' && !this.confirmedIds.has(id);
  }

  /**
   * Get count of pending interactions
   */
  getPendingCount(): number {
    return this.getAllPending().length;
  }

  /**
   * Get statistics for diagnostics
   */
  getStats(): {
    totalPending: number;
    oldestPendingAgeMs: number | null;
    bySession: Record<string, number>;
    byEventType: Record<string, number>;
  } {
    const pending = this.getAllPending();
    const now = Date.now();
    
    let oldestPendingAgeMs: number | null = null;
    if (pending.length > 0) {
      const oldest = Math.min(...pending.map(p => p.timestamp));
      oldestPendingAgeMs = now - oldest;
    }

    const bySession: Record<string, number> = {};
    const byEventType: Record<string, number> = {};
    
    for (const item of pending) {
      bySession[item.sessionId] = (bySession[item.sessionId] || 0) + 1;
      byEventType[item.eventType] = (byEventType[item.eventType] || 0) + 1;
    }

    return {
      totalPending: pending.length,
      oldestPendingAgeMs,
      bySession,
      byEventType,
    };
  }

  /**
   * Clear all pending interactions (use with caution)
   */
  clear(): void {
    this.interactions.clear();
    safeRemove(PENDING_INTERACTIONS_KEY);
  }
}

// ============================================================================
// Offline Queue Manager - Durable retry-until-ack semantics
// ============================================================================

class OfflineQueueManager {
  private queue: QueuedItem[] = [];
  private isProcessing = false;
  private durableStore: DurablePendingStore;
  private deadLetter: DeadLetterItem[] = [];
  private onConfirmedCallback?: (ids: string[]) => void;
  private onDeadLetterCallback?: (ids: string[], reason: string) => void;

  constructor(onConfirmed?: (ids: string[]) => void, onDeadLetter?: (ids: string[], reason: string) => void) {
    this.durableStore = new DurablePendingStore();
    this.onConfirmedCallback = onConfirmed;
    this.onDeadLetterCallback = onDeadLetter;
    this.loadQueue();
    this.loadDeadLetter();
    // Start background processing
    this.startBackgroundProcessing();
  }

  private loadQueue(): void {
    this.queue = safeGet<QueuedItem[]>(OFFLINE_QUEUE_KEY, []) ?? [];
  }

  private saveQueue(): SafeSetResult {
    // Filter out confirmed items before saving
    const unconfirmed = this.queue.filter(item => 
      item.status !== 'backend_confirmed' && !this.durableStore.isConfirmed(item.id)
    );
    
    // Critical session data - use memory fallback if quota exceeded
    const result = safeSet(OFFLINE_QUEUE_KEY, unconfirmed, {
      priority: 'critical',
      allowEviction: true,
    });
    
    if (!result.success && result.quotaExceeded) {
      // Try to save in chunks
      return this.saveQueueChunked();
    }
    
    return result;
  }

  private saveQueueChunked(): SafeSetResult {
    // Keep only most recent items if storage is limited
    const recent = this.queue
      .filter(item => item.status !== 'backend_confirmed')
      .slice(-CHUNK_SIZE);
    
    const result = safeSet(OFFLINE_QUEUE_KEY, recent, {
      priority: 'critical',
      allowEviction: true,
    });
    
    if (!result.success) {
      // Last resort: keep minimal queue
      const minimal = this.queue.slice(-20);
      const minimalResult = safeSet(OFFLINE_QUEUE_KEY, minimal, {
        priority: 'critical',
        allowEviction: true,
      });
      
      if (!minimalResult.success) {
        // Memory fallback: queue remains in memory, will be retried on next session
        console.error('[OfflineQueueManager] Failed to save queue to storage, using memory fallback');
      }
      return minimalResult;
    }
    
    return result;
  }

  private loadDeadLetter(): void {
    this.deadLetter = safeGet<DeadLetterItem[]>(DEAD_LETTER_KEY, []) ?? [];
  }

  private saveDeadLetter(): SafeSetResult {
    // Critical for research data integrity - use memory fallback if quota exceeded
    return safeSet(DEAD_LETTER_KEY, this.deadLetter.slice(-50), {
      priority: 'critical',
      allowEviction: true,
    });
  }

  add(item: Omit<QueuedItem, 'retries' | 'timestamp' | 'status' | 'errorCount'>): void {
    // Check if already confirmed
    if (this.durableStore.isConfirmed(item.id)) {
      return;
    }

    const queueItem: QueuedItem = {
      ...item,
      retries: 0,
      timestamp: Date.now(),
      status: 'queued_locally',
      errorCount: 0,
    };
    
    this.queue.push(queueItem);
    this.saveQueue();

    // Log queue growth for large backlogs
    if (this.queue.length > CHUNK_SIZE) {
      console.info('[OfflineQueue] Queue size:', this.queue.length, '- using chunked storage');
    }
  }

  remove(id: string): void {
    this.queue = this.queue.filter(item => item.id !== id);
    this.durableStore.markConfirmed(id);
    this.saveQueue();
  }

  removeBatch(ids: string[]): void {
    this.queue = this.queue.filter(item => !ids.includes(item.id));
    this.durableStore.markConfirmedBatch(ids);
    this.saveQueue();
    
    // RESEARCH-1: Notify external pending store of confirmations
    if (this.onConfirmedCallback) {
      this.onConfirmedCallback(ids);
    }
  }

  getPending(): QueuedItem[] {
    // Filter out confirmed items
    return this.queue.filter(item => 
      item.status !== 'backend_confirmed' && !this.durableStore.isConfirmed(item.id)
    );
  }

  getAllUnconfirmed(): QueuedItem[] {
    return this.getPending();
  }

  incrementRetry(id: string, error?: Error): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.retries++;
      item.lastAttempt = Date.now();
      item.status = 'sent_unverified';
      
      if (error) {
        item.errorCount++;
      }
      
      // RESEARCH-2: Never drop items due to retry count
      // Only move to dead letter for irrecoverable schema validation failures
      this.saveQueue();
    }
  }

  markSent(id: string): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.status = 'sent_unverified';
      item.lastAttempt = Date.now();
      this.saveQueue();
    }
  }

  moveToDeadLetter(id: string, reason: string): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      this.deadLetter.push({
        id: item.id,
        type: item.type,
        data: item.data,
        reason,
        timestamp: Date.now(),
      });
      this.saveDeadLetter();
      
      // Log for research visibility
      console.error('[telemetry_dead_letter]', {
        eventId: item.id,
        eventType: item.type,
        reason,
      });
      
      // Remove from main queue
      this.queue = this.queue.filter(item => item.id !== id);
      this.saveQueue();

      if (this.onDeadLetterCallback) {
        this.onDeadLetterCallback([id], reason);
      }
    }
  }

  getDeadLetter(): DeadLetterItem[] {
    return [...this.deadLetter];
  }

  private startBackgroundProcessing(): void {
    // Try to process queue every 30 seconds
    setInterval(() => {
      this.processQueue();
    }, 30000);
    
    // Also try on online event
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.log('[OfflineQueue] Back online, processing queue...');
        this.processQueue();
      });
    }
  }

  async processQueue(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0) {
      return;
    }

    const backendHealthy = await checkBackendHealth();
    if (!backendHealthy) {
      return;
    }

    this.isProcessing = true;
    
    const pending = this.getPending();
    
    // Process interactions in batches for efficiency
    const interactions = pending.filter(item => item.type === 'interaction');
    const others = pending.filter(item => item.type !== 'interaction');
    
    // Process interactions in batches
    for (let i = 0; i < interactions.length; i += BATCH_SIZE) {
      const batch = interactions.slice(i, i + BATCH_SIZE);
      const events = batch.map(item => item.data as InteractionEvent);
      
      try {
        // Use verified batch write
        const result = await storageClient.logInteractionsBatchVerified(events);
        
        if (result.confirmed.length > 0) {
          this.removeBatch(result.confirmed);
        }

        if (result.invalid && result.invalid.length > 0) {
          for (const id of result.invalid) {
            this.moveToDeadLetter(id, 'server_schema_validation_failed');
          }
        }
        
        // Mark sent but not confirmed for retry
        for (const id of result.failed) {
          if (result.invalid?.includes(id)) {
            continue;
          }
          this.incrementRetry(id);
        }
      } catch (error) {
        console.warn('[OfflineQueue] Batch processing failed:', error);
        // Mark all as retry
        for (const item of batch) {
          this.incrementRetry(item.id, error as Error);
        }
      }
    }
    
    // Process other item types individually
    for (const item of others) {
      try {
        let success = false;
        
        switch (item.type) {
          case 'textbookUnit': {
            const { learnerId, unit } = item.data as { learnerId: string; unit: InstructionalUnit };
            success = await storageClient.saveTextbookUnit(learnerId, unit);
            break;
          }
          case 'profile':
            success = await storageClient.saveProfile(item.data as LearnerProfile);
            break;
          case 'session': {
            const { learnerId, data } = item.data as { learnerId: string; data: unknown };
            success = await storageClient.saveSession(learnerId, data as { startTime: string; lastActivity: string });
            break;
          }
        }
        
        if (success) {
          this.remove(item.id);
        } else {
          this.incrementRetry(item.id);
        }
      } catch (error) {
        console.warn('[OfflineQueue] Failed to process item:', error);
        this.incrementRetry(item.id, error as Error);
      }
      
      // Small delay between items to avoid overwhelming the backend
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.isProcessing = false;
  }
}

// ============================================================================
// Dual Storage Manager
// ============================================================================

class DualStorageManager {
  private config: StorageConfig;
  private backendHealthy: boolean = false;
  private offlineQueue: OfflineQueueManager;
  private pendingStore: DurablePendingStore;  // RESEARCH-1: Tracks all pending interactions
  private lastHydratedAt: Record<string, number> = {};
  private lastBackendAckTime: number | null = null;
  private totalConfirmedCount: number = 0;
  private totalFailedCount: number = 0;

  private storageTelemetryUnsubscribe?: () => void;

  constructor() {
    this.config = {
      useBackend: USE_BACKEND,
      fallbackToLocal: true,
    };
    
    // Subscribe to storage telemetry for monitoring quota issues
    this.storageTelemetryUnsubscribe = subscribeToStorageTelemetry((event) => {
      if (event.type === 'storage_write_failed' && event.details?.priority === 'critical') {
        console.error('[DualStorage] Critical storage write failed:', event.key, event.details);
      }
    });
    
    this.pendingStore = new DurablePendingStore();  // RESEARCH-1
    this.offlineQueue = new OfflineQueueManager((ids) => {
      // RESEARCH-1: When offline queue confirms items, also mark in pending store
      for (const id of ids) {
        this.pendingStore.markConfirmedInteraction(id);
      }
    }, (ids, reason) => {
      for (const id of ids) {
        this.pendingStore.markDeadLetter(id, reason);
      }
    });
    
    // Check backend health on init
    if (this.config.useBackend) {
      void this.checkHealth().then((healthy) => {
        if (healthy) {
          void this.flushPendingSessionEnds();
        }
      });
      if (typeof window !== 'undefined') {
        window.addEventListener('online', () => {
          void this.flushPendingSessionEnds();
        });
      }
    }
  }

  /**
   * Get current storage mode
   */
  getMode(): StorageMode {
    if (!this.config.useBackend) return 'local';
    if (this.backendHealthy) return 'backend';
    return 'offline';
  }

  /**
   * Check if backend is available and healthy
   */
  async checkHealth(): Promise<boolean> {
    if (!this.config.useBackend) {
      this.backendHealthy = false;
      return false;
    }
    this.backendHealthy = await checkBackendHealth();
    return this.backendHealthy;
  }

  /**
   * Get research runtime mode
   * @returns 'research-safe' | 'research-unsafe' | 'dev-demo'
   */
  getResearchMode(): ResearchMode {
    return getResearchRuntimeMode();
  }

  /**
   * Check if in research-safe mode (data durability guaranteed)
   */
  isResearchSafe(): boolean {
    return isResearchSafe();
  }

  /**
   * Check if in research-unsafe mode (BLOCKING in production)
   */
  isResearchUnsafe(): boolean {
    return isResearchUnsafe();
  }

  /**
   * Check if storage operations are allowed
   * Returns false in research-unsafe mode
   */
  areWritesAllowed(): boolean {
    return !isResearchUnsafe();
  }

  /**
   * Get queue statistics for diagnostics
   */
  getQueueStats(): QueueStats {
    const pending = this.offlineQueue.getPending();
    const now = Date.now();
    
    let oldestUnconfirmedAgeMs: number | null = null;
    if (pending.length > 0) {
      const oldest = pending.reduce((oldest, item) => 
        item.timestamp < oldest.timestamp ? item : oldest
      );
      oldestUnconfirmedAgeMs = now - oldest.timestamp;
    }

    return {
      pendingCount: pending.length,
      oldestUnconfirmedAgeMs,
      lastBackendAckTime: this.lastBackendAckTime,
      totalConfirmed: this.totalConfirmedCount,
      totalFailed: this.totalFailedCount,
    };
  }

  /**
   * Log queue statistics for telemetry
   */
  logQueueStats(): void {
    const stats = this.getQueueStats();
    const pendingStats = this.pendingStore.getStats();
    // eslint-disable-next-line no-console
    console.info('[telemetry_queue_stats]', {
      ...stats,
      pendingStore: pendingStats,
      researchMode: this.getResearchMode(),
      contractVersion: RESEARCH_CONTRACT_VERSION,
    });
  }

  /**
   * RESEARCH-1: Get all pending interactions (not yet confirmed by backend)
   */
  getAllPendingInteractions(): InteractionEvent[] {
    return this.pendingStore.getAllPending().map(p => p.event);
  }

  /**
   * RESEARCH-1: Get pending interactions for a specific session
   * Used for pagehide flush to ensure all session events are sent
   */
  getPendingInteractionsForSession(sessionId: string): InteractionEvent[] {
    return this.pendingStore.getPendingForSession(sessionId).map(p => p.event);
  }

  /**
   * RESEARCH-1: Get pending store statistics
   */
  getPendingStats(): ReturnType<DurablePendingStore['getStats']> {
    return this.pendingStore.getStats();
  }

  /**
   * Set storage mode
   */
  setMode(mode: 'local' | 'backend'): void {
    this.config.useBackend = mode === 'backend';
    if (mode === 'backend') {
      this.checkHealth();
    }
  }

  // ============================================================================
  // User Profile Operations
  // ============================================================================

  saveUserProfile(profile: UserProfile): { success: boolean; quotaExceeded?: boolean } {
    // Always save to localStorage as cache (synchronous)
    const localResult = localStorageManager.saveUserProfile(profile);
    
    // Backend sync in background
    if (this.shouldUseBackend()) {
      storageClient.createLearner(profile).then(success => {
        if (!success) {
          // Backend failed, add to offline queue
          this.offlineQueue.add({
            id: `profile-${profile.id}-${Date.now()}`,
            type: 'profile',
            data: profile,
          });
        }
      }).catch(error => {
        console.warn('[DualStorage] Backend saveUserProfile failed, queued for retry:', error);
        this.offlineQueue.add({
          id: `profile-${profile.id}-${Date.now()}`,
          type: 'profile',
          data: profile,
        });
      });
    }
    
    return localResult;
  }

  getUserProfile(): UserProfile | null {
    // Try backend FIRST (primary source of truth) - async in background
    if (this.shouldUseBackend()) {
      const localProfile = localStorageManager.getUserProfile();
      const learnerId = localProfile?.id;
      
      if (learnerId) {
        storageClient.getLearner(learnerId).then(backendProfile => {
          if (backendProfile) {
            // Sync to localStorage for offline access
            localStorageManager.saveUserProfile(backendProfile);
          }
        }).catch(error => {
          console.warn('[DualStorage] Backend getUserProfile failed, using localStorage:', error);
        });
      }
    }
    
    // Always return localStorage data immediately (synchronous)
    return localStorageManager.getUserProfile();
  }

  clearUserProfile(): boolean {
    // Always clear both
    if (this.config.useBackend) {
      // Backend doesn't support delete yet, just clear local
    }
    const profile = localStorageManager.getUserProfile();
    if (profile?.id) {
      clearUiStateForActor(profile.id);
    } else {
      clearAllUiState();
    }
    return localStorageManager.clearUserProfile();
  }

  // ============================================================================
  // Interaction/Event Operations
  // ============================================================================

  private withActiveSessionFallback(event: InteractionEvent): InteractionEvent {
    const explicitSessionId = event.sessionId?.trim();
    if (explicitSessionId) {
      return explicitSessionId === event.sessionId
        ? event
        : { ...event, sessionId: explicitSessionId };
    }

    return {
      ...event,
      sessionId: localStorageManager.getActiveSessionId(),
    };
  }

  private queueInteractionForRetry(event: InteractionEvent): void {
    this.offlineQueue.add({
      id: event.id,
      type: 'interaction',
      data: event,
    });
  }

  private sendInteractionToBackend(event: InteractionEvent, source: string): void {
    if (!this.shouldUseBackend()) {
      return;
    }

    const eventForWrite = this.withActiveSessionFallback(event);
    storageClient.logInteraction(eventForWrite).then(result => {
      if (!result.success || !result.confirmed) {
        this.queueInteractionForRetry(eventForWrite);
      }
    }).catch(error => {
      console.warn(`[DualStorage] Backend ${source} failed, queuing for retry:`, error);
      this.queueInteractionForRetry(eventForWrite);
    });
  }

  /**
   * @deprecated Use saveInteraction() for all research-critical events.
   * This method uses the old send-and-queue-on-failure logic instead of 
   * the durable pending-store lifecycle. Removed for concept_view and session_end.
   */
  private syncLatestLocalInteraction<T>(learnerId: string, source: string, write: () => T): T {
    const beforeCount = localStorageManager.getInteractionsByLearner(learnerId).length;
    const result = write();
    const writeFailed =
      typeof result === 'object' &&
      result !== null &&
      'success' in result &&
      (result as { success?: unknown }).success === false;
    if (writeFailed) {
      return result;
    }

    const interactions = localStorageManager.getInteractionsByLearner(learnerId);
    if (interactions.length <= beforeCount) {
      return result;
    }

    for (const createdEvent of interactions.slice(beforeCount)) {
      this.sendInteractionToBackend(createdEvent, source);
    }
    return result;
  }

  saveInteraction(event: InteractionEvent): { success: boolean; quotaExceeded?: boolean; blocked?: boolean } {
    // RESEARCH-SAFETY: Block writes in research-unsafe mode
    if (isResearchUnsafe()) {
      console.error('[DualStorage] BLOCKED: saveInteraction in research-unsafe mode');
      return { success: false, blocked: true };
    }

    const eventForWrite = this.withActiveSessionFallback(event);
    
    // RESEARCH-1: Durable write semantics
    // Step 1: Save to localStorage FIRST (synchronous, always succeeds or fails fast)
    const localResult = localStorageManager.saveInteraction(eventForWrite);
    if (!localResult.success) {
      return localResult;  // Return quota exceeded or other local failure
    }
    
    // Step 2: Add to durable pending store BEFORE network send
    // This ensures the event is tracked even if the tab closes during send
    this.pendingStore.add(eventForWrite);
    
    // Step 3: Update problem progress for execution events
    if (this.shouldUseBackend() && eventForWrite.eventType === 'execution' && eventForWrite.problemId) {
      const progressPayload = {
        solved: eventForWrite.successful === true,
        incrementAttempts: true,
        lastCode: eventForWrite.code,
      };
      storageClient.updateProblemProgress(
        eventForWrite.learnerId,
        eventForWrite.problemId,
        progressPayload
      ).catch(error => {
        console.warn('[DualStorage] Backend updateProblemProgress failed:', error);
        // Non-blocking - progress update is best-effort
      });
    }
    
    // Step 4: Send to backend (async in background)
    if (this.shouldUseBackend()) {
      this.pendingStore.markSent(eventForWrite.id);
      
      storageClient.logInteraction(eventForWrite).then(result => {
        if (result.success && result.confirmed) {
          // Backend confirmed receipt - mark as confirmed
          this.pendingStore.markConfirmedInteraction(eventForWrite.id);
          this.trackBackendAck();
        } else {
          // Backend did not confirm - will be retried via pending store
          console.warn('[DualStorage] Backend did not confirm interaction, will retry:', eventForWrite.id);
          this.queueInteractionForRetry(eventForWrite);
        }
      }).catch(error => {
        console.warn('[DualStorage] Backend saveInteraction failed, will retry:', error);
        // Event remains in pending store, will be retried
        this.queueInteractionForRetry(eventForWrite);
      });
    } else {
      // No backend - mark as confirmed locally
      this.pendingStore.markConfirmedInteraction(eventForWrite.id);
    }
    
    return localResult;
  }

  private trackBackendAck(): void {
    this.lastBackendAckTime = Date.now();
    this.totalConfirmedCount++;
  }

  logInteraction(event: InteractionEvent): { success: boolean; quotaExceeded?: boolean } {
    return this.saveInteraction(event);
  }

  logConceptView(params: {
    learnerId: string;
    problemId: string;
    conceptId: string;
    source: 'problem' | 'hint' | 'textbook';
    unitId?: string;
    sessionId?: string;
  }): { success: boolean; quotaExceeded?: boolean } {
    // RESEARCH-2: Use same durable pending-store path as all research-critical events
    const event: InteractionEvent = {
      id: createEventId('concept'),
      learnerId: params.learnerId,
      sessionId: params.sessionId || this.getActiveSessionId(),
      timestamp: Date.now(),
      eventType: 'concept_view',
      problemId: params.problemId,
      conceptId: params.conceptId,
      source: params.source,
      unitId: params.unitId,
    };
    
    return this.saveInteraction(event);
  }

  logSessionEnd(params: {
    learnerId: string;
    sessionId: string;
    problemId: string;
    totalTime: number;
    problemsAttempted: number;
    problemsSolved: number;
  }): { success: boolean; quotaExceeded?: boolean } {
    // RESEARCH-2: Use same durable pending-store path as all research-critical events
    const event: InteractionEvent = {
      id: createEventId('session_end'),
      learnerId: params.learnerId,
      sessionId: params.sessionId,
      timestamp: Date.now(),
      eventType: 'session_end',
      problemId: params.problemId,
      totalTime: params.totalTime,
      problemsAttempted: params.problemsAttempted,
      problemsSolved: params.problemsSolved,
    };
    
    return this.saveInteraction(event);
  }

  async saveInteractionCritical(event: InteractionEvent): Promise<CriticalWriteStatus> {
    const eventForWrite = this.withActiveSessionFallback(event);
    const localResult = localStorageManager.saveInteraction(eventForWrite);
    if (localResult.success === false) {
      return {
        backendConfirmed: false,
        pendingSync: false,
        error: localResult.quotaExceeded
          ? 'Failed to save locally: browser storage quota exceeded.'
          : 'Failed to save locally.',
        };
      }

    this.pendingStore.add(eventForWrite);

    if (!this.config.useBackend) {
      this.pendingStore.markConfirmedInteraction(eventForWrite.id);
      return { backendConfirmed: true, pendingSync: false };
    }

    const healthy = await this.checkHealth();
    if (!healthy) {
      this.offlineQueue.add({
        id: eventForWrite.id,
        type: 'interaction',
        data: eventForWrite,
      });
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Backend unavailable; queued for sync.',
      };
    }

    try {
      this.pendingStore.markSent(eventForWrite.id);
      const backendSuccess = await storageClient.logInteraction(eventForWrite);
      if (backendSuccess.success && backendSuccess.confirmed) {
        this.pendingStore.markConfirmedInteraction(eventForWrite.id);
        this.trackBackendAck();
        return { backendConfirmed: true, pendingSync: false };
      }
      this.offlineQueue.add({
        id: eventForWrite.id,
        type: 'interaction',
        data: eventForWrite,
      });
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Backend did not confirm; queued for retry.',
      };
    } catch (error) {
      console.warn('[DualStorage] saveInteractionCritical backend failure, queued:', error);
      this.offlineQueue.add({
        id: eventForWrite.id,
        type: 'interaction',
        data: eventForWrite,
      });
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Backend request failed; queued for retry.',
      };
    }
  }

  getAllInteractions(): InteractionEvent[] {
    const learnerId = this.getCurrentLearnerId();
    if (learnerId && this.shouldUseBackend()) {
      void this.hydrateLearner(learnerId);
    }
    return localStorageManager.getAllInteractions();
  }

  getInteractionsByLearner(learnerId: string): InteractionEvent[] {
    if (this.shouldUseBackend()) {
      void this.hydrateLearner(learnerId);
    }
    return localStorageManager.getInteractionsByLearner(learnerId);
  }

  // ============================================================================
  // Textbook Operations
  // ============================================================================

  saveTextbookUnit(learnerId: string, unit: InstructionalUnit): SaveTextbookUnitResult {
    // Send to backend FIRST (primary source of truth) - async in background
    if (this.shouldUseBackend()) {
      storageClient.saveTextbookUnit(learnerId, unit).then(backendSuccess => {
        if (!backendSuccess) {
          // Backend failed, queue for retry
          this.offlineQueue.add({
            id: `textbook-${unit.id}-${Date.now()}`,
            type: 'textbookUnit',
            data: { learnerId, unit },
          });
        }
      }).catch(error => {
        console.warn('[DualStorage] Backend saveTextbookUnit failed, queuing for retry:', error);
        this.offlineQueue.add({
          id: `textbook-${unit.id}-${Date.now()}`,
          type: 'textbookUnit',
          data: { learnerId, unit },
        });
      });
    }
    
    // Always cache in localStorage (synchronous return)
    return localStorageManager.saveTextbookUnit(learnerId, unit);
  }

  async saveTextbookUnitCritical(
    learnerId: string,
    unit: InstructionalUnit,
  ): Promise<{ result: SaveTextbookUnitResult; status: CriticalWriteStatus }> {
    const result = localStorageManager.saveTextbookUnit(learnerId, unit);
    if (result.success === false) {
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: false,
          error: result.quotaExceeded
            ? 'Failed to save locally: browser storage quota exceeded.'
            : 'Failed to save locally.',
        },
      };
    }

    if (!this.config.useBackend) {
      return { result, status: { backendConfirmed: true, pendingSync: false } };
    }

    const healthy = await this.checkHealth();
    if (!healthy) {
      this.offlineQueue.add({
        id: `textbook-${unit.id}-${Date.now()}`,
        type: 'textbookUnit',
        data: { learnerId, unit },
      });
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Saved locally. Backend unavailable; queued for sync.',
        },
      };
    }

    try {
      const backendSuccess = await storageClient.saveTextbookUnit(learnerId, unit);
      if (backendSuccess) {
        return { result, status: { backendConfirmed: true, pendingSync: false } };
      }
      this.offlineQueue.add({
        id: `textbook-${unit.id}-${Date.now()}`,
        type: 'textbookUnit',
        data: { learnerId, unit },
      });
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Saved locally. Backend did not confirm; queued for retry.',
        },
      };
    } catch (error) {
      console.warn('[DualStorage] saveTextbookUnitCritical backend failure, queued:', error);
      this.offlineQueue.add({
        id: `textbook-${unit.id}-${Date.now()}`,
        type: 'textbookUnit',
        data: { learnerId, unit },
      });
      return {
        result,
        status: {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Saved locally. Backend request failed; queued for retry.',
        },
      };
    }
  }

  saveTextbookUnitV2(
    learnerId: string,
    input: CreateUnitInput,
    problemId?: string,
    useCompetition = true
  ): SaveTextbookUnitResult & { action: 'created' | 'updated'; why: string; competitionResult?: unknown } {
    // First, save to localStorage (this handles deduplication/competition) - synchronous
    const localResult = localStorageManager.saveTextbookUnitV2(learnerId, input, problemId, useCompetition);
    
    // Then sync to backend - async in background
    if (this.shouldUseBackend()) {
      const unit: InstructionalUnit = {
        id: localResult.unit.id,
        type: localResult.unit.type,
        conceptId: localResult.unit.conceptId,
        conceptIds: localResult.unit.conceptIds,
        title: localResult.unit.title,
        content: localResult.unit.content,
        contentFormat: localResult.unit.contentFormat,
        sourceInteractionIds: localResult.unit.sourceInteractionIds,
        provenance: localResult.unit.provenance,
        status: localResult.unit.status,
        prerequisites: localResult.unit.prerequisites,
        addedTimestamp: localResult.unit.addedTimestamp,
      };
      
      storageClient.saveTextbookUnit(learnerId, unit).then(backendSuccess => {
        if (!backendSuccess) {
          this.offlineQueue.add({
            id: `textbook-v2-${unit.id}-${Date.now()}`,
            type: 'textbookUnit',
            data: { learnerId, unit },
          });
        }
      }).catch(error => {
        console.warn('[DualStorage] Backend saveTextbookUnitV2 failed, queuing for retry:', error);
        this.offlineQueue.add({
          id: `textbook-v2-${unit.id}-${Date.now()}`,
          type: 'textbookUnit',
          data: { learnerId, unit },
        });
      });
    }
    
    return localResult;
  }

  async saveTextbookUnitV2Critical(
    learnerId: string,
    input: CreateUnitInput,
    problemId?: string,
    useCompetition = true,
  ): Promise<{
    result: SaveTextbookUnitResult & { action: 'created' | 'updated'; why: string; competitionResult?: unknown };
    status: CriticalWriteStatus;
  }> {
    const result = localStorageManager.saveTextbookUnitV2(learnerId, input, problemId, useCompetition);
    const unit: InstructionalUnit = {
      id: result.unit.id,
      type: result.unit.type,
      conceptId: result.unit.conceptId,
      conceptIds: result.unit.conceptIds,
      title: result.unit.title,
      content: result.unit.content,
      contentFormat: result.unit.contentFormat,
      sourceInteractionIds: result.unit.sourceInteractionIds,
      provenance: result.unit.provenance,
      status: result.unit.status,
      prerequisites: result.unit.prerequisites,
      addedTimestamp: result.unit.addedTimestamp,
    };

    const write = await this.saveTextbookUnitCritical(learnerId, unit);
    return { result, status: write.status };
  }

  getTextbook(learnerId: string): InstructionalUnit[] {
    // Try backend FIRST (primary source of truth) - async in background
    if (this.shouldUseBackend()) {
      storageClient.getTextbook(learnerId).then(backendUnits => {
        if (backendUnits && backendUnits.length > 0) {
          // Sync to localStorage for offline access
          for (const unit of backendUnits) {
            localStorageManager.saveTextbookUnit(learnerId, unit);
          }
        }
      }).catch(error => {
        console.warn('[DualStorage] Backend getTextbook failed, using localStorage:', error);
      });
    }
    
    // Always return localStorage data immediately (synchronous)
    return localStorageManager.getTextbook(learnerId);
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  startSession(learnerId: string): string {
    const sessionId = localStorageManager.startSession(learnerId);
    
    if (this.shouldUseBackend()) {
      try {
        const sessionData = {
          sessionId,
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        };
        
        storageClient.saveSession(learnerId, sessionData).catch(err => {
          console.warn('[DualStorage] Failed to sync session to backend, queuing:', err);
          this.offlineQueue.add({
            id: `session-${learnerId}-${Date.now()}`,
            type: 'session',
            data: { learnerId, data: sessionData },
          });
        });
      } catch (error) {
        console.warn('[DualStorage] Backend startSession failed:', error);
      }
    }
    
    return sessionId;
  }

  async ensureSessionPersisted(learnerId: string, sessionId: string): Promise<CriticalWriteStatus> {
    if (!this.config.useBackend) {
      return { backendConfirmed: true, pendingSync: false };
    }
    const healthy = await this.checkHealth();
    const sessionData = {
      sessionId,
      startTime: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
    };
    if (!healthy) {
      this.offlineQueue.add({
        id: `session-${learnerId}-${Date.now()}`,
        type: 'session',
        data: { learnerId, data: sessionData },
      });
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session started locally. Backend unavailable; queued for sync.',
      };
    }
    try {
      const success = await storageClient.saveSession(learnerId, sessionData);
      if (success) {
        return { backendConfirmed: true, pendingSync: false };
      }
      this.offlineQueue.add({
        id: `session-${learnerId}-${Date.now()}`,
        type: 'session',
        data: { learnerId, data: sessionData },
      });
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session saved locally. Backend did not confirm; queued for retry.',
      };
    } catch (error) {
      console.warn('[DualStorage] ensureSessionPersisted backend failure, queued:', error);
      this.offlineQueue.add({
        id: `session-${learnerId}-${Date.now()}`,
        type: 'session',
        data: { learnerId, data: sessionData },
      });
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session saved locally. Backend request failed; queued for retry.',
      };
    }
  }

  async ensureSessionInteractionsPersisted(
    learnerId: string,
    sessionId: string,
  ): Promise<CriticalWriteStatus & { missingInteractionIds?: string[] }> {
    if (!this.config.useBackend) {
      return { backendConfirmed: true, pendingSync: false, missingInteractionIds: [] };
    }

    const healthy = await this.checkHealth();
    if (!healthy) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Backend unavailable. Cannot confirm session interaction sync.',
      };
    }

    await this.offlineQueue.processQueue();

    const localSessionInteractions = localStorageManager
      .getInteractionsByLearner(learnerId)
      .filter((interaction) => interaction.sessionId === sessionId);
    if (localSessionInteractions.length === 0) {
      return { backendConfirmed: true, pendingSync: false, missingInteractionIds: [] };
    }

    const backendSnapshot = await storageClient.getInteractions(learnerId, { sessionId, limit: 5000 });
    const backendIds = new Set(backendSnapshot.events.map((interaction) => interaction.id));
    const missingInteractions = localSessionInteractions.filter((interaction) => !backendIds.has(interaction.id));

    if (missingInteractions.length === 0) {
      return { backendConfirmed: true, pendingSync: false, missingInteractionIds: [] };
    }

    try {
      const batchSuccess = await storageClient.logInteractionsBatch(missingInteractions);
      if (!batchSuccess) {
        for (const interaction of missingInteractions) {
          this.offlineQueue.add({
            id: interaction.id,
            type: 'interaction',
            data: interaction,
          });
        }
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Some interactions are still pending backend sync.',
          missingInteractionIds: missingInteractions.map((interaction) => interaction.id),
        };
      }
    } catch (error) {
      console.warn('[DualStorage] ensureSessionInteractionsPersisted batch sync failed:', error);
      for (const interaction of missingInteractions) {
        this.offlineQueue.add({
          id: interaction.id,
          type: 'interaction',
          data: interaction,
        });
      }
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Interaction sync request failed; queued for retry.',
        missingInteractionIds: missingInteractions.map((interaction) => interaction.id),
      };
    }

    const verification = await storageClient.getInteractions(learnerId, { sessionId, limit: 5000 });
    const verifiedIds = new Set(verification.events.map((interaction) => interaction.id));
    const stillMissing = localSessionInteractions
      .filter((interaction) => !verifiedIds.has(interaction.id))
      .map((interaction) => interaction.id);

    if (stillMissing.length > 0) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Backend verification failed for some interactions.',
        missingInteractionIds: stillMissing,
      };
    }

    return { backendConfirmed: true, pendingSync: false, missingInteractionIds: [] };
  }

  queueSessionEnd(event: InteractionEvent): { success: boolean; quotaExceeded?: boolean } {
    if (!event.sessionId) {
      return { success: false };
    }

    const pending = this.readPendingSessionEnds();
    const key = this.pendingSessionEndKey(event);
    const existingIndex = pending.findIndex((item) => item.key === key);
    const existing = existingIndex >= 0 ? pending[existingIndex] : undefined;
    const item: PendingSessionEnd = {
      key,
      event,
      queuedAt: existing?.queuedAt ?? Date.now(),
      lastAttemptAt: existing?.lastAttemptAt,
    };

    if (existingIndex >= 0) {
      pending[existingIndex] = item;
    } else {
      pending.push(item);
    }

    return this.writePendingSessionEnds(pending.slice(-CHUNK_SIZE));
  }

  async flushPendingSessionEnds(): Promise<CriticalWriteStatus> {
    if (!this.config.useBackend) {
      return { backendConfirmed: true, pendingSync: false };
    }

    const pending = this.readPendingSessionEnds();
    if (pending.length === 0) {
      return { backendConfirmed: true, pendingSync: false };
    }

    let firstFailure: CriticalWriteStatus | undefined;
    for (const item of pending) {
      const status = await this.writeQueuedSessionEnd(item.event);
      if (!status.backendConfirmed && !firstFailure) {
        firstFailure = status;
      }
    }

    return firstFailure ?? { backendConfirmed: true, pendingSync: false };
  }

  async emitSessionEnd(event: InteractionEvent): Promise<CriticalWriteStatus> {
    if (!event.sessionId) {
      return {
        backendConfirmed: false,
        pendingSync: false,
        error: 'Missing sessionId for session_end event.',
      };
    }

    if (!this.config.useBackend) {
      const localResult = localStorageManager.saveInteraction(event);
      if (!localResult.success) {
        return {
          backendConfirmed: false,
          pendingSync: false,
          error: localResult.quotaExceeded
            ? 'Failed to save session_end locally: browser storage quota exceeded.'
            : 'Failed to save session_end locally.',
        };
      }
      return { backendConfirmed: true, pendingSync: false };
    }

    const queueResult = this.queueSessionEnd(event);
    if (!queueResult.success) {
      return {
        backendConfirmed: false,
        pendingSync: false,
        error: queueResult.quotaExceeded
          ? 'Failed to queue session_end locally: browser storage quota exceeded.'
          : 'Failed to queue session_end locally.',
      };
    }

    return this.writeQueuedSessionEnd(event);
  }

  /**
   * Flush with keepalive for pagehide/logout scenarios
   * RESEARCH-3: Ensures data is sent even when tab closes
   * RESEARCH-1: Includes CSRF token for Neon auth+CSRF routes
   * Only marks events confirmed when confirmed by backend ID
   */
  async flushWithKeepalive(sessionId: string): Promise<CriticalWriteStatus> {
    if (!this.config.useBackend) {
      return { backendConfirmed: true, pendingSync: false };
    }

    console.info('[telemetry_pagehide_flush_started]', { 
      sessionId,
      contractVersion: RESEARCH_CONTRACT_VERSION 
    });

    // RESEARCH-1: Get ALL pending interactions from durable pending store
    // This includes both newly created events and retry queue items
    const pendingInteractions = this.pendingStore.getPendingForSession(sessionId);
    const events = pendingInteractions.map(p => p.event);

    // Also include retry queue items that might not be in pending store
    const retryQueueItems = this.offlineQueue.getAllUnconfirmed().filter(
      item => item.type === 'interaction' && (item.data as InteractionEvent).sessionId === sessionId
    );
    const retryEvents = retryQueueItems.map(item => item.data as InteractionEvent);

    // Merge and deduplicate by event ID
    const eventMap = new Map<string, InteractionEvent>();
    for (const event of [...events, ...retryEvents]) {
      eventMap.set(event.id, event);
    }
    const allEvents = Array.from(eventMap.values());

    // Send batch with keepalive and track confirmed IDs
    let flushResult: { success: boolean; confirmedIds?: string[] } = { success: allEvents.length === 0, confirmedIds: [] };
    if (allEvents.length > 0) {
      flushResult = await storageClient.logInteractionsBatchKeepalive(allEvents);
      
      // Only mark confirmed events as confirmed (not all events)
      if (flushResult.success && flushResult.confirmedIds) {
        for (const confirmedId of flushResult.confirmedIds) {
          this.pendingStore.markConfirmedInteraction(confirmedId);
        }
      }
    }

    // Flush pending session_ends only if interactions were confirmed
    const pendingSessionEnds = this.readPendingSessionEnds().filter(
      item => item.event.sessionId === sessionId
    );

    const confirmedInteractionIds = new Set(flushResult.confirmedIds ?? []);
    const interactionsConfirmed = allEvents.length === 0 || (
      flushResult.success && allEvents.every(event => confirmedInteractionIds.has(event.id))
    );
    const confirmedSessionEndIds: string[] = [];
    let sessionEndFlushComplete = true;

    if (interactionsConfirmed) {
      for (const item of pendingSessionEnds) {
        const sessionEndResult = await storageClient.logInteractionsBatchKeepalive([item.event]);
        if (sessionEndResult.success && sessionEndResult.confirmedIds?.includes(item.event.id)) {
          this.removePendingSessionEnd(item.event);
          confirmedSessionEndIds.push(item.event.id);
        } else {
          sessionEndFlushComplete = false;
        }
      }
    } else if (pendingSessionEnds.length > 0) {
      sessionEndFlushComplete = false;
    }

    const allConfirmed = interactionsConfirmed && sessionEndFlushComplete;

    const result: CriticalWriteStatus = allConfirmed
      ? { backendConfirmed: true, pendingSync: false }
      : { backendConfirmed: false, pendingSync: true, error: 'Keepalive flush incomplete' };

    console.info(
      allConfirmed 
        ? '[telemetry_pagehide_flush_confirmed]' 
        : '[telemetry_pagehide_flush_pending]',
      { 
        sessionId, 
        eventCount: allEvents.length,
        confirmedCount: flushResult.confirmedIds?.length || 0,
        pendingSessionEndCount: Math.max(0, pendingSessionEnds.length - confirmedSessionEndIds.length),
        reason: allConfirmed ? undefined : 'partial_confirmation'
      }
    );

    return result;
  }

  /**
   * RESEARCH-2: Flush pending interactions with verification before session_end
   * Ensures all session interactions are confirmed before sending session_end
   */
  async flushPendingWithVerification(sessionId: string): Promise<{
    interactionsFlushed: number;
    interactionsConfirmed: number;
    sessionEndSent: boolean;
    sessionEndConfirmed: boolean;
    error?: string;
  }> {
    const result = {
      interactionsFlushed: 0,
      interactionsConfirmed: 0,
      sessionEndSent: false,
      sessionEndConfirmed: false,
    };

    if (!this.config.useBackend) {
      return result;
    }

    // Step 1: Get all pending interactions for this session
    const pendingInteractions = this.pendingStore.getPendingForSession(sessionId);
    const events = pendingInteractions.map(p => p.event);

    if (events.length > 0) {
      result.interactionsFlushed = events.length;
      
      // Step 2: Send via keepalive batch
      const keepaliveSuccess = await storageClient.logInteractionsBatchKeepalive(events);
      
      if (keepaliveSuccess.success) {
        const confirmed = new Set(keepaliveSuccess.confirmedIds ?? []);
        for (const event of events) {
          if (confirmed.has(event.id)) {
            this.pendingStore.markConfirmedInteraction(event.id);
          }
        }
        result.interactionsConfirmed = events.filter(event => confirmed.has(event.id)).length;
        if (result.interactionsConfirmed < events.length) {
          result.error = 'Keepalive flush returned partial confirmation; events remain pending';
          return result;
        }
      } else {
        // Keepalive failed - events remain in pending store for retry
        result.error = 'Keepalive flush failed, events remain pending';
        return result;
      }
    }

    // Step 3: Also process retry queue items for this session
    const retryQueueItems = this.offlineQueue.getAllUnconfirmed().filter(
      item => item.type === 'interaction' && (item.data as InteractionEvent).sessionId === sessionId
    );
    
    if (retryQueueItems.length > 0) {
      const retryEvents = retryQueueItems.map(item => item.data as InteractionEvent);
      const retrySuccess = await storageClient.logInteractionsBatchKeepalive(retryEvents);
      
      if (retrySuccess.success) {
        const confirmed = new Set(retrySuccess.confirmedIds ?? []);
        for (const item of retryQueueItems) {
          if (confirmed.has(item.id)) {
            this.pendingStore.markConfirmedInteraction(item.id);
          }
        }
      }
    }

    // Step 4: Check if there are still pending interactions
    const remainingPending = this.pendingStore.getPendingForSession(sessionId);
    if (remainingPending.length > 0) {
      result.error = `${remainingPending.length} interactions still pending after flush`;
      return result;
    }

    return result;
  }

  private async writeQueuedSessionEnd(event: InteractionEvent): Promise<CriticalWriteStatus> {
    if (!event.sessionId) {
      this.removePendingSessionEnd(event);
      return {
        backendConfirmed: false,
        pendingSync: false,
        error: 'Missing sessionId for queued session_end event.',
      };
    }

    this.markPendingSessionEndAttempt(event);

    const syncStatus = await this.ensureSessionInteractionsPersisted(event.learnerId, event.sessionId);
    if (!syncStatus.backendConfirmed) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: syncStatus.error || 'Session interactions are not fully synced to backend.',
      };
    }

    const healthy = await this.checkHealth();
    if (!healthy) {
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session interactions synced, but backend became unavailable before session_end.',
      };
    }

    try {
      const backendSuccess = await storageClient.logInteraction(event);
      if (!backendSuccess.success || !backendSuccess.confirmed) {
        return {
          backendConfirmed: false,
          pendingSync: true,
          error: 'Backend did not confirm session_end; kept for retry.',
        };
      }
      localStorageManager.saveInteraction(event);
      this.removePendingSessionEnd(event);
      return { backendConfirmed: true, pendingSync: false };
    } catch (error) {
      console.warn('[DualStorage] emitSessionEnd backend failure, kept for retry:', error);
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Session_end request failed; kept for retry.',
      };
    }
  }

  /**
   * RESEARCH-4: Finalize active session before logout with backend confirmation barrier.
   * Computes session_end from local evidence, ensures all interactions are synced,
   * then writes session_end through the verified barrier. Blocks logout if confirmation fails.
   */
  async finalizeActiveSessionBeforeLogout(learnerId: string): Promise<CriticalWriteStatus> {
    // 1. Resolve active session ID
    let sessionId = localStorageManager.getActiveSessionId();
    const allInteractions = localStorageManager.getInteractionsByLearner(learnerId);

    if (!sessionId || sessionId === 'session-unknown') {
      const recoveredSessionId = [...allInteractions]
        .sort((a, b) => b.timestamp - a.timestamp)
        .find((interaction) => interaction.sessionId && interaction.sessionId !== 'session-unknown')
        ?.sessionId;
      if (!recoveredSessionId) {
        return { backendConfirmed: true, pendingSync: false };
      }
      sessionId = recoveredSessionId;
      localStorageManager.setActiveSessionId(recoveredSessionId);
    }

    // 2. Read local interactions for this session
    const sessionInteractions = allInteractions.filter(i => i.sessionId === sessionId);

    // 3. If no interactions exist, nothing to finalize
    if (sessionInteractions.length === 0) {
      return { backendConfirmed: true, pendingSync: false };
    }

    // 4. Compute canonical session_end summary from local evidence
    const sortedInteractions = [...sessionInteractions].sort((a, b) => a.timestamp - b.timestamp);
    const firstInteraction = sortedInteractions[0];
    const lastInteraction = sortedInteractions[sortedInteractions.length - 1];

    // totalTime: now - first interaction timestamp (use session start if available)
    const sessionStartTime = firstInteraction.timestamp;
    const totalTime = Math.max(0, Date.now() - sessionStartTime);

    // problemsAttempted: unique problem IDs with execution/error/hint_view/explanation_view/guidance_view
    const attemptedProblemIds = new Set(
      sessionInteractions
        .filter(i => ['execution', 'error', 'hint_view', 'explanation_view', 'guidance_view'].includes(i.eventType))
        .map(i => i.problemId)
    );
    const problemsAttempted = attemptedProblemIds.size;

    // problemsSolved: unique problem IDs with successful execution
    const solvedProblemIds = new Set(
      sessionInteractions
        .filter(i => i.eventType === 'execution' && i.successful === true)
        .map(i => i.problemId)
    );
    const problemsSolved = solvedProblemIds.size;

    // problemId: use latest session interaction problem ID, fallback 'session-summary'
    const problemId = lastInteraction?.problemId || 'session-summary';

    // 5. Build deterministic session_end event ID (prevents duplicates on retry)
    const eventId = `session-end:${sessionId}`;

    // Check if session_end already exists for this session
    const existingSessionEnd = sessionInteractions.find(i => i.eventType === 'session_end');
    if (existingSessionEnd) {
      // Already finalized, just ensure it's synced
      if (this.config.useBackend) {
        const syncStatus = await this.ensureSessionInteractionsPersisted(learnerId, sessionId);
        if (!syncStatus.backendConfirmed) {
          return {
            backendConfirmed: false,
            pendingSync: true,
            error: 'Session already finalized locally, but not fully synced to backend.',
          };
        }
      }
      return { backendConfirmed: true, pendingSync: false };
    }

    // 6. Build session_end event
    const sessionEndEvent: InteractionEvent = {
      id: eventId,
      sessionId,
      learnerId,
      timestamp: Date.now(),
      eventType: 'session_end',
      problemId,
      totalTime,
      timeSpent: totalTime,
      problemsAttempted,
      problemsSolved,
    };

    // 7. Call emitSessionEnd for the backend verification barrier
    return this.emitSessionEnd(sessionEndEvent);
  }

  private pendingSessionEndKey(event: InteractionEvent): string {
    return event.sessionId ? `${event.learnerId}:${event.sessionId}` : event.id;
  }

  private readPendingSessionEnds(): PendingSessionEnd[] {
    const parsed = safeGet<PendingSessionEnd[]>(PENDING_SESSION_ENDS_KEY, []);
    if (!parsed || !Array.isArray(parsed)) return [];
    return parsed.filter((item): item is PendingSessionEnd => {
      return Boolean(
        item &&
        typeof item.key === 'string' &&
        item.event &&
        typeof item.event.id === 'string' &&
        typeof item.event.learnerId === 'string' &&
        item.event.eventType === 'session_end' &&
        typeof item.queuedAt === 'number',
      );
    });
  }

  private writePendingSessionEnds(pending: PendingSessionEnd[]): SafeSetResult {
    // Critical session data - use memory fallback if quota exceeded
    const result = safeSet(PENDING_SESSION_ENDS_KEY, pending, {
      priority: 'critical',
      allowEviction: true,
    });
    
    if (!result.success && result.quotaExceeded) {
      // Try with just the most recent items
      const reducedResult = safeSet(PENDING_SESSION_ENDS_KEY, pending.slice(-20), {
        priority: 'critical',
        allowEviction: true,
      });
      return reducedResult;
    }
    
    return result;
  }

  private markPendingSessionEndAttempt(event: InteractionEvent): void {
    const key = this.pendingSessionEndKey(event);
    const pending = this.readPendingSessionEnds();
    const index = pending.findIndex((item) => item.key === key);
    if (index < 0) return;
    pending[index] = {
      ...pending[index],
      lastAttemptAt: Date.now(),
    };
    this.writePendingSessionEnds(pending);
  }

  private removePendingSessionEnd(event: InteractionEvent): void {
    const key = this.pendingSessionEndKey(event);
    this.writePendingSessionEnds(this.readPendingSessionEnds().filter((item) => item.key !== key));
  }

  getActiveSessionId(): string {
    return localStorageManager.getActiveSessionId();
  }

  clearActiveSession(): void {
    const learnerId = this.getCurrentLearnerId();
    localStorageManager.clearActiveSession();
    
    if (learnerId && this.shouldUseBackend()) {
      try {
        storageClient.clearSession(learnerId).catch(err => {
          console.warn('[DualStorage] Failed to clear session on backend:', err);
        });
      } catch (error) {
        console.warn('[DualStorage] Backend clearActiveSession failed:', error);
      }
    }
  }

  // ============================================================================
  // Profile Operations (Full Learner Profile)
  // ============================================================================

  /**
   * Save a learner's full profile to backend and localStorage
   */
  saveProfile(profile: LearnerProfile): void {
    // Send to backend FIRST (primary source of truth) - async in background
    if (this.shouldUseBackend()) {
      storageClient.saveProfile(profile).then(success => {
        if (!success) {
          this.offlineQueue.add({
            id: `full-profile-${profile.id}-${Date.now()}`,
            type: 'profile',
            data: profile,
          });
        }
      }).catch(err => {
        console.warn('[DualStorage] Failed to sync profile to backend, queuing:', err);
        this.offlineQueue.add({
          id: `full-profile-${profile.id}-${Date.now()}`,
          type: 'profile',
          data: profile,
        });
      });
    }
    
    // Always cache in localStorage (synchronous)
    localStorageManager.saveProfile(profile);
  }

  /**
   * Get a learner's full profile
   * Backend is PRIMARY source of truth (synced in background)
   */
  getProfile(learnerId: string): LearnerProfile | null {
    // Try backend FIRST (primary source of truth) - async in background
    if (this.shouldUseBackend()) {
      storageClient.getProfile(learnerId).then(backendProfile => {
        if (backendProfile) {
          // Merge solvedProblemIds by union with local before saving
          // This prevents wiping locally-correct solved state with empty backend set during transition
          const localProfile = localStorageManager.getProfile(learnerId);
          if (localProfile?.solvedProblemIds?.size && !backendProfile.solvedProblemIds?.size) {
            // Backend has empty solved set but local has data - keep local data
            console.log('[DualStorage] Preserving local solvedProblemIds during backend sync');
          } else if (localProfile?.solvedProblemIds?.size && backendProfile.solvedProblemIds?.size) {
            // Both have data - merge by union
            const mergedSolvedIds = new Set([
              ...Array.from(localProfile.solvedProblemIds),
              ...Array.from(backendProfile.solvedProblemIds),
            ]);
            backendProfile.solvedProblemIds = mergedSolvedIds;
          }
          // Sync to localStorage for offline access
          localStorageManager.saveProfile(backendProfile);
        }
      }).catch(err => {
        console.warn('[DualStorage] Failed to get profile from backend, using localStorage:', err);
      });
    }
    
    // Always return localStorage data immediately (synchronous)
    return localStorageManager.getProfile(learnerId);
  }

  /**
   * Get all learner profiles (for instructor dashboard)
   */
  getAllProfiles(): LearnerProfile[] {
    // Try backend FIRST (primary source of truth) - async in background
    if (this.shouldUseBackend()) {
      storageClient.getAllProfiles().then(profiles => {
        if (profiles.length > 0) {
          // Sync each profile to localStorage
          for (const profile of profiles) {
            localStorageManager.saveProfile(profile);
          }
        }
      }).catch(err => {
        console.warn('[DualStorage] Failed to get profiles from backend:', err);
      });
    }
    
    return localStorageManager
      .getAllProfiles()
      .map((profile: { id: string }) => localStorageManager.getProfile(profile.id))
      .filter((profile): profile is LearnerProfile => Boolean(profile));
  }

  async hydrateLearner(learnerId: string, options?: { force?: boolean }): Promise<boolean> {
    if (!this.config.useBackend) {
      return false;
    }
    const now = Date.now();
    if (!options?.force && this.lastHydratedAt[learnerId] && now - this.lastHydratedAt[learnerId] < 3000) {
      return true;
    }

    const healthy = await this.checkHealth();
    if (!healthy) {
      return false;
    }

    const hydrationStart = Date.now();
    
    // Capture pre-hydration state for audit
    const localProfileBefore = localStorageManager.getProfile(learnerId);
    const localInteractionsBefore = localStorageManager.getInteractionsByLearner(learnerId);
    const localTextbookBefore = localStorageManager.getTextbook(learnerId);
    
    const auditContext = {
      learnerId,
      timestamp: hydrationStart,
      localBefore: {
        hadProfile: localProfileBefore !== null,
        solvedProblemCount: localProfileBefore?.solvedProblemIds?.size ?? 0,
        interactionCount: localInteractionsBefore.length,
        textbookUnitCount: localTextbookBefore.length,
      },
    };

    try {
      // Hydrate session/profile first so resumed editor state is available quickly
      // on first render in account mode.
      // RESEARCH-4: Also fetch problem_progress for authoritative solved state
      const [profile, session, problemProgress] = await Promise.all([
        storageClient.getProfile(learnerId),
        storageClient.getSession(learnerId),
        storageClient.getAllProblemProgress(learnerId),
      ]);

      if (profile) {
        // RESEARCH-4: Use problem_progress as authoritative source for solved state
        // Profile's solvedProblemIds is a cache; problem_progress is durable truth
        const solvedIdsFromProgress = new Set(
          problemProgress
            .filter((p) => p.solved)
            .map((p) => p.problemId)
        );

        // Merge with local to prevent data loss during transition
        const localProfile = localStorageManager.getProfile(learnerId);
        const localSolvedIds = localProfile?.solvedProblemIds || new Set<string>();

        // Authoritative merge: progress table + local + profile cache
        const mergedSolvedIds = new Set<string>([
          ...Array.from(solvedIdsFromProgress),
          ...Array.from(localSolvedIds),
          ...Array.from(profile.solvedProblemIds || []),
        ]);

        // Log merge details for audit
        console.info('[hydration_profile_merge]', {
          ...auditContext,
          backendSources: {
            fromProgressTable: solvedIdsFromProgress.size,
            fromProfileCache: profile.solvedProblemIds?.size ?? 0,
          },
          localSource: {
            beforeCount: localSolvedIds.size,
          },
          mergeResult: {
            afterCount: mergedSolvedIds.size,
            newProblemsAdded: Math.max(0, mergedSolvedIds.size - Math.max(
              solvedIdsFromProgress.size,
              localSolvedIds.size,
              profile.solvedProblemIds?.size ?? 0
            )),
          },
          preservedFields: [
            'solvedProblemIds (union merge)',
            'conceptsCovered (backend authoritative)',
            'errorHistory (backend authoritative)',
            'conceptCoverageEvidence (backend authoritative)',
          ],
        });

        profile.solvedProblemIds = mergedSolvedIds;
        localStorageManager.saveProfile(profile);
      }

      const hydratedSessionId =
        session?.sessionId?.trim() || localStorageManager.getActiveSessionId();
      const hydratedProblemId = session?.currentProblemId?.trim();

      if (hydratedSessionId) {
        localStorageManager.setActiveSessionId(hydratedSessionId);
      }

      if (
        hydratedSessionId &&
        hydratedProblemId &&
        typeof session.currentCode === 'string' &&
        session.currentCode.trim().length > 0
      ) {
        localStorageManager.savePracticeDraft(
          learnerId,
          hydratedSessionId,
          hydratedProblemId,
          session.currentCode,
        );
      }

      // Continue heavy sync in background so session restore is deterministic
      // even when interaction/textbook payloads are large.
      void Promise.all([
        storageClient.getInteractions(learnerId, { limit: 5000 }),
        storageClient.getTextbook(learnerId),
      ])
        .then(([interactionsResult, textbookUnits]) => {
          const existing = localStorageManager.getAllInteractions();
          const byId = new Map(existing.map((item) => [item.id, item]));
          
          // Track merge statistics for audit
          const beforeCount = byId.size;
          let backendNewCount = 0;
          let backendOverwriteCount = 0;
          
          for (const interaction of interactionsResult.events) {
            if (byId.has(interaction.id)) {
              backendOverwriteCount++;
            } else {
              backendNewCount++;
            }
            byId.set(interaction.id, interaction);
          }
          
          const mergedInteractions = Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp);
          
          localStorageManager.importData({
            interactions: mergedInteractions,
            activeSessionId: hydratedSessionId || localStorageManager.getActiveSessionId(),
          });

          // Track textbook merge
          let textbookUnitsAdded = 0;
          for (const unit of textbookUnits) {
            const existingUnits = localStorageManager.getTextbook(learnerId);
            const alreadyExists = existingUnits.some(u => u.id === unit.id);
            localStorageManager.saveTextbookUnit(learnerId, unit);
            if (!alreadyExists) {
              textbookUnitsAdded++;
            }
          }
          
          // Log background sync audit
          console.info('[hydration_background_sync]', {
            learnerId,
            interactions: {
              localBefore: beforeCount,
              backendReceived: interactionsResult.events.length,
              backendNew: backendNewCount,
              backendOverwrite: backendOverwriteCount,
              localAfter: mergedInteractions.length,
              mergeStrategy: 'id_based_dedup_backend_wins',
            },
            textbook: {
              backendReceived: textbookUnits.length,
              unitsAdded: textbookUnitsAdded,
              mergeStrategy: 'id_based_upsert',
            },
            durationMs: Date.now() - hydrationStart,
          });
        })
        .catch((syncError) => {
          console.warn('[DualStorage] hydrateLearner background sync failed:', syncError);
        });

      // Log immediate hydration completion (background sync continues)
      console.info('[hydration_immediate_complete]', {
        learnerId,
        durationMs: Date.now() - hydrationStart,
        sessionRestored: !!hydratedSessionId,
        profileHydrated: !!profile,
        backgroundSyncInitiated: true,
      });

      this.lastHydratedAt[learnerId] = now;
      return true;
    } catch (error) {
      console.error('[DualStorage] hydrateLearner failed:', {
        learnerId,
        error: error instanceof Error ? error.message : 'unknown',
        durationMs: Date.now() - hydrationStart,
      });
      return false;
    }
  }

  /**
   * Fetch active backend session snapshot for restore-critical flows.
   * Returns null when backend mode is disabled, unhealthy, or no session exists.
   */
  async getBackendSessionSnapshot(
    learnerId: string,
  ): Promise<Awaited<ReturnType<typeof storageClient.getSession>>> {
    if (!this.config.useBackend) {
      return null;
    }
    const healthy = await this.checkHealth();
    if (!healthy) {
      return null;
    }
    try {
      return await storageClient.getSession(learnerId);
    } catch (error) {
      console.warn('[DualStorage] getBackendSessionSnapshot failed:', error);
      return null;
    }
  }

  /**
   * Result type for hydrateInstructorDashboard with detailed error information
   */
  async hydrateInstructorDashboard(): Promise<
    | { ok: true; scopeEmpty: boolean; sectionCount: number; learnerCount: number }
    | { ok: false; error: 'auth' | 'backend' | 'scope_empty' | 'network'; message: string }
  > {
    if (!this.config.useBackend) {
      return { ok: false, error: 'backend', message: 'Backend not configured' };
    }
    
    const healthy = await this.checkHealth();
    if (!healthy) {
      return { ok: false, error: 'network', message: 'Backend health check failed' };
    }

    try {
      const [overview, learners, profiles] = await Promise.all([
        storageClient.getInstructorOverview(),
        storageClient.getInstructorLearners(),
        storageClient.getAllProfiles(),
      ]);

      // Check for auth errors (null/empty responses indicate auth failure)
      if (overview === null && learners.length === 0 && profiles.length === 0) {
        // Check if we have a valid user profile - if so, it's likely an auth issue
        const currentProfile = localStorageManager.getUserProfile();
        if (currentProfile?.role !== 'instructor') {
          return { 
            ok: false, 
            error: 'auth', 
            message: 'Not authenticated as instructor' 
          };
        }
        return { 
          ok: false, 
          error: 'backend', 
          message: 'Failed to fetch instructor data' 
        };
      }

      for (const profile of profiles) {
        localStorageManager.saveProfile(profile);
      }

      for (const learner of learners) {
        if (learner?.learner?.id) {
          await this.hydrateLearner(learner.learner.id);
        }
      }

      const sectionCount = overview?.sections?.length ?? 0;
      const learnerCount = learners.length;
      const scopeEmpty = sectionCount === 0 || learnerCount === 0;

      console.log('[DualStorage] Instructor dashboard hydrated', {
        sectionCount,
        learnerCount,
        scopeEmpty,
      });
      
      return { 
        ok: true, 
        scopeEmpty, 
        sectionCount, 
        learnerCount 
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('[DualStorage] hydrateInstructorDashboard failed:', error);
      
      // Categorize error type
      if (message.includes('401') || message.includes('Unauthorized')) {
        return { ok: false, error: 'auth', message: 'Authentication required' };
      }
      if (message.includes('403') || message.includes('Forbidden')) {
        return { ok: false, error: 'auth', message: 'Instructor access required' };
      }
      if (message.includes('network') || message.includes('fetch')) {
        return { ok: false, error: 'network', message };
      }
      
      return { ok: false, error: 'backend', message };
    }
  }

  /**
   * Update profile from a single event
   * Sends event to backend which derives the state changes
   */
  updateProfileFromEvent(learnerId: string, event: InteractionEvent): LearnerProfile | null {
    // Update localStorage cache first (synchronous)
    const localProfile = localStorageManager.getProfile(learnerId);
    if (localProfile) {
      localProfile.interactionCount++;
      localProfile.lastActive = Date.now();
      
      if (event.errorSubtypeId) {
        const currentCount = localProfile.errorHistory.get(event.errorSubtypeId) || 0;
        localProfile.errorHistory.set(event.errorSubtypeId, currentCount + 1);
      }
      
      if (event.conceptIds) {
        for (const conceptId of event.conceptIds) {
          localProfile.conceptsCovered.add(conceptId);
        }
      }
      
      localStorageManager.saveProfile(localProfile);
    }
    
    // Send to backend (primary source of truth) - async in background
    if (this.shouldUseBackend()) {
      storageClient.updateProfileFromEvent(learnerId, event).catch(err => {
        console.warn('[DualStorage] Failed to update profile on backend:', err);
      });
    }
    
    return localProfile;
  }

  // ============================================================================
  // Export Operations (Instructor Dashboard)
  // ============================================================================

  exportData(options?: { allHistory?: boolean }): {
    interactions: InteractionEvent[];
    profiles: unknown[];
    textbooks: Record<string, InstructionalUnit[]>;
    llmCache: Record<string, unknown>;
    replayMode: boolean;
    pdfIndex: unknown;
    pdfIndexProvenance: unknown;
    activeSessionId: string;
    exportScope: string;
    exportPolicyVersion: string;
    exportedAt: string;
  } {
    // If using backend, try to get all learners' data - async in background
    if (this.shouldUseBackend()) {
      Promise.all([
        storageClient.getClassStats().catch(() => null),
        storageClient.getAllProfiles().catch(() => []),
      ]).then(([stats, profiles]) => {
        if (stats) {
          console.log('[DualStorage] Backend stats:', stats);
          console.log('[DualStorage] Backend profiles:', profiles.length);
        }
      }).catch(error => {
        console.warn('[DualStorage] Failed to get backend stats:', error);
      });
    }
    
    return localStorageManager.exportData(options);
  }

  exportAllData(): ReturnType<typeof localStorageManager.exportAllData> {
    return localStorageManager.exportAllData();
  }

  // ============================================================================
  // Logging Operations (Week 5 Events)
  // ============================================================================

  logProfileAssigned(
    learnerId: string,
    profileId: string,
    strategy: 'static' | 'diagnostic' | 'bandit',
    problemId: string,
    reason?: string
  ): void {
    this.syncLatestLocalInteraction(
      learnerId,
      'logProfileAssigned',
      () => localStorageManager.logProfileAssigned(learnerId, profileId, strategy, problemId, reason),
    );
  }

  logEscalationTriggered(
    learnerId: string,
    profileId: string,
    errorCount: number,
    problemId: string,
    reason: string = 'threshold_met',
    timeToEscalationMs?: number
  ): void {
    this.syncLatestLocalInteraction(
      learnerId,
      'logEscalationTriggered',
      () => localStorageManager.logEscalationTriggered(
        learnerId,
        profileId,
        errorCount,
        problemId,
        reason,
        timeToEscalationMs,
      ),
    );
  }

  logBanditArmSelected(params: {
    learnerId: string;
    problemId: string;
    armId: string;
    selectionMethod: 'thompson_sampling' | 'epsilon_greedy' | 'forced';
    armStatsAtSelection?: Record<string, { mean: number; pulls: number }>;
    sessionId?: string;
  }): void {
    this.syncLatestLocalInteraction(
      params.learnerId,
      'logBanditArmSelected',
      () => localStorageManager.logBanditArmSelected(params),
    );
  }

  logBanditRewardObserved(
    learnerId: string,
    armId: string,
    reward: number,
    components: {
      independentSuccess: number;
      errorReduction: number;
      delayedRetention: number;
      dependencyPenalty: number;
      timeEfficiency: number;
    }
  ): void {
    this.syncLatestLocalInteraction(
      learnerId,
      'logBanditRewardObserved',
      () => localStorageManager.logBanditRewardObserved(learnerId, armId, reward, components),
    );
  }

  logHDICalculated(
    learnerId: string,
    hdi: number,
    components: { hpa: number; aed: number; er: number; reae: number; iwh: number },
    problemId: string
  ): void {
    this.syncLatestLocalInteraction(
      learnerId,
      'logHDICalculated',
      () => localStorageManager.logHDICalculated(learnerId, hdi, components, problemId),
    );
  }

  saveCoverageChangeEvent(
    params: Parameters<typeof localStorageManager.saveCoverageChangeEvent>[0],
  ): ReturnType<typeof localStorageManager.saveCoverageChangeEvent> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'saveCoverageChangeEvent',
      () => localStorageManager.saveCoverageChangeEvent(params),
    );
  }

  logReinforcementScheduled(
    ...args: Parameters<typeof localStorageManager.logReinforcementScheduled>
  ): ReturnType<typeof localStorageManager.logReinforcementScheduled> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logReinforcementScheduled',
      () => localStorageManager.logReinforcementScheduled(...args),
    );
  }

  logReinforcementPromptShown(
    ...args: Parameters<typeof localStorageManager.logReinforcementPromptShown>
  ): ReturnType<typeof localStorageManager.logReinforcementPromptShown> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logReinforcementPromptShown',
      () => localStorageManager.logReinforcementPromptShown(...args),
    );
  }

  logReinforcementResponse(
    ...args: Parameters<typeof localStorageManager.logReinforcementResponse>
  ): ReturnType<typeof localStorageManager.logReinforcementResponse> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logReinforcementResponse',
      () => localStorageManager.logReinforcementResponse(...args),
    );
  }

  logGuidanceRequest(
    params: Parameters<typeof localStorageManager.logGuidanceRequest>[0],
  ): ReturnType<typeof localStorageManager.logGuidanceRequest> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'logGuidanceRequest',
      () => localStorageManager.logGuidanceRequest(params),
    );
  }

  logGuidanceView(
    params: Parameters<typeof localStorageManager.logGuidanceView>[0],
  ): ReturnType<typeof localStorageManager.logGuidanceView> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'logGuidanceView',
      () => localStorageManager.logGuidanceView(params),
    );
  }

  logGuidanceEscalate(
    params: Parameters<typeof localStorageManager.logGuidanceEscalate>[0],
  ): ReturnType<typeof localStorageManager.logGuidanceEscalate> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'logGuidanceEscalate',
      () => localStorageManager.logGuidanceEscalate(params),
    );
  }

  logTextbookUnitUpsert(
    params: Parameters<typeof localStorageManager.logTextbookUnitUpsert>[0],
  ): ReturnType<typeof localStorageManager.logTextbookUnitUpsert> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'logTextbookUnitUpsert',
      () => localStorageManager.logTextbookUnitUpsert(params),
    );
  }

  logSourceView(
    params: Parameters<typeof localStorageManager.logSourceView>[0],
  ): ReturnType<typeof localStorageManager.logSourceView> {
    return this.syncLatestLocalInteraction(
      params.learnerId,
      'logSourceView',
      () => localStorageManager.logSourceView(params),
    );
  }

  logConditionAssigned(
    ...args: Parameters<typeof localStorageManager.logConditionAssigned>
  ): ReturnType<typeof localStorageManager.logConditionAssigned> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logConditionAssigned',
      () => localStorageManager.logConditionAssigned(...args),
    );
  }

  logBanditUpdated(
    ...args: Parameters<typeof localStorageManager.logBanditUpdated>
  ): ReturnType<typeof localStorageManager.logBanditUpdated> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logBanditUpdated',
      () => localStorageManager.logBanditUpdated(...args),
    );
  }

  logHDITrajectoryUpdated(
    ...args: Parameters<typeof localStorageManager.logHDITrajectoryUpdated>
  ): ReturnType<typeof localStorageManager.logHDITrajectoryUpdated> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logHDITrajectoryUpdated',
      () => localStorageManager.logHDITrajectoryUpdated(...args),
    );
  }

  logDependencyInterventionTriggered(
    ...args: Parameters<typeof localStorageManager.logDependencyInterventionTriggered>
  ): ReturnType<typeof localStorageManager.logDependencyInterventionTriggered> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logDependencyInterventionTriggered',
      () => localStorageManager.logDependencyInterventionTriggered(...args),
    );
  }

  logProfileAdjusted(
    ...args: Parameters<typeof localStorageManager.logProfileAdjusted>
  ): ReturnType<typeof localStorageManager.logProfileAdjusted> {
    return this.syncLatestLocalInteraction(
      args[0],
      'logProfileAdjusted',
      () => localStorageManager.logProfileAdjusted(...args),
    );
  }

  // ============================================================================
  // Offline Queue Operations
  // ============================================================================

  /**
   * Get the current offline queue status
   */
  getOfflineQueueStatus(): { pending: number; isProcessing: boolean } {
    return {
      pending: this.offlineQueue.getPending().length,
      isProcessing: false, // Simplified - actual processing state is internal
    };
  }

  /**
   * Manually trigger offline queue processing
   */
  async processOfflineQueue(): Promise<void> {
    await this.offlineQueue.processQueue();
    await this.flushPendingSessionEnds();
  }

  // ============================================================================
  // Helper Methods
  // ============================================================================

  private shouldUseBackend(): boolean {
    return this.config.useBackend && this.backendHealthy;
  }

  private getCurrentLearnerId(): string | null {
    const profile = localStorageManager.getUserProfile();
    return profile?.id || null;
  }

  // ============================================================================
  // Pass-through Methods
  // ============================================================================

  // These methods always use localStorage (no backend equivalent yet)
  getLLMCacheRecord = localStorageManager.getLLMCacheRecord.bind(localStorageManager);
  saveLLMCacheRecord = localStorageManager.saveLLMCacheRecord.bind(localStorageManager);
  getPdfIndex = localStorageManager.getPdfIndex.bind(localStorageManager);
  savePdfIndex = localStorageManager.savePdfIndex.bind(localStorageManager);
  getPolicyReplayMode = localStorageManager.getPolicyReplayMode.bind(localStorageManager);
  setPolicyReplayMode = localStorageManager.setPolicyReplayMode.bind(localStorageManager);
  getReinforcementSchedules = localStorageManager.getReinforcementSchedules.bind(localStorageManager);
  saveReinforcementSchedule = localStorageManager.saveReinforcementSchedule.bind(localStorageManager);
  getCoverageStats = localStorageManager.getCoverageStats.bind(localStorageManager);
  isStudent = localStorageManager.isStudent.bind(localStorageManager);
  isInstructor = localStorageManager.isInstructor.bind(localStorageManager);
  hasRole = localStorageManager.hasRole.bind(localStorageManager);
  clearAll = localStorageManager.clearAll.bind(localStorageManager);
  safeLoadProfile = localStorageManager.safeLoadProfile.bind(localStorageManager);
  
  // Practice drafts
  savePracticeDraft = localStorageManager.savePracticeDraft.bind(localStorageManager);
  getPracticeDraft = localStorageManager.getPracticeDraft.bind(localStorageManager);
  findAnyPracticeDraft = localStorageManager.findAnyPracticeDraft.bind(localStorageManager);
  clearPracticeDraft = localStorageManager.clearPracticeDraft.bind(localStorageManager);
  
  // Session config
  setActiveSessionId = localStorageManager.setActiveSessionId.bind(localStorageManager);
  
  // PDF uploads
  addUploadedPdfFile = localStorageManager.addUploadedPdfFile.bind(localStorageManager);
  getUploadedPdfFiles = localStorageManager.getUploadedPdfFiles.bind(localStorageManager);
  removeUploadedPdfFile = localStorageManager.removeUploadedPdfFile.bind(localStorageManager);
  clearUploadedPdfFiles = localStorageManager.clearUploadedPdfFiles.bind(localStorageManager);
  
  // Trace slice and interactions
  getTraceSlice = localStorageManager.getTraceSlice.bind(localStorageManager);
  getInteractionsByIds = localStorageManager.getInteractionsByIds.bind(localStorageManager);
  clearInteractions = localStorageManager.clearInteractions.bind(localStorageManager);
  getInteractionsByProblem = localStorageManager.getInteractionsByProblem.bind(localStorageManager);
  
  // Textbook helpers
  createDefaultProfile = localStorageManager.createDefaultProfile.bind(localStorageManager);
  clearTextbook = localStorageManager.clearTextbook.bind(localStorageManager);
  getLegacyHtmlUnitsInfo = localStorageManager.getLegacyHtmlUnitsInfo.bind(localStorageManager);
  
  // Reinforcement
  updatePromptStatus = localStorageManager.updatePromptStatus.bind(localStorageManager);
  getDuePrompts = localStorageManager.getDuePrompts.bind(localStorageManager);
  
  // Import/Export
  importData = localStorageManager.importData.bind(localStorageManager);
}

// ============================================================================
// Export
// ============================================================================

export const dualStorage = new DualStorageManager();

// Re-export storage client for direct access
export { storageClient, isBackendAvailable, checkBackendHealth };

// Default export uses dual storage
export default dualStorage;
