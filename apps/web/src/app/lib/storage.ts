import {
  InteractionEvent,
  LearnerProfile,
  InstructionalUnit,
  SaveTextbookUnitResult,
  LLMCacheRecord,
  PdfIndexDocument,
  PdfIndexChunk,
  PdfIndexProvenance,
  PdfSourceDoc,
  PdfCitation,
  UnitProvenance,
  ConceptCoverageEvidence,
  GuidanceRequestType,
  RungLevel,
  GuidanceEscalationTrigger,
  TextbookUnitAction,
  UserProfile,
  UserRole
} from '../types';
import {
  canonicalizeSqlEngageSubtype,
  getConceptIdsForSqlEngageSubtype,
  getDeterministicSqlEngageAnchor,
  getSqlEngagePolicyVersion
} from '../data/sql-engage';
import {
  PDF_CHUNKER_VERSION,
  PDF_EMBEDDING_MODEL_ID,
  PDF_INDEX_SCHEMA_VERSION
} from './pdf-index-config';
import {
  upsertTextbookUnit,
  buildNewUnit,
  findExistingUnit,
  generateDedupeKey,
  competeAndSelectBestUnit,
  filterUnitsByStatus,
  type CreateUnitInput
} from './textbook-units';

/**
 * StorageManager - Local storage manager for interaction traces and learner state
 * 
 * Features:
 * - User profile management (Week 4)
 * - Interaction event storage
 * - Learner profile persistence with optimistic locking
 * - Textbook unit storage with deduplication
 * - LLM cache management
 * - PDF index storage with memory fallback
 * - Guidance ladder event logging
 * 
 * All methods handle quota exceeded errors gracefully.
 */
class StorageManager {
  private readonly EXPORT_POLICY_VERSION = 'weekly-export-sanitize-v1';
  private readonly INTERACTIONS_KEY = 'sql-learning-interactions';
  /** Key for learner profiles (maps learnerId -> LearnerProfile) - tracks learning progress per learner */
  private readonly PROFILES_KEY = 'sql-learning-profiles';
  private readonly TEXTBOOK_KEY = 'sql-learning-textbook';
  private readonly ACTIVE_SESSION_KEY = 'sql-learning-active-session';
  private readonly PRACTICE_DRAFTS_KEY = 'sql-learning-practice-drafts';
  private readonly LLM_CACHE_KEY = 'sql-learning-llm-cache';
  private readonly REPLAY_MODE_KEY = 'sql-learning-policy-replay-mode';
  private readonly PDF_INDEX_KEY = 'sql-learning-pdf-index';
  /** Key for current user identity (single active user profile) - used for role-based auth (Week 4) */
  private readonly USER_PROFILE_KEY = 'sql-adapt-user-profile'; // Week 4: Aligned with existing app key

  // In-memory fallback for PDF index when LocalStorage quota is exceeded
  private pdfIndexMemory: PdfIndexDocument | null = null;

  /**
   * Save user profile to localStorage
   * @param profile - User profile to save
   * @returns Object with success flag and optional quota exceeded flag
   * 
   * SECURITY: Profile data is validated before storage (see validateProfile).
   * Name is limited to 1-100 characters. React escapes rendered content by default.
   */
  saveUserProfile(profile: UserProfile): { success: boolean; quotaExceeded?: boolean } {
    try {
      // Validate before saving to ensure data integrity
      const validation = this.validateProfile(profile);
      if (!validation) {
        console.warn('[Storage] Invalid profile data rejected');
        return { success: false };
      }
      
      const serializable = {
        ...validation,
        createdAt: typeof validation.createdAt === 'number' ? validation.createdAt : Date.now()
      };
      const result = this.safeSetItem(this.USER_PROFILE_KEY, JSON.stringify(serializable));
      if (!result.success) {
        console.warn('[Storage] Failed to save user profile:', result.quotaExceeded ? 'quota exceeded' : 'unknown error');
      }
      return result;
    } catch (error) {
      console.error('[Storage] Exception saving user profile:', error);
      return { success: false };
    }
  }

  /**
   * Validates a partial user profile object
   * @param parsed - Partial profile to validate
   * @returns Validated UserProfile or null if invalid
   */
  private validateProfile(parsed: Partial<UserProfile>): UserProfile | null {
    // Validate required fields
    if (typeof parsed.id !== 'string' || !parsed.id.trim()) {
      return null;
    }
    // Validate name: must be a non-empty string between 1-100 characters
    if (typeof parsed.name !== 'string') {
      return null;
    }
    const trimmedName = parsed.name.trim();
    if (trimmedName.length < 1 || trimmedName.length > 100) {
      return null;
    }
    if (parsed.role !== 'student' && parsed.role !== 'instructor') {
      return null;
    }
    if (typeof parsed.createdAt !== 'number' || !Number.isFinite(parsed.createdAt)) {
      return null;
    }

    return {
      id: parsed.id.trim(),
      name: trimmedName,
      role: parsed.role,
      createdAt: parsed.createdAt
    };
  }

  /**
   * Get user profile from localStorage
   * @returns User profile or null if not found/invalid
   */
  getUserProfile(): UserProfile | null {
    try {
      const raw = localStorage.getItem(this.USER_PROFILE_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as Partial<UserProfile>;
      const validated = this.validateProfile(parsed);
      
      if (!validated) {
        // Corrupted profile data - clean up
        try {
          localStorage.removeItem(this.USER_PROFILE_KEY);
        } catch {
          // Ignore cleanup errors
        }
      }
      
      return validated;
    } catch {
      // Corrupted profile data or localStorage access denied
      try {
        localStorage.removeItem(this.USER_PROFILE_KEY);
      } catch {
        // Ignore cleanup errors
      }
      return null;
    }
  }

  /**
   * Clear user profile from localStorage
   * @returns True if successful
   */
  clearUserProfile(): boolean {
    try {
      localStorage.removeItem(this.USER_PROFILE_KEY);
      return true;
    } catch (error) {
      console.error('[Storage] Exception clearing user profile:', error);
      return false;
    }
  }

  /**
   * Safely load user profile with error handling and cleanup
   * This is a shared utility used by hooks to safely load profiles
   * @returns Object with profile (or null) and success flag
   */
  safeLoadProfile(): { profile: UserProfile | null; success: boolean; error?: Error } {
    try {
      const raw = localStorage.getItem(this.USER_PROFILE_KEY);
      if (!raw) {
        return { profile: null, success: true };
      }

      const parsed = JSON.parse(raw) as Partial<UserProfile>;
      const validated = this.validateProfile(parsed);
      
      if (!validated) {
        // Invalid profile - clean up
        try {
          localStorage.removeItem(this.USER_PROFILE_KEY);
        } catch {
          // Ignore cleanup errors
        }
        return { profile: null, success: false, error: new Error('Invalid profile data') };
      }
      
      return { profile: validated, success: true };
    } catch (error) {
      // Corrupted profile data or localStorage access denied
      try {
        localStorage.removeItem(this.USER_PROFILE_KEY);
      } catch {
        // Ignore cleanup errors
      }
      return { 
        profile: null, 
        success: false, 
        error: error instanceof Error ? error : new Error('Unknown error loading profile')
      };
    }
  }

  /**
   * Check if current user is a student
   * @returns True if student role
   */
  isStudent(): boolean {
    const profile = this.getUserProfile();
    return profile?.role === 'student';
  }

  /**
   * Check if current user is an instructor
   * @returns True if instructor role
   */
  isInstructor(): boolean {
    const profile = this.getUserProfile();
    return profile?.role === 'instructor';
  }

  /**
   * Check if user has a specific role
   * @param role - Role to check
   * @returns True if user has the role
   */
  hasRole(role: UserRole): boolean {
    const profile = this.getUserProfile();
    return profile?.role === role;
  }

  private readParsedStorage<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      // Corrupted localStorage payloads should never crash runtime code paths.
      localStorage.removeItem(key);
      return fallback;
    }
  }

  /**
   * Safely sets a LocalStorage item, detecting quota exceeded errors.
   * Returns true if successful, false if quota exceeded.
   */
  private safeSetItem(key: string, value: string): { success: boolean; quotaExceeded?: boolean } {
    try {
      localStorage.setItem(key, value);
      return { success: true };
    } catch (error) {
      // Check for quota exceeded errors (varies by browser)
      const isQuotaError = 
        error instanceof DOMException &&
        (error.name === 'QuotaExceededError' ||
         error.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
         error.code === 22 || // Chrome/Safari
         error.code === 1014); // Firefox
      
      if (isQuotaError) {
        console.warn(`LocalStorage quota exceeded for key '${key}'. Value size: ${value.length} chars.`);
        return { success: false, quotaExceeded: true };
      }
      
      // Re-throw non-quota errors
      throw error;
    }
  }

  /**
   * Start a new session
   * @param learnerId - Learner identifier
   * @returns Session ID
   */
  startSession(learnerId: string): string {
    const sessionId = `session-${learnerId}-${Date.now()}`;
    localStorage.setItem(this.ACTIVE_SESSION_KEY, sessionId);
    return sessionId;
  }

  /**
   * Get active session ID
   * @returns Session ID or fallback
   */
  getActiveSessionId(): string {
    const existing = localStorage.getItem(this.ACTIVE_SESSION_KEY);
    if (existing) return existing;

    const fallback = 'session-unknown';
    localStorage.setItem(this.ACTIVE_SESSION_KEY, fallback);
    return fallback;
  }

  clearActiveSession() {
    localStorage.removeItem(this.ACTIVE_SESSION_KEY);
  }

  setActiveSessionId(sessionId: string) {
    const normalized = sessionId.trim();
    if (!normalized) {
      this.clearActiveSession();
      return;
    }
    localStorage.setItem(this.ACTIVE_SESSION_KEY, normalized);
  }

  /**
   * Save practice draft code
   * @param learnerId - Learner identifier
   * @param sessionId - Session identifier
   * @param problemId - Problem identifier
   * @param code - SQL code to save
   * @returns Save result with quota info
   */
  savePracticeDraft(learnerId: string, sessionId: string, problemId: string, code: string): { success: boolean; quotaExceeded?: boolean } {
    const key = this.buildPracticeDraftKey(learnerId, sessionId, problemId);
    const drafts = this.readParsedStorage<Record<string, string>>(this.PRACTICE_DRAFTS_KEY, {});
    drafts[key] = code;
    
    // Use safeSetItem to handle quota exceeded errors
    const result = this.safeSetItem(this.PRACTICE_DRAFTS_KEY, JSON.stringify(drafts));
    if (!result.success && result.quotaExceeded) {
      console.warn(`Failed to save practice draft for ${key}: LocalStorage quota exceeded`);
    }
    return result;
  }

  /**
   * Get saved practice draft
   * @param learnerId - Learner identifier
   * @param sessionId - Session identifier
   * @param problemId - Problem identifier
   * @returns Saved code or null
   */
  getPracticeDraft(learnerId: string, sessionId: string, problemId: string): string | null {
    const key = this.buildPracticeDraftKey(learnerId, sessionId, problemId);
    const drafts = this.readParsedStorage<Record<string, string>>(this.PRACTICE_DRAFTS_KEY, {});
    return drafts[key] ?? null;
  }

  clearPracticeDraft(learnerId: string, sessionId: string, problemId: string): { success: boolean; quotaExceeded?: boolean } {
    const key = this.buildPracticeDraftKey(learnerId, sessionId, problemId);
    const drafts = this.readParsedStorage<Record<string, string>>(this.PRACTICE_DRAFTS_KEY, {});
    if (!(key in drafts)) {
      return { success: true };
    }
    delete drafts[key];
    
    // Use safeSetItem to handle quota exceeded errors
    const result = this.safeSetItem(this.PRACTICE_DRAFTS_KEY, JSON.stringify(drafts));
    if (!result.success && result.quotaExceeded) {
      console.warn(`Failed to clear practice draft for ${key}: LocalStorage quota exceeded`);
    }
    return result;
  }

  setPolicyReplayMode(enabled: boolean) {
    localStorage.setItem(this.REPLAY_MODE_KEY, JSON.stringify(Boolean(enabled)));
  }

  getPolicyReplayMode(): boolean {
    return Boolean(this.readParsedStorage<boolean>(this.REPLAY_MODE_KEY, false));
  }

  private readonly MAX_LLM_CACHE_SIZE = 100;

  /**
   * Save LLM cache record with LRU eviction
   * @param record - Cache record to save
   */
  saveLLMCacheRecord(record: LLMCacheRecord) {
    const cache = this.getLLMCache();
    cache[record.cacheKey] = record;
    
    // Enforce max cache size with LRU eviction
    const cacheKeys = Object.keys(cache);
    if (cacheKeys.length > this.MAX_LLM_CACHE_SIZE) {
      const entries = cacheKeys
        .map(key => ({ key, createdAt: cache[key].createdAt || 0 }))
        .sort((a, b) => a.createdAt - b.createdAt);
      
      const toEvict = entries.slice(0, cacheKeys.length - this.MAX_LLM_CACHE_SIZE);
      for (const { key } of toEvict) {
        delete cache[key];
      }
      // LLM cache size exceeded, evicted oldest entries
    }
    
    // Use safeSetItem to handle quota exceeded errors gracefully
    const result = this.safeSetItem(this.LLM_CACHE_KEY, JSON.stringify(cache));
    if (!result.success && result.quotaExceeded) {
      console.warn('[Storage] Failed to save LLM cache: LocalStorage quota exceeded. Cache will be lost on page refresh.');
    }
  }

  /**
   * Get LLM cache record by key
   * @param cacheKey - Cache key
   * @returns Cache record or null
   */
  getLLMCacheRecord(cacheKey: string): LLMCacheRecord | null {
    const cache = this.getLLMCache();
    return cache[cacheKey] || null;
  }

  getLLMCache(): Record<string, LLMCacheRecord> {
    return this.readParsedStorage<Record<string, LLMCacheRecord>>(this.LLM_CACHE_KEY, {});
  }

  /**
   * Save PDF index with memory fallback on quota exceeded
   * @param document - PDF index document
   * @returns Save result with quota info
   */
  savePdfIndex(document: PdfIndexDocument): { success: boolean; quotaExceeded?: boolean } {
    const normalized = this.normalizePdfIndexDocument(document);
    if (!normalized) {
      return { success: false };
    }
    
    const serialized = JSON.stringify(normalized);
    const result = this.safeSetItem(this.PDF_INDEX_KEY, serialized);
    
    if (result.quotaExceeded) {
      // Fall back to in-memory storage
      this.pdfIndexMemory = normalized;
      console.warn('PDF index stored in memory only (LocalStorage quota exceeded). The index will be lost on page refresh.');
    } else if (result.success) {
      // Clear memory fallback if LocalStorage succeeds
      this.pdfIndexMemory = null;
    }
    
    return result;
  }

  /**
   * Get PDF index from storage or memory fallback
   * @returns PDF index document or null
   */
  getPdfIndex(): PdfIndexDocument | null {
    // First try LocalStorage
    const raw = this.readParsedStorage<unknown>(this.PDF_INDEX_KEY, null);
    const normalized = this.normalizePdfIndexDocument(raw);
    if (normalized) {
      return normalized;
    }
    
    // Fall back to in-memory if available
    if (this.pdfIndexMemory) {
      return this.pdfIndexMemory;
    }

    // Return null without corrupting localStorage - don't write null back
    return null;
  }

  getPdfIndexProvenance(): PdfIndexProvenance | null {
    const index = this.getPdfIndex();
    if (!index) {
      return null;
    }

    return {
      indexId: index.indexId,
      schemaVersion: index.schemaVersion,
      embeddingModelId: index.embeddingModelId,
      chunkerVersion: index.chunkerVersion,
      docCount: index.docCount,
      chunkCount: index.chunkCount
    };
  }

  // Interaction traces
  /**
   * Save an interaction event
   * @param event - Interaction event to save
   * @returns Save result with quota info
   */
  saveInteraction(event: InteractionEvent): { success: boolean; quotaExceeded?: boolean } {
    const sessionId = event.sessionId || this.getActiveSessionId();
    const normalizedEvent = { ...event, sessionId };
    const interactions = this.getAllInteractions();
    interactions.push(normalizedEvent);
    
    // Use safeSetItem to handle quota exceeded errors
    const result = this.safeSetItem(this.INTERACTIONS_KEY, JSON.stringify(interactions));
    
    // Only update profile if interaction save succeeded
    if (result.success) {
      this.updateProfileStatsFromEvent(normalizedEvent);
    }
    
    return result;
  }

  /**
   * Log a coverage change event when a concept is newly covered.
   * This creates an auditable trace of concept coverage progression.
   * 
   * Enhanced logging includes:
   * - Score delta for tracking progress magnitude
   * - Confidence level changes
   * - Evidence summary for debugging coverage decisions
   * - Timestamp for replay/analysis
   */
  saveCoverageChangeEvent(params: {
    learnerId: string;
    problemId: string;
    conceptId: string;
    score: number;
    previousScore: number;
    confidence: 'low' | 'medium' | 'high';
    evidenceCounts: ConceptCoverageEvidence['evidenceCounts'];
    triggerEventId?: string;
    triggerEventType?: string;
  }): void {
    const sessionId = this.getActiveSessionId();
    const timestamp = Date.now();
    const scoreDelta = params.score - params.previousScore;
    
    // Calculate total evidence count for summary
    const totalEvidence = 
      params.evidenceCounts.successfulExecution +
      params.evidenceCounts.notesAdded +
      params.evidenceCounts.explanationViewed +
      params.evidenceCounts.hintViewed +
      params.evidenceCounts.errorEncountered;
    
    const event: InteractionEvent = {
      id: `evt-coverage-${params.learnerId}-${params.conceptId}-${timestamp}`,
      sessionId,
      learnerId: params.learnerId,
      timestamp,
      eventType: 'coverage_change',
      problemId: params.problemId,
      conceptIds: [params.conceptId],
      inputs: {
        previousScore: params.previousScore,
        previousConfidence: this.inferPreviousConfidence(params.previousScore),
        triggerEventType: params.triggerEventType || 'unknown'
      },
      outputs: {
        score: params.score,
        scoreDelta,
        confidence: params.confidence,
        successfulExecution: params.evidenceCounts.successfulExecution,
        hintViewed: params.evidenceCounts.hintViewed,
        explanationViewed: params.evidenceCounts.explanationViewed,
        errorEncountered: params.evidenceCounts.errorEncountered,
        notesAdded: params.evidenceCounts.notesAdded,
        totalEvidence,
        triggerEventId: params.triggerEventId || 'unknown',
        coverageThreshold: this.COVERAGE_THRESHOLD,
        policyVersion: 'coverage-v1-score-and-executions'
      }
    };

    const interactions = this.getAllInteractions();
    interactions.push(event);
    const result = this.safeSetItem(this.INTERACTIONS_KEY, JSON.stringify(interactions));
    
    if (!result.success) {
      console.warn(`[Coverage] Failed to save coverage change event: ${result.quotaExceeded ? 'quota exceeded' : 'unknown error'}`);
    }
    
    // Coverage progression logged via saveCoverageChangeEvent
  }

  /**
   * Infer previous confidence level based on previous score.
   * Used for logging confidence transitions in coverage events.
   */
  private inferPreviousConfidence(previousScore: number): 'low' | 'medium' | 'high' {
    if (previousScore >= this.CONFIDENCE_THRESHOLDS.high.score) {
      return 'high';
    }
    if (previousScore >= this.CONFIDENCE_THRESHOLDS.medium.score) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Get all interaction events
   * @returns Array of all interactions
   */
  getAllInteractions(): InteractionEvent[] {
    return this.readParsedStorage<InteractionEvent[]>(this.INTERACTIONS_KEY, []);
  }

  /**
   * Get interactions for a specific learner
   * @param learnerId - Learner identifier
   * @returns Filtered interactions
   */
  getInteractionsByLearner(learnerId: string): InteractionEvent[] {
    return this.getAllInteractions().filter(i => i.learnerId === learnerId);
  }

  /**
   * Get interactions for a specific problem
   * @param problemId - Problem identifier
   * @returns Filtered interactions
   */
  getInteractionsByProblem(problemId: string): InteractionEvent[] {
    return this.getAllInteractions().filter(i => i.problemId === problemId);
  }

  /**
   * Get filtered and sorted trace slice
   * @param options - Filter options (learner, problem, session, limit)
   * @returns Filtered and sorted interactions
   */
  getTraceSlice(options?: {
    learnerId?: string;
    problemId?: string;
    sessionId?: string;
    limit?: number;
  }): InteractionEvent[] {
    const learnerId = options?.learnerId;
    const problemId = options?.problemId;
    const sessionId = options?.sessionId;
    const limit = options?.limit;

    const filtered = this.getAllInteractions()
      .filter((interaction) => {
        if (learnerId && interaction.learnerId !== learnerId) return false;
        if (problemId && interaction.problemId !== problemId) return false;
        if (sessionId && interaction.sessionId !== sessionId) return false;
        return true;
      })
      .sort((a, b) => {
        const timestampDelta = a.timestamp - b.timestamp;
        if (timestampDelta !== 0) return timestampDelta;

        const problemDelta = (a.problemId || '').localeCompare(b.problemId || '');
        if (problemDelta !== 0) return problemDelta;

        const typeDelta = (a.eventType || '').localeCompare(b.eventType || '');
        if (typeDelta !== 0) return typeDelta;

        return (a.id || '').localeCompare(b.id || '');
      });

    if (!limit || limit <= 0 || filtered.length <= limit) {
      return filtered;
    }

    return filtered.slice(-limit);
  }

  getInteractionsByIds(interactionIds: string[], learnerId?: string): InteractionEvent[] {
    if (interactionIds.length === 0) return [];

    const source = learnerId
      ? this.getInteractionsByLearner(learnerId)
      : this.getAllInteractions();
    const byId = new Map(source.map((interaction) => [interaction.id, interaction]));
    const dedupedIds = Array.from(new Set(interactionIds));

    return dedupedIds
      .map((id) => byId.get(id))
      .filter((interaction): interaction is InteractionEvent => Boolean(interaction));
  }

  clearInteractions() {
    localStorage.removeItem(this.INTERACTIONS_KEY);
  }

  // Learner profiles with optimistic locking to prevent race conditions
  /**
   * Save learner profile with optimistic locking
   * @param profile - Profile to save
   */
  saveProfile(profile: LearnerProfile) {
    // Re-read profiles from storage each time to minimize race condition window
    let profiles = this.getAllProfiles();
    let index = profiles.findIndex(p => p.id === profile.id);
    
    // Get existing version or start at 0
    const existingVersion = index >= 0 ? (profiles[index].version || 0) : 0;
    const incomingVersion = (profile as any).version || 0;
    
    // Simple merge strategy: if incoming has lower version, merge data
    let mergedConceptsCovered = profile.conceptsCovered;
    let mergedEvidence = profile.conceptCoverageEvidence || new Map();
    let mergedErrorHistory = profile.errorHistory;
    
    if (index >= 0 && incomingVersion < existingVersion) {
      // Race condition detected: merge with existing data instead of overwriting
      const existingProfile = this.getProfile(profile.id);
      
      if (existingProfile) {
        // Merge conceptsCovered: union of both sets
        mergedConceptsCovered = new Set([
          ...Array.from(existingProfile.conceptsCovered),
          ...Array.from(profile.conceptsCovered)
        ]);
        
        // Merge conceptCoverageEvidence: keep higher scores
        mergedEvidence = new Map(existingProfile.conceptCoverageEvidence);
        for (const [conceptId, newEvidence] of (profile.conceptCoverageEvidence || new Map()).entries()) {
          const existingEvidence = mergedEvidence.get(conceptId);
          if (!existingEvidence || newEvidence.score > existingEvidence.score) {
            mergedEvidence.set(conceptId, newEvidence);
          }
        }
        
        // Merge errorHistory: sum the counts
        mergedErrorHistory = new Map(existingProfile.errorHistory);
        for (const [errorType, count] of profile.errorHistory.entries()) {
          mergedErrorHistory.set(errorType, (mergedErrorHistory.get(errorType) || 0) + count);
        }
      }
    }
    
    // Atomic read-modify-write: use the profiles from initial read with merged data
    // This prevents race conditions from concurrent tab modifications
    // The version-based merge strategy above already handles stale data detection
    const currentVersion = existingVersion;
    
    // Convert Sets and Maps to arrays for storage
    const serializable = {
      ...profile,
      version: currentVersion + 1, // Increment from version at initial read
      currentStrategy: this.normalizeStrategy(profile.currentStrategy),
      conceptsCovered: Array.from(mergedConceptsCovered),
      conceptCoverageEvidence: Array.from(mergedEvidence.entries()),
      errorHistory: Array.from(mergedErrorHistory.entries())
    };
    
    // Re-find index in the current profiles array (from initial read)
    const writeIndex = profiles.findIndex(p => p.id === profile.id);
    if (writeIndex >= 0) {
      profiles[writeIndex] = serializable;
    } else {
      profiles.push(serializable);
    }
    
    // Use safeSetItem for consistency and quota handling
    const result = this.safeSetItem(this.PROFILES_KEY, JSON.stringify(profiles));
    if (!result.success && result.quotaExceeded) {
      console.warn('[Storage] Failed to save profile: LocalStorage quota exceeded');
    }
  }

  /**
   * Get learner profile by ID
   * @param learnerId - Learner identifier
   * @returns Profile or null
   */
  getProfile(learnerId: string): LearnerProfile | null {
    try {
      const profiles = this.getAllProfiles();
      const profile = profiles.find(p => p.id === learnerId);
      
      if (!profile) return null;
      
      // Convert arrays back to Sets and Maps
      // Handle both Array<Array<[string, ConceptCoverageEvidence]>> and Array<[string, ConceptCoverageEvidence]>
      const rawEvidence = profile.conceptCoverageEvidence;
      const evidenceMap = new Map<string, ConceptCoverageEvidence>();
      const now = Date.now();
      
      if (Array.isArray(rawEvidence)) {
        for (const item of rawEvidence) {
          if (!Array.isArray(item) || item.length < 2) continue;
          const [key, value] = item;
          if (typeof key !== 'string' || typeof value !== 'object' || value === null) continue;
          
          // Ensure evidence has all required fields with defaults
          const defaultEvidence = this.createDefaultEvidence(key, now);
          const mergedEvidence: ConceptCoverageEvidence = {
            ...defaultEvidence,
            ...value,
            conceptId: key,
            evidenceCounts: {
              ...defaultEvidence.evidenceCounts,
              ...(value.evidenceCounts || {})
            }
          };
          evidenceMap.set(key, mergedEvidence);
        }
      }
      
      // Ensure all covered concepts have evidence entries
      const conceptsCovered = new Set((profile.conceptsCovered || []) as any);
      for (const conceptId of conceptsCovered) {
        if (!evidenceMap.has(conceptId)) {
          evidenceMap.set(conceptId, this.createDefaultEvidence(conceptId, now));
        }
      }
      
      return {
        ...profile,
        conceptsCovered,
        conceptCoverageEvidence: evidenceMap,
        errorHistory: new Map((profile.errorHistory || []) as any),
        currentStrategy: this.normalizeStrategy(profile.currentStrategy)
      };
    } catch (error) {
      // Handle corrupted profile data gracefully
      console.error(`Failed to parse profile for learner ${learnerId}:`, error);
      // Clear corrupted profile to allow fresh start
      try {
        const profiles = this.getAllProfiles().filter(p => p?.id !== learnerId);
        localStorage.setItem(this.PROFILES_KEY, JSON.stringify(profiles));
      } catch (cleanupError) {
        console.error('Failed to clean up corrupted profile:', cleanupError);
      }
      return null;
    }
  }

  getAllProfiles(): any[] {
    return this.readParsedStorage<any[]>(this.PROFILES_KEY, []);
  }

  /**
   * Create default profile for new learner
   * @param learnerId - Learner identifier
   * @param strategy - Initial strategy (default: adaptive-medium)
   * @returns Created profile
   */
  createDefaultProfile(learnerId: string, strategy: LearnerProfile['currentStrategy'] = 'adaptive-medium'): LearnerProfile {
    const profile: LearnerProfile = {
      id: learnerId,
      name: `Learner ${learnerId}`,
      conceptsCovered: new Set(),
      conceptCoverageEvidence: new Map(),
      errorHistory: new Map(),
      interactionCount: 0,
      currentStrategy: this.normalizeStrategy(strategy),
      preferences: {
        escalationThreshold: 3,
        aggregationDelay: 300000 // 5 minutes
      }
    };
    this.saveProfile(profile);
    return profile;
  }

  private createDefaultEvidence(conceptId: string, timestamp: number): ConceptCoverageEvidence {
    return {
      conceptId,
      score: 0,
      confidence: 'low',
      lastUpdated: timestamp,
      evidenceCounts: {
        successfulExecution: 0,
        hintViewed: 0,
        explanationViewed: 0,
        errorEncountered: 0,
        notesAdded: 0
      },
      streakCorrect: 0,
      streakIncorrect: 0
    };
  }

  // Week 3 D8: Guidance Ladder event logging helpers

  /**
   * Log a guidance request event when learner requests help.
   * Enables replay reconstruction of help-seeking behavior.
   */
  logGuidanceRequest(params: {
    learnerId: string;
    problemId: string;
    requestType: GuidanceRequestType;
    currentRung: RungLevel;
    sessionId?: string;
  }): { success: boolean; quotaExceeded?: boolean } {
    const event: InteractionEvent = {
      id: this.generateEventId('guidance-req'),
      sessionId: params.sessionId || this.getActiveSessionId(),
      learnerId: params.learnerId,
      timestamp: Date.now(),
      eventType: 'guidance_request',
      problemId: params.problemId,
      requestType: params.requestType,
      currentRung: params.currentRung
    };
    return this.saveInteraction(event);
  }

  /**
   * Log a guidance view event when guidance is displayed.
   * Captures rung, concept IDs, and grounding information for replay.
   */
  logGuidanceView(params: {
    learnerId: string;
    problemId: string;
    rung: RungLevel;
    conceptIds: string[];
    sourceRefIds?: string[];
    grounded: boolean;
    contentLength: number;
    sessionId?: string;
  }): { success: boolean; quotaExceeded?: boolean } {
    const event: InteractionEvent = {
      id: this.generateEventId('guidance-view'),
      sessionId: params.sessionId || this.getActiveSessionId(),
      learnerId: params.learnerId,
      timestamp: Date.now(),
      eventType: 'guidance_view',
      problemId: params.problemId,
      rung: params.rung,
      conceptIds: params.conceptIds,
      retrievedSourceIds: params.sourceRefIds,
      grounded: params.grounded,
      contentLength: params.contentLength
    };
    return this.saveInteraction(event);
  }

  /**
   * Log a guidance escalation event when escalation happens.
   * Captures trigger reason and evidence for replay analysis.
   */
  logGuidanceEscalate(params: {
    learnerId: string;
    problemId: string;
    fromRung: RungLevel;
    toRung: RungLevel;
    trigger: GuidanceEscalationTrigger;
    evidence: {
      errorCount: number;
      retryCount: number;
      hintCount: number;
      timeSpentMs: number;
    };
    sourceInteractionIds?: string[];
    sessionId?: string;
  }): { success: boolean; quotaExceeded?: boolean } {
    const event: InteractionEvent = {
      id: this.generateEventId('guidance-esc'),
      sessionId: params.sessionId || this.getActiveSessionId(),
      learnerId: params.learnerId,
      timestamp: Date.now(),
      eventType: 'guidance_escalate',
      problemId: params.problemId,
      fromRung: params.fromRung,
      toRung: params.toRung,
      trigger: params.trigger,
      inputs: {
        error_count: params.evidence.errorCount,
        retry_count: params.evidence.retryCount,
        hint_count: params.evidence.hintCount,
        time_spent_ms: params.evidence.timeSpentMs
      },
      triggerInteractionIds: params.sourceInteractionIds
    };
    return this.saveInteraction(event);
  }

  /**
   * Log a textbook unit upsert event when My Textbook unit is created or updated.
   * Captures dedupe key and revision count for replay.
   */
  logTextbookUnitUpsert(params: {
    learnerId: string;
    problemId: string;
    unitId: string;
    conceptIds: string[];
    action: TextbookUnitAction;
    dedupeKey: string;
    revisionCount: number;
    sourceRefIds?: string[];
    sourceInteractionIds?: string[];
    sessionId?: string;
  }): { success: boolean; quotaExceeded?: boolean } {
    const event: InteractionEvent = {
      id: this.generateEventId('unit-upsert'),
      sessionId: params.sessionId || this.getActiveSessionId(),
      learnerId: params.learnerId,
      timestamp: Date.now(),
      eventType: 'textbook_unit_upsert',
      problemId: params.problemId,
      unitId: params.unitId,
      conceptIds: params.conceptIds,
      action: params.action,
      dedupeKey: params.dedupeKey,
      revisionCount: params.revisionCount,
      retrievedSourceIds: params.sourceRefIds,
      triggerInteractionIds: params.sourceInteractionIds
    };
    return this.saveInteraction(event);
  }

  /**
   * Log a source view event when learner opens source viewer.
   * Captures passage count and concept coverage for replay.
   */
  logSourceView(params: {
    learnerId: string;
    problemId: string;
    passageCount: number;
    conceptIds: string[];
    expanded: boolean;
    sessionId?: string;
  }): { success: boolean; quotaExceeded?: boolean } {
    const event: InteractionEvent = {
      id: this.generateEventId('source-view'),
      sessionId: params.sessionId || this.getActiveSessionId(),
      learnerId: params.learnerId,
      timestamp: Date.now(),
      eventType: 'source_view',
      problemId: params.problemId,
      passageCount: params.passageCount,
      conceptIds: params.conceptIds,
      expanded: params.expanded
    };
    return this.saveInteraction(event);
  }

  /**
   * Generate a unique event ID for Guidance Ladder events.
   */
  private generateEventId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `evt-${prefix}-${timestamp}-${random}`;
  }

  // Evidence scoring weights for coverage calculation
  private readonly EVIDENCE_WEIGHTS = {
    successfulExecution: 25,    // Strong positive evidence
    notesAdded: 15,             // Good positive evidence (engagement)
    explanationViewed: 5,       // Weak positive (needed help)
    hintViewed: 2,              // Minimal positive (just viewed hint)
    errorEncountered: -5        // Negative evidence
  };

  // Thresholds for coverage and confidence
  private readonly COVERAGE_THRESHOLD = 50;      // Score >= 50 = concept covered
  private readonly CONFIDENCE_THRESHOLDS = {
    high: { score: 75, minExecutions: 2 },
    medium: { score: 40, minExecutions: 1 },
    low: { score: 0, minExecutions: 0 }
  };

  // Valid concept IDs from SQL-Engage knowledge graph (used for validation)
  private readonly VALID_CONCEPT_IDS = new Set([
    'select-basic',
    'where-clause',
    'joins',
    'aggregation',
    'subqueries',
    'order-by'
  ]);

  // Textbook/instructional units
  /**
   * Save textbook unit (legacy v1)
   * @param learnerId - Learner identifier
   * @param unit - Unit to save
   * @returns Save result
   */
  saveTextbookUnit(learnerId: string, unit: InstructionalUnit): SaveTextbookUnitResult {
    const textbooks = this.getAllTextbooks();
    if (!textbooks[learnerId]) {
      textbooks[learnerId] = [];
    }
    const activeSessionId = unit.sessionId || this.getActiveSessionId();
    const normalizedSourceIds = this.mergeIds(unit.sourceInteractionIds, unit.sourceInteractions);
    const dedupKeyByHash = unit.provenance?.inputHash;
    const dedupKeyFallback = this.buildUnitFallbackDedupKey(unit);
    const existing = textbooks[learnerId].find((candidate) => {
      const candidateHash = candidate.provenance?.inputHash;
      if (dedupKeyByHash && candidateHash && candidateHash === dedupKeyByHash) {
        return true;
      }
      const candidateFallback = this.buildUnitFallbackDedupKey(candidate);
      return candidateFallback === dedupKeyFallback;
    });

    if (existing) {
      const existingSourceIds = this.mergeIds(existing.sourceInteractionIds, existing.sourceInteractions);
      existing.sourceInteractionIds = this.mergeIds(existingSourceIds, normalizedSourceIds);
      // BUG FIX: Don't overwrite addedTimestamp - use updatedTimestamp instead
      existing.updatedTimestamp = Date.now();
      existing.content = unit.content;
      existing.title = unit.title;
      existing.sessionId = existing.sessionId || activeSessionId;
      existing.provenance = this.mergeProvenance(existing.provenance, unit.provenance);
      existing.lastErrorSubtypeId = unit.lastErrorSubtypeId || existing.lastErrorSubtypeId;
      existing.updatedSessionIds = Array.from(new Set([
        ...(existing.updatedSessionIds || []),
        activeSessionId
      ]));
      // BUG FIX: Merge conceptIds array to preserve all concepts
      if (unit.conceptIds && unit.conceptIds.length > 0) {
        const existingConceptIds = existing.conceptIds || [existing.conceptId];
        const mergedConceptIds = Array.from(new Set([...existingConceptIds, ...unit.conceptIds]));
        existing.conceptIds = mergedConceptIds;
      }

      // Use safeSetItem for quota handling
      const result = this.safeSetItem(this.TEXTBOOK_KEY, JSON.stringify(textbooks));
      if (!result.success) {
        console.warn('Failed to save textbook unit update: quota exceeded or other error');
      }
      return {
        action: 'updated',
        unit: {
          ...existing,
          sourceInteractionIds: this.mergeIds(existing.sourceInteractionIds, existing.sourceInteractions)
        },
        success: result.success,
        quotaExceeded: result.quotaExceeded
      };
    } else {
      const created = {
        ...unit,
        sessionId: activeSessionId,
        updatedSessionIds: [activeSessionId],
        sourceInteractionIds: normalizedSourceIds
      };
      textbooks[learnerId].push(created);

      // Use safeSetItem for quota handling
      const result = this.safeSetItem(this.TEXTBOOK_KEY, JSON.stringify(textbooks));
      if (!result.success) {
        console.warn('Failed to save new textbook unit: quota exceeded or other error');
      }
      return {
        action: 'created',
        unit: created,
        success: result.success,
        quotaExceeded: result.quotaExceeded
      };
    }
  }

  /**
   * Get all textbook units for a learner
   * @param learnerId - Learner identifier
   * @returns Array of units
   */
  getTextbook(learnerId: string): InstructionalUnit[] {
    const textbooks = this.getAllTextbooks();
    const units = textbooks[learnerId] || [];
    return units.map(unit => ({
      ...unit,
      sourceInteractionIds: this.mergeIds(unit.sourceInteractionIds, unit.sourceInteractions)
    }));
  }

  // Week 3 D6: Enhanced upsert with dedupe and revision tracking
  // Week 3 D8: Added logging for textbook_unit_upsert events
  // Week 3 Feature: Explanation Competition/Selection System
  saveTextbookUnitV2(
    learnerId: string, 
    input: CreateUnitInput,
    problemId?: string,
    useCompetition = true // Enable competition by default
  ): SaveTextbookUnitResult & {
    action: 'created' | 'updated';
    why: string;
    competitionResult?: ReturnType<typeof competeAndSelectBestUnit>['result'];
  } {
    const textbooks = this.getAllTextbooks();
    if (!textbooks[learnerId]) {
      textbooks[learnerId] = [];
    }

    // Create input with logging callback for upsert tracking
    const inputWithLogging: CreateUnitInput = {
      ...input,
      onUpsert: (params) => {
        // Week 3 D8: Log textbook_unit_upsert event
        if (problemId) {
          this.logTextbookUnitUpsert({
            learnerId,
            problemId,
            unitId: params.unitId,
            conceptIds: input.conceptIds,
            action: params.action,
            dedupeKey: params.dedupeKey,
            revisionCount: params.revisionCount,
            sourceRefIds: input.sourceRefIds,
            sourceInteractionIds: input.sourceInteractionIds,
            sessionId: input.sessionId
          });
        }
        // Call original callback if provided
        input.onUpsert?.(params);
      }
    };

    // If competition is enabled, use the competition flow for new units
    if (useCompetition) {
      // First check if this is an update to an existing unit (dedupe)
      const dedupeKey = generateDedupeKey({
        conceptIds: input.conceptIds,
        type: input.type
      });
      const existingUnit = findExistingUnit(textbooks[learnerId], dedupeKey);
      
      if (existingUnit) {
        // Use existing upsert logic for updates
        const result = upsertTextbookUnit(
          textbooks[learnerId],
          inputWithLogging,
          () => this.generateEventId('unit')
        );

        if (result.action === 'updated') {
          // Replace existing unit
          const index = textbooks[learnerId].findIndex(
            (u) => generateDedupeKey(u) === dedupeKey
          );
          if (index !== -1) {
            // Preserve status when updating
            const updatedUnit = {
              ...result.unit,
              status: existingUnit.status || 'primary'
            };
            textbooks[learnerId][index] = updatedUnit;
          }
        }

        const saveResult = this.safeSetItem(this.TEXTBOOK_KEY, JSON.stringify(textbooks));
        return {
          ...result,
          success: saveResult.success,
          quotaExceeded: saveResult.quotaExceeded
        };
      }

      // No existing unit - use competition to add new unit
      const newUnit = buildNewUnit(inputWithLogging, this.generateEventId('unit'));
      
      // Ensure new units start with status to satisfy type constraints
      const newUnitWithStatus = {
        ...newUnit,
        status: 'primary' as const
      };
      
      const { updatedUnits, result: competitionResult } = competeAndSelectBestUnit(
        textbooks[learnerId],
        newUnitWithStatus
      );

      // Update storage with competition results
      textbooks[learnerId] = updatedUnits;

      // Competition result logged via telemetry if needed

      // Find the new/updated unit for return
      const primaryUnit = competitionResult.primaryUnit;

      // Save to storage
      const saveResult = this.safeSetItem(this.TEXTBOOK_KEY, JSON.stringify(textbooks));
      if (!saveResult.success) {
        console.warn('Failed to save textbook unit: quota exceeded or other error');
      }

      return {
        action: 'created',
        unit: primaryUnit,
        success: saveResult.success,
        quotaExceeded: saveResult.quotaExceeded,
        why: competitionResult.reason,
        competitionResult
      };
    }

    // Legacy upsert flow (competition disabled)
    const result = upsertTextbookUnit(
      textbooks[learnerId],
      inputWithLogging,
      () => this.generateEventId('unit')
    );

    if (result.action === 'created') {
      textbooks[learnerId].push(result.unit);
    } else {
      // Replace existing unit with updated version
      const dedupeKey = generateDedupeKey(result.unit);
      const index = textbooks[learnerId].findIndex(
        (u) => generateDedupeKey(u) === dedupeKey
      );
      if (index !== -1) {
        textbooks[learnerId][index] = result.unit;
      }
    }

    // Save to storage
    const saveResult = this.safeSetItem(this.TEXTBOOK_KEY, JSON.stringify(textbooks));
    if (!saveResult.success) {
      console.warn('Failed to save textbook unit: quota exceeded or other error');
    }

    return {
      ...result,
      success: saveResult.success,
      quotaExceeded: saveResult.quotaExceeded
    };
  }

  /**
   * Get textbook units with optional status filtering
   */
  getTextbookWithStatus(
    learnerId: string,
    statuses?: Array<'primary' | 'alternative' | 'archived'>
  ): InstructionalUnit[] {
    const units = this.getTextbook(learnerId);
    if (!statuses || statuses.length === 0) {
      return units;
    }
    return filterUnitsByStatus(units, statuses);
  }

  private mergeIds(...sources: Array<string[] | undefined>): string[] {
    return Array.from(
      new Set(
        sources
          .flatMap((source) => source || [])
          .map((value) => value?.trim())
          .filter((value): value is string => Boolean(value))
      )
    );
  }

  private buildUnitFallbackDedupKey(unit: InstructionalUnit): string {
    const conceptId = (unit.conceptId || 'unknown-concept').trim().toLowerCase();
    const errorSubtype = (unit.lastErrorSubtypeId || 'unknown').trim().toLowerCase();
    const templateId = (unit.provenance?.templateId || 'template-unknown').trim().toLowerCase();
    const unitType = (unit.type || 'summary').trim().toLowerCase();
    return `${conceptId}::${errorSubtype}::${templateId}::${unitType}`;
  }

  private mergeProvenance(
    existing?: UnitProvenance,
    incoming?: UnitProvenance
  ): UnitProvenance | undefined {
    if (!existing && !incoming) {
      return undefined;
    }

    const mergedRetrievedSourceIds = this.mergeIds(
      existing?.retrievedSourceIds,
      incoming?.retrievedSourceIds
    );
    const createdAtCandidates = [existing?.createdAt, incoming?.createdAt].filter(
      (value): value is number => typeof value === 'number' && Number.isFinite(value)
    );
    const createdAt = createdAtCandidates.length > 0
      ? Math.min(...createdAtCandidates)
      : Date.now();
    const mergedPdfCitations = this.mergePdfCitations(
      existing?.retrievedPdfCitations,
      incoming?.retrievedPdfCitations
    );

    return {
      ...(existing || {}),
      ...(incoming || {}),
      createdAt,
      retrievedSourceIds: mergedRetrievedSourceIds,
      retrievedPdfCitations: mergedPdfCitations.length > 0 ? mergedPdfCitations : (existing?.retrievedPdfCitations || incoming?.retrievedPdfCitations),
      // Don't let null/empty incoming overwrite valid existing data
      parserStatus: incoming?.parserStatus || existing?.parserStatus,
      parserFailureReason: incoming?.parserFailureReason || existing?.parserFailureReason,
    };
  }

  private mergePdfCitations(...sources: Array<PdfCitation[] | undefined>): PdfCitation[] {
    const bestByChunkId = new Map<string, PdfCitation>();
    for (const source of sources) {
      for (const citation of source || []) {
        if (!citation || !citation.chunkId) continue;
        const rawPage = Number(citation.page);
        // Fix: Default to page 1 instead of dropping citations with invalid pages
        const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
        // Fix: Ensure score is a valid number (not NaN)
        const rawScore = Number(citation.score);
        const score = Number.isFinite(rawScore) ? rawScore : 0;
        const docId = this.asNonEmptyString(citation.docId)
          || this.asNonEmptyString(citation.chunkId.split(':')[0])
          || 'legacy-doc';
        const normalized: PdfCitation = {
          docId,
          chunkId: citation.chunkId,
          page,
          score
        };
        const existing = bestByChunkId.get(normalized.chunkId);
        if (!existing || normalized.score > existing.score) {
          bestByChunkId.set(normalized.chunkId, normalized);
        }
      }
    }
    return Array.from(bestByChunkId.values());
  }

  getAllTextbooks(): Record<string, InstructionalUnit[]> {
    return this.readParsedStorage<Record<string, InstructionalUnit[]>>(this.TEXTBOOK_KEY, {});
  }

  clearTextbook(learnerId: string): { success: boolean; quotaExceeded?: boolean } {
    const textbooks = this.getAllTextbooks();
    delete textbooks[learnerId];
    
    // Use safeSetItem for consistency and quota handling
    const result = this.safeSetItem(this.TEXTBOOK_KEY, JSON.stringify(textbooks));
    if (!result.success && result.quotaExceeded) {
      console.warn(`[Storage] Failed to clear textbook for ${learnerId}: LocalStorage quota exceeded`);
    }
    return result;
  }

  // Export data for research
  exportData(options?: { allHistory?: boolean }) {
    const allHistory = options?.allHistory === true;
    const activeSessionId = this.getActiveSessionId();
    const interactions = this.getAllInteractions().filter(i => {
      if (allHistory) return true;
      return i.sessionId === activeSessionId;
    }).map((interaction) => this.normalizeInteractionForExport(interaction, activeSessionId));
    const allTextbooks = this.getAllTextbooks();
    const textbooks = Object.fromEntries(
      Object.entries(allTextbooks).map(([learnerId, units]) => [
        learnerId,
        units.filter(unit => {
          if (allHistory) return true;
          return unit.sessionId === activeSessionId || (unit.updatedSessionIds || []).includes(activeSessionId);
        })
      ])
    );

    const serializableProfiles = this.getAllProfiles().map(profile => {
      const learnerInteractions = interactions.filter(i => i.learnerId === profile.id);
      const errors = learnerInteractions.filter(i => i.eventType === 'error').length;
      
      // Get full profile with evidence data
      const fullProfile = this.getProfile(profile.id);
      const conceptsCoveredSet = fullProfile?.conceptsCovered || new Set<string>(profile.conceptsCovered || []);
      const coverageEvidence = fullProfile?.conceptCoverageEvidence;

      // Build evidence summary for export
      const conceptCoverageWithEvidence = Array.from(conceptsCoveredSet).map(conceptId => {
        const evidence = coverageEvidence?.get(conceptId);
        return {
          conceptId,
          score: evidence?.score || 0,
          confidence: evidence?.confidence || 'low',
          evidenceCounts: evidence?.evidenceCounts || {
            successfulExecution: 0,
            hintViewed: 0,
            explanationViewed: 0,
            errorEncountered: 0,
            notesAdded: 0
          }
        };
      });

      return {
        ...profile,
        interactionCount: learnerInteractions.length,
        errors,
        conceptsCovered: Array.from(conceptsCoveredSet),
        conceptCoverageEvidence: coverageEvidence 
          ? Array.from(coverageEvidence.entries())
          : [],
        conceptCoverageSummary: conceptCoverageWithEvidence
      };
    });

    return {
      interactions,
      profiles: serializableProfiles,
      textbooks,
      llmCache: this.getLLMCache(),
      replayMode: this.getPolicyReplayMode(),
      pdfIndex: this.getPdfIndex(),
      pdfIndexProvenance: this.getPdfIndexProvenance(),
      activeSessionId,
      exportScope: allHistory ? 'all-history' : 'active-session',
      exportPolicyVersion: this.EXPORT_POLICY_VERSION,
      exportedAt: new Date().toISOString()
    };
  }

  exportAllData() {
    return this.exportData({ allHistory: true });
  }

  importData(data: any) {
    // Basic validation: data must be an object
    if (!data || typeof data !== 'object') {
      console.error('Import failed: data must be an object');
      throw new Error('Invalid import data: must be an object');
    }
    
    // Validate interactions array if provided
    if (data.interactions !== undefined) {
      if (!Array.isArray(data.interactions)) {
        console.error('Import failed: interactions must be an array');
        throw new Error('Invalid import data: interactions must be an array');
      }
      // Validate each interaction has required fields
      for (const interaction of data.interactions) {
        if (!interaction || typeof interaction !== 'object') {
          console.error('Import failed: each interaction must be an object');
          throw new Error('Invalid import data: each interaction must be an object');
        }
        if (typeof interaction.id !== 'string') {
          console.error('Import failed: interaction.id must be a string');
          throw new Error('Invalid import data: interaction.id must be a string');
        }
        if (typeof interaction.learnerId !== 'string') {
          console.error('Import failed: interaction.learnerId must be a string');
          throw new Error('Invalid import data: interaction.learnerId must be a string');
        }
      }
      localStorage.setItem(this.INTERACTIONS_KEY, JSON.stringify(data.interactions));
    }
    
    // Validate profiles array if provided
    if (data.profiles !== undefined) {
      if (!Array.isArray(data.profiles)) {
        console.error('Import failed: profiles must be an array');
        throw new Error('Invalid import data: profiles must be an array');
      }
      for (const profile of data.profiles) {
        if (!profile || typeof profile !== 'object') {
          console.error('Import failed: each profile must be an object');
          throw new Error('Invalid import data: each profile must be an object');
        }
        if (typeof profile.id !== 'string') {
          console.error('Import failed: profile.id must be a string');
          throw new Error('Invalid import data: profile.id must be a string');
        }
      }
      localStorage.setItem(this.PROFILES_KEY, JSON.stringify(data.profiles));
    }
    
    // Validate textbooks object if provided
    if (data.textbooks !== undefined) {
      if (!data.textbooks || typeof data.textbooks !== 'object' || Array.isArray(data.textbooks)) {
        console.error('Import failed: textbooks must be an object (learnerId -> units map)');
        throw new Error('Invalid import data: textbooks must be an object');
      }
      localStorage.setItem(this.TEXTBOOK_KEY, JSON.stringify(data.textbooks));
    }
    
    // Validate LLM cache if provided
    if (data.llmCache !== undefined) {
      if (!data.llmCache || typeof data.llmCache !== 'object' || Array.isArray(data.llmCache)) {
        console.error('Import failed: llmCache must be an object');
        throw new Error('Invalid import data: llmCache must be an object');
      }
      localStorage.setItem(this.LLM_CACHE_KEY, JSON.stringify(data.llmCache));
    }
    
    if (typeof data.replayMode === 'boolean') {
      this.setPolicyReplayMode(data.replayMode);
    }
    
    // Validate PDF index if provided
    if (data.pdfIndex !== undefined) {
      if (!data.pdfIndex || typeof data.pdfIndex !== 'object') {
        console.error('Import failed: pdfIndex must be an object');
        throw new Error('Invalid import data: pdfIndex must be an object');
      }
      this.savePdfIndex(data.pdfIndex);
    }

    const importedActiveSessionId = typeof data.activeSessionId === 'string'
      ? data.activeSessionId.trim()
      : '';
    if (importedActiveSessionId) {
      this.setActiveSessionId(importedActiveSessionId);
      return;
    }

    const interactions = Array.isArray(data.interactions) ? data.interactions : [];
    const fallbackActiveSessionId = [...interactions]
      .sort((a, b) => Number(b?.timestamp || 0) - Number(a?.timestamp || 0))
      .map((interaction) => (typeof interaction?.sessionId === 'string' ? interaction.sessionId.trim() : ''))
      .find((session): session is string => Boolean(session));
    if (fallbackActiveSessionId) {
      this.setActiveSessionId(fallbackActiveSessionId);
      return;
    }

    this.clearActiveSession();
  }

  getConceptCoverageEvidence(learnerId: string): Map<string, ConceptCoverageEvidence> {
    const profile = this.getProfile(learnerId);
    return profile?.conceptCoverageEvidence || new Map();
  }

  getCoverageStats(learnerId: string): {
    totalConcepts: number;
    coveredCount: number;
    coveragePercentage: number;
    byConfidence: Record<'low' | 'medium' | 'high', number>;
    averageScore: number;
    // Enhanced coverage metrics
    scoreDistribution: {
      '0-25': number;
      '26-50': number;
      '51-75': number;
      '76-100': number;
    };
    totalEvidenceCount: number;
    evidenceBreakdown: {
      successfulExecution: number;
      notesAdded: number;
      explanationViewed: number;
      hintViewed: number;
      errorEncountered: number;
    };
  } {
    const profile = this.getProfile(learnerId);
    const evidenceMap = profile?.conceptCoverageEvidence || new Map();
    const totalConcepts = 6; // Based on conceptNodes array length
    const allConceptIds = ['select-basic', 'where-clause', 'joins', 'aggregation', 'subqueries', 'order-by'];
    
    let coveredCount = 0;
    let totalScore = 0;
    const byConfidence: Record<'low' | 'medium' | 'high', number> = {
      low: 0,
      medium: 0,
      high: 0
    };

    // Score distribution buckets
    const scoreDistribution = {
      '0-25': 0,
      '26-50': 0,
      '51-75': 0,
      '76-100': 0
    };

    // Evidence breakdown totals
    const evidenceBreakdown = {
      successfulExecution: 0,
      notesAdded: 0,
      explanationViewed: 0,
      hintViewed: 0,
      errorEncountered: 0
    };

    // Include ALL concepts in stats calculation, even those with no evidence
    for (const conceptId of allConceptIds) {
      const evidence = evidenceMap.get(conceptId);
      if (evidence) {
        if (evidence.score >= this.COVERAGE_THRESHOLD) {
          coveredCount++;
        }
        totalScore += evidence.score;
        byConfidence[evidence.confidence]++;
        
        // Score distribution
        if (evidence.score <= 25) scoreDistribution['0-25']++;
        else if (evidence.score <= 50) scoreDistribution['26-50']++;
        else if (evidence.score <= 75) scoreDistribution['51-75']++;
        else scoreDistribution['76-100']++;
        
        // Evidence breakdown
        evidenceBreakdown.successfulExecution += evidence.evidenceCounts.successfulExecution;
        evidenceBreakdown.notesAdded += evidence.evidenceCounts.notesAdded;
        evidenceBreakdown.explanationViewed += evidence.evidenceCounts.explanationViewed;
        evidenceBreakdown.hintViewed += evidence.evidenceCounts.hintViewed;
        evidenceBreakdown.errorEncountered += evidence.evidenceCounts.errorEncountered;
      } else {
        // Uncovered concepts count as low confidence with 0 score
        byConfidence.low++;
        scoreDistribution['0-25']++;
      }
    }

    const totalEvidenceCount = 
      evidenceBreakdown.successfulExecution +
      evidenceBreakdown.notesAdded +
      evidenceBreakdown.explanationViewed +
      evidenceBreakdown.hintViewed +
      evidenceBreakdown.errorEncountered;

    return {
      totalConcepts,
      coveredCount,
      coveragePercentage: (coveredCount / totalConcepts) * 100,
      byConfidence,
      averageScore: Math.round(totalScore / totalConcepts),
      scoreDistribution,
      totalEvidenceCount,
      evidenceBreakdown
    };
  }

  clearAll() {
    this.clearInteractions();
    this.clearActiveSession();
    localStorage.removeItem(this.PROFILES_KEY);
    localStorage.removeItem(this.TEXTBOOK_KEY);
    localStorage.removeItem(this.PRACTICE_DRAFTS_KEY);
    localStorage.removeItem(this.LLM_CACHE_KEY);
    localStorage.removeItem(this.REPLAY_MODE_KEY);
    localStorage.removeItem(this.PDF_INDEX_KEY);
  }

  private buildPracticeDraftKey(learnerId: string, sessionId: string, problemId: string): string {
    return [learnerId, sessionId, problemId].map((value) => value.trim()).join('::');
  }

  private updateProfileStatsFromEvent(event: InteractionEvent) {
    try {
      const profile = this.getProfile(event.learnerId);
      if (!profile) return;

      profile.interactionCount += 1;

      if (event.eventType === 'error') {
        const subtype = event.sqlEngageSubtype || event.errorSubtypeId;
        if (subtype) {
          const canonicalSubtype = canonicalizeSqlEngageSubtype(subtype);
          profile.errorHistory.set(
            canonicalSubtype,
            (profile.errorHistory.get(canonicalSubtype) || 0) + 1
          );
        }
      }

      // Update evidence-based coverage for all valid concept IDs in the event
      const conceptIds = this.extractConceptIdsFromEvent(event);
      if (conceptIds.length === 0) {
        console.warn(`[Storage] No valid concept IDs found for event ${event.id} (type: ${event.eventType})`);
      }
      for (const conceptId of conceptIds) {
        this.updateConceptEvidence(profile, conceptId, event);
      }

      this.saveProfile(profile);
    } catch (error) {
      // Log error but don't crash - profile stats are non-critical
      console.error('Failed to update profile stats from event:', error);
      // If profile save fails, at least log the error for debugging
      if (typeof error === 'object' && error instanceof Error) {
        console.error('Profile update error details:', {
          learnerId: event.learnerId,
          eventType: event.eventType,
          error: error.message
        });
      }
    }
  }

  /**
   * Extract and validate concept IDs from an interaction event.
   * Only returns concept IDs that exist in the SQL-Engage knowledge graph.
   */
  private extractConceptIdsFromEvent(event: InteractionEvent): string[] {
    const conceptIds = new Set<string>();

    if (event.eventType === 'error') {
      const subtype = event.sqlEngageSubtype || event.errorSubtypeId;
      if (subtype) {
        const canonicalSubtype = canonicalizeSqlEngageSubtype(subtype);
        getConceptIdsForSqlEngageSubtype(canonicalSubtype).forEach((conceptId) => {
          if (this.VALID_CONCEPT_IDS.has(conceptId)) {
            conceptIds.add(conceptId);
          }
        });
      }
    }

    for (const conceptId of event.conceptIds || []) {
      const normalized = conceptId.trim();
      if (normalized && this.VALID_CONCEPT_IDS.has(normalized)) {
        conceptIds.add(normalized);
      } else if (normalized && !this.VALID_CONCEPT_IDS.has(normalized)) {
        // Log invalid concept IDs for debugging but skip them
        console.warn(`[Storage] Skipping invalid concept ID: ${normalized}`);
      }
    }

    return Array.from(conceptIds);
  }

  private updateConceptEvidence(
    profile: LearnerProfile,
    conceptId: string,
    event: InteractionEvent
  ): void {
    const evidenceMap = profile.conceptCoverageEvidence || new Map();
    const existing = evidenceMap.get(conceptId);
    const now = Date.now();
    
    // Track if concept was already covered before this update
    const wasAlreadyCovered = profile.conceptsCovered.has(conceptId);
    
    // Deep clone to avoid mutating the original evidence object
    const evidence: ConceptCoverageEvidence = existing
      ? { 
          ...existing, 
          evidenceCounts: { ...existing.evidenceCounts }
        }
      : this.createDefaultEvidence(conceptId, now);

    // Update evidence counts based on event type
    switch (event.eventType) {
      case 'execution':
        if (event.successful) {
          evidence.evidenceCounts.successfulExecution++;
          evidence.streakCorrect++;
          evidence.streakIncorrect = 0;
        } else {
          evidence.evidenceCounts.errorEncountered++;
          evidence.streakIncorrect++;
          evidence.streakCorrect = 0;
        }
        break;
      case 'error':
        evidence.evidenceCounts.errorEncountered++;
        evidence.streakIncorrect++;
        evidence.streakCorrect = 0;
        break;
      case 'hint_view':
        evidence.evidenceCounts.hintViewed++;
        break;
      case 'explanation_view':
        evidence.evidenceCounts.explanationViewed++;
        break;
      case 'textbook_add':
      case 'textbook_update':
        evidence.evidenceCounts.notesAdded++;
        break;
    }

    // Recalculate score based on evidence
    evidence.score = this.calculateEvidenceScore(evidence);
    evidence.confidence = this.calculateConfidenceLevel(evidence);
    evidence.lastUpdated = now;

    // Add to covered set if threshold reached
    const newlyCovered = evidence.score >= this.COVERAGE_THRESHOLD && !wasAlreadyCovered;
    if (evidence.score >= this.COVERAGE_THRESHOLD) {
      profile.conceptsCovered.add(conceptId);
    }

    evidenceMap.set(conceptId, evidence);
    profile.conceptCoverageEvidence = evidenceMap;
    
    // Log coverage change event if concept is newly covered
    if (newlyCovered) {
      this.saveCoverageChangeEvent({
        learnerId: profile.id,
        problemId: event.problemId,
        conceptId,
        score: evidence.score,
        previousScore: existing?.score ?? 0,
        confidence: evidence.confidence,
        evidenceCounts: { ...evidence.evidenceCounts },
        triggerEventId: event.id,
        triggerEventType: event.eventType
      });
    }
  }

  private calculateEvidenceScore(evidence: ConceptCoverageEvidence): number {
    const counts = evidence.evidenceCounts;
    const weights = this.EVIDENCE_WEIGHTS;

    // Base score from weighted evidence
    let score = 
      counts.successfulExecution * weights.successfulExecution +
      counts.notesAdded * weights.notesAdded +
      counts.explanationViewed * weights.explanationViewed +
      counts.hintViewed * weights.hintViewed +
      counts.errorEncountered * weights.errorEncountered;

    // Streak bonuses/penalties for consistent performance
    const STREAK_BONUSES = {
      correct3Plus: 15,  // +15 for 3+ consecutive correct
      correct2: 5        // +5 for 2 consecutive correct
    };
    const STREAK_PENALTIES = {
      incorrect3Plus: -10,  // -10 for 3+ consecutive incorrect
      incorrect2: -5        // -5 for 2 consecutive incorrect (fixed missing penalty)
    };

    if (evidence.streakCorrect >= 3) {
      score += STREAK_BONUSES.correct3Plus;
    } else if (evidence.streakCorrect >= 2) {
      score += STREAK_BONUSES.correct2;
    }

    if (evidence.streakIncorrect >= 3) {
      score += STREAK_PENALTIES.incorrect3Plus;
    } else if (evidence.streakIncorrect >= 2) {
      score += STREAK_PENALTIES.incorrect2;
    }

    // Clamp to 0-100 range
    return Math.max(0, Math.min(100, score));
  }

  private calculateConfidenceLevel(evidence: ConceptCoverageEvidence): 'low' | 'medium' | 'high' {
    const totalEvidence = 
      evidence.evidenceCounts.successfulExecution +
      evidence.evidenceCounts.notesAdded +
      evidence.evidenceCounts.explanationViewed +
      evidence.evidenceCounts.hintViewed;

    // High confidence requires good score and multiple successful executions
    if (evidence.score >= this.CONFIDENCE_THRESHOLDS.high.score &&
        evidence.evidenceCounts.successfulExecution >= this.CONFIDENCE_THRESHOLDS.high.minExecutions) {
      return 'high';
    }

    // Medium confidence requires both decent score AND successful execution
    if (evidence.score >= this.CONFIDENCE_THRESHOLDS.medium.score &&
        evidence.evidenceCounts.successfulExecution >= this.CONFIDENCE_THRESHOLDS.medium.minExecutions) {
      return 'medium';
    }

    return 'low';
  }

  private normalizeStrategy(strategy: unknown): LearnerProfile['currentStrategy'] {
    if (
      strategy === 'hint-only' ||
      strategy === 'adaptive-low' ||
      strategy === 'adaptive-medium' ||
      strategy === 'adaptive-high'
    ) {
      return strategy;
    }
    return 'adaptive-medium';
  }

  private normalizeInteractionForExport(
    interaction: InteractionEvent,
    activeSessionId: string
  ): InteractionEvent {
    // Validate required fields and provide defaults for corrupted data
    const normalizedId = typeof interaction.id === 'string' && interaction.id.trim() 
      ? interaction.id.trim() 
      : `evt-fallback-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    
    const normalizedLearnerId = typeof interaction.learnerId === 'string' && interaction.learnerId.trim()
      ? interaction.learnerId.trim()
      : 'learner-unknown';
    
    const normalizedTimestamp = typeof interaction.timestamp === 'number' && Number.isFinite(interaction.timestamp)
      ? interaction.timestamp
      : Date.now();
    
    const normalizedSessionId = typeof interaction.sessionId === 'string' && interaction.sessionId.trim()
      ? interaction.sessionId.trim()
      : (activeSessionId || 'session-unknown');
    
    const normalizedProblemId = typeof interaction.problemId === 'string' && interaction.problemId.trim()
      ? interaction.problemId.trim()
      : 'problem-unknown';
    
    const validEventTypes: InteractionEvent['eventType'][] = [
      'code_change', 'execution', 'error', 'hint_request', 'hint_view',
      'explanation_view', 'llm_generate', 'pdf_index_rebuilt', 'pdf_index_uploaded',
      'textbook_add', 'textbook_update', 'coverage_change',
      // Week 3 D8: Guidance Ladder events
      'guidance_request', 'guidance_view', 'guidance_escalate',
      'textbook_unit_upsert', 'source_view'
    ];
    const normalizedEventType = validEventTypes.includes(interaction.eventType)
      ? interaction.eventType
      : 'execution';
    
    const sanitized = {
      ...interaction,
      id: normalizedId,
      learnerId: normalizedLearnerId,
      timestamp: normalizedTimestamp,
      sessionId: normalizedSessionId,
      problemId: normalizedProblemId,
      eventType: normalizedEventType
    };

    if (sanitized.eventType === 'hint_view') {
      return this.normalizeHintViewForExport(sanitized);
    }

    if (sanitized.eventType === 'textbook_add' || sanitized.eventType === 'textbook_update') {
      return this.normalizeTextbookEventForExport(sanitized);
    }

    return sanitized;
  }

  private normalizeHintViewForExport(interaction: InteractionEvent): InteractionEvent {
    const canonicalSubtype = canonicalizeSqlEngageSubtype(
      interaction.sqlEngageSubtype || interaction.errorSubtypeId || 'incomplete query'
    );
    const hintLevel = this.clampHintLevel(interaction.hintLevel);
    const rowSeed = `${interaction.learnerId}|${interaction.problemId}|${canonicalSubtype}`;
    const fallbackAnchor = getDeterministicSqlEngageAnchor(canonicalSubtype, rowSeed);
    const sqlEngageRowId = interaction.sqlEngageRowId?.trim() || fallbackAnchor.rowId;
    const policyVersion = interaction.policyVersion?.trim() || getSqlEngagePolicyVersion();

    const normalizedHintView: InteractionEvent = {
      ...interaction,
      eventType: 'hint_view',
      hintLevel,
      sqlEngageSubtype: canonicalSubtype,
      sqlEngageRowId,
      policyVersion
    };

    // Week 2 gate requires hint_view events to omit hintId.
    delete normalizedHintView.hintId;
    return normalizedHintView;
  }

  private normalizeTextbookEventForExport(interaction: InteractionEvent): InteractionEvent {
    // Ensure textbook events have all required fields for a "working prototype"
    const policyVersion = interaction.policyVersion?.trim() || 'unknown';
    const templateId = interaction.templateId?.trim() || 'unknown';
    
    // Ensure evidenceInteractionIds is set (mirror of triggerInteractionIds for clarity)
    const evidenceIds = interaction.evidenceInteractionIds 
      || interaction.triggerInteractionIds 
      || [];
    
    // Check for placeholder content
    const outputs = interaction.outputs || {};
    const hasRealContent = outputs['has_real_content'] === true || 
      (outputs['fallback_used'] === false && outputs['parse_success'] === true);
    
    // Log warning if placeholder content detected
    if (!hasRealContent) {
      console.warn(`[Export] Textbook event ${interaction.id} may contain placeholder content:`, {
        fallback_reason: outputs['fallback_reason'],
        parse_success: outputs['parse_success']
      });
    }

    return {
      ...interaction,
      eventType: interaction.eventType,
      policyVersion,
      templateId,
      evidenceInteractionIds: evidenceIds,
      triggerInteractionIds: interaction.triggerInteractionIds || evidenceIds
    };
  }

  private clampHintLevel(value: unknown): 1 | 2 | 3 {
    if (value === 1 || value === 2 || value === 3) {
      return value;
    }
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value <= 1) return 1;
      if (value >= 3) return 3;
      return 2;
    }
    return 1;
  }

  private normalizePdfIndexDocument(raw: unknown): PdfIndexDocument | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const candidate = raw as Partial<PdfIndexDocument> & {
      sourceDocs?: unknown;
      chunks?: unknown;
    };
    const sourceDocs = this.normalizePdfSourceDocs(candidate.sourceDocs, candidate.sourceName);
    if (sourceDocs.length === 0) {
      return null;
    }

    const chunks = this.normalizePdfChunks(candidate.chunks, sourceDocs[0].docId);
    if (chunks.length === 0) {
      return null;
    }

    const indexId = this.asNonEmptyString(candidate.indexId)
      || `pdf-index-${sourceDocs[0].docId}-${chunks.length}`;
    const createdAt = this.asNonEmptyString(candidate.createdAt) || new Date().toISOString();
    const schemaVersion = this.asNonEmptyString(candidate.schemaVersion) || PDF_INDEX_SCHEMA_VERSION;
    const chunkerVersion = this.asNonEmptyString(candidate.chunkerVersion) || PDF_CHUNKER_VERSION;
    const embeddingModelId = this.asNonEmptyString(candidate.embeddingModelId) || PDF_EMBEDDING_MODEL_ID;
    const sourceName = this.asNonEmptyString(candidate.sourceName)
      || (sourceDocs.length === 1 ? sourceDocs[0].filename : `${sourceDocs.length} documents`);

    return {
      indexId,
      sourceName,
      createdAt,
      schemaVersion,
      chunkerVersion,
      embeddingModelId,
      sourceDocs,
      docCount: sourceDocs.length,
      chunkCount: chunks.length,
      chunks
    };
  }

  private normalizePdfSourceDocs(rawSourceDocs: unknown, fallbackSourceName?: string): PdfSourceDoc[] {
    if (Array.isArray(rawSourceDocs) && rawSourceDocs.length > 0) {
      const normalized = rawSourceDocs
        .map((doc, index) => this.normalizePdfSourceDoc(doc, index))
        .filter((doc): doc is PdfSourceDoc => Boolean(doc));
      if (normalized.length > 0) {
        return normalized;
      }
    }

    const fallbackName = this.asNonEmptyString(fallbackSourceName) || 'unknown.pdf';
    const fallbackDocId = `legacy-${this.simpleHash(fallbackName)}`;
    return [
      {
        docId: fallbackDocId,
        filename: fallbackName,
        sha256: `legacy-${this.simpleHash(`${fallbackName}::sha`)}`,
        pageCount: 0
      }
    ];
  }

  private normalizePdfSourceDoc(rawDoc: unknown, index: number): PdfSourceDoc | null {
    if (!rawDoc || typeof rawDoc !== 'object') {
      return null;
    }

    const candidate = rawDoc as Partial<PdfSourceDoc>;
    const filename = this.asNonEmptyString(candidate.filename) || `document-${index + 1}.pdf`;
    const docId = this.asNonEmptyString(candidate.docId) || `doc-${this.simpleHash(filename)}-${index + 1}`;
    const sha256 = this.asNonEmptyString(candidate.sha256) || `legacy-${this.simpleHash(`${filename}::sha`)}`;
    const pageCount = Number(candidate.pageCount);

    return {
      docId,
      filename,
      sha256,
      pageCount: Number.isFinite(pageCount) && pageCount >= 0 ? pageCount : 0
    };
  }

  private normalizePdfChunks(rawChunks: unknown, defaultDocId: string): PdfIndexChunk[] {
    if (!Array.isArray(rawChunks) || rawChunks.length === 0) {
      return [];
    }

    return rawChunks
      .map((chunk, index) => this.normalizePdfChunk(chunk, defaultDocId, index))
      .filter((chunk): chunk is PdfIndexChunk => Boolean(chunk));
  }

  private normalizePdfChunk(rawChunk: unknown, defaultDocId: string, index: number): PdfIndexChunk | null {
    if (!rawChunk || typeof rawChunk !== 'object') {
      return null;
    }

    const candidate = rawChunk as Partial<PdfIndexChunk>;
    const text = this.asNonEmptyString(candidate.text);
    if (!text) {
      return null;
    }

    const page = Number(candidate.page);
    const normalizedPage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
    const docId = this.asNonEmptyString(candidate.docId) || defaultDocId;
    const chunkId = this.asNonEmptyString(candidate.chunkId)
      || `${docId}:p${normalizedPage}:c${index + 1}`;
    const embedding = Array.isArray(candidate.embedding)
      ? candidate.embedding
          .map((value) => Number(value))
          .filter((value) => Number.isFinite(value))
      : undefined;

    return {
      chunkId,
      docId,
      page: normalizedPage,
      text,
      embedding
    };
  }

  private asNonEmptyString(value: unknown): string {
    if (typeof value !== 'string') {
      return '';
    }
    return value.trim();
  }

  private simpleHash(value: string): string {
    let hash = 0;
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash.toString(16);
  }
}

export const storage = new StorageManager();
