/**
 * Condition Assignment Module
 * 
 * Deterministic A/B test condition assignment for experimental control.
 * Ensures consistent condition assignment across sessions for the same learner.
 * 
 * Version: condition-assignment-v1
 * 
 * @module experiments/condition-assignment
 */

import type { SessionConfig } from '../../types';
import { POLICY_IDS, getPolicyById } from '../policies/policy-definitions';

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
    seed = 0
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
  return 'condition-assignment-v1';
}

/**
 * Storage key for session config in LocalStorage
 */
export const SESSION_CONFIG_STORAGE_KEY = 'sql-adapt-session-config';

/**
 * Save session config to storage
 * 
 * @param config - Session configuration to save
 */
export function saveSessionConfig(config: SessionConfig): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(SESSION_CONFIG_STORAGE_KEY, JSON.stringify(config));
  }
}

/**
 * Load session config from storage
 * 
 * @returns Session configuration or null if not found
 */
export function loadSessionConfig(): SessionConfig | null {
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem(SESSION_CONFIG_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const validated = validateSessionConfig(parsed);
        if (validated.valid) {
          return parsed;
        }
      } catch {
        // Invalid JSON, return null
      }
    }
  }
  return null;
}

/**
 * Clear session config from storage
 */
export function clearSessionConfig(): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem(SESSION_CONFIG_STORAGE_KEY);
  }
}
