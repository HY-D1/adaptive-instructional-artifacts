/**
 * textbook-orchestrator-esm.mjs
 *
 * Pure-JS ESM mirror of apps/web/src/app/lib/ml/textbook-orchestrator.ts.
 *
 * This file is the single canonical source of orchestration logic for Node.js
 * scripts (e.g. replay-paper-tables.mjs).  It must stay in sync with the
 * TypeScript source.  Any threshold or condition change must be reflected here.
 *
 * Do NOT add independent policy logic here.  Copy constants from the TS source;
 * never invent new ones.
 *
 * Exported API (mirrors TypeScript exports):
 *   orchestrate(ctx)              → OrchestrationDecision
 *   resolveCorpusConceptId(id, available?) → string | null
 *   staticHintModeCondition()     → SessionConditionFlags
 *   adaptiveTextbookCondition()   → SessionConditionFlags
 *   explanationFirstCondition()   → SessionConditionFlags
 *   conservativeCondition()       → SessionConditionFlags
 *
 * @see apps/web/src/app/lib/ml/textbook-orchestrator.ts (canonical TypeScript source)
 * @version orchestrator-esm-v1
 */

// ── Compatibility map (mirrors concept-compatibility-map.ts) ─────────────────
// Keep in sync with apps/web/src/app/lib/content/concept-compatibility-map.ts
const CONCEPT_COMPATIBILITY_MAP = {
  'joins':             ['dbms-ramakrishnan-3rd-edition/joins', 'murachs-mysql-3rd-edition/joins-murach'],
  'where-clause':      ['dbms-ramakrishnan-3rd-edition/where-clause', 'murachs-mysql-3rd-edition/where-clause-murach'],
  'aggregation':       ['dbms-ramakrishnan-3rd-edition/aggregate-functions', 'murachs-mysql-3rd-edition/aggregate-functions-murach'],
  'having-clause':     ['dbms-ramakrishnan-3rd-edition/having', 'murachs-mysql-3rd-edition/having-murach'],
  'order-by':          ['murachs-mysql-3rd-edition/order-by-murach', 'dbms-ramakrishnan-3rd-edition/order-by'],
  'string-functions':  ['murachs-mysql-3rd-edition/string-functions', 'dbms-ramakrishnan-3rd-edition/string-functions'],
  'cte':               ['dbms-ramakrishnan-3rd-edition/subqueries', 'murachs-mysql-3rd-edition/subqueries-murach'],
  'union':             ['dbms-ramakrishnan-3rd-edition/set-operations'],
  'views':             ['dbms-ramakrishnan-3rd-edition/views', 'murachs-mysql-3rd-edition/views-murach'],
  'subqueries':        ['dbms-ramakrishnan-3rd-edition/subqueries', 'murachs-mysql-3rd-edition/subqueries-murach'],
  'insert-update-delete': ['dbms-ramakrishnan-3rd-edition/sql-dml', 'murachs-mysql-3rd-edition/insert-update-delete-murach'],
  'transactions':      ['dbms-ramakrishnan-3rd-edition/transactions'],
  'window-functions':  ['murachs-mysql-3rd-edition/window-functions-murach'],
  'indexes':           ['dbms-ramakrishnan-3rd-edition/indexes'],
  'date-functions':    ['murachs-mysql-3rd-edition/date-functions-murach'],
  'case-expressions':  ['murachs-mysql-3rd-edition/case-expressions-murach'],
};

// ── Thresholds (must match textbook-orchestrator.ts) ─────────────────────────

/** Adaptive mode escalation thresholds */
const ADAPTIVE = {
  showExplanation:      { hintCount: 1, retryCount: 2 },
  upsertTextbookUnit:   { hintCount: 3, retryCount: 4, elapsedMs: 120_000 },
  promptReflectiveNote: { hintCount: 6, elapsedMs: 300_000 },
};

/** Static-ladder thresholds (adaptiveLadderDisabled mode) */
const STATIC_LADDER = {
  showExplanation:    { hintCount: 2, retryCount: 2 },
  upsertTextbookUnit: { hintCount: 4, retryCount: 4 },
};

// ── Corpus resolution ─────────────────────────────────────────────────────────

/**
 * Resolve an internal concept ID to the preferred stable corpus key.
 * @param {string} conceptId
 * @param {Record<string, unknown>} [availableConcepts]
 * @returns {string | null}
 */
export function resolveCorpusConceptId(conceptId, availableConcepts) {
  const candidates = CONCEPT_COMPATIBILITY_MAP[conceptId];
  if (!candidates || candidates.length === 0) return null;

  if (availableConcepts) {
    for (const candidate of candidates) {
      if (candidate in availableConcepts) return candidate;
    }
    return candidates[0];
  }

  return candidates[0];
}

// ── Main orchestration function ───────────────────────────────────────────────

/**
 * Determine the next instructional action for a learner at a decision point.
 *
 * Deterministic: same context always returns same decision.
 *
 * @param {{ conceptId: string, retryCount: number, hintCount: number,
 *           elapsedMs: number, sessionConfig: object, availableConcepts?: object }} ctx
 * @returns {{ action: string, reason: string, corpusConceptId: string|null,
 *             escalationTriggerReason: string, errorCountAtDecision: number,
 *             timeToDecision: number }}
 */
export function orchestrate(ctx) {
  const { conceptId, retryCount, hintCount, elapsedMs, sessionConfig, availableConcepts } = ctx;
  const corpusConceptId = resolveCorpusConceptId(conceptId, availableConcepts);

  const base = {
    corpusConceptId,
    errorCountAtDecision: retryCount,
    timeToDecision: elapsedMs,
  };

  // 1. Static hint mode: escalation permanently disabled
  if (sessionConfig.staticHintMode) {
    return { ...base, action: 'stay_hint', reason: 'static_hint_mode: escalation disabled', escalationTriggerReason: 'static_hint_mode' };
  }

  // 2. Immediate explanation mode: skip hint phase on first retry
  if (sessionConfig.immediateExplanationMode) {
    if (retryCount >= 1) {
      return { ...base, action: 'show_explanation', reason: 'immediate_explanation_mode: explanation on first retry', escalationTriggerReason: 'immediate_explanation_mode' };
    }
    return { ...base, action: 'stay_hint', reason: 'immediate_explanation_mode: waiting for first retry', escalationTriggerReason: 'pre_first_retry' };
  }

  // 3. Textbook disabled: ceiling is show_explanation
  if (sessionConfig.textbookDisabled) {
    if (hintCount >= STATIC_LADDER.showExplanation.hintCount || retryCount >= STATIC_LADDER.showExplanation.retryCount) {
      return { ...base, action: 'show_explanation', reason: 'textbook_disabled: explanation ceiling reached', escalationTriggerReason: 'textbook_disabled_threshold' };
    }
    return { ...base, action: 'stay_hint', reason: 'textbook_disabled: early hint phase', escalationTriggerReason: 'early_phase' };
  }

  // 4. Adaptive ladder disabled: static thresholds, no time-based
  if (sessionConfig.adaptiveLadderDisabled) {
    if (hintCount >= STATIC_LADDER.upsertTextbookUnit.hintCount || retryCount >= STATIC_LADDER.upsertTextbookUnit.retryCount) {
      return { ...base, action: 'upsert_textbook_unit', reason: 'adaptive_ladder_disabled: static textbook threshold met', escalationTriggerReason: 'static_textbook_threshold' };
    }
    if (hintCount >= STATIC_LADDER.showExplanation.hintCount || retryCount >= STATIC_LADDER.showExplanation.retryCount) {
      return { ...base, action: 'show_explanation', reason: 'adaptive_ladder_disabled: static explanation threshold met', escalationTriggerReason: 'static_explanation_threshold' };
    }
    return { ...base, action: 'stay_hint', reason: 'adaptive_ladder_disabled: early hint phase', escalationTriggerReason: 'early_phase' };
  }

  // 5. Fully adaptive mode
  if (hintCount >= ADAPTIVE.promptReflectiveNote.hintCount || elapsedMs >= ADAPTIVE.promptReflectiveNote.elapsedMs) {
    return {
      ...base,
      action: 'prompt_reflective_note',
      reason: 'adaptive: high hint count or extended struggle — reflective synthesis',
      escalationTriggerReason: hintCount >= ADAPTIVE.promptReflectiveNote.hintCount ? 'high_hint_count' : 'time_stuck',
    };
  }

  if (hintCount >= ADAPTIVE.upsertTextbookUnit.hintCount || retryCount >= ADAPTIVE.upsertTextbookUnit.retryCount || elapsedMs >= ADAPTIVE.upsertTextbookUnit.elapsedMs) {
    return {
      ...base,
      action: 'upsert_textbook_unit',
      reason: 'adaptive: moderate struggle — escalate to textbook unit',
      escalationTriggerReason:
        hintCount >= ADAPTIVE.upsertTextbookUnit.hintCount  ? 'hint_count_threshold'  :
        retryCount >= ADAPTIVE.upsertTextbookUnit.retryCount ? 'retry_count_threshold' :
        'elapsed_time_threshold',
    };
  }

  if (hintCount >= ADAPTIVE.showExplanation.hintCount && retryCount >= ADAPTIVE.showExplanation.retryCount) {
    return { ...base, action: 'show_explanation', reason: 'adaptive: hint_plus_retry threshold met', escalationTriggerReason: 'hint_plus_retry' };
  }

  return { ...base, action: 'stay_hint', reason: 'adaptive: early phase — no escalation threshold met', escalationTriggerReason: 'early_phase' };
}

// ── Condition helpers ─────────────────────────────────────────────────────────

/** Static hint mode (control arm): hints only, no escalation. */
export function staticHintModeCondition() {
  return { textbookDisabled: false, adaptiveLadderDisabled: false, immediateExplanationMode: false, staticHintMode: true };
}

/** Fully adaptive textbook (treatment arm): all 4 actions, time/count-based. */
export function adaptiveTextbookCondition() {
  return { textbookDisabled: false, adaptiveLadderDisabled: false, immediateExplanationMode: false, staticHintMode: false };
}

/** Explanation-first: skips hints, shows explanation on first retry. */
export function explanationFirstCondition() {
  return { textbookDisabled: true, adaptiveLadderDisabled: false, immediateExplanationMode: true, staticHintMode: false };
}

/** Conservative: hints only. */
export function conservativeCondition() {
  return { textbookDisabled: false, adaptiveLadderDisabled: true, immediateExplanationMode: false, staticHintMode: true };
}
