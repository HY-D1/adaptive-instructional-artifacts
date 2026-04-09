/**
 * Condition Assignment Module
 * 
 * Deterministic A/B test condition assignment for experimental control.
 * Ensures consistent condition assignment across sessions for the same learner.
 * 
 * Version: condition-assignment-v2
 * 
 * Session Config Redesign (Workstream 3/6):
 * - Uses sessionStorage instead of localStorage (tab-local, survives refresh, not permanent)
 * - Backend-first loading with sessionStorage fallback
 * - Safe storage writes that never crash on quota exceeded
 * - Telemetry logging for storage failures
 * 
 * @module experiments/condition-assignment
 */

import type { SessionConfig } from '../../types';
import { POLICY_IDS, getPolicyById } from '../policies/policy-definitions';
import { storageClient, isBackendAvailable } from '../api/storage-client';

/**
 * Hash a string to a numeric value for deterministic assignment
 * Uses the same algorithm as escalation-profiles.ts for consistency
 * 
 * @param str - String to hash
 * @returns Numeric hash value (0 to 2^31-1)
 */
export function hashString(str: string): number {
  if (!str || typeof str !== 'string') {
    return 0;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

/**
 * Generate a unique ID for sessions
 * 
 * @returns Unique session ID
 */
export function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generation mode for LLM quality control
 * - cheap_mode: Low reasoning effort, shorter outputs, faster/cheaper
 * - quality_mode: Medium reasoning effort, richer outputs, higher quality
 */
export type GenerationMode = 'cheap_mode' | 'quality_mode';

/**
 * Configuration options for condition assignment
 */
export interface AssignmentOptions {
  /** Array of condition IDs to choose from (defaults to all policies except no_hints) */
  availableConditions?: string[];
  /** Force a specific condition (for testing) */
  forceCondition?: string;
  /** Session creation timestamp */
  timestamp?: number;
  /** Random seed for reproducibility */
  seed?: number;
  /** Generation mode for LLM quality control */
  generationMode?: GenerationMode;
  /** Force specific generation mode (for testing) */
  forceGenerationMode?: GenerationMode;
}

/**
 * Assign a condition to a learner based on their learnerId.
 * This assignment is deterministic - the same learnerId will always
 * receive the same condition, ensuring consistency across sessions.
 * 
 * The function balances groups using a hash-based approach that distributes
 * learners evenly across conditions while maintaining consistency.
 * 
 * @param learnerId - Unique learner identifier
 * @param options - Assignment options
 * @returns Session configuration with assigned condition
 * 
 * @example
 * ```typescript
 * // Standard assignment
 * const config = assignCondition('learner-123');
 * 
 * // Force specific condition for testing
 * const config = assignCondition('test-user', { forceCondition: 'aggressive' });
 * 
 * // Custom condition pool
 * const config = assignCondition('learner-456', { 
 *   availableConditions: ['aggressive', 'conservative'] 
 * });
 * ```
 */
export function assignCondition(
  learnerId: string,
  options: AssignmentOptions = {}
): SessionConfig {
  const {
    availableConditions = ['aggressive', 'conservative', 'adaptive'],
    forceCondition,
    timestamp = Date.now(),
    seed = 0,
    generationMode,
    forceGenerationMode
  } = options;

  // Determine condition
  let conditionId: string;

  if (forceCondition) {
    // Force specific condition (for testing) - bypasses available conditions check
    conditionId = forceCondition;
  } else {
    // Deterministic assignment based on hash
    const hash = hashString(learnerId) + seed;
    const index = hash % availableConditions.length;
    conditionId = availableConditions[index];
  }

  // Determine generation mode
  let assignedGenerationMode: GenerationMode;
  if (forceGenerationMode) {
    assignedGenerationMode = forceGenerationMode;
  } else if (generationMode) {
    assignedGenerationMode = generationMode;
  } else {
    // Deterministic assignment based on hash (separate from condition assignment)
    const hash = hashString(learnerId + '-generation') + seed;
    assignedGenerationMode = hash % 2 === 0 ? 'cheap_mode' : 'quality_mode';
  }

  // Get policy to determine toggle settings
  const policy = getPolicyById(conditionId);

  // Determine toggle settings based on condition
  const toggles = calculateToggles(conditionId, policy?.hintsEnabled ?? true);

  return {
    sessionId: generateSessionId(),
    learnerId,
    escalationPolicy: conditionId as SessionConfig['escalationPolicy'],
    ...toggles,
    conditionId,
    generationMode: assignedGenerationMode,
    createdAt: timestamp
  };
}

/**
 * Calculate toggle flags based on condition and policy
 */
function calculateToggles(
  conditionId: string,
  hintsEnabled: boolean
): Pick<SessionConfig, 'textbookDisabled' | 'adaptiveLadderDisabled' | 'immediateExplanationMode' | 'staticHintMode'> {
  switch (conditionId) {
    case 'explanation_first':
      return {
        textbookDisabled: true,  // No textbook in explanation-first (direct explanations)
        adaptiveLadderDisabled: true,
        immediateExplanationMode: true,
        staticHintMode: false
      };
      
    case 'conservative':
      return {
        textbookDisabled: false,
        adaptiveLadderDisabled: true,  // Conservative uses static ladder
        immediateExplanationMode: false,
        staticHintMode: true
      };
      
    case 'aggressive':
      return {
        textbookDisabled: false,
        adaptiveLadderDisabled: false,
        immediateExplanationMode: false,
        staticHintMode: false
      };
      
    case 'adaptive':
      return {
        textbookDisabled: false,
        adaptiveLadderDisabled: false,
        immediateExplanationMode: false,
        staticHintMode: false
      };
      
    case 'no_hints':
      return {
        textbookDisabled: false, // Textbook still available as reference
        adaptiveLadderDisabled: true,
        immediateExplanationMode: false,
        staticHintMode: false
      };
      
    default:
      return {
        textbookDisabled: false,
        adaptiveLadderDisabled: false,
        immediateExplanationMode: false,
        staticHintMode: false
      };
  }
}

/**
 * Reconstruct session config from existing session data.
 * Useful when resuming sessions or validating existing configurations.
 * 
 * @param existingConfig - Partial session config to reconstruct from
 * @returns Complete session config with defaults filled in
 */
export function reconstructSessionConfig(
  existingConfig: Partial<SessionConfig>
): SessionConfig {
  const learnerId = existingConfig.learnerId || 'unknown';
  const timestamp = existingConfig.createdAt || Date.now();
  
  // If we have a conditionId, trust it; otherwise re-assign
  const conditionId = existingConfig.conditionId;
  
  if (conditionId) {
    const policy = getPolicyById(conditionId);
    const toggles = calculateToggles(conditionId, policy?.hintsEnabled ?? true);
    
    return {
      sessionId: existingConfig.sessionId || generateSessionId(),
      learnerId,
      escalationPolicy: existingConfig.escalationPolicy || (conditionId as SessionConfig['escalationPolicy']),
      textbookDisabled: existingConfig.textbookDisabled ?? toggles.textbookDisabled,
      adaptiveLadderDisabled: existingConfig.adaptiveLadderDisabled ?? toggles.adaptiveLadderDisabled,
      immediateExplanationMode: existingConfig.immediateExplanationMode ?? toggles.immediateExplanationMode,
      staticHintMode: existingConfig.staticHintMode ?? toggles.staticHintMode,
      conditionId,
      createdAt: timestamp
    };
  }
  
  // Re-assign if no conditionId
  return assignCondition(learnerId, { timestamp });
}

/**
 * Get condition distribution statistics for a set of learners.
 * Useful for verifying balanced assignment before running experiments.
 * 
 * @param learnerIds - Array of learner IDs
 * @param conditions - Array of condition IDs to distribute across
 * @returns Distribution statistics
 */
export function getConditionDistribution(
  learnerIds: string[],
  conditions: string[] = ['aggressive', 'conservative', 'adaptive']
): {
  distribution: Record<string, number>;
  percentages: Record<string, number>;
  isBalanced: boolean;
  chiSquare: number;
} {
  const distribution: Record<string, number> = {};
  conditions.forEach(c => distribution[c] = 0);
  
  learnerIds.forEach(id => {
    const hash = hashString(id);
    const index = hash % conditions.length;
    const condition = conditions[index];
    distribution[condition] = (distribution[condition] || 0) + 1;
  });
  
  // Calculate percentages
  const total = learnerIds.length;
  const percentages: Record<string, number> = {};
  conditions.forEach(c => {
    percentages[c] = total > 0 ? (distribution[c] / total) * 100 : 0;
  });
  
  // Chi-square test for balance (expected = equal distribution)
  const expected = total / conditions.length;
  const chiSquare = conditions.reduce((sum, c) => {
    const observed = distribution[c];
    return sum + Math.pow(observed - expected, 2) / expected;
  }, 0);
  
  // Consider balanced if chi-square < critical value (df=2, alpha=0.05 = 5.991)
  const isBalanced = chiSquare < 5.991;
  
  return { distribution, percentages, isBalanced, chiSquare };
}

/**
 * Validate that a session configuration is complete and valid.
 * 
 * @param config - Session configuration to validate
 * @returns Validation result with any errors
 */
export function validateSessionConfig(config: SessionConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  if (!config.sessionId) {
    errors.push('Missing sessionId');
  }
  
  if (!config.learnerId) {
    errors.push('Missing learnerId');
  }
  
  if (!config.conditionId) {
    errors.push('Missing conditionId');
  }
  
  if (!POLICY_IDS.includes(config.escalationPolicy)) {
    errors.push(`Invalid escalationPolicy: ${config.escalationPolicy}`);
  }
  
  if (!config.createdAt || config.createdAt <= 0) {
    errors.push('Invalid createdAt timestamp');
  }
  
  // Validate consistency between conditionId and escalationPolicy
  if (config.conditionId && config.conditionId !== config.escalationPolicy) {
    errors.push('conditionId does not match escalationPolicy');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get all available experimental conditions.
 * Excludes the no_hints control condition from active experiments.
 * 
 * @returns Array of experimental condition IDs
 */
export function getExperimentalConditions(): string[] {
  return POLICY_IDS.filter(id => id !== 'no_hints');
}

/**
 * Get version of the condition assignment module.
 */
export function getConditionAssignmentVersion(): string {
  return 'condition-assignment-v2';
}

// ============================================================================
// Session Config Persistence (Redesigned Workstream 3/6)
// ============================================================================

/**
 * Storage key for session config in sessionStorage
 * Changed from localStorage to sessionStorage for tab-local persistence
 */
export const SESSION_CONFIG_STORAGE_KEY = 'sql-adapt-session-config';

/**
 * Legacy storage key for migration (localStorage)
 * @deprecated Used only for one-time migration from localStorage
 */
const LEGACY_SESSION_CONFIG_KEY = 'sql-adapt-session-config-local';

/**
 * Telemetry event for storage failures
 */
interface StorageFailureEvent {
  type: 'session_config_storage_failure';
  operation: 'save' | 'load' | 'clear';
  error: string;
  timestamp: number;
  storageType: 'sessionStorage' | 'localStorage' | 'backend';
}

/**
 * Log storage failure for telemetry/monitoring
 * Never throws - always fails silently
 */
function logStorageFailure(
  operation: 'save' | 'load' | 'clear',
  error: unknown,
  storageType: 'sessionStorage' | 'localStorage' | 'backend'
): void {
  try {
    const event: StorageFailureEvent = {
      type: 'session_config_storage_failure',
      operation,
      error: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      storageType,
    };
    
    // Log to console for development/debugging
    console.warn(`[SessionConfig] Storage failure (${storageType}/${operation}):`, event.error);
    
    // Emit custom event for telemetry subscribers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('session_config_storage_failure', { detail: event }));
    }
  } catch {
    // Absolute last resort - never crash
  }
}

/**
 * Check if a DOMException is a QuotaExceededError
 */
function isQuotaExceededError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'QuotaExceededError';
}

/**
 * Safely write to sessionStorage with quota handling
 */
function safeSessionStorageWrite(key: string, value: string): { success: boolean; quotaExceeded?: boolean } {
  try {
    sessionStorage.setItem(key, value);
    return { success: true };
  } catch (error) {
    if (isQuotaExceededError(error)) {
      logStorageFailure('save', error, 'sessionStorage');
      return { success: false, quotaExceeded: true };
    }
    logStorageFailure('save', error, 'sessionStorage');
    return { success: false };
  }
}

/**
 * Save session config to storage
 * 
 * Redesigned (v2):
 * - Primary: sessionStorage (tab-local, survives refresh, not permanent)
 * - Never throws - always returns success status
 * - Logs failures for telemetry
 * 
 * @param config - Session configuration to save
 * @returns Success status and quota exceeded flag
 */
export function saveSessionConfig(config: SessionConfig): { success: boolean; quotaExceeded?: boolean } {
  // Always validate first
  const validation = validateSessionConfig(config);
  if (!validation.valid) {
    logStorageFailure('save', `Validation failed: ${validation.errors.join(', ')}`, 'sessionStorage');
    return { success: false };
  }
  
  // Primary: sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    const result = safeSessionStorageWrite(SESSION_CONFIG_STORAGE_KEY, JSON.stringify(config));
    if (result.success) {
      return result;
    }
    // If quota exceeded, don't try localStorage - just fail gracefully
    if (result.quotaExceeded) {
      return result;
    }
  }
  
  return { success: false };
}

/**
 * Load session config from storage
 * 
 * Redesigned (v2):
 * - Primary: sessionStorage (tab-local)
 * - Validates loaded config
 * - Returns null if invalid or not found
 * - Clears corrupted/invalid data
 * - Never throws
 * 
 * @returns Session configuration or null if not found/invalid
 */
export function loadSessionConfig(): SessionConfig | null {
  // Primary: sessionStorage
  if (typeof sessionStorage !== 'undefined') {
    try {
      const stored = sessionStorage.getItem(SESSION_CONFIG_STORAGE_KEY);
      if (stored) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(stored);
        } catch (parseError) {
          // Corrupted JSON - clear it
          logStorageFailure('load', parseError, 'sessionStorage');
          safeClearSessionConfig();
          return null;
        }
        
        const validated = validateSessionConfig(parsed as SessionConfig);
        if (validated.valid) {
          return parsed as SessionConfig;
        }
        // Invalid config - clear it
        safeClearSessionConfig();
      }
    } catch (error) {
      logStorageFailure('load', error, 'sessionStorage');
    }
  }
  
  return null;
}

/**
 * Clear session config from all storage
 * 
 * Redesigned (v2):
 * - Clears from sessionStorage (primary)
 * - Never throws
 * 
 * @returns Success status
 */
export function safeClearSessionConfig(): boolean {
  let success = true;
  
  // Clear sessionStorage (primary)
  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_CONFIG_STORAGE_KEY);
    } catch (error) {
      logStorageFailure('clear', error, 'sessionStorage');
      success = false;
    }
  }
  
  // Also clear legacy localStorage if present
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.removeItem(SESSION_CONFIG_STORAGE_KEY);
      localStorage.removeItem(LEGACY_SESSION_CONFIG_KEY);
    } catch (error) {
      logStorageFailure('clear', error, 'localStorage');
      success = false;
    }
  }
  
  return success;
}

// ============================================================================
// Async Backend Session Loading (Workstream 3/6)
// ============================================================================

/**
 * Result from loading session config with backend priority
 */
export interface SessionLoadResult {
  /** The loaded or assigned session config */
  config: SessionConfig;
  /** Source of the session config */
  source: 'backend' | 'sessionStorage' | 'assigned';
  /** Whether a new condition was assigned */
  isNewAssignment: boolean;
}

/**
 * Session data from backend (subset for condition assignment)
 */
interface BackendSessionData {
  sessionId?: string;
  conditionId?: string;
  escalationPolicy?: SessionConfig['escalationPolicy'];
  textbookDisabled?: boolean;
  adaptiveLadderDisabled?: boolean;
  immediateExplanationMode?: boolean;
  staticHintMode?: boolean;
  generationMode?: GenerationMode;
  startTime?: string;
}

/**
 * Load session config with backend-first priority
 * 
 * Redesigned boot sequence (v2):
 * 1. Try load from backend learner_sessions first (most durable)
 * 2. Else recover from sessionStorage
 * 3. Else assign new condition via assignCondition()
 * 
 * Condition assignment remains deterministic (same learnerId → same condition)
 * 
 * @param learnerId - Current learner ID
 * @returns Promise resolving to session config and load metadata
 */
export async function loadSessionConfigAsync(
  learnerId: string
): Promise<SessionLoadResult> {
  // Try backend first (most durable)
  if (isBackendAvailable()) {
    try {
      const backendSession = await storageClient.getSession(learnerId);
      if (backendSession && isValidBackendSession(backendSession, learnerId)) {
        const config = convertBackendSessionToConfig(backendSession, learnerId);
        
        // Also save to sessionStorage for tab-local recovery
        saveSessionConfig(config);
        
        return {
          config,
          source: 'backend',
          isNewAssignment: false,
        };
      }
    } catch (error) {
      logStorageFailure('load', error, 'backend');
    }
  }
  
  // Fallback: sessionStorage
  const storedConfig = loadSessionConfig();
  if (storedConfig && storedConfig.learnerId === learnerId) {
    return {
      config: storedConfig,
      source: 'sessionStorage',
      isNewAssignment: false,
    };
  }
  
  // Final fallback: assign new condition
  // assignCondition is deterministic - same learnerId always gets same condition
  const newConfig = assignCondition(learnerId);
  
  // Save to sessionStorage (best effort - don't block on failure)
  saveSessionConfig(newConfig);
  
  return {
    config: newConfig,
    source: 'assigned',
    isNewAssignment: true,
  };
}

/**
 * Check if backend session data is valid and belongs to current learner
 */
function isValidBackendSession(
  session: BackendSessionData,
  expectedLearnerId: string
): boolean {
  // Must have a conditionId to be valid
  if (!session.conditionId) {
    return false;
  }
  
  // Must have valid escalation policy
  if (!session.escalationPolicy || !POLICY_IDS.includes(session.escalationPolicy)) {
    return false;
  }
  
  return true;
}

/**
 * Convert backend session data to SessionConfig
 */
function convertBackendSessionToConfig(
  session: BackendSessionData,
  learnerId: string
): SessionConfig {
  // Generate new session ID if not provided
  const sessionId = session.sessionId || generateSessionId();
  
  // Use backend values with sensible defaults
  const conditionId = session.conditionId || 'adaptive';
  // Ensure escalationPolicy is a valid policy ID
  const escalationPolicy = (session.escalationPolicy && POLICY_IDS.includes(session.escalationPolicy))
    ? session.escalationPolicy
    : (conditionId as SessionConfig['escalationPolicy']);
  
  const policy = getPolicyById(conditionId);
  const defaultToggles = calculateToggles(conditionId, policy?.hintsEnabled ?? true);
  
  return {
    sessionId,
    learnerId,
    conditionId,
    escalationPolicy,
    textbookDisabled: session.textbookDisabled ?? defaultToggles.textbookDisabled,
    adaptiveLadderDisabled: session.adaptiveLadderDisabled ?? defaultToggles.adaptiveLadderDisabled,
    immediateExplanationMode: session.immediateExplanationMode ?? defaultToggles.immediateExplanationMode,
    staticHintMode: session.staticHintMode ?? defaultToggles.staticHintMode,
    generationMode: session.generationMode || 'quality_mode',
    createdAt: session.startTime ? new Date(session.startTime).getTime() : Date.now(),
  };
}

/**
 * Legacy clear function (alias for safeClearSessionConfig)
 * @deprecated Use safeClearSessionConfig instead
 */
export function clearSessionConfig(): boolean {
  return safeClearSessionConfig();
}
