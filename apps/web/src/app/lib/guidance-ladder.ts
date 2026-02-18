/**
 * Guidance Ladder State Machine (Week 3 D4)
 * 
 * Deterministic ladder controller for progressive instructional support:
 * - Rung 1: Micro-hint (brief, contextual)
 * - Rung 2: Explanation (structured, source-grounded)
 * - Rung 3: Reflective note (My Textbook unit upsert)
 */

import type { InteractionEvent } from '../types';
import { canAutoEscalate, getTextbookConceptIdsForSubtype } from '../data';

// Rung definitions with strict boundaries
export type GuidanceRung = 1 | 2 | 3;

export const RUNG_DEFINITIONS = {
  1: {
    name: 'Micro-hint',
    description: 'Brief, contextual nudge pointing toward the solution',
    maxLength: 150, // characters
    mustInclude: ['contextual_clue'],
    mustNotInclude: ['full_explanation', 'step_by_step', 'concept_definition'],
    examples: [
      'Check your FROM clause - is the table name spelled correctly?',
      'Remember: columns in GROUP BY must match SELECT non-aggregates.'
    ]
  },
  2: {
    name: 'Explanation',
    description: 'Structured guidance with source grounding',
    maxLength: 800, // characters
    mustInclude: ['concept_reference', 'source_citation'],
    mustNotInclude: ['full_solution', 'copy_paste_answer'],
    examples: [
      'The JOIN requires an ON clause to specify how tables relate (see textbook p.78). Without this, you get a Cartesian product.'
    ]
  },
  3: {
    name: 'Reflective Note',
    description: 'My Textbook unit with concept tags and provenance',
    maxLength: 2000, // characters
    mustInclude: ['concept_tags', 'source_refs', 'summary', 'common_mistakes', 'minimal_example'],
    mustNotInclude: [], // Can include everything at this level
    examples: [
      'Complete unit for JOIN conditions with examples, mistakes, and sources.'
    ]
  }
} as const;

// Escalation trigger types
export type EscalationTrigger = 
  | 'learner_request'           // User explicitly clicked "Get More Help"
  | 'rung_exhausted'            // Reached max hints at current rung
  | 'repeated_error'            // Same error subtype after help
  | 'time_stuck'                // > 5 minutes without progress
  | 'hint_reopened'             // Re-opened help after dismissal
  | 'auto_escalation_eligible'; // System detected struggle pattern

// Trigger conditions with thresholds
export const TRIGGER_CONDITIONS = {
  rung_exhausted: {
    description: 'Max hints at current rung reached',
    threshold: { rung1: 3, rung2: 2 } // After 3 hints at rung 1, or 2 at rung 2
  },
  repeated_error: {
    description: 'Same error subtype within last 3 attempts',
    threshold: { sameSubtypeCount: 2 }
  },
  time_stuck: {
    description: 'No successful execution for time threshold',
    threshold: { milliseconds: 5 * 60 * 1000 } // 5 minutes
  },
  hint_reopened: {
    description: 'Help requested again after dismissal',
    threshold: { reopenCount: 1 }
  }
} as const;

// State machine state
export type GuidanceLadderState = {
  learnerId: string;
  problemId: string;
  currentRung: GuidanceRung;
  rungAttempts: Record<GuidanceRung, number>; // How many times at each rung
  lastEscalationTrigger?: EscalationTrigger;
  lastEscalationTimestamp?: number;
  escalationHistory: Array<{
    fromRung: GuidanceRung;
    toRung: GuidanceRung;
    trigger: EscalationTrigger;
    timestamp: number;
    evidence: {
      errorSubtypeId?: string;
      errorCount: number;
      timeSpentMs: number;
      hintCount: number;
    };
  }>;
  currentConceptIds: string[];
  groundedInSources: boolean;
};

// Initial state factory
export function createInitialLadderState(
  learnerId: string,
  problemId: string
): GuidanceLadderState {
  return {
    learnerId,
    problemId,
    currentRung: 1,
    rungAttempts: { 1: 0, 2: 0, 3: 0 },
    escalationHistory: [],
    currentConceptIds: [],
    groundedInSources: false
  };
}

// Check if escalation is allowed (must have trigger)
export function canEscalate(
  state: GuidanceLadderState,
  trigger: EscalationTrigger,
  interactions: InteractionEvent[]
): { allowed: boolean; reason: string; evidence?: Record<string, unknown> } {
  // Already at max rung
  if (state.currentRung >= 3) {
    return { allowed: false, reason: 'Already at maximum rung (3)' };
  }

  // Check trigger-specific conditions
  const problemInteractions = interactions.filter(
    (i) => i.problemId === state.problemId
  );

  switch (trigger) {
    case 'learner_request':
      // Always allowed on explicit request
      return { allowed: true, reason: 'Learner explicitly requested escalation' };

    case 'rung_exhausted': {
      const currentAttempts = state.rungAttempts[state.currentRung];
      const threshold = state.currentRung === 1 
        ? TRIGGER_CONDITIONS.rung_exhausted.threshold.rung1 
        : TRIGGER_CONDITIONS.rung_exhausted.threshold.rung2;
      
      if (currentAttempts >= threshold) {
        return {
          allowed: true,
          reason: `Rung ${state.currentRung} exhausted (${currentAttempts} >= ${threshold})`,
          evidence: { currentAttempts, threshold }
        };
      }
      return {
        allowed: false,
        reason: `Rung ${state.currentRung} not yet exhausted (${currentAttempts} < ${threshold})`
      };
    }

    case 'repeated_error': {
      const recentErrors = problemInteractions
        .filter((i) => i.eventType === 'error')
        .slice(-3);
      
      if (recentErrors.length < 2) {
        return { allowed: false, reason: 'Not enough recent errors to detect pattern' };
      }

      const subtypeCounts = new Map<string, number>();
      for (const error of recentErrors) {
        const subtype = error.sqlEngageSubtype || error.errorSubtypeId || 'unknown';
        subtypeCounts.set(subtype, (subtypeCounts.get(subtype) || 0) + 1);
      }

      const hasRepeatedSubtype = Array.from(subtypeCounts.values()).some(
        (count) => count >= TRIGGER_CONDITIONS.repeated_error.threshold.sameSubtypeCount
      );

      if (hasRepeatedSubtype) {
        return {
          allowed: true,
          reason: 'Same error subtype repeated within last 3 attempts',
          evidence: { subtypeCounts: Object.fromEntries(subtypeCounts) }
        };
      }
      return { allowed: false, reason: 'No repeated error subtype detected' };
    }

    case 'time_stuck': {
      const successfulExecs = problemInteractions.filter(
        (i) => i.eventType === 'execution' && i.successful
      );
      
      if (successfulExecs.length > 0) {
        return { allowed: false, reason: 'Successful execution found - not stuck' };
      }

      const firstInteraction = problemInteractions[0];
      if (!firstInteraction) {
        return { allowed: false, reason: 'No interactions recorded' };
      }

      const timeSpent = Date.now() - firstInteraction.timestamp;
      const threshold = TRIGGER_CONDITIONS.time_stuck.threshold.milliseconds;

      if (timeSpent >= threshold) {
        return {
          allowed: true,
          reason: `No success for ${Math.round(timeSpent / 1000)}s (threshold: ${threshold / 1000}s)`,
          evidence: { timeSpentMs: timeSpent, thresholdMs: threshold }
        };
      }
      return {
        allowed: false,
        reason: `Only ${Math.round(timeSpent / 1000)}s elapsed (threshold: ${threshold / 1000}s)`
      };
    }

    case 'hint_reopened': {
      const hintRequests = problemInteractions.filter(
        (i) => i.eventType === 'hint_request' || i.eventType === 'hint_view'
      );
      
      // Check if help was reopened after being dismissed
      const lastHintDismissal = [...problemInteractions]
        .reverse()
        .find((i) => i.eventType === 'hint_dismiss' || i.eventType === 'help_close');
      
      const reopenedAfterDismissal = lastHintDismissal && 
        hintRequests.some((h) => h.timestamp > lastHintDismissal.timestamp);

      if (reopenedAfterDismissal) {
        return {
          allowed: true,
          reason: 'Help reopened after previous dismissal'
        };
      }
      return { allowed: false, reason: 'Help not reopened after dismissal' };
    }

    case 'auto_escalation_eligible': {
      // Check if current error subtype is eligible for auto-escalation
      const lastError = [...problemInteractions]
        .reverse()
        .find((i) => i.eventType === 'error');
      
      const subtype = lastError?.sqlEngageSubtype || lastError?.errorSubtypeId;
      
      if (subtype && canAutoEscalate(subtype)) {
        return {
          allowed: true,
          reason: `Auto-escalation eligible subtype: ${subtype}`,
          evidence: { subtype, verified: true }
        };
      }
      
      if (subtype) {
        return {
          allowed: false,
          reason: `Subtype ${subtype} not verified for auto-escalation`,
          evidence: { subtype, verified: false }
        };
      }
      return { allowed: false, reason: 'No error subtype to evaluate' };
    }

    default:
      return { allowed: false, reason: 'Unknown trigger type' };
  }
}

// Perform escalation
export function escalate(
  state: GuidanceLadderState,
  trigger: EscalationTrigger,
  evidence: {
    errorSubtypeId?: string;
    errorCount: number;
    timeSpentMs: number;
    hintCount: number;
  },
  conceptIds: string[]
): GuidanceLadderState {
  if (state.currentRung >= 3) {
    return state; // Cannot escalate beyond rung 3
  }

  const fromRung = state.currentRung;
  const toRung = (fromRung + 1) as GuidanceRung;
  const timestamp = Date.now();

  return {
    ...state,
    currentRung: toRung,
    lastEscalationTrigger: trigger,
    lastEscalationTimestamp: timestamp,
    currentConceptIds: conceptIds,
    groundedInSources: toRung >= 2, // Rungs 2+ must be grounded
    escalationHistory: [
      ...state.escalationHistory,
      {
        fromRung,
        toRung,
        trigger,
        timestamp,
        evidence
      }
    ]
  };
}

// Record an attempt at current rung
export function recordRungAttempt(state: GuidanceLadderState): GuidanceLadderState {
  return {
    ...state,
    rungAttempts: {
      ...state.rungAttempts,
      [state.currentRung]: state.rungAttempts[state.currentRung] + 1
    }
  };
}

// Validate content against rung boundaries
export function validateContentForRung(
  content: string,
  rung: GuidanceRung
): { valid: boolean; violations: string[] } {
  const definition = RUNG_DEFINITIONS[rung];
  const violations: string[] = [];

  // Length check
  if (content.length > definition.maxLength) {
    violations.push(
      `Content length (${content.length}) exceeds rung ${rung} maximum (${definition.maxLength})`
    );
  }

  // Rung 1 specific checks
  if (rung === 1) {
    // Check for explanation-length content indicators
    const explanationIndicators = [
      /\b(because|since|therefore|this is why)\b/i,
      /\b(step|first|second|third|finally)\b/i,
      /\b(concept|definition|means|refers to)\b/i,
      /[.!?]\s+[A-Z].{20,}[.!?]/ // Multiple sentences
    ];

    for (const pattern of explanationIndicators) {
      if (pattern.test(content) && content.length > 100) {
        violations.push('Rung 1 content appears to contain explanation-length material');
        break;
      }
    }
  }

  // Rung 2 specific checks
  if (rung === 2) {
    // Should have some source reference
    const hasSourceRef = /\b(page|chapter|see|source|textbook|according to)\b/i.test(content);
    if (!hasSourceRef && content.length > 200) {
      violations.push('Rung 2 content should cite sources (page, chapter, etc.)');
    }
  }

  return { valid: violations.length === 0, violations };
}

// Get current rung info
export function getCurrentRungInfo(state: GuidanceLadderState) {
  return {
    rung: state.currentRung,
    name: RUNG_DEFINITIONS[state.currentRung].name,
    attemptsAtRung: state.rungAttempts[state.currentRung],
    canEscalateTo: state.currentRung < 3 ? (state.currentRung + 1) as GuidanceRung : null,
    groundedInSources: state.groundedInSources || state.currentRung >= 2
  };
}

// Determine next action based on state and interactions
export function determineNextAction(
  state: GuidanceLadderState,
  interactions: InteractionEvent[]
): {
  action: 'stay' | 'escalate' | 'aggregate';
  rung: GuidanceRung;
  trigger?: EscalationTrigger;
  reason: string;
} {
  // Check for explicit learner escalation request
  const lastInteraction = interactions[interactions.length - 1];
  if (lastInteraction?.eventType === 'explanation_view' || 
      lastInteraction?.metadata?.escalationRequested) {
    const canEsc = canEscalate(state, 'learner_request', interactions);
    if (canEsc.allowed) {
      return {
        action: 'escalate',
        rung: (state.currentRung + 1) as GuidanceRung,
        trigger: 'learner_request',
        reason: canEsc.reason
      };
    }
  }

  // Check rung exhaustion
  const rungExhausted = canEscalate(state, 'rung_exhausted', interactions);
  if (rungExhausted.allowed) {
    return {
      action: 'escalate',
      rung: (state.currentRung + 1) as GuidanceRung,
      trigger: 'rung_exhausted',
      reason: rungExhausted.reason
    };
  }

  // Check repeated errors
  const repeatedError = canEscalate(state, 'repeated_error', interactions);
  if (repeatedError.allowed) {
    return {
      action: 'escalate',
      rung: (state.currentRung + 1) as GuidanceRung,
      trigger: 'repeated_error',
      reason: repeatedError.reason
    };
  }

  // Check time stuck
  const timeStuck = canEscalate(state, 'time_stuck', interactions);
  if (timeStuck.allowed) {
    return {
      action: 'escalate',
      rung: (state.currentRung + 1) as GuidanceRung,
      trigger: 'time_stuck',
      reason: timeStuck.reason
    };
  }

  // Check auto-escalation eligibility
  const autoEligible = canEscalate(state, 'auto_escalation_eligible', interactions);
  if (autoEligible.allowed) {
    return {
      action: 'escalate',
      rung: (state.currentRung + 1) as GuidanceRung,
      trigger: 'auto_escalation_eligible',
      reason: autoEligible.reason
    };
  }

  // Default: stay at current rung
  return {
    action: 'stay',
    rung: state.currentRung,
    reason: 'No escalation triggers met'
  };
}
