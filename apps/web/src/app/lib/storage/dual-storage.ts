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
import type {
  UserProfile,
  InteractionEvent,
  InstructionalUnit,
  LearnerProfile,
  SaveTextbookUnitResult,
  CreateUnitInput,
} from '@/app/types';

// Configuration
const USE_BACKEND = import.meta.env.VITE_USE_BACKEND === 'true' || !!import.meta.env.VITE_API_URL;

// Offline queue configuration
const OFFLINE_QUEUE_KEY = 'sql-adapt-offline-queue';
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

  constructor() {
    this.config = {
      useBackend: USE_BACKEND,
      fallbackToLocal: true,
    };
    
    this.offlineQueue = new OfflineQueueManager();
    
    // Check backend health on init
    if (this.config.useBackend) {
      this.checkHealth();
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

  async saveUserProfile(profile: UserProfile): Promise<{ success: boolean; quotaExceeded?: boolean }> {
    // Always save to localStorage as cache
    const localResult = localStorageManager.saveUserProfile(profile);
    
    if (this.shouldUseBackend()) {
      try {
        const success = await storageClient.createLearner(profile);
        if (success) return { success: true };
        
        // Backend failed, add to offline queue
        this.offlineQueue.add({
          id: `profile-${profile.id}-${Date.now()}`,
          type: 'profile',
          data: profile,
        });
        
        // Still return success since we saved locally
        return { success: localResult.success, quotaExceeded: localResult.quotaExceeded };
      } catch (error) {
        console.warn('[DualStorage] Backend saveUserProfile failed, queued for retry:', error);
        this.offlineQueue.add({
          id: `profile-${profile.id}-${Date.now()}`,
          type: 'profile',
          data: profile,
        });
      }
    }
    
    return localResult;
  }

  async getUserProfile(): Promise<UserProfile | null> {
    // Try backend FIRST (primary source of truth)
    if (this.shouldUseBackend()) {
      try {
        // Get local ID first to know what to fetch
        const localProfile = localStorageManager.getUserProfile();
        const learnerId = localProfile?.id;
        
        if (learnerId) {
          const backendProfile = await storageClient.getLearner(learnerId);
          if (backendProfile) {
            // Sync to localStorage for offline access
            localStorageManager.saveUserProfile(backendProfile);
            return backendProfile;
          }
        }
      } catch (error) {
        console.warn('[DualStorage] Backend getUserProfile failed, using localStorage:', error);
      }
    }
    
    // Fall back to localStorage
    return localStorageManager.getUserProfile();
  }

  clearUserProfile(): boolean {
    // Always clear both
    if (this.config.useBackend) {
      // Backend doesn't support delete yet, just clear local
    }
    return localStorageManager.clearUserProfile();
  }

  // ============================================================================
  // Interaction/Event Operations
  // ============================================================================

  async saveInteraction(event: InteractionEvent): Promise<{ success: boolean; quotaExceeded?: boolean }> {
    // Send to backend FIRST (primary source of truth)
    if (this.shouldUseBackend()) {
      try {
        const backendSuccess = await storageClient.logInteraction(event);
        if (!backendSuccess) {
          // Backend failed, queue for retry
          this.offlineQueue.add({
            id: event.id,
            type: 'interaction',
            data: event,
          });
        }
      } catch (error) {
        console.warn('[DualStorage] Backend saveInteraction failed, queuing for retry:', error);
        this.offlineQueue.add({
          id: event.id,
          type: 'interaction',
          data: event,
        });
      }
    }
    
    // Always cache in localStorage
    return localStorageManager.saveInteraction(event);
  }

  getAllInteractions(): InteractionEvent[] {
    // localStorage is the cache for interactions
    return localStorageManager.getAllInteractions();
  }

  getInteractionsByLearner(learnerId: string): InteractionEvent[] {
    return localStorageManager.getInteractionsByLearner(learnerId);
  }

  // ============================================================================
  // Textbook Operations
  // ============================================================================

  async saveTextbookUnit(learnerId: string, unit: InstructionalUnit): Promise<SaveTextbookUnitResult> {
    // Send to backend FIRST (primary source of truth)
    if (this.shouldUseBackend()) {
      try {
        const backendSuccess = await storageClient.saveTextbookUnit(learnerId, unit);
        if (!backendSuccess) {
          // Backend failed, queue for retry
          this.offlineQueue.add({
            id: `textbook-${unit.id}-${Date.now()}`,
            type: 'textbookUnit',
            data: { learnerId, unit },
          });
        }
      } catch (error) {
        console.warn('[DualStorage] Backend saveTextbookUnit failed, queuing for retry:', error);
        this.offlineQueue.add({
          id: `textbook-${unit.id}-${Date.now()}`,
          type: 'textbookUnit',
          data: { learnerId, unit },
        });
      }
    }
    
    // Always cache in localStorage
    return localStorageManager.saveTextbookUnit(learnerId, unit);
  }

  async saveTextbookUnitV2(
    learnerId: string,
    input: CreateUnitInput,
    problemId?: string,
    useCompetition = true
  ): Promise<SaveTextbookUnitResult & { action: 'created' | 'updated'; why: string; competitionResult?: unknown }> {
    // First, save to localStorage (this handles deduplication/competition)
    const localResult = localStorageManager.saveTextbookUnitV2(learnerId, input, problemId, useCompetition);
    
    // Then sync to backend
    if (this.shouldUseBackend()) {
      try {
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
        };
        
        const backendSuccess = await storageClient.saveTextbookUnit(learnerId, unit);
        if (!backendSuccess) {
          this.offlineQueue.add({
            id: `textbook-v2-${unit.id}-${Date.now()}`,
            type: 'textbookUnit',
            data: { learnerId, unit },
          });
        }
      } catch (error) {
        console.warn('[DualStorage] Backend saveTextbookUnitV2 failed, queuing for retry:', error);
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
        };
        this.offlineQueue.add({
          id: `textbook-v2-${unit.id}-${Date.now()}`,
          type: 'textbookUnit',
          data: { learnerId, unit },
        });
      }
    }
    
    return localResult;
  }

  async getTextbook(learnerId: string): Promise<InstructionalUnit[]> {
    // Try backend FIRST (primary source of truth)
    if (this.shouldUseBackend()) {
      try {
        const backendUnits = await storageClient.getTextbook(learnerId);
        if (backendUnits && backendUnits.length > 0) {
          // Sync to localStorage for offline access
          // Note: We don't have a bulk save, so we'd need to merge carefully
          // For now, just return backend data
          return backendUnits;
        }
      } catch (error) {
        console.warn('[DualStorage] Backend getTextbook failed, using localStorage:', error);
      }
    }
    
    // Fall back to localStorage
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
  async saveProfile(profile: LearnerProfile): Promise<void> {
    // Send to backend FIRST (primary source of truth)
    if (this.shouldUseBackend()) {
      try {
        const success = await storageClient.saveProfile(profile);
        if (!success) {
          this.offlineQueue.add({
            id: `full-profile-${profile.id}-${Date.now()}`,
            type: 'profile',
            data: profile,
          });
        }
      } catch (err) {
        console.warn('[DualStorage] Failed to sync profile to backend, queuing:', err);
        this.offlineQueue.add({
          id: `full-profile-${profile.id}-${Date.now()}`,
          type: 'profile',
          data: profile,
        });
      }
    }
    
    // Always cache in localStorage
    localStorageManager.saveProfile(profile);
  }

  /**
   * Get a learner's full profile
   * Backend is PRIMARY source of truth
   */
  async getProfile(learnerId: string): Promise<LearnerProfile | null> {
    // Try backend FIRST (primary source of truth)
    if (this.shouldUseBackend()) {
      try {
        const backendProfile = await storageClient.getProfile(learnerId);
        if (backendProfile) {
          // Sync to localStorage for offline access
          localStorageManager.saveProfile(backendProfile);
          return backendProfile;
        }
      } catch (err) {
        console.warn('[DualStorage] Failed to get profile from backend, using localStorage:', err);
      }
    }
    
    // Fall back to localStorage
    return localStorageManager.getProfile(learnerId);
  }

  /**
   * Get all learner profiles (for instructor dashboard)
   */
  async getAllProfiles(): Promise<LearnerProfile[]> {
    // Try backend FIRST (primary source of truth)
    if (this.shouldUseBackend()) {
      try {
        const profiles = await storageClient.getAllProfiles();
        if (profiles.length > 0) {
          // Sync each profile to localStorage
          for (const profile of profiles) {
            localStorageManager.saveProfile(profile);
          }
          return profiles;
        }
      } catch (err) {
        console.warn('[DualStorage] Failed to get profiles from backend:', err);
      }
    }
    
    // Fall back to localStorage - only has current user's profile
    return [];
  }

  /**
   * Update profile from a single event
   * Sends event to backend which derives the state changes
   */
  async updateProfileFromEvent(learnerId: string, event: InteractionEvent): Promise<LearnerProfile | null> {
    // Update localStorage cache first
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
    
    // Send to backend (primary source of truth)
    if (this.shouldUseBackend()) {
      try {
        return await storageClient.updateProfileFromEvent(learnerId, event);
      } catch (err) {
        console.warn('[DualStorage] Failed to update profile on backend:', err);
      }
    }
    
    return localProfile;
  }

  // ============================================================================
  // Export Operations (Instructor Dashboard)
  // ============================================================================

  async exportData(options?: { allHistory?: boolean }): Promise<{
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
  }> {
    // If using backend, try to get all learners' data
    if (this.shouldUseBackend()) {
      try {
        const [stats, profiles] = await Promise.all([
          storageClient.getClassStats(),
          storageClient.getAllProfiles().catch(() => []),
        ]);
        
        if (stats) {
          console.log('[DualStorage] Backend stats:', stats);
          console.log('[DualStorage] Backend profiles:', profiles.length);
        }
      } catch (error) {
        console.warn('[DualStorage] Failed to get backend stats:', error);
      }
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

  logEscalationTriggered(learnerId: string, profileId: string, errorCount: number, problemId: string): void {
    localStorageManager.logEscalationTriggered(learnerId, profileId, errorCount, problemId);
  }

  logBanditArmSelected(learnerId: string, armId: string, selectionMethod: 'thompson_sampling' | 'epsilon_greedy' | 'forced'): void {
    localStorageManager.logBanditArmSelected(learnerId, armId, selectionMethod);
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
}

// ============================================================================
// Export
// ============================================================================

export const dualStorage = new DualStorageManager();

// Re-export storage client for direct access
export { storageClient, isBackendAvailable, checkBackendHealth };

// Default export uses dual storage
export default dualStorage;
