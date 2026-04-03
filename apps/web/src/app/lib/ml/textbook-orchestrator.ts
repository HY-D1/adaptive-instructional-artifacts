/**
 * textbook-orchestrator.ts
 *
 * Deterministic, condition-aware orchestration function for adaptive textbook
 * escalation decisions.
 *
 * This is the single decision point that:
 *  - Reads session-level condition flags (staticHintMode, textbookDisabled, etc.)
 *  - Considers learner struggle signals (retryCount, hintCount, elapsedMs)
 *  - Resolves the internal concept ID to a stable corpus key via the compatibility map
 *  - Returns one typed action: stay_hint | show_explanation | upsert_textbook_unit |
 *    prompt_reflective_note
 *
 * Pure function — no side effects, fully testable and replay-safe.
 *
 * ESCALATION THRESHOLDS (adaptive mode)
 * ──────────────────────────────────────
 * stay_hint            default (early phase)
 * show_explanation     hintCount >= 1 AND retryCount >= 2
 * upsert_textbook_unit hintCount >= 3 OR retryCount >= 4 OR elapsedMs >= 120_000
 * prompt_reflective_note hintCount >= 6 OR elapsedMs >= 300_000
 *
 * CONDITIONS AND THEIR CEILINGS
 * ──────────────────────────────
 * staticHintMode          → always stay_hint (baseline control)
 * immediateExplanationMode → jump to show_explanation on first retry
 * textbookDisabled         → ceiling is show_explanation (no textbook units)
 * adaptiveLadderDisabled   → static thresholds, no time-based escalation
 * (none)                   → fully adaptive, all 4 actions available
 */

import { CONCEPT_COMPATIBILITY_MAP } from '../content/concept-compatibility-map';
import type { InteractionEvent } from '../../types';

// ── Types ─────────────────────────────────────────────────────────────────────

export type OrchestrationAction =
  | 'stay_hint'
  | 'show_explanation'
  | 'upsert_textbook_unit'
  | 'prompt_reflective_note';

/** Condition toggles extracted from SessionConfig */
export interface SessionConditionFlags {
  textbookDisabled: boolean;
  adaptiveLadderDisabled: boolean;
  immediateExplanationMode: boolean;
  staticHintMode: boolean;
}

/** All inputs for a single orchestration decision */
export interface OrchestrationContext {
  /** Internal adaptive concept ID (e.g. 'joins', 'where-clause') */
  conceptId: string;
  /** SQL-Engage or internal error subtype (used for trigger reason label) */
  errorSubtype?: string;
  /** Number of execution attempts on this problem so far */
  retryCount: number;
  /** Number of hints already consumed by the learner */
  hintCount: number;
  /** Milliseconds since the learner's first interaction with this problem */
  elapsedMs: number;
  /** Condition flags from the learner's SessionConfig */
  sessionConfig: SessionConditionFlags;
  /**
   * Optional: keys present in the loaded concept-map.json.
   * When provided, corpus resolution filters to actually-present keys.
   * Omit (or pass undefined) in unit tests that don't load the real corpus.
   */
  availableConcepts?: Record<string, unknown>;
  /**
   * Learner history signals (Workstream 9)
   * Historical data used for personalization
   */
  learnerHistory?: {
    /** Prior successful recoveries without explanation */
    priorRecoveryWithoutExplanation: number;
    /** Prior dependence on high rungs */
    priorHighRungDependence: number;
    /** Repeated error subtype persistence count */
    repeatedErrorPersistence: number;
    /** Average time to recovery (ms) */
    avgTimeToRecovery: number;
  };
}

/** The decision returned by orchestrate() */
export interface OrchestrationDecision {
  action: OrchestrationAction;
  /** Human-readable explanation of why this action was chosen */
  reason: string;
  /**
   * Stable corpus concept key from the helper-export compatibility map.
   * e.g. "dbms-ramakrishnan-3rd-edition/joins"
   * null if the internal conceptId has no known corpus mapping.
   */
  corpusConceptId: string | null;
  /** RESEARCH-4 field: canonical trigger label for log analysis */
  escalationTriggerReason: string;
  /** Retry count at the moment of this decision (mirrors errorCountAtEscalation) */
  errorCountAtDecision: number;
  /** Elapsed time at the moment of this decision (mirrors timeToEscalation) */
  timeToDecision: number;
}

// ── Thresholds ────────────────────────────────────────────────────────────────

/** Adaptive mode escalation thresholds */
const ADAPTIVE = {
  showExplanation: { hintCount: 1, retryCount: 2 },
  upsertTextbookUnit: { hintCount: 3, retryCount: 4, elapsedMs: 120_000 },
  promptReflectiveNote: { hintCount: 6, elapsedMs: 300_000 },
} as const;

/** Static-ladder thresholds (adaptiveLadderDisabled mode) */
const STATIC_LADDER = {
  showExplanation: { hintCount: 2, retryCount: 2 },
  upsertTextbookUnit: { hintCount: 4, retryCount: 4 },
} as const;

/**
 * Calculate history-aware threshold adjustments (Workstream 9)
 * Uses learner history to personalize escalation thresholds
 */
function calculateHistoryAdjustments(
  history: OrchestrationContext['learnerHistory']
): {
  hintCountAdjustment: number;
  retryCountAdjustment: number;
  elapsedMsAdjustment: number;
} {
  if (!history) {
    return { hintCountAdjustment: 0, retryCountAdjustment: 0, elapsedMsAdjustment: 0 };
  }

  // Learners with prior recovery without explanation get slightly higher thresholds
  // (they've shown they can figure things out)
  const recoveryAdjustment = Math.min(history.priorRecoveryWithoutExplanation * 0.5, 1);

  // Learners with high rung dependence get lower thresholds
  // (they need more support)
  const dependenceAdjustment = Math.min(history.priorHighRungDependence * 0.5, 1);

  // Repeated error persistence increases threshold slightly
  // (learner is struggling with this specific error type)
  const persistenceAdjustment = Math.min(history.repeatedErrorPersistence * 0.3, 1);

  return {
    hintCountAdjustment: recoveryAdjustment - dependenceAdjustment + persistenceAdjustment,
    retryCountAdjustment: recoveryAdjustment - dependenceAdjustment + persistenceAdjustment,
    elapsedMsAdjustment: 0, // Time-based thresholds stay consistent
  };
}

// ── Corpus resolution ─────────────────────────────────────────────────────────

/**
 * Resolve an internal concept ID to the preferred stable corpus key.
 *
 * If availableConcepts is provided, picks the first candidate that exists in it.
 * If availableConcepts is absent, returns the first candidate from the map (stable default).
 * Returns null if the internal ID has no entry in the compatibility map.
 */
export function resolveCorpusConceptId(
  conceptId: string,
  availableConcepts?: Record<string, unknown>
): string | null {
  const candidates = CONCEPT_COMPATIBILITY_MAP[conceptId];
  if (!candidates || candidates.length === 0) return null;

  if (availableConcepts) {
    for (const candidate of candidates) {
      if (candidate in availableConcepts) return candidate;
    }
    // All candidates absent from loaded corpus — return first for traceability
    return candidates[0];
  }

  return candidates[0];
}

// ── Main orchestration function ───────────────────────────────────────────────

/**
 * Determine the next instructional action for a learner at a decision point.
 *
 * This function is the single source of truth for escalation logic.
 * It is deterministic: given the same context, it always returns the same decision.
 *
 * @example
 * // static_hint_mode baseline
 * orchestrate({ conceptId: 'joins', retryCount: 5, hintCount: 4, elapsedMs: 200_000,
 *   sessionConfig: { staticHintMode: true, ... } })
 * // → { action: 'stay_hint', reason: 'static_hint_mode: escalation disabled', ... }
 *
 * @example
 * // adaptive mode with struggle signals
 * orchestrate({ conceptId: 'joins', retryCount: 3, hintCount: 2, elapsedMs: 60_000,
 *   sessionConfig: { staticHintMode: false, textbookDisabled: false, ... } })
 * // → { action: 'show_explanation', reason: 'adaptive: hint_plus_retry threshold met', ... }
 */
export function orchestrate(ctx: OrchestrationContext): OrchestrationDecision {
  const { conceptId, retryCount, hintCount, elapsedMs, sessionConfig, availableConcepts, learnerHistory } = ctx;
  const corpusConceptId = resolveCorpusConceptId(conceptId, availableConcepts);

  // Calculate history-aware threshold adjustments (Workstream 9)
  const adjustments = calculateHistoryAdjustments(learnerHistory);

  // Apply adjustments to thresholds (ensure they don't go below minimums)
  const adjustedAdaptive = {
    showExplanation: {
      hintCount: Math.max(1, ADAPTIVE.showExplanation.hintCount + adjustments.hintCountAdjustment),
      retryCount: Math.max(2, ADAPTIVE.showExplanation.retryCount + adjustments.retryCountAdjustment),
    },
    upsertTextbookUnit: {
      hintCount: Math.max(2, ADAPTIVE.upsertTextbookUnit.hintCount + adjustments.hintCountAdjustment),
      retryCount: Math.max(3, ADAPTIVE.upsertTextbookUnit.retryCount + adjustments.retryCountAdjustment),
      elapsedMs: ADAPTIVE.upsertTextbookUnit.elapsedMs,
    },
    promptReflectiveNote: {
      hintCount: Math.max(4, ADAPTIVE.promptReflectiveNote.hintCount + adjustments.hintCountAdjustment),
      elapsedMs: ADAPTIVE.promptReflectiveNote.elapsedMs,
    },
  };

  const base = {
    corpusConceptId,
    errorCountAtDecision: retryCount,
    timeToDecision: elapsedMs,
  };

  // ── 1. Static hint mode: escalation permanently disabled ──────────────────
  if (sessionConfig.staticHintMode) {
    return {
      ...base,
      action: 'stay_hint',
      reason: 'static_hint_mode: escalation disabled',
      escalationTriggerReason: 'static_hint_mode',
    };
  }

  // ── 2. Immediate explanation mode: skip hint phase on first retry ──────────
  if (sessionConfig.immediateExplanationMode) {
    if (retryCount >= 1) {
      return {
        ...base,
        action: 'show_explanation',
        reason: 'immediate_explanation_mode: explanation on first retry',
        escalationTriggerReason: 'immediate_explanation_mode',
      };
    }
    return {
      ...base,
      action: 'stay_hint',
      reason: 'immediate_explanation_mode: waiting for first retry',
      escalationTriggerReason: 'pre_first_retry',
    };
  }

  // ── 3. Textbook disabled: ceiling is show_explanation ─────────────────────
  if (sessionConfig.textbookDisabled) {
    if (hintCount >= STATIC_LADDER.showExplanation.hintCount ||
        retryCount >= STATIC_LADDER.showExplanation.retryCount) {
      return {
        ...base,
        action: 'show_explanation',
        reason: 'textbook_disabled: explanation ceiling reached',
        escalationTriggerReason: 'textbook_disabled_threshold',
      };
    }
    return {
      ...base,
      action: 'stay_hint',
      reason: 'textbook_disabled: early hint phase',
      escalationTriggerReason: 'early_phase',
    };
  }

  // ── 4. Adaptive ladder disabled: static thresholds, no time-based ─────────
  if (sessionConfig.adaptiveLadderDisabled) {
    if (hintCount >= STATIC_LADDER.upsertTextbookUnit.hintCount ||
        retryCount >= STATIC_LADDER.upsertTextbookUnit.retryCount) {
      return {
        ...base,
        action: 'upsert_textbook_unit',
        reason: 'adaptive_ladder_disabled: static textbook threshold met',
        escalationTriggerReason: 'static_textbook_threshold',
      };
    }
    if (hintCount >= STATIC_LADDER.showExplanation.hintCount ||
        retryCount >= STATIC_LADDER.showExplanation.retryCount) {
      return {
        ...base,
        action: 'show_explanation',
        reason: 'adaptive_ladder_disabled: static explanation threshold met',
        escalationTriggerReason: 'static_explanation_threshold',
      };
    }
    return {
      ...base,
      action: 'stay_hint',
      reason: 'adaptive_ladder_disabled: early hint phase',
      escalationTriggerReason: 'early_phase',
    };
  }

  // ── 5. Fully adaptive mode ────────────────────────────────────────────────

  // Reflective note: high hint count or long elapsed time
  if (hintCount >= adjustedAdaptive.promptReflectiveNote.hintCount ||
      elapsedMs >= adjustedAdaptive.promptReflectiveNote.elapsedMs) {
    return {
      ...base,
      action: 'prompt_reflective_note',
      reason: 'adaptive: high hint count or extended struggle — reflective synthesis',
      escalationTriggerReason:
        hintCount >= adjustedAdaptive.promptReflectiveNote.hintCount
          ? 'high_hint_count'
          : 'time_stuck',
    };
  }

  // Textbook unit: moderate struggle signals
  if (hintCount >= adjustedAdaptive.upsertTextbookUnit.hintCount ||
      retryCount >= adjustedAdaptive.upsertTextbookUnit.retryCount ||
      elapsedMs >= adjustedAdaptive.upsertTextbookUnit.elapsedMs) {
    return {
      ...base,
      action: 'upsert_textbook_unit',
      reason: 'adaptive: moderate struggle — escalate to textbook unit',
      escalationTriggerReason:
        hintCount >= adjustedAdaptive.upsertTextbookUnit.hintCount
          ? 'hint_count_threshold'
          : retryCount >= adjustedAdaptive.upsertTextbookUnit.retryCount
          ? 'retry_count_threshold'
          : 'elapsed_time_threshold',
    };
  }

  // Explanation: hint seen + multiple retries
  if (hintCount >= adjustedAdaptive.showExplanation.hintCount &&
      retryCount >= adjustedAdaptive.showExplanation.retryCount) {
    return {
      ...base,
      action: 'show_explanation',
      reason: 'adaptive: hint_plus_retry threshold met',
      escalationTriggerReason: 'hint_plus_retry',
    };
  }

  // Default: stay at hint level
  return {
    ...base,
    action: 'stay_hint',
    reason: 'adaptive: early phase — no escalation threshold met',
    escalationTriggerReason: 'early_phase',
  };
}

// ── Condition helpers ─────────────────────────────────────────────────────────

/**
 * Build SessionConditionFlags for the static_hint_mode baseline condition.
 * This is the control arm: hints only, no textbook escalation.
 */
export function staticHintModeCondition(): SessionConditionFlags {
  return {
    textbookDisabled: false,
    adaptiveLadderDisabled: false,
    immediateExplanationMode: false,
    staticHintMode: true,
  };
}

/**
 * Build SessionConditionFlags for the fully adaptive textbook condition.
 * This is the treatment arm: all 4 actions available, time/count-based.
 */
export function adaptiveTextbookCondition(): SessionConditionFlags {
  return {
    textbookDisabled: false,
    adaptiveLadderDisabled: false,
    immediateExplanationMode: false,
    staticHintMode: false,
  };
}

/**
 * Build SessionConditionFlags for the explanation-first condition.
 * Skips hints, goes straight to explanation on first retry.
 */
export function explanationFirstCondition(): SessionConditionFlags {
  return {
    textbookDisabled: true, // ceiling at explanation
    adaptiveLadderDisabled: false,
    immediateExplanationMode: true,
    staticHintMode: false,
  };
}

/**
 * Build SessionConditionFlags for the conservative condition.
 * Hints only, no escalation to explanation or textbook.
 */
export function conservativeCondition(): SessionConditionFlags {
  return {
    textbookDisabled: false,
    adaptiveLadderDisabled: true,
    immediateExplanationMode: false,
    staticHintMode: true,
  };
}

// ── Reinforcement Event Factories ─────────────────────────────────────────────

/**
 * Create a reinforcement_prompt_shown event with stable identifiers.
 *
 * This factory ensures all reinforcement events carry the source unit/concept IDs
 * needed for outcome attribution and paper analysis.
 *
 * @example
 * const promptEvent = createReinforcementPromptShown({
 *   learnerId: 'learner-1',
 *   sessionId: 'session-1',
 *   sourceUnitId: 'unit-abc-123',
 *   sourceConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
 *   delayBucket: '3d',
 *   promptType: 'mcq',
 *   timestamp: Date.now(),
 * });
 */
export function createReinforcementPromptShown(params: {
  learnerId: string;
  sessionId: string;
  sourceUnitId: string;
  sourceConceptId: string;
  delayBucket: 'immediate' | '3d' | '7d' | '14d' | '21d';
  promptType: 'mcq' | 'sql_completion' | 'concept_explanation';
  timestamp: number;
  problemId?: string;
}): InteractionEvent {
  const {
    learnerId,
    sessionId,
    sourceUnitId,
    sourceConceptId,
    delayBucket,
    promptType,
    timestamp,
    problemId = 'reinforcement',
  } = params;

  // Deterministic ID based on source unit and delay bucket
  const promptId = `reinforcement-${sourceUnitId}-${delayBucket}-${Math.floor(timestamp / 1000)}`;

  return {
    id: promptId,
    learnerId,
    sessionId,
    timestamp,
    eventType: 'reinforcement_prompt_shown',
    problemId,
    promptId,
    promptType,
    sourceUnitId,
    sourceConceptId,
    delayBucket,
    corpusConceptId: sourceConceptId,
    scheduledTime: timestamp,
  };
}

/**
 * Create a reinforcement_response event with outcome tracking.
 *
 * Links back to the original prompt via sourceUnitId and captures
 * correctness, latency, and concept attribution.
 *
 * @example
 * const responseEvent = createReinforcementResponse({
 *   learnerId: 'learner-1',
 *   sessionId: 'session-1',
 *   sourceUnitId: 'unit-abc-123',
 *   sourceConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
 *   delayBucket: '3d',
 *   isCorrect: true,
 *   latencyMs: 4500,
 *   response: 'SELECT * FROM users',
 *   timestamp: Date.now(),
 * });
 */
export function createReinforcementResponse(params: {
  learnerId: string;
  sessionId: string;
  sourceUnitId: string;
  sourceConceptId: string;
  delayBucket: 'immediate' | '3d' | '7d' | '14d' | '21d';
  isCorrect: boolean;
  latencyMs: number;
  response: string;
  timestamp: number;
  problemId?: string;
}): InteractionEvent {
  const {
    learnerId,
    sessionId,
    sourceUnitId,
    sourceConceptId,
    delayBucket,
    isCorrect,
    latencyMs,
    response,
    timestamp,
    problemId = 'reinforcement',
  } = params;

  // Deterministic ID based on prompt ID
  const responseId = `response-${sourceUnitId}-${delayBucket}-${Math.floor(timestamp / 1000)}`;

  return {
    id: responseId,
    learnerId,
    sessionId,
    timestamp,
    eventType: 'reinforcement_response',
    problemId,
    sourceUnitId,
    sourceConceptId,
    delayBucket,
    corpusConceptId: sourceConceptId,
    isCorrect,
    reinforcementCorrect: isCorrect,
    reinforcementLatencyMs: latencyMs,
    response,
    shownTime: timestamp - latencyMs,
    completedTime: timestamp,
  };
}

/**
 * Schedule a reinforcement prompt for a future delay bucket.
 *
 * Returns the scheduled time and bucket for the reinforcement prompt
 * based on the unit creation time. This is a deterministic scheduling
 * function that rounds to the nearest bucket boundary.
 *
 * @param unitCreatedAt - Timestamp when the textbook unit was created
 * @param targetDelayDays - Target delay: 3, 7, 14, or 21 days
 * @returns Scheduled time and delay bucket
 */
export function scheduleReinforcement(
  unitCreatedAt: number,
  targetDelayDays: 3 | 7 | 14 | 21 = 3
): { scheduledTime: number; delayBucket: '3d' | '7d' | '14d' | '21d' } {
  const msPerDay = 24 * 60 * 60 * 1000;
  const scheduledTime = unitCreatedAt + targetDelayDays * msPerDay;

  return {
    scheduledTime,
    delayBucket: `${targetDelayDays}d` as '3d' | '7d' | '14d' | '21d',
  };
}
