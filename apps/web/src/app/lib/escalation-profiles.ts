/**
 * Escalation Profiles Module
 * 
 * Defines different escalation strategies for the adaptive learning system.
 * Each profile specifies thresholds and triggers for when to escalate learners
 * to deeper explanations or aggregate content into their textbook.
 * 
 * Policy Version: escalation-profiles-v1
 */

import type { InteractionEvent } from '../types';

/**
 * Escalation profile defining thresholds and triggers for adaptive learning
 */
export interface EscalationProfile {
  id: 'fast-escalator' | 'slow-escalator' | 'adaptive-escalator' | 'explanation-first';
  name: string;
  description: string;
  thresholds: {
    escalate: number;      // Errors before explanation
    aggregate: number;     // Errors before textbook
  };
  triggers: {
    timeStuck: number;     // ms before escalation
    rungExhausted: number; // Hint count before escalation
    repeatedError: number; // Same error count before escalation
  };
}

/**
 * Profile for learners who need quick intervention.
 * Low thresholds mean faster escalation to explanations.
 */
export const FAST_ESCALATOR: EscalationProfile = {
  id: 'fast-escalator',
  name: 'Fast Escalator',
  description: 'Quick intervention for learners who benefit from early explanations',
  thresholds: {
    escalate: 2,    // 2 errors before explanation
    aggregate: 4    // 4 errors before textbook
  },
  triggers: {
    timeStuck: 120000,      // 2 minutes
    rungExhausted: 2,       // 2 hints
    repeatedError: 1        // 1 repeat
  }
};

/**
 * Profile for learners who benefit from extended exploration.
 * High thresholds allow more self-directed problem solving.
 */
export const SLOW_ESCALATOR: EscalationProfile = {
  id: 'slow-escalator',
  name: 'Slow Escalator',
  description: 'Extended exploration for persistent, self-directed learners',
  thresholds: {
    escalate: 5,    // 5 errors before explanation
    aggregate: 8    // 8 errors before textbook
  },
  triggers: {
    timeStuck: 480000,      // 8 minutes
    rungExhausted: 4,       // 4 hints
    repeatedError: 3        // 3 repeats
  }
};

/**
 * Profile for balanced, adaptive escalation.
 * Moderate thresholds that can be adjusted based on learner behavior.
 */
export const ADAPTIVE_ESCALATOR: EscalationProfile = {
  id: 'adaptive-escalator',
  name: 'Adaptive Escalator',
  description: 'Balanced escalation that adapts to learner patterns',
  thresholds: {
    escalate: 3,    // 3 errors (base)
    aggregate: 6    // 6 errors (base)
  },
  triggers: {
    timeStuck: 300000,      // 5 minutes
    rungExhausted: 3,       // 3 hints
    repeatedError: 2        // 2 repeats
  }
};

/**
 * Profile for learners who benefit from immediate explanations.
 * Prioritizes explanations over progressive hints.
 */
export const EXPLANATION_FIRST: EscalationProfile = {
  id: 'explanation-first',
  name: 'Explanation First',
  description: 'Prioritizes explanations over progressive hints - learners get full explanations immediately',
  thresholds: {
    escalate: 1,    // Immediate escalation to explanation
    aggregate: 3,   // Quick aggregation to textbook
  },
  triggers: {
    timeStuck: 60000,      // 1 minute (quick help)
    rungExhausted: 1,      // 1 hint max
    repeatedError: 1       // 1 repeat triggers explanation
  }
};

/**
 * Registry of all escalation profiles by ID
 */
export const ESCALATION_PROFILES: Record<string, EscalationProfile> = {
  'fast-escalator': FAST_ESCALATOR,
  'slow-escalator': SLOW_ESCALATOR,
  'adaptive-escalator': ADAPTIVE_ESCALATOR,
  'explanation-first': EXPLANATION_FIRST,
};

/**
 * Strategy for assigning escalation profiles to learners
 */
export type AssignmentStrategy = 'static' | 'diagnostic' | 'bandit';

/**
 * Context for profile assignment decisions
 */
export interface AssignmentContext {
  learnerId: string;
  interactions?: InteractionEvent[];
  timestamp?: number;
  diagnosticResults?: {
    persistenceScore: number;  // 0-1, higher = more persistent
    recoveryRate: number;      // 0-1, higher = recovers faster
  };
}

/**
 * Hash a string to a numeric value for deterministic assignment
 * @param str - String to hash
 * @returns Numeric hash value (0-1)
 */
function hashString(str: string): number {
  if (!str || typeof str !== 'string') {
    return 0;
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  // Normalize to 0-1 range
  return Math.abs(hash) / 2147483647;
}

/**
 * Assign an escalation profile to a learner based on the specified strategy
 * 
 * @param context - Assignment context including learner ID and diagnostic results
 * @param strategy - Strategy for profile assignment
 * @returns Selected escalation profile
 * 
 * Strategy behaviors:
 * - 'static': Deterministically assigns based on hash of learnerId
 * - 'diagnostic': Uses persistenceScore and recoveryRate to select appropriate profile
 * - 'bandit': Returns ADAPTIVE_ESCALATOR (bandit algorithm handles selection)
 */
export function assignProfile(
  context: AssignmentContext,
  strategy: AssignmentStrategy
): EscalationProfile {
  switch (strategy) {
    case 'static': {
      // Use hash of learnerId to deterministically assign
      const hash = hashString(context.learnerId);
      if (hash < 0.33) {
        return FAST_ESCALATOR;
      } else if (hash < 0.67) {
        return ADAPTIVE_ESCALATOR;
      } else {
        return SLOW_ESCALATOR;
      }
    }
    
    case 'diagnostic': {
      // Use diagnostic results to select profile
      const { persistenceScore = 0.5, recoveryRate = 0.5 } = context.diagnosticResults || {};
      
      // High persistence + high recovery = slow escalator (can explore more)
      // Low persistence + low recovery = fast escalator (needs help sooner)
      // Mixed or moderate = adaptive escalator
      const score = (persistenceScore + recoveryRate) / 2;
      
      if (score > 0.7) {
        return SLOW_ESCALATOR;
      } else if (score < 0.3) {
        return FAST_ESCALATOR;
      } else {
        return ADAPTIVE_ESCALATOR;
      }
    }
    
    case 'bandit':
      // Bandit strategy: return adaptive escalator as base
      // The multi-armed bandit algorithm will handle dynamic selection
      return ADAPTIVE_ESCALATOR;
    
    default:
      // Default to adaptive for unknown strategies
      return ADAPTIVE_ESCALATOR;
  }
}

/**
 * Get an escalation profile by its ID
 * 
 * @param id - Profile ID
 * @returns Escalation profile or undefined if not found
 */
export function getProfileById(id: string): EscalationProfile | undefined {
  return ESCALATION_PROFILES[id];
}

/**
 * Get the escalation threshold for a profile
 * Special handling for 'explanation-first' which has threshold = 1
 * 
 * @param profileId - Profile ID
 * @returns Escalation threshold (number of hints before escalation)
 */
export function getProfileEscalationThreshold(profileId: string | undefined): number {
  if (!profileId) return 3; // Default adaptive threshold
  
  switch (profileId) {
    case 'fast-escalator': return 2;
    case 'slow-escalator': return 5;
    case 'adaptive-escalator': return 3;
    case 'explanation-first': return 1; // Immediate escalation
    default: return 3;
  }
}

/**
 * Get the current policy version for escalation profiles
 * @returns Policy version string
 */
export function getEscalationProfilesVersion(): string {
  return 'escalation-profiles-v1';
}

/**
 * Get escalation profile for a learner using specified strategy.
 * Convenience wrapper around assignProfile().
 *
 * @param learnerId - Learner identifier
 * @param interactions - Learner's interaction history
 * @param strategy - Assignment strategy ('static' | 'diagnostic' | 'bandit')
 * @returns EscalationProfile for the learner
 *
 * @example
 * ```typescript
 * const profile = getProfileForLearner('learner-123', interactions, 'diagnostic');
 * console.log(profile.name); // 'Fast Escalator'
 * ```
 */
export function getProfileForLearner(
  learnerId: string,
  interactions: InteractionEvent[] = [],
  strategy: AssignmentStrategy = 'static'
): EscalationProfile {
  const context: AssignmentContext = {
    learnerId,
    interactions,
    timestamp: Date.now(),
  };
  return assignProfile(context, strategy);
}

/**
 * Get escalation thresholds for a profile by ID.
 *
 * @param profileId - Profile identifier ('fast-escalator', 'slow-escalator', 'adaptive-escalator', 'explanation-first')
 * @returns Thresholds object or undefined if profile not found
 *
 * @example
 * ```typescript
 * const thresholds = getProfileThresholds('fast-escalator');
 * console.log(thresholds); // { escalate: 2, aggregate: 4 }
 * ```
 */
export function getProfileThresholds(
  profileId: string
): { escalate: number; aggregate: number } | undefined {
  const profile = getProfileById(profileId);
  return profile ? { ...profile.thresholds } : undefined;
}
