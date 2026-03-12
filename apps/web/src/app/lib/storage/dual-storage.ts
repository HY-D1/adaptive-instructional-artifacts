/**
 * Dual-Mode Storage Adapter
 * Switches between localStorage and backend API based on configuration
 * Falls back to localStorage on backend errors
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

interface StorageConfig {
  useBackend: boolean;
  fallbackToLocal: boolean;
}

// ============================================================================
// Dual Storage Manager
// ============================================================================

class DualStorageManager {
  private config: StorageConfig;
  private backendHealthy: boolean = false;

  constructor() {
    this.config = {
      useBackend: USE_BACKEND,
      fallbackToLocal: true,
    };
    
    // Check backend health on init
    if (this.config.useBackend) {
      this.checkHealth();
    }
  }

  /**
   * Get current storage mode
   */
  getMode(): 'local' | 'backend' {
    return this.config.useBackend && this.backendHealthy ? 'backend' : 'local';
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
    if (this.shouldUseBackend()) {
      try {
        const success = await storageClient.createLearner(profile);
        if (success) return { success: true };
        if (this.config.fallbackToLocal) {
          console.warn('[DualStorage] Backend saveUserProfile failed, falling back to localStorage');
        }
      } catch (error) {
        console.warn('[DualStorage] Backend error, falling back to localStorage:', error);
      }
    }
    return localStorageManager.saveUserProfile(profile);
  }

  async getUserProfile(): Promise<UserProfile | null> {
    if (this.shouldUseBackend()) {
      try {
        // Get from local first for speed, sync with backend
        const local = localStorageManager.getUserProfile();
        if (local) {
          // Async sync to backend
          storageClient.getLearner(local.id).then(backend => {
            if (!backend) {
              // Learner doesn't exist on backend, create it
              storageClient.createLearner(local);
            }
          });
          return local;
        }
      } catch (error) {
        console.warn('[DualStorage] Backend error, using localStorage:', error);
      }
    }
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
    // Always save to localStorage first (primary source of truth)
    const localResult = localStorageManager.saveInteraction(event);
    
    if (this.shouldUseBackend()) {
      try {
        // Async sync to backend - don't wait
        storageClient.logInteraction(event).catch(err => {
          console.warn('[DualStorage] Failed to sync interaction to backend:', err);
        });
      } catch (error) {
        // Silent fail for backend - localStorage is source of truth
      }
    }
    
    return localResult;
  }

  getAllInteractions(): InteractionEvent[] {
    return localStorageManager.getAllInteractions();
  }

  getInteractionsByLearner(learnerId: string): InteractionEvent[] {
    return localStorageManager.getInteractionsByLearner(learnerId);
  }

  // ============================================================================
  // Textbook Operations
  // ============================================================================

  async saveTextbookUnit(learnerId: string, unit: InstructionalUnit): Promise<SaveTextbookUnitResult> {
    const localResult = localStorageManager.saveTextbookUnit(learnerId, unit);
    
    if (this.shouldUseBackend()) {
      try {
        storageClient.saveTextbookUnit(learnerId, unit).catch(err => {
          console.warn('[DualStorage] Failed to sync textbook unit to backend:', err);
        });
      } catch (error) {
        // Silent fail
      }
    }
    
    return localResult;
  }

  async saveTextbookUnitV2(
    learnerId: string,
    input: CreateUnitInput,
    problemId?: string,
    useCompetition = true
  ): Promise<SaveTextbookUnitResult & { action: 'created' | 'updated'; why: string; competitionResult?: unknown }> {
    const localResult = localStorageManager.saveTextbookUnitV2(learnerId, input, problemId, useCompetition);
    
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
        storageClient.saveTextbookUnit(learnerId, unit).catch(err => {
          console.warn('[DualStorage] Failed to sync textbook unit V2 to backend:', err);
        });
      } catch (error) {
        // Silent fail
      }
    }
    
    return localResult;
  }

  getTextbook(learnerId: string): InstructionalUnit[] {
    return localStorageManager.getTextbook(learnerId);
  }

  // ============================================================================
  // Session Operations
  // ============================================================================

  startSession(learnerId: string): string {
    const sessionId = localStorageManager.startSession(learnerId);
    
    if (this.shouldUseBackend()) {
      try {
        storageClient.saveSession(learnerId, {
          startTime: new Date().toISOString(),
          lastActivity: new Date().toISOString(),
        }).catch(err => {
          console.warn('[DualStorage] Failed to sync session to backend:', err);
        });
      } catch (error) {
        // Silent fail
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
        // Silent fail
      }
    }
  }

  // ============================================================================
  // Profile Operations
  // ============================================================================

  saveProfile(profile: LearnerProfile): void {
    localStorageManager.saveProfile(profile);
    
    // Sync to backend
    if (this.shouldUseBackend()) {
      // Backend doesn't have full profile support yet
    }
  }

  getProfile(learnerId: string): LearnerProfile | null {
    return localStorageManager.getProfile(learnerId);
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
        const stats = await storageClient.getClassStats();
        if (stats) {
          console.log('[DualStorage] Backend stats:', stats);
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
}

// ============================================================================
// Export
// ============================================================================

export const dualStorage = new DualStorageManager();

// Re-export storage client for direct access
export { storageClient, isBackendAvailable, checkBackendHealth };

// Default export uses dual storage
export default dualStorage;
