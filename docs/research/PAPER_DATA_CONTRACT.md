# Paper Data Contract

**Version**: paper-data-contract-v1  
**Last Updated**: 2026-04-07  
**Status**: Active Development

This document defines the research-ready data contract for SQL-Adapt telemetry. It specifies the completeness thresholds and semantic requirements for data to be considered suitable for academic paper analysis.

## Overview

The paper data contract goes beyond the beta-readiness checklist. While beta readiness checks that signals exist and schema is correct, the paper contract enforces **row-level completeness** and **semantic correctness**.

## Thresholds

All percentages are calculated as `non_null_count / total_count`.

| Field Group | Field | Threshold | Rationale |
|-------------|-------|-----------|-----------|
| **hint_view** | `hint_id` | ≥ 99% | Every hint view must have a stable identifier for item-level analysis |
| **hint_view** | `template_id` | ≥ 99% | Template provenance is required for pedagogical analysis |
| **hint_view** | `hint_text` | ≥ 99% | The actual rendered text must be captured |
| **hint_view** | `hint_level` | ≥ 99% | Level (1/2/3) is required for ladder analysis |
| **hint_view** | `sql_engage_subtype` | ≥ 99% | Error subtype for categorization |
| **hint_view** | `sql_engage_row_id` | ≥ 99% | Deterministic anchor for taxonomy linkage |
| **hint_view** | `policy_version` | ≥ 99% | Policy version for reproducibility |
| **hint_view** | `help_request_index` | ≥ 99% | Sequence number for the help ladder |
| **concept_view** | `concept_id` | ≥ 99% | Concept being viewed |
| **concept_view** | `source` | ≥ 99% | Source of the view (problem/hint/textbook) |
| **session_end** | `total_time` | ≥ 99% | Total session duration |
| **session_end** | `problems_attempted` | ≥ 99% | Count for engagement metrics |
| **session_end** | `problems_solved` | ≥ 99% | Count for success metrics |
| **code_change** | burst ratio | ≤ 30% | Max 30% of code_changes under 1s apart |

## Event Types

### hint_view

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

### concept_view

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

### session_end

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

### code_change

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

## Validation Gate

Run the research-readiness gate:

```bash
npm run research:gate
```

This will:
1. Check all completeness thresholds
2. Report pass/fail status for each metric
3. Exit with code 0 if all thresholds met, 1 otherwise

## Version History

| Version | Date | Changes |
|---------|------|---------|
| paper-data-contract-v1 | 2026-04-07 | Initial research-ready contract |

## Related Documents

- `docs/research/LOGGING_SPECIFICATION.md` - Full telemetry specification
- `docs/runbooks/beta-telemetry-readiness.md` - Beta readiness checklist
- `docs/runbooks/status.md` - Current system status
- `docs/audit/neon-research-readiness-sql-queries-2026-04-07.sql` - Audit SQL bundle
- `docs/audit/RESEARCH_DATA_PIPELINE_VERIFICATION_REPORT.md` - Pipeline verification (2026-04-08)
