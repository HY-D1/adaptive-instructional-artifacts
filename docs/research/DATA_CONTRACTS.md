# Research Data Contracts

**Version:** 1.0.0  
**Last Updated:** 2026-04-09  
**Status:** Active

---

## Overview

This document defines the complete data contract for research data exports from the Adaptive Instructional Artifacts system. It specifies field semantics, ordering guarantees, reproducibility requirements, completeness thresholds, and semantic requirements for data to be considered suitable for academic paper analysis.

---

## Export Endpoints

| Endpoint | Method | Format | Purpose |
|----------|--------|--------|---------|
| `/api/research/summary` | GET | JSON/CSV | Class-level summary with interactions |
| `/api/research/learners` | GET | JSON | Learner list with summary stats |
| `/api/research/aggregates` | GET | JSON | Aggregated class statistics |
| `/api/instructor/export` | GET | JSON/NDJSON | Paginated learner data export |

---

## Field Preservation Contract

The following fields are guaranteed to be preserved in all exports:

### Core Identity Fields
| Field | Type | Description | Paper Threshold |
|-------|------|-------------|-----------------|
| `id` | string | Unique interaction identifier (UUID) | ≥ 99% |
| `learnerId` | string | Reference to users.id | ≥ 99% |
| `sectionId` | string \| null | Reference to course_sections.id | ≥ 99% |
| `sessionId` | string | Session identifier for replay grouping | ≥ 99% |
| `timestamp` | ISO 8601 | Event timestamp (UTC) | ≥ 99% |
| `createdAt` | ISO 8601 | Record creation timestamp | ≥ 99% |

### Event Fields
| Field | Type | Description | Paper Threshold |
|-------|------|-------------|-----------------|
| `eventType` | string | Type of interaction event | ≥ 99% |
| `problemId` | string | Reference to problem being attempted | ≥ 99% |
| `problemSetId` | string \| null | Parent problem set identifier | ≥ 99% |
| `problemNumber` | number \| null | Position within problem set | ≥ 99% |

### Content Fields
| Field | Type | Description | Paper Threshold |
|-------|------|-------------|-----------------|
| `code` | string \| null | SQL code submitted (if applicable) | ≥ 99% |
| `error` | string \| null | Error message (if applicable) | ≥ 99% |
| `errorSubtypeId` | string \| null | Categorized error identifier | ≥ 99% |
| `hintId` | string \| null | Hint identifier (if hint shown) | ≥ 99% |
| `hintText` | string \| null | Hint content (if captured) | ≥ 99% |
| `hintLevel` | number \| null | Hint escalation level | ≥ 99% |
| `templateId` | string \| null | Template identifier for pedagogical classification | ≥ 99% |
| `sqlEngageSubtype` | string \| null | Error subtype from SQL-Engage taxonomy | ≥ 99% |
| `sqlEngageRowId` | string \| null | Deterministic anchor for taxonomy linkage | ≥ 99% |
| `policyVersion` | string \| null | Version of hint policy in effect | ≥ 99% |
| `helpRequestIndex` | number \| null | Sequence number for the help ladder | ≥ 99% |

### Adaptive System Fields
| Field | Type | Description | Paper Threshold |
|-------|------|-------------|-----------------|
| `hdi` | number \| null | Help Dependency Index value | ≥ 99% |
| `hdiLevel` | string \| null | HDI category (low/medium/high) | ≥ 99% |
| `hdiComponents` | object \| null | Detailed HDI calculation inputs | ≥ 99% |
| `profileId` | string \| null | Assigned learner profile | ≥ 99% |
| `assignmentStrategy` | string \| null | How profile was assigned | ≥ 99% |
| `banditState` | object \| null | Thompson sampling state (if used) | ≥ 99% |

### Session Fields
| Field | Type | Description | Paper Threshold |
|-------|------|-------------|-----------------|
| `totalTime` | number \| null | Total session time in milliseconds | ≥ 99% |
| `problemsAttempted` | number \| null | Number of problems attempted | ≥ 99% |
| `problemsSolved` | number \| null | Number of problems successfully solved | ≥ 99% |

### Replay Fields
| Field | Type | Description | Paper Threshold |
|-------|------|-------------|-----------------|
| `payload` | object \| null | Complete event payload for reconstruction | ≥ 99% |
| `sourceInteractionIds` | string[] \| null | References to triggering events | ≥ 99% |
| `triggerReason` | string \| null | Why this event occurred | ≥ 99% |

### Code Change Fields
| Field | Type | Description | Paper Threshold |
|-------|------|-------------|-----------------|
| `inputs.previousCodeHash` | string \| null | Hash of code before change | ≥ 99% |
| `outputs.codeHash` | string \| null | Hash of code after change | ≥ 99% |
| `outputs.draftLength` | number \| null | Character count after change | ≥ 99% |
| `outputs.charsAdded` | number \| null | Characters added | ≥ 99% |
| `outputs.charsDeleted` | number \| null | Characters deleted | ≥ 99% |
| `outputs.editBurstId` | string \| null | Identifier for burst grouping | ≥ 99% |

---

## Completeness Thresholds

All percentages are calculated as `non_null_count / total_count`.

### hint_view Events
| Field | Threshold | Rationale |
|-------|-----------|-----------|
| `hint_id` | ≥ 99% | Every hint view must have a stable identifier for item-level analysis |
| `template_id` | ≥ 99% | Template provenance is required for pedagogical analysis |
| `hint_text` | ≥ 99% | The actual rendered text must be captured |
| `hint_level` | ≥ 99% | Level (1/2/3) is required for ladder analysis |
| `sql_engage_subtype` | ≥ 99% | Error subtype for categorization |
| `sql_engage_row_id` | ≥ 99% | Deterministic anchor for taxonomy linkage |
| `policy_version` | ≥ 99% | Policy version for reproducibility |
| `help_request_index` | ≥ 99% | Sequence number for the help ladder |

### concept_view Events
| Field | Threshold | Rationale |
|-------|-----------|-----------|
| `concept_id` | ≥ 99% | Concept being viewed |
| `source` | ≥ 99% | Source of the view (problem/hint/textbook) |

### session_end Events
| Field | Threshold | Rationale |
|-------|-----------|-----------|
| `total_time` | ≥ 99% | Total session duration |
| `problems_attempted` | ≥ 99% | Count for engagement metrics |
| `problems_solved` | ≥ 99% | Count for success metrics |

### code_change Events
| Metric | Threshold | Rationale |
|--------|-----------|-----------|
| Burst ratio | ≤ 30% | Max 30% of code_changes under 1s apart (indicates proper debouncing) |

---

## Event Type Taxonomy

### Core Event Types

Guaranteed event types for filtering:

| Type | Description |
|------|-------------|
| `code_change` | SQL code modified (debounced - represents logical editing sessions, not individual keystrokes) |
| `code_execute` | Query executed |
| `hint_request` | Learner requested hint |
| `hint_show` | Hint displayed to learner |
| `hint_view` | Learner viewed a generated hint |
| `explanation_request` | Learner requested explanation |
| `explanation_show` | Explanation displayed |
| `guidance_escalate` | Escalation triggered |
| `problem_solved` | Problem completed successfully |
| `problem_skip` | Problem skipped |
| `bandit_arm_selected` | Adaptive arm chosen |
| `bandit_reward_observed` | Reward signal captured |
| `textbook_unit_created` | Note added to textbook |

### Detailed Event Specifications

#### hint_view

A `hint_view` event represents a learner viewing a generated hint. These events are critical for:
- Hint effectiveness analysis
- Guidance ladder progression studies
- Template efficacy comparison

**Required Fields**:
- `hint_id`: Stable identifier (UUID or deterministic string)
- `hint_text`: Full rendered hint text
- `hint_level`: 1, 2, or 3
- `template_id`: Template identifier for pedagogical classification
- `sql_engage_subtype`: Error subtype from SQL-Engage taxonomy
- `sql_engage_row_id`: Deterministic row anchor
- `policy_version`: Version of hint policy in effect
- `help_request_index`: Sequence number (1, 2, 3...)
- `session_id`: Session context
- `problem_id`: Problem context
- `timestamp`: Event timestamp

#### concept_view

A `concept_view` event represents a learner viewing a concept. These events enable:
- Concept engagement tracking
- Learning path analysis
- Source attribution

**Required Fields**:
- `concept_id`: Concept identifier
- `source`: One of `'problem'`, `'hint'`, `'textbook'`
- `session_id`: Session context
- `problem_id`: Problem context (if applicable)
- `timestamp`: Event timestamp

#### session_end

A `session_end` event marks the end of a learning session. These events enable:
- Session duration analysis
- Engagement level classification
- Outcome correlation

**Required Fields**:
- `total_time`: Total session time in milliseconds
- `problems_attempted`: Number of problems attempted
- `problems_solved`: Number of problems successfully solved
- `session_id`: Session identifier
- `timestamp`: Event timestamp

#### code_change

A `code_change` event represents a meaningful code edit. **These are debounced** - they represent logical editing sessions, not individual keystrokes.

**Required Fields**:
- `inputs.previousCodeHash`: Hash of code before change
- `outputs.codeHash`: Hash of code after change
- `outputs.draftLength`: Character count after change
- `outputs.charsAdded`: Characters added
- `outputs.charsDeleted`: Characters deleted
- `outputs.editBurstId`: Identifier for burst grouping
- `session_id`: Session context
- `problem_id`: Problem context
- `timestamp`: Event timestamp

**Burst Metrics**:
- Events under 1 second apart should be ≤ 30% of all code_change events
- This indicates proper debouncing is in effect

---

## Ordering & Pagination

### Ordering Guarantees

#### Interaction Events
- **Primary sort:** `timestamp DESC` (newest first)
- **Secondary sort:** `id ASC` (for deterministic tie-breaking)

#### Learner Lists
- **Primary sort:** `name ASC` (alphabetical by display name)
- **Secondary sort:** `id ASC` (for deterministic tie-breaking)

### Export Reproducibility

All exports include:
1. `exportedAt`: ISO 8601 timestamp of export generation
2. `exportMetadata.actorRole`: Who initiated the export
3. `exportMetadata.actorId`: Identifier of exporting user
4. `exportMetadata.sectionIds`: Sections included in export

### Pagination Contract

#### Request Parameters
| Parameter | Type | Default | Max | Description |
|-----------|------|---------|-----|-------------|
| `page` | integer | 1 | - | Page number (1-indexed) |
| `perPage` | integer | 50 | 200 | Items per page |

#### Response Metadata
```json
{
  "pagination": {
    "page": 1,
    "perPage": 50,
    "total": 150,
    "hasMore": true
  }
}
```

#### Streaming Mode

For large exports, use `?stream=true`:
- Returns NDJSON (newline-delimited JSON)
- Each line is a complete JSON object
- No in-memory array construction on server
- Client processes stream incrementally

---

## Memory Safety Limits

| Resource | Limit | Behavior When Exceeded |
|----------|-------|------------------------|
| Learners per summary | 100 | HTTP 400 with error code |
| Interactions per learner | 10,000 | Warning in response, truncated |
| Estimated payload size | 100MB | HTTP 413, suggest streaming |
| Learners per page | 200 | Hard cap enforced |

---

## Date Range Filtering

All date parameters accept ISO 8601 format:
- `startDate`: Inclusive lower bound
- `endDate`: Inclusive upper bound

Examples:
- `2026-04-01` (date only, assumes midnight)
- `2026-04-01T00:00:00Z` (explicit UTC)
- `2026-04-01T12:00:00-07:00` (with timezone)

---

## CSV Export Format

When `?format=csv` is specified:

1. Header row with field names (snake_case)
2. One row per interaction
3. JSON objects are stringified in cells
4. Newlines in content are escaped as `\n`
5. UTF-8 encoding guaranteed

---

## Derived Exports

The following derived exports are generated from raw telemetry:

### hint_events.csv/json

Enriched hint view data for direct analysis.

Fields:
- All `hint_view` fields from raw events
- `prev_hint_id`: Previous hint in sequence (if any)
- `time_since_prev_hint_ms`: Time delta

### hint_response_windows.csv/json

Post-hint behavioral analysis window.

Fields:
- `hint_event_id`: Reference to hint_view event
- `window_start_ms`: Timestamp of hint_view
- `window_end_ms`: Timestamp of next hint, problem change, or session end
- `events_after_hint`: Count of events in window
- `code_changes_after_hint`: Count of code edits
- `executions_after_hint`: Count of query executions
- `errors_after_hint`: Count of errors
- `next_hint_requested`: Whether learner requested another hint
- `next_hint_viewed`: Whether learner viewed another hint
- `escalated_after_hint`: Whether escalation occurred
- `left_problem_without_execution`: Whether learner left without running code
- `window_closed_by`: One of `next_hint`, `problem_change`, `session_end`, `end_of_trace`

### escalation_events.csv/json

Enriched escalation data for policy analysis.

Fields:
- All escalation fields from raw events
- `escalation_duration_ms`: Time from trigger to resolution
- `hints_before_escalation`: Count of hints viewed
- `errors_before_escalation`: Count of errors

---

## SQL Audit Queries

### Hint View Completeness

```sql
SELECT 
  COUNT(*) as total_hint_views,
  COUNT(hint_id) FILTER (WHERE hint_id IS NOT NULL AND btrim(hint_id) != '') as hint_id_present,
  COUNT(template_id) FILTER (WHERE template_id IS NOT NULL AND btrim(template_id) != '') as template_id_present,
  COUNT(hint_text) FILTER (WHERE hint_text IS NOT NULL AND btrim(hint_text) != '') as hint_text_present,
  COUNT(hint_level) FILTER (WHERE hint_level IS NOT NULL) as hint_level_present
FROM interaction_events 
WHERE event_type = 'hint_view';
```

### Editor Burst Noise

```sql
WITH code_changes AS (
  SELECT 
    id,
    timestamp,
    LAG(timestamp) OVER (ORDER BY timestamp) as prev_timestamp
  FROM interaction_events
  WHERE event_type = 'code_change'
)
SELECT 
  COUNT(*) as total_code_changes,
  COUNT(*) FILTER (WHERE prev_timestamp IS NOT NULL 
                   AND EXTRACT(EPOCH FROM (timestamp::timestamp - prev_timestamp::timestamp)) < 1) as under_1s,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE prev_timestamp IS NOT NULL 
                             AND EXTRACT(EPOCH FROM (timestamp::timestamp - prev_timestamp::timestamp)) < 1) 
    / COUNT(*), 
    2
  ) as pct_under_1s
FROM code_changes;
```

### Post-Hint Outcomes

```sql
-- For a specific hint event, find subsequent behavior
WITH hint_events AS (
  SELECT 
    id as hint_id,
    session_id,
    problem_id,
    timestamp as hint_timestamp,
    LEAD(timestamp) OVER (
      PARTITION BY session_id, problem_id 
      ORDER BY timestamp
    ) as next_event_time
  FROM interaction_events
  WHERE event_type = 'hint_view'
)
SELECT 
  h.hint_id,
  COUNT(e.id) as events_after_hint,
  COUNT(e.id) FILTER (WHERE e.event_type = 'code_change') as code_changes,
  COUNT(e.id) FILTER (WHERE e.event_type = 'execution') as executions,
  COUNT(e.id) FILTER (WHERE e.event_type = 'error') as errors,
  COUNT(e.id) FILTER (WHERE e.event_type = 'hint_view') as next_hints
FROM hint_events h
LEFT JOIN interaction_events e ON 
  e.session_id = h.session_id 
  AND e.problem_id = h.problem_id
  AND e.timestamp > h.hint_timestamp
  AND (h.next_event_time IS NULL OR e.timestamp < h.next_event_time)
GROUP BY h.hint_id;
```

---

## Validation Commands

### Export Validation

```bash
# Verify export endpoint responds
npm run research:validate

# Check export format compliance
node scripts/export/export-policies.mjs

# Verify data integrity
node scripts/replay-checksum-gate.mjs
```

### Research Readiness Gate

Run the research-readiness gate:

```bash
npm run research:gate
```

This will:
1. Check all completeness thresholds
2. Report pass/fail status for each metric
3. Exit with code 0 if all thresholds met, 1 otherwise

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-04-09 | Merged export and paper data contracts |
| 1.0.0 (export) | 2026-04-08 | Initial export contract |
| paper-data-contract-v1 | 2026-04-07 | Initial research-ready contract |

---

## Related Documents

- `docs/research/LOGGING_SPECIFICATION.md` - Full telemetry specification
- `docs/runbooks/beta-telemetry-readiness.md` - Beta readiness checklist
- `docs/operations/STATUS.md` - Current system status
- `docs/audit/neon-research-readiness-sql-queries-2026-04-07.sql` - Audit SQL bundle
- `docs/audit/RESEARCH_DATA_PIPELINE_VERIFICATION_REPORT.md` - Pipeline verification (2026-04-08)
