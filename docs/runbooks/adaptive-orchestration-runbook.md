# Adaptive Textbook Orchestration — Runbook

**Module**: `apps/web/src/app/lib/ml/textbook-orchestrator.ts`
**Version**: orchestrator-v1
**Related test**: `textbook-orchestrator.test.ts`
**Replay script**: `scripts/replay-toy.mjs`, `scripts/replay-experiment.mjs`

---

## Overview

The textbook orchestrator is the single decision point that determines what
instructional action to take at each struggle signal. It is a pure, deterministic
function — given the same inputs it always returns the same decision, making it
directly testable and replay-safe.

**Week 6 Additions**: This runbook now covers the experiment-ready outcome
pipeline with:
- Delayed reinforcement events for measuring unit effectiveness
- Explicit dependency metrics (HDI-style formula)
- 3-policy replay comparisons
- Paper-ready JSON/CSV output artifacts

---

## Session-Level Baseline Conditions

Each learner session is assigned exactly one condition via `assignCondition()` in
`condition-assignment.ts`. The condition controls which orchestration actions are
available.

| Condition ID | `staticHintMode` | `textbookDisabled` | `immediateExplanationMode` | `adaptiveLadderDisabled` | Description |
|---|---|---|---|---|---|
| `conservative` (baseline) | ✅ true | false | false | true | Hints only — **control arm** |
| `explanation_first` | false | true | ✅ true | true | Skips hints, goes straight to explanation |
| `adaptive` (treatment) | false | false | false | false | All 4 actions, time/count-based thresholds |
| `aggressive` | false | false | false | false | Same as adaptive but tighter escalation profile |
| `no_hints` | false | false | false | true | No help at all |

> The canonical two-arm comparison for the experiment is:
> **static_hint_mode** (conservative) vs **adaptive textbook** (adaptive).

### Condition Assignment Event

When a session config is created, emit a `condition_assigned` event:

```typescript
{
  eventType: 'condition_assigned',
  learnerId: session.learnerId,
  sessionId: session.sessionId,
  conditionId: session.conditionId,
  strategyAssigned: session.escalationPolicy,  // RESEARCH-4
  timestamp: Date.now(),
  problemId: currentProblemId,
}
```

---

## Orchestration Actions

The orchestrator returns one of four typed actions:

| Action | Rung | When triggered | Event to emit |
|---|---|---|---|
| `stay_hint` | 1 | Early phase, or `staticHintMode` | `guidance_view` (rung=1) |
| `show_explanation` | 2 | Hint seen + retries; or `immediateExplanationMode` | `guidance_escalate` (toRung=2) + `explanation_view` |
| `upsert_textbook_unit` | 3 | Moderate struggle (hintCount≥3 or retryCount≥4) | `textbook_unit_upsert` with `corpusConceptId` |
| `prompt_reflective_note` | 3+ | Deep struggle (hintCount≥6 or 5+ minutes) | `textbook_unit_upsert` + `textbook_unit_shown` |

---

## Escalation Thresholds

### Adaptive Mode (treatment arm)

```
stay_hint            → default (no threshold met)
show_explanation     → hintCount >= 1 AND retryCount >= 2
upsert_textbook_unit → hintCount >= 3 OR retryCount >= 4 OR elapsedMs >= 120_000
prompt_reflective_note → hintCount >= 6 OR elapsedMs >= 300_000
```

### Static Ladder (adaptiveLadderDisabled, no time-based escalation)

```
stay_hint            → default
show_explanation     → hintCount >= 2 OR retryCount >= 2
upsert_textbook_unit → hintCount >= 4 OR retryCount >= 4
```

---

## Event Schema

All orchestration decisions emit an event with these fields:

```typescript
{
  // Standard fields
  eventType: 'guidance_escalate' | 'textbook_unit_upsert' | 'textbook_unit_shown' | 'guidance_view',
  learnerId: string,
  sessionId: string,
  timestamp: number,
  problemId: string,

  // Guidance ladder fields
  fromRung: 1 | 2 | 3,
  toRung: 1 | 2 | 3,
  trigger: EscalationTrigger,

  // Textbook unit fields (for upsert_textbook_unit / prompt_reflective_note)
  unitId: string,
  dedupeKey: string,         // "{sortedConceptIds}::{type}"
  revisionCount: number,

  // Stable corpus identifier (NEW — Week 6)
  corpusConceptId: string,   // e.g. "dbms-ramakrishnan-3rd-edition/joins"

  // RESEARCH-4 canonical study fields
  escalationTriggerReason: string,  // e.g. "hint_plus_retry", "high_hint_count"
  errorCountAtEscalation: number,   // retryCount at decision time
  timeToEscalation: number,         // elapsedMs at decision time
  strategyAssigned: string,         // condition ID (e.g. "adaptive", "conservative")

  // Condition tracking
  conditionId: string,
}
```

### Key field: `corpusConceptId`

`corpusConceptId` is the resolved corpus key from `concept-compatibility-map.ts`,
e.g. `"dbms-ramakrishnan-3rd-edition/joins"`. It is the stable, textbook-backed
identifier for a concept, as opposed to the internal app ID (`"joins"`).

Every `textbook_unit_upsert` and `textbook_unit_shown` event **must** include
`corpusConceptId` so downstream analytics can join events to corpus metadata
without re-running the compatibility map.

---

## Replay Commands

### Unit test replay (Vitest — preferred for CI)

Runs the canonical 6-step fixture under both conditions, asserts reproducible
outputs:

```bash
npx vitest run apps/web/src/app/lib/ml/textbook-orchestrator.test.ts
```

Expected output:
```
✓ replay fixture: static_hint_mode vs adaptive textbook on same trace
  ✓ static produces only stay_hint; adaptive produces 4 distinct action types
  ✓ explanations shown: 0 (static) vs 2 (adaptive)
  ✓ textbook units triggered: 0 (static) vs 1 (adaptive)
  ✓ reflective notes triggered: 0 (static) vs 1 (adaptive)
  ✓ escalation depth: 0 (static) vs 3 (adaptive)
  ✓ decisions are deterministic: same trace same condition → same result
```

### Script replay (against real or synthetic learner traces)

Compare hint-only vs adaptive textbook over a synthetic fixture:

```bash
node scripts/replay-toy.mjs
```

Compare all 5 canonical policies against real export:

```bash
node scripts/replay-experiment.mjs --policies conservative,adaptive --format both
```

Output artifacts written to `dist/replay/experiment/`:
- `experiment-results.json` — full report with per-policy metrics
- `metrics.csv` — aggregate metrics per policy
- `statistics.csv` — HDI / coverage / success-rate statistics
- `summary.txt` — human-readable comparison

---

## Example Output Diff: static_hint_mode vs adaptive textbook

The canonical 6-step trace (concept: `joins`):

| Step | retryCount | hintCount | elapsedMs | static_hint_mode | adaptive |
|---|---|---|---|---|---|
| 0 | 1 | 0 | 0 | `stay_hint` | `stay_hint` |
| 1 | 2 | 0 | 15 000 | `stay_hint` | `stay_hint` |
| 2 | 2 | 1 | 20 000 | `stay_hint` | `show_explanation` |
| 3 | 3 | 1 | 30 000 | `stay_hint` | `show_explanation` |
| 4 | 4 | 3 | 90 000 | `stay_hint` | `upsert_textbook_unit` |
| 5 | 7 | 6 | 310 000 | `stay_hint` | `prompt_reflective_note` |

**Summary diff**:

```
                        static_hint_mode   adaptive
explanations shown:             0              2
textbook units upserted:        0              1
reflective notes prompted:      0              1
escalation depth:               0              3
corpusConceptId in events:    absent   "dbms-ramakrishnan-3rd-edition/joins"
```

The textbook unit event emitted at step 4 carries:

```json
{
  "eventType": "textbook_unit_upsert",
  "corpusConceptId": "dbms-ramakrishnan-3rd-edition/joins",
  "escalationTriggerReason": "hint_count_threshold",
  "errorCountAtEscalation": 4,
  "timeToEscalation": 90000
}
```

---

## Regression Gate

`textbook-orchestrator.test.ts` is the regression gate for this system.
It fails if:
- The `static_hint_mode` arm ever produces non-hint actions
- The `adaptive` arm fails to reach `upsert_textbook_unit` or `prompt_reflective_note`
- Any decision is missing `corpusConceptId`, `escalationTriggerReason`, or RESEARCH-4 fields
- Determinism breaks (same input → different output)

Run as part of the full unit suite:

```bash
npm run test:unit
```

---

## Delayed Reinforcement Events

When a textbook unit is created, the system schedules delayed reinforcement
prompts to measure whether the unit was effective. These prompts are spaced
across delay buckets: immediate, 3d, 7d, 14d, 21d.

### Event Schema

**reinforcement_prompt_shown**:
```typescript
{
  eventType: 'reinforcement_prompt_shown',
  learnerId: string,
  sessionId: string,
  timestamp: number,
  sourceUnitId: string,           // The unit that triggered this prompt
  sourceConceptId: string,        // Stable corpus concept key
  delayBucket: 'immediate' | '3d' | '7d' | '14d' | '21d',
  promptType: 'mcq' | 'sql_completion' | 'concept_explanation',
  corpusConceptId: string,        // Same as sourceConceptId
  scheduledTime: number,
}
```

**reinforcement_response**:
```typescript
{
  eventType: 'reinforcement_response',
  learnerId: string,
  sessionId: string,
  timestamp: number,
  sourceUnitId: string,
  sourceConceptId: string,
  delayBucket: 'immediate' | '3d' | '7d' | '14d' | '21d',
  reinforcementCorrect: boolean,  // Whether answer was correct
  reinforcementLatencyMs: number, // Response time in ms
  response: string,               // The learner's response
  corpusConceptId: string,
  shownTime: number,              // When prompt was shown
  completedTime: number,          // When response was recorded
}
```

### Factory Functions

Use the helper functions in `textbook-orchestrator.ts`:

```typescript
import {
  createReinforcementPromptShown,
  createReinforcementResponse,
  scheduleReinforcement
} from './textbook-orchestrator';

// Schedule a prompt
const { scheduledTime, delayBucket } = scheduleReinforcement(Date.now(), 3);

// Create prompt event
const prompt = createReinforcementPromptShown({
  learnerId: 'learner-1',
  sessionId: 'session-1',
  sourceUnitId: 'unit-abc-123',
  sourceConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
  delayBucket: '3d',
  promptType: 'mcq',
  timestamp: scheduledTime,
});

// Create response event
const response = createReinforcementResponse({
  learnerId: 'learner-1',
  sessionId: 'session-1',
  sourceUnitId: 'unit-abc-123',
  sourceConceptId: 'dbms-ramakrishnan-3rd-edition/joins',
  delayBucket: '3d',
  isCorrect: true,
  latencyMs: 4500,
  response: 'SELECT * FROM users',
  timestamp: Date.now(),
});
```

---

## Dependency Metrics (HDI-Style Score)

The dependency metric module (`dependency-metrics.ts`) provides a deterministic,
replayable formula for measuring learner dependency on instructional support.

### Canonical Formula (dependency-metrics-v1)

```
HDI = 0.30·HPA + 0.15·AED + 0.25·ER + 0.15·REAE + 0.15·(1−IWH)
```

Where:
- **HPA** (Hints Per Attempt) = min(hints / attempts, 1.0)
- **AED** (Average Escalation Depth) = clamp((avg_hint_level − 1) / 2, 0, 1)
- **ER** (Explanation Rate) = min(explanations / attempts, 1.0)
- **REAE** (Repeated Error After Explanation) = errors_after_explanation / total_errors
- **IWH** (Improvement Without Hint) = successes_without_hints / total_successes

All components normalized to [0, 1]. Higher HDI indicates greater dependency
on instructional support.

### Usage

```typescript
import {
  calculateDependencyMetrics,
  calculateReinforcementMetrics,
  comparePoliciesOnTrace,
  generatePaperSummary,
  comparisonsToCsv
} from './dependency-metrics';

// Calculate HDI for a trace
const metrics = calculateDependencyMetrics(trace);
console.log(metrics.hdi);           // 0.0 - 1.0
console.log(metrics.components);    // { hpa, aed, er, reae, iwh }
console.log(metrics.formulaDescription); // Canonical formula string

// Calculate reinforcement outcomes
const reinforcement = calculateReinforcementMetrics(trace);
console.log(reinforcement.accuracyRate);
console.log(reinforcement.byDelayBucket['3d'].accuracyRate);

// Compare policies
const comparisons = comparePoliciesOnTrace(baseTrace, {
  conservative: conservativeTrace,
  adaptive: adaptiveTrace,
});
```

---

## 3-Policy Replay Fixture

The canonical replay fixture compares three policies on the same 6-step trace:
- **conservative**: Hints only (control)
- **adaptive**: Full escalation ladder (treatment)
- **explanation_first**: Immediate explanation, no textbook

### Running the Fixture

Unit test (Vitest):
```bash
npx vitest run apps/web/src/app/lib/ml/textbook-orchestrator.test.ts \
  --reporter=verbose
```

Look for the test: "replay fixture: 3-policy comparison on canonical trace"

### Expected Results

| Policy | Explanations | Textbook Units | Reflective Notes | HDI |
|--------|-------------|----------------|------------------|-----|
| conservative | 0 | 0 | 0 | Low |
| adaptive | 2 | 1 | 1 | Medium |
| explanation_first | 5 | 0 | 0 | High |

---

## Paper Tables Output Command

Generate machine-readable JSON and CSV summaries suitable for paper figures:

```bash
node scripts/replay-paper-tables.mjs
```

Options:
```bash
# CSV only
node scripts/replay-paper-tables.mjs --format csv

# JSON only
node scripts/replay-paper-tables.mjs --format json

# Custom output directory
node scripts/replay-paper-tables.mjs --output-dir ./my-results
```

### Output Artifacts

All files are written to `dist/replay/paper-tables/`:

| File | Format | Contents |
|------|--------|----------|
| `policy-comparison.json` | JSON | Full comparison with all metrics |
| `policy-comparison.csv` | CSV | Table-friendly format for papers |
| `hdi-components.json` | JSON | HDI breakdown by component |
| `reinforcement-outcomes.csv` | CSV | Reinforcement metrics by delay bucket |
| `experiment-manifest.json` | JSON | Metadata, checksums, formula |

### Example CSV Output (policy-comparison.csv)

```csv
policy_id,policy_name,explanations_shown,textbook_units_upserted,reinforcement_prompts_shown,reinforcement_correct_count,reinforcement_accuracy,hdi,hdi_hpa,hdi_aed,hdi_er,hdi_reae,hdi_iwh,concepts_encountered,concepts_mastered,coverage_rate
conservative,Conservative (Hints Only),0,0,0,0,0.0000,0.3000,0.6000,0.0000,0.0000,0.0000,1.0000,1,0,0.0000
adaptive,Adaptive Textbook,2,1,2,1,0.5000,0.4875,0.3000,0.2000,0.2500,0.1000,0.7500,1,1,1.0000
explanation_first,Explanation First,5,0,0,0,0.0000,0.5500,0.1000,0.0000,0.8333,0.0000,0.5000,1,1,1.0000
```

---

## Complete Verification Command

Run all tests to verify the experiment pipeline:

```bash
# 1. Unit tests (including orchestrator and dependency metrics)
npx vitest run apps/web/src/app/lib/ml/textbook-orchestrator.test.ts
npx vitest run apps/web/src/app/lib/ml/dependency-metrics.test.ts

# 2. Full test suite
npm run test:unit

# 3. Build check
npm run build

# 4. Generate paper tables
node scripts/replay-paper-tables.mjs

# 5. Inspect output
ls -la dist/replay/paper-tables/
cat dist/replay/paper-tables/policy-comparison.csv
```
