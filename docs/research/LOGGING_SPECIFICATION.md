# Logging, Debugging, and Reproducibility Specification

**Purpose**: Define the "log everything" contract that makes debugging, offline replay, and publishable claims possible.  
**Version**: 1.0.0  
**Last Updated**: 2026-04-05

---

## Two-Layer Logging Architecture

### Research Event Stream ("what happened pedagogically")

High-level, domain-specific events capturing pedagogical interactions:

| Event Category | Examples |
|----------------|----------|
| Session lifecycle | `session_started`, `session_ended` |
| Problem interaction | `problem_started`, `problem_ended` |
| Query execution | `query_submitted`, `query_result` |
| Error handling | `error_classified` |
| Guidance system | `hint_requested`, `hint_shown`, `escalation_triggered` |
| Textbook operations | `textbook_unit_created`, `textbook_unit_saved` |
| Learning dynamics | `reinforcement_scheduled`, `reinforcement_response` |
| Policy decisions | `bandit_arm_selected`, `bandit_reward_observed` |

### Operational Telemetry ("what happened technically")

Runtime metrics and system health:

| Category | Examples |
|----------|----------|
| Performance | API latencies, execution times |
| Reliability | Schema validation failures, LLM request failures |
| Resource | Queue backpressure, memory usage |
| Security | Authentication events, access violations |

### Canonical Event Name Mapping (Current Emissions)

Use emitted `eventType` names below when querying exports, DB rows, and audit artifacts.
This table is the canonical source for `scripts/audit/audit-beta-telemetry.mjs` step-to-event coverage outputs.

| Analysis Label (paper/runbook wording) | Emitted `eventType` (source of truth) | Notes |
|----------------------------------------|----------------------------------------|-------|
| `query_submitted` / `query_result` | `execution`, `error` | `execution` and `error` are the canonical run outcome events. |
| `hint_requested` | `guidance_request` | Request-side event for the guidance ladder. |
| `hint_shown` | `hint_view` | Rendered hint event with `helpRequestIndex` and rung metadata. |
| `explanation_shown` | `explanation_view` | Explanation-mode render event. |
| `escalation_triggered` | `guidance_escalate`, `escalation_triggered` | `guidance_escalate` is ladder-level; `escalation_triggered` is profile-level study signal. |
| `textbook_unit_created` / `textbook_unit_saved` | `textbook_add`, `textbook_update`, `textbook_unit_upsert` | All count as save-to-notes evidence. |
| `condition_assigned` | `condition_assigned` | Canonical condition/session assignment event. |
| `bandit_*` policy events | `bandit_arm_selected`, `bandit_reward_observed`, `bandit_updated` | Week 5 adaptive policy loop. |
| `hdi_*` dependency events | `hdi_calculated`, `hdi_trajectory_updated`, `dependency_intervention_triggered` | Hint dependency instrumentation. |

### Correlation Strategy

All events correlated via shared `trace_id`:

```typescript
// Research event
trace_id: "session-abc-123"
eventType: "hint_shown"

// Operational event  
trace_id: "session-abc-123"
eventType: "llm_latency_ms"
value: 450
```

Aligns with OpenTelemetry data modeling for cross-service correlation.

---

## Canonical Event Record Schema

Every event stored as JSON object in JSONL format (append-only).

### Required Fields (All Events)

```typescript
interface CanonicalEvent {
  // Schema Versioning
  schema_version: string;        // Semantic version, e.g., "1.0.0"
  
  // Identity
  event_id: string;              // UUID (time-sortable, v7 recommended)
  trace_id: string;              // Stable per session
  span_id?: string;              // Optional: per action group
  
  // Timing
  ts: string;                    // ISO-8601 timestamp in UTC
  
  // Source
  app_id: string;                // "cybernetic-sabotage", "sqlbeyond", etc.
  app_version: string;           // Git commit hash + build id
  
  // Actor
  learner_id: string;            // Pseudonymous stable ID (never raw email)
  session_id: string;
  problem_id: string;
  attempt_id?: string;
  
  // Experiment Context
  experiment: {
    condition_id: string;        // Experimental condition
    toggles: Record<string, boolean>;  // Feature flags
    policy_arm: string;          // Bandit arm or profile
    random_seed?: number;        // For reproducibility
  };
  
  // Event-Specific Payload
  eventType: string;
  payload: Record<string, unknown>;  // Validated per event type
  
  // Integrity (optional but powerful)
  integrity?: {
    payload_sha256: string;
    previous_event_sha256: string;
  };
}
```

### Storage Format

```jsonl
{"schema_version":"1.0.0","event_id":"...","eventType":"session_started",...}
{"schema_version":"1.0.0","event_id":"...","eventType":"problem_started",...}
{"schema_version":"1.0.0","event_id":"...","eventType":"query_submitted",...}
```

---

## Event Taxonomy (Core Set)

### Session Lifecycle

#### `session_started`

```typescript
{
  eventType: 'session_started',
  payload: {
    learnerProfile: {
      id: string;
      role: 'student' | 'instructor';
      assignedProfile?: string;  // Escalation profile
    };
    experimentToggles: {
      textbook_disabled?: boolean;
      adaptive_ladder_disabled?: boolean;
      immediate_explanation_mode?: boolean;
      bandit_disabled?: boolean;
    };
    clientInfo: {
      userAgent: string;
      screenSize: string;
      timezone: string;
    };
  }
}
```

#### `session_ended`

```typescript
{
  eventType: 'session_ended',
  payload: {
    durationMs: number;
    problemsAttempted: number;
    problemsSolved: number;
    finalHDI?: number;
    terminationReason: 'user_action' | 'timeout' | 'error';
  }
}
```

### Problem Interaction

#### `problem_started`

```typescript
{
  eventType: 'problem_started',
  payload: {
    problemId: string;
    problemType: string;
    conceptsTested: string[];
    difficultyEstimate: number;
  }
}
```

#### `problem_ended`

```typescript
{
  eventType: 'problem_ended',
  payload: {
    problemId: string;
    solved: boolean;
    attempts: number;
    hintsRequested: number;
    maxRungReached: number;
    timeSpentMs: number;
    finalErrorSubtype?: string;
  }
}
```

### Query Execution

#### `query_editor_state`

```typescript
{
  eventType: 'query_editor_state',
  payload: {
    snapshotType: 'periodic' | 'diff_summary';
    sqlLength: number;
    clauseCounts: {
      select: number;
      where: number;
      join: number;
      groupBy: number;
      // ...
    };
    editDistanceFromPrevious?: number;
  }
}
```

#### `query_submitted`

```typescript
{
  eventType: 'query_submitted',
  payload: {
    problemId: string;
    attemptNumber: number;
    sqlLength: number;
    // SQL content NOT logged (privacy)
    sqlHash: string;  // SHA-256 for comparison
  }
}
```

#### `query_result`

```typescript
{
  eventType: 'query_result',
  payload: {
    problemId: string;
    success: boolean;
    runtimeMs: number;
    rowCount?: number;
    resultSetHash?: string;  // Not full data
    errorType?: string;
    errorSubtype?: string;
    errorMessage?: string;  // Sanitized
  }
}
```

### Error Classification

#### `error_classified`

```typescript
{
  eventType: 'error_classified',
  payload: {
    problemId: string;
    errorType: string;
    errorSubtype: string;
    confidence: number;  // 0-1
    classifierVersion: string;  // "rule-v1", "model-v2", etc.
    matchedPattern?: string;
    conceptIds: string[];  // Affected concepts
  }
}
```

### Guidance System

#### `hint_requested`

```typescript
{
  eventType: 'hint_requested',
  payload: {
    problemId: string;
    currentRung: number;
    previousHintsCount: number;
    errorContext: {
      errorSubtype: string;
      errorCount: number;
    };
  }
}
```

#### `hint_shown`

```typescript
{
  eventType: 'hint_shown',
  payload: {
    problemId: string;
    rung: number;  // 1, 2, or 3
    hintType: 'sql-engage' | 'llm-generated';
    sqlEngageHintId?: string;
    conceptIds: string[];
    sourceRefIds?: string[];  // For L2+
    contentLength: number;
    generationLatencyMs?: number;
  }
}
```

#### `escalation_evaluated`

```typescript
{
  eventType: 'escalation_evaluated',
  payload: {
    problemId: string;
    decisionPoint: number;
    context: {
      errorCount: number;
      errorCountBySubtype: Record<string, number>;
      timeStuckMs: number;
      hintViews: number;
      repeatedErrorCount: number;
      currentRung: number;
    };
    profileId: string;
    thresholds: {
      escalate: number;
      aggregate: number;
    };
    decision: 'escalate' | 'maintain' | 'aggregate';
    propensity?: number;  // Action probability for OPE
  }
}
```

#### `escalation_triggered`

```typescript
{
  eventType: 'escalation_triggered',
  payload: {
    problemId: string;
    fromRung: number;
    toRung: number;
    trigger: 'error_threshold' | 'time_stuck' | 'rung_exhausted' | 'repeated_error' | 'csi_high';
    context: {
      errorCountAtTrigger: number;
      timeToEscalationMs: number;
      hintViewsToEscalation: number;
      repeatedErrorCount: number;
    };
    profileId: string;
  }
}
```

#### `explanation_shown`

```typescript
{
  eventType: 'explanation_shown',
  payload: {
    problemId: string;
    explanationType: 'llm' | 'template';
    conceptIds: string[];
    sourceRefIds: string[];
    sourceGrounded: boolean;
    ungroundedConcepts?: string[];
    generationMetadata?: {
      model: string;
      temperature: number;
      latencyMs: number;
      tokenCount: number;
    };
  }
}
```

### Textbook Operations

#### `textbook_unit_created`

```typescript
{
  eventType: 'textbook_unit_created',
  payload: {
    unitId: string;
    conceptIds: string[];
    sourceInteractionIds: string[];  // Provenance
    contentType: 'explanation' | 'example' | 'summary';
    generationMethod: 'llm' | 'template' | 'aggregated';
    retrievalBundleHash: string;
  }
}
```

#### `textbook_unit_saved`

```typescript
{
  eventType: 'textbook_unit_saved',
  payload: {
    unitId: string;
    learnerId: string;
    saveContext: 'post_explanation' | 'manual' | 'auto_aggregate';
    learnerEdits?: {
      lengthDelta: number;
      addedKeywords: string[];
    };
  }
}
```

#### `textbook_unit_edited`

```typescript
{
  eventType: 'textbook_unit_edited',
  payload: {
    unitId: string;
    editType: 'append' | 'modify' | 'organize';
    rqsBefore?: number;  // Reflection Quality Score
    rqsAfter?: number;
  }
}
```

### Spaced Reinforcement

#### `reinforcement_scheduled`

```typescript
{
  eventType: 'reinforcement_scheduled',
  payload: {
    unitId: string;
    conceptId: string;
    scheduledFor: string;  // ISO timestamp
    delayDays: number;  // 3 or 7
  }
}
```

#### `reinforcement_prompt_shown`

```typescript
{
  eventType: 'reinforcement_prompt_shown',
  payload: {
    unitId: string;
    conceptId: string;
    promptType: 'recall' | 'application' | 'completion';
  }
}
```

#### `reinforcement_response`

```typescript
{
  eventType: 'reinforcement_response',
  payload: {
    unitId: string;
    conceptId: string;
    correct: boolean;
    responseTimeMs: number;
    confidence?: number;  // Self-reported
  }
}
```

### Bandit Learning

#### `bandit_arm_selected`

```typescript
{
  eventType: 'bandit_arm_selected',
  payload: {
    learnerId: string;
    armId: string;  // Profile ID
    selectionMethod: 'thompson_sampling' | 'epsilon_greedy' | 'forced';
    samples?: Record<string, number>;  // Beta samples per arm
    exploration: boolean;  // True if exploratory
  }
}
```

#### `bandit_reward_observed`

```typescript
{
  eventType: 'bandit_reward_observed',
  payload: {
    learnerId: string;
    armId: string;
    reward: number;  // -1 to +1
    rewardComponents: {
      solved: number;
      hintDepthPenalty: number;
      dependencyPenalty: number;
      recallBonus: number;
    };
    context: {
      problemDifficulty: number;
      initialHDI: number;
    };
  }
}
```

#### `bandit_posterior_updated`

```typescript
{
  eventType: 'bandit_posterior_updated',
  payload: {
    learnerId: string;
    armId: string;
    alphaBefore: number;
    betaBefore: number;
    alphaAfter: number;
    betaAfter: number;
    pullCount: number;
    meanReward: number;
  }
}
```

### HDI Calculation

#### `hdi_calculated`

```typescript
{
  eventType: 'hdi_calculated',
  payload: {
    learnerId: string;
    hdi: number;  // 0-1
    level: 'low' | 'medium' | 'high';
    components: {
      hpa: number;   // Hints Per Attempt
      aed: number;   // Average Escalation Depth
      er: number;    // Explanation Rate
      reae: number;  // Repeated Error After Explanation
      iwh: number;   // Improvement Without Hint
    };
    calculationWindow: {
      startTime: string;
      endTime: string;
      eventCount: number;
    };
  }
}
```

#### `hdi_trajectory_updated`

```typescript
{
  eventType: 'hdi_trajectory_updated',
  payload: {
    learnerId: string;
    trend: 'increasing' | 'stable' | 'decreasing';
    slope: number;  // HDI change per day
    currentHDI: number;
    previousHDI: number;
    delta: number;
  }
}
```

#### `dependency_intervention_triggered`

```typescript
{
  eventType: 'dependency_intervention_triggered',
  payload: {
    learnerId: string;
    interventionType: 'toast_warning' | 'progress_hint' | 'profile_switch_slow';
    triggerHDI: number;
    hdiTrajectory: 'increasing' | 'stable' | 'decreasing';
    componentsAtTrigger: {
      hpa: number;
      aed: number;
      er: number;
      reae: number;
      iwh: number;
    };
  }
}
```

### Dashboard & Analytics

#### `dashboard_viewed`

```typescript
{
  eventType: 'dashboard_viewed',
  payload: {
    viewerRole: 'student' | 'instructor' | 'researcher';
    viewType: 'progress' | 'analytics' | 'traces' | 'replay';
    filtersApplied?: Record<string, unknown>;
  }
}
```

### System Exceptions

#### `system_exception`

```typescript
{
  eventType: 'system_exception',
  payload: {
    exceptionType: string;
    message: string;  // Sanitized
    stackHash?: string;  // Hash of stack trace
    context: {
      component: string;
      operation: string;
    };
    severity: 'error' | 'warning' | 'critical';
  }
}
```

---

## Must-Log Fields for Escalation Profiles and Bandits

### Profile Assignment Events

```typescript
{
  eventType: 'profile_assigned',
  payload: {
    learnerProfileId: string;      // Required for counterfactual replay
    policyArm: string;             // Which arm was selected
    assignmentStrategy: 'static' | 'diagnostic' | 'bandit';
    escalationTriggerReason?:      // For escalation events
      'error_threshold' | 
      'time_stuck' | 
      'rung_exhausted' | 
      'repeated_error' |
      'csi_high';
    errorCountAtEscalation: number;
    timeToEscalationMs: number;
    hintViewsToEscalation: number;
    strategyAssigned: string;
    rewardValue?: number;
    strategyUpdated: boolean;
    propensity?: number;           // Action probability for OPE
  }
}
```

### Why These Matter

These fields enable:
- **Counterfactual replay**: Apply alternative policies to same traces
- **Off-policy evaluation**: Use contextual bandit estimators (doubly robust)
- **Policy comparison**: Compare outcomes across assignment strategies
- **Causal analysis**: Control for assignment mechanism

---

## Schema Validation

### Validation Rules

```typescript
// Schema validation per event type
const eventValidators = {
  'session_started': z.object({
    schema_version: z.literal('1.0.0'),
    event_id: z.string().uuid(),
    eventType: z.literal('session_started'),
    payload: z.object({
      learnerProfile: z.object({
        id: z.string(),
        role: z.enum(['student', 'instructor'])
      }),
      experimentToggles: z.record(z.boolean())
    })
  }),
  
  'escalation_triggered': z.object({
    eventType: z.literal('escalation_triggered'),
    payload: z.object({
      fromRung: z.number().int().min(1).max(3),
      toRung: z.number().int().min(2).max(4),
      trigger: z.enum([
        'error_threshold',
        'time_stuck', 
        'rung_exhausted',
        'repeated_error',
        'csi_high'
      ])
    })
  }),
  
  // ... additional validators
};
```

### Validation Pipeline

```
Event Generation → Schema Validation → Integrity Hash → Append to JSONL
                        ↓
                Validation Failure
                        ↓
           Log to system_exception + Continue
```

---

## Reproducibility Requirements

### Artifact Pack Contents

Every experiment run emits a single folder:

```
experiment-run-2026-03-03-abc123/
├── config.json                    # All policy thresholds, toggles, seeds
├── environment.lock               # Runtime versions + dependency lockfiles
├── code_version.txt               # Commit hashes for each component
├── events.jsonl                   # Raw event stream
├── derived.parquet                # Derived analytics tables
├── figures/                       # Generated plots
│   ├── escalation_heatmap.png
│   ├── hdi_trajectory.png
│   └── error_transition_matrix.png
└── run_report.md                  # Human-readable narrative
```

### config.json Schema

```json
{
  "schema_version": "1.0.0",
  "run_id": "uuid",
  "timestamp": "2026-03-03T10:00:00Z",
  "experiment": {
    "name": "escalation-profile-comparison",
    "condition_id": "condition-abc",
    "random_seed": 12345
  },
  "policies": {
    "escalation_profiles": {
      "fast": { "thresholds": { "escalate": 2, "aggregate": 4 } },
      "slow": { "thresholds": { "escalate": 5, "aggregate": 8 } },
      "adaptive": { "thresholds": { "escalate": 3, "aggregate": 6 } }
    },
    "bandit": {
      "algorithm": "thompson_sampling",
      "prior_alpha": 1,
      "prior_beta": 1
    }
  },
  "toggles": {
    "textbook_disabled": false,
    "adaptive_ladder_disabled": false,
    "bandit_disabled": false
  }
}
```

### environment.lock Schema

```json
{
  "node_version": "20.11.0",
  "npm_version": "10.2.4",
  "dependencies": {
    "package-lock.json": "sha256:abc123...",
    "vitest": "1.3.1",
    "playwright": "1.53.0"
  },
  "git_commits": {
    "main": "abc123def456",
    "adaptation-layer": "def789abc012"
  }
}
```

### run_report.md Template

```markdown
# Experiment Report: escalation-profile-comparison

**Run ID**: uuid  
**Date**: 2026-03-03  
**Duration**: 2 hours  

## Configuration

Escalation profiles tested: fast, slow, adaptive
Assignment strategy: bandit

## Key Findings

- Fast escalator: avg 2.3 hints before explanation
- Slow escalator: avg 4.1 hints before explanation  
- Adaptive: avg 3.0 hints, adjusted per learner

## Figures

- Figure 1: Escalation heatmap (see figures/escalation_heatmap.png)
- Figure 2: HDI trajectories by profile

## Reproduction

```bash
git checkout abc123def456
npm ci
npm run experiment --config=config.json
```

## Claims Supported

1. ✓ "Fast escalator reaches explanation sooner than slow"
2. ✓ "Adaptive profile adjusts based on learner history"
```

---

## Standards Alignment

### ACM Artifact Review Guidance

- Distinguishes repeatability vs reproducibility
- Packages computational experiments for re-running
- Includes exact commands and expected runtime

### FAIR Principles

| Principle | Implementation |
|-----------|----------------|
| **F**indable | Experiment ID in every event |
| **A**ccessible | JSONL format, standard tools |
| **I**nteroperable | Schema version, standard fields |
| **R**eusable | config.json + environment.lock |

### NeurIPS Checklists

- ✓ Splits documented (train/test)
- ✓ Code version tracked
- ✓ Settings documented
- ✓ Limitations acknowledged
- ✓ Metrics computable from logs

---

## Privacy and Security

### Data Sanitization

| Field | Action |
|-------|--------|
| Raw SQL | Hash only (SHA-256) |
| Email/Name | Never logged; use pseudonymous ID |
| API Keys | Redacted; log presence only |
| Error messages | Sanitized; remove file paths |
| Stack traces | Hash only; no line numbers |

### Example

```typescript
// BEFORE (DON'T DO THIS)
{
  eventType: 'query_submitted',
  payload: {
    sql: "SELECT * FROM users WHERE email = 'alice@example.com'"
  }
}

// AFTER (CORRECT)
{
  eventType: 'query_submitted', 
  payload: {
    sqlHash: "sha256:abc123...",
    sqlLength: 54,
    clauseCounts: { select: 1, from: 1, where: 1 }
  }
}
```

---

## Implementation Reference

### Logging Functions

```typescript
// apps/web/src/app/lib/storage/session-events.ts

export function logEvent(event: CanonicalEvent): void {
  // 1. Validate against schema
  const validator = eventValidators[event.eventType];
  if (!validator) {
    console.warn(`Unknown event type: ${event.eventType}`);
    return;
  }
  
  const result = validator.safeParse(event);
  if (!result.success) {
    logSystemException({
      error: 'validation_failed',
      eventType: event.eventType,
      issues: result.error.issues
    });
    return;
  }
  
  // 2. Compute integrity hash
  const integrityHash = computeHash(event.payload);
  
  // 3. Append to storage
  const eventWithHash = { ...event, integrity: integrityHash };
  appendToEventLog(eventWithHash);
}

export function logEscalationTriggered(
  context: EscalationContext,
  profile: EscalationProfile
): void {
  logEvent({
    schema_version: '1.0.0',
    event_id: generateUUIDv7(),
    eventType: 'escalation_triggered',
    ts: new Date().toISOString(),
    // ... other required fields
    payload: {
      trigger: context.trigger,
      errorCountAtEscalation: context.errorCount,
      timeToEscalationMs: context.timeSpentMs,
      hintViewsToEscalation: context.hintCount,
      profileId: profile.id,
      // Required for counterfactual replay
      propensity: calculatePropensity(context, profile)
    }
  });
}
```

---

## `hint_view` and `hintId`

### Policy

`hint_view` events preserve `hintId`. This is required for tracking which specific hints are used, comparing hint strategies, modeling hints as items, and reconstructing exact learner interaction sequences.

### Why `hintId` is required

- `hint_view` represents a **runtime observation** that a learner viewed a generated hint (L1 micro-hint, L2 guiding question, or L3 strategic hint).
- The hint content can be dynamically generated, but the event must still carry a stable `hintId` for item-level analysis.
- When an authored hint asset is unavailable, the runtime derives a deterministic ID from the SQL-Engage subtype, row anchor, and hint level.

### Required hint fields

When a `hint_view` event is emitted, the following fields capture the pedagogical context:

| Field | Purpose |
|-------|---------|
| `hintId` | Stable identifier for the viewed hint item |
| `hintLevel` | 1, 2, or 3 indicating the guidance-ladder rung shown |
| `hintText` | The actual rendered hint text shown to the learner |
| `sqlEngageSubtype` | The SQL-Engage error subtype that triggered the hint |
| `sqlEngageRowId` | A deterministic anchor mapping the hint to the CSV taxonomy |
| `policyVersion` | The version of the hint-selection policy in effect |

### Preservation layers

The preservation contract is enforced across the runtime path:

1. **Hint generation** (`apps/web/src/app/components/features/hints/HintSystem.tsx`) — assigns a stable `hintId` to every `hint_view`.
2. **Frontend storage normalization** (`apps/web/src/app/lib/storage/storage.ts`) — preserves existing `hintId` or derives a deterministic fallback before persisting.
3. **API client** (`apps/web/src/app/lib/api/storage-client.ts`) — includes `hintId` in backend interaction payloads.
4. **Database write path** (`apps/server/src/db/neon.ts`) — maps `hintId` to `interaction_events.hint_id`.
5. **DB read path** (`apps/server/src/db/neon.ts`) — returns `hintId` from stored `hint_id` rows.

---

## Client-Side Data Caching and Privacy Notes

### Architecture

SQL-Adapt uses a **dual-storage layer** in the browser. `localStorage` serves as a synchronous cache for all student data regardless of whether the app is running in frontend-only mode or backend-connected mode. Events, profiles, sessions, and textbook units are written to `localStorage` immediately and then synced to the backend opportunistically.

### Session-end backend confirmation

For normal React cleanup paths, `session_end` is emitted only after the dual-storage layer verifies that prior session interactions are present in the backend. If verification fails, the `session_end` event remains queued for retry instead of being treated as backend-confirmed.

Browser `pagehide` is a lifecycle edge case: the app queues `session_end` locally and attempts an immediate backend flush, but the browser may terminate asynchronous work before confirmation. Treat `pagehide` `session_end` handling as queued/best-effort unless a dedicated beacon or keepalive endpoint is added.

### What is cached

The following categories of data are stored in the browser's `localStorage`:

- **Interaction events** (including `hint_view`, `query_submitted`, `error_classified`, etc.)
- **Learner profiles** (concepts covered, error history, preferences)
- **Active sessions** (session IDs, current problem, draft code, guidance state)
- **Textbook units** ("My Textbook" content)
- **SQL drafts** and **LLM cache entries**
- **PDF metadata** and corpus references

### Implications for research

Exported research datasets are sourced from `localStorage` at the time of export, not directly from the server backend. This means:

- Exports reflect the **browser cache state** at the moment of export.
- Unsynced events that exist only in `localStorage` will be included.
- Conversely, events that have been pruned or cleared from `localStorage` will be missing even if they were previously persisted to the backend.

### Privacy and shared-device concerns

Data is stored **unencrypted in `localStorage`** and persists across browser sessions until explicitly cleared. On shared devices (e.g., library computers, classroom tablets), subsequent users of the same browser profile may be able to access prior learner data via browser dev tools.

### Current mitigations

- **7-day session expiry** — stale session data is considered expired and may be overwritten.
- **Pseudonymous learner IDs** — profiles use opaque IDs rather than real names.
- **Raw-SQL hashing** — the spec requires SQL content to be hashed, not stored verbatim, reducing the sensitivity of logged query text.
- **Backend sync** — when a backend is available, events are mirrored to the server for durable storage.

---

## Validation Checklist

Before claiming reproducibility, verify:

- [ ] All events have `schema_version`
- [ ] All events have unique `event_id`
- [ ] All events have `trace_id` for correlation
- [ ] Timestamps are ISO-8601 UTC
- [ ] Learner IDs are pseudonymous
- [ ] SQL content is hashed, not stored
- [ ] API keys are redacted
- [ ] Schema validators exist for all event types
- [ ] Config files capture all thresholds/toggles
- [ ] Environment.lock captures versions
- [ ] Git commit hash recorded
- [ ] Figures include generation script references

---

*Last updated: 2026-03-03*  
*Schema Version: 1.0.0*
