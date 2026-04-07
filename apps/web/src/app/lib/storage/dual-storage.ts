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
  storageClient,
  isBackendAvailable,
  checkBackendHealth,
} from '../api/storage-client';
import { clearAllUiState, clearUiStateForActor } from '../ui-state';
import type {
  UserProfile,
  InteractionEvent,
  InstructionalUnit,
  LearnerProfile,
  SaveTextbookUnitResult,
} from '@/app/types';
import type { CreateUnitInput } from './textbook-units';

// Configuration
// VITE_API_BASE_URL is the canonical env var — presence alone enables backend mode
const USE_BACKEND = !!import.meta.env.VITE_API_BASE_URL;

// Offline queue configuration
const OFFLINE_QUEUE_KEY = 'sql-adapt-offline-queue';
const PENDING_SESSION_ENDS_KEY = 'sql-adapt-pending-session-ends';
const MAX_QUEUE_SIZE = 100;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

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

// ============================================================================
// Offline Queue Manager
// ============================================================================

class OfflineQueueManager {
  private queue: QueuedItem[] = [];
  private isProcessing = false;

  constructor() {
    this.loadQueue();
    // Start background processing
    this.startBackgroundProcessing();
  }

  private loadQueue(): void {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) {
        this.queue = JSON.parse(raw);
      }
    } catch {
      this.queue = [];
    }
  }

  private saveQueue(): void {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
    } catch {
      // If we can't save queue, trim it aggressively
      this.queue = this.queue.slice(-20);
      try {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.queue));
      } catch {
        // Last resort: clear queue
        this.queue = [];
      }
    }
  }

  add(item: Omit<QueuedItem, 'retries' | 'timestamp'>): void {
    const queueItem: QueuedItem = {
      ...item,
      retries: 0,
      timestamp: Date.now(),
    };
    
    this.queue.push(queueItem);
    
    // Trim queue if too large (keep newest)
    if (this.queue.length > MAX_QUEUE_SIZE) {
      this.queue = this.queue.slice(-MAX_QUEUE_SIZE);
    }
    
    this.saveQueue();
  }

  remove(id: string): void {
    this.queue = this.queue.filter(item => item.id !== id);
    this.saveQueue();
  }

  getPending(): QueuedItem[] {
    return [...this.queue];
  }

  incrementRetry(id: string): void {
    const item = this.queue.find(i => i.id === id);
    if (item) {
      item.retries++;
      if (item.retries >= MAX_RETRIES) {
        // Move to dead letter queue or log
        console.warn('[OfflineQueue] Item exceeded max retries:', id);
        this.remove(id);
      } else {
        this.saveQueue();
      }
    }
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
    
    for (const item of pending) {
      try {
        let success = false;
        
        switch (item.type) {
          case 'interaction':
            success = await storageClient.logInteraction(item.data as InteractionEvent);
            break;
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
        this.incrementRetry(item.id);
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
  private lastHydratedAt: Record<string, number> = {};

  constructor() {
    this.config = {
      useBackend: USE_BACKEND,
      fallbackToLocal: true,
    };
    
    this.offlineQueue = new OfflineQueueManager();
    
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

  saveInteraction(event: InteractionEvent): { success: boolean; quotaExceeded?: boolean } {
    // Send to backend FIRST (primary source of truth) - async in background
    if (this.shouldUseBackend()) {
      storageClient.logInteraction(event).then(backendSuccess => {
        if (!backendSuccess) {
          // Backend failed, queue for retry
          this.offlineQueue.add({
            id: event.id,
            type: 'interaction',
            data: event,
          });
        }
      }).catch(error => {
        console.warn('[DualStorage] Backend saveInteraction failed, queuing for retry:', error);
        this.offlineQueue.add({
          id: event.id,
          type: 'interaction',
          data: event,
        });
      });
    }
    
    // Always cache in localStorage (synchronous return)
    return localStorageManager.saveInteraction(event);
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
    const resolvedSessionId = params.sessionId || localStorageManager.getActiveSessionId();
    const beforeCount = localStorageManager.getInteractionsByLearner(params.learnerId).length;
    const result = localStorageManager.logConceptView(params);
    if (!result.success) {
      return result;
    }

    const interactions = localStorageManager.getInteractionsByLearner(params.learnerId);
    if (interactions.length <= beforeCount) {
      return result;
    }

    const createdEvent = [...interactions]
      .reverse()
      .find((interaction) => {
        if (interaction.eventType !== 'concept_view') return false;
        if (interaction.problemId !== params.problemId) return false;
        if ((interaction.sessionId || '') !== (resolvedSessionId || '')) return false;
        const interactionConceptId = interaction.conceptId || interaction.conceptIds?.[0];
        return interactionConceptId === params.conceptId && interaction.source === params.source;
      });

    if (!createdEvent || !this.shouldUseBackend()) {
      return result;
    }

    storageClient.logInteraction(createdEvent).catch((error) => {
      console.warn('[DualStorage] Backend logConceptView failed, queuing for retry:', error);
      this.offlineQueue.add({
        id: createdEvent.id,
        type: 'interaction',
        data: createdEvent,
      });
    });

    return result;
  }

  logSessionEnd(params: {
    learnerId: string;
    sessionId: string;
    problemId: string;
    totalTime: number;
    problemsAttempted: number;
    problemsSolved: number;
  }): { success: boolean; quotaExceeded?: boolean } {
    const result = localStorageManager.logSessionEnd(params);
    if (!result.success) {
      return result;
    }
    const interactions = localStorageManager
      .getInteractionsByLearner(params.learnerId)
      .filter((interaction) => interaction.sessionId === params.sessionId && interaction.eventType === 'session_end');
    const sessionEndEvent = interactions[interactions.length - 1];
    if (sessionEndEvent && this.shouldUseBackend()) {
      storageClient.logInteraction(sessionEndEvent).catch((error) => {
        console.warn('[DualStorage] Backend logSessionEnd failed, queuing for retry:', error);
        this.offlineQueue.add({
          id: sessionEndEvent.id,
          type: 'interaction',
          data: sessionEndEvent,
        });
      });
    }
    return result;
  }

  async saveInteractionCritical(event: InteractionEvent): Promise<CriticalWriteStatus> {
    const localResult = localStorageManager.saveInteraction(event);
    if (localResult.success === false) {
      return {
        backendConfirmed: false,
        pendingSync: false,
        error: localResult.quotaExceeded
          ? 'Failed to save locally: browser storage quota exceeded.'
          : 'Failed to save locally.',
      };
    }

    if (!this.config.useBackend) {
      return { backendConfirmed: true, pendingSync: false };
    }

    const healthy = await this.checkHealth();
    if (!healthy) {
      this.offlineQueue.add({
        id: event.id,
        type: 'interaction',
        data: event,
      });
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Backend unavailable; queued for sync.',
      };
    }

    try {
      const backendSuccess = await storageClient.logInteraction(event);
      if (backendSuccess) {
        return { backendConfirmed: true, pendingSync: false };
      }
      this.offlineQueue.add({
        id: event.id,
        type: 'interaction',
        data: event,
      });
      return {
        backendConfirmed: false,
        pendingSync: true,
        error: 'Saved locally. Backend did not confirm; queued for retry.',
      };
    } catch (error) {
      console.warn('[DualStorage] saveInteractionCritical backend failure, queued:', error);
      this.offlineQueue.add({
        id: event.id,
        type: 'interaction',
        data: event,
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

    return this.writePendingSessionEnds(pending.slice(-MAX_QUEUE_SIZE));
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
      if (!backendSuccess) {
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
    const sessionId = localStorageManager.getActiveSessionId();
    if (!sessionId || sessionId === 'session-unknown') {
      return { backendConfirmed: true, pendingSync: false };
    }

    // 2. Read local interactions for this session
    const allInteractions = localStorageManager.getInteractionsByLearner(learnerId);
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
    try {
      const raw = localStorage.getItem(PENDING_SESSION_ENDS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
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
    } catch {
      return [];
    }
  }

  private writePendingSessionEnds(pending: PendingSessionEnd[]): { success: boolean; quotaExceeded?: boolean } {
    try {
      localStorage.setItem(PENDING_SESSION_ENDS_KEY, JSON.stringify(pending));
      return { success: true };
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        try {
          localStorage.setItem(PENDING_SESSION_ENDS_KEY, JSON.stringify(pending.slice(-20)));
          return { success: true };
        } catch {
          return { success: false, quotaExceeded: true };
        }
      }
      return { success: false };
    }
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

    try {
      // Hydrate session/profile first so resumed editor state is available quickly
      // on first render in account mode.
      const [profile, session] = await Promise.all([
        storageClient.getProfile(learnerId),
        storageClient.getSession(learnerId),
      ]);

      if (profile) {
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
          for (const interaction of interactionsResult.events) {
            byId.set(interaction.id, interaction);
          }
          localStorageManager.importData({
            interactions: Array.from(byId.values()).sort((a, b) => a.timestamp - b.timestamp),
            activeSessionId: hydratedSessionId || localStorageManager.getActiveSessionId(),
          });

          for (const unit of textbookUnits) {
            localStorageManager.saveTextbookUnit(learnerId, unit);
          }
        })
        .catch((syncError) => {
          console.warn('[DualStorage] hydrateLearner background sync failed:', syncError);
        });

      this.lastHydratedAt[learnerId] = now;
      return true;
    } catch (error) {
      console.warn('[DualStorage] hydrateLearner failed:', error);
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

  async hydrateInstructorDashboard(): Promise<boolean> {
    if (!this.config.useBackend) {
      return false;
    }
    const healthy = await this.checkHealth();
    if (!healthy) {
      return false;
    }

    try {
      const [overview, learners, profiles] = await Promise.all([
        storageClient.getInstructorOverview(),
        storageClient.getInstructorLearners(),
        storageClient.getAllProfiles(),
      ]);

      for (const profile of profiles) {
        localStorageManager.saveProfile(profile);
      }

      for (const learner of learners) {
        if (learner?.learner?.id) {
          await this.hydrateLearner(learner.learner.id);
        }
      }

      console.log('[DualStorage] Instructor dashboard hydrated', {
        sectionCount: overview?.sections?.length ?? 0,
        learnerCount: learners.length,
      });
      return true;
    } catch (error) {
      console.warn('[DualStorage] hydrateInstructorDashboard failed:', error);
      return false;
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
    localStorageManager.logProfileAssigned(learnerId, profileId, strategy, problemId, reason);
  }

  logEscalationTriggered(
    learnerId: string,
    profileId: string,
    errorCount: number,
    problemId: string,
    reason: string = 'threshold_met',
    timeToEscalationMs?: number
  ): void {
    localStorageManager.logEscalationTriggered(learnerId, profileId, errorCount, problemId, reason, timeToEscalationMs);
  }

  logBanditArmSelected(params: {
    learnerId: string;
    problemId: string;
    armId: string;
    selectionMethod: 'thompson_sampling' | 'epsilon_greedy' | 'forced';
    armStatsAtSelection?: Record<string, { mean: number; pulls: number }>;
    sessionId?: string;
  }): void {
    localStorageManager.logBanditArmSelected(params);
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
    localStorageManager.logBanditRewardObserved(learnerId, armId, reward, components);
  }

  logHDICalculated(
    learnerId: string,
    hdi: number,
    components: { hpa: number; aed: number; er: number; reae: number; iwh: number },
    problemId: string
  ): void {
    localStorageManager.logHDICalculated(learnerId, hdi, components, problemId);
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
  saveCoverageChangeEvent = localStorageManager.saveCoverageChangeEvent.bind(localStorageManager);
  
  // Textbook helpers
  createDefaultProfile = localStorageManager.createDefaultProfile.bind(localStorageManager);
  clearTextbook = localStorageManager.clearTextbook.bind(localStorageManager);
  getLegacyHtmlUnitsInfo = localStorageManager.getLegacyHtmlUnitsInfo.bind(localStorageManager);
  
  // Reinforcement
  updatePromptStatus = localStorageManager.updatePromptStatus.bind(localStorageManager);
  getDuePrompts = localStorageManager.getDuePrompts.bind(localStorageManager);
  logReinforcementScheduled = localStorageManager.logReinforcementScheduled.bind(localStorageManager);
  logReinforcementPromptShown = localStorageManager.logReinforcementPromptShown.bind(localStorageManager);
  logReinforcementResponse = localStorageManager.logReinforcementResponse.bind(localStorageManager);
  
  // Guidance ladder
  logGuidanceRequest = localStorageManager.logGuidanceRequest.bind(localStorageManager);
  logGuidanceView = localStorageManager.logGuidanceView.bind(localStorageManager);
  logGuidanceEscalate = localStorageManager.logGuidanceEscalate.bind(localStorageManager);
  logTextbookUnitUpsert = localStorageManager.logTextbookUnitUpsert.bind(localStorageManager);
  logSourceView = localStorageManager.logSourceView.bind(localStorageManager);
  
  // Bandit
  logBanditUpdated = localStorageManager.logBanditUpdated.bind(localStorageManager);
  
  // HDI
  logHDITrajectoryUpdated = localStorageManager.logHDITrajectoryUpdated.bind(localStorageManager);
  logDependencyInterventionTriggered = localStorageManager.logDependencyInterventionTriggered.bind(localStorageManager);
  
  // Profile adjustment
  logProfileAdjusted = localStorageManager.logProfileAdjusted.bind(localStorageManager);
  
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
