-- Neon research-readiness audit SQL, 2026-04-07.
-- Secrets omitted. Replace :audit_start, :audit_learner_id, and :audit_session_id
-- when rerunning against a new audited session.

-- Captured audit session used for evidence artifact 07:
-- :audit_start = '2026-04-07T22:34:53.915Z'
-- :audit_learner_id = 'abb443fe-ce38-4fd3-a0bb-7a84ffa1cf87'
-- :audit_session_id = 'session-1775601297009-rbpg9kg'

-- ============================================================================
-- Paper Data Contract: Core Completeness Checks
-- ============================================================================

-- Hint view completeness summary (all required fields).
SELECT 
  COUNT(*) AS total_hint_views,
  COUNT(hint_id) FILTER (WHERE hint_id IS NOT NULL AND btrim(hint_id) != '') AS hint_id_present,
  ROUND(100.0 * COUNT(hint_id) FILTER (WHERE hint_id IS NOT NULL AND btrim(hint_id) != '') / COUNT(*), 2) AS hint_id_pct,
  COUNT(hint_text) FILTER (WHERE hint_text IS NOT NULL AND btrim(hint_text) != '') AS hint_text_present,
  ROUND(100.0 * COUNT(hint_text) FILTER (WHERE hint_text IS NOT NULL AND btrim(hint_text) != '') / COUNT(*), 2) AS hint_text_pct,
  COUNT(hint_level) FILTER (WHERE hint_level IS NOT NULL) AS hint_level_present,
  ROUND(100.0 * COUNT(hint_level) FILTER (WHERE hint_level IS NOT NULL) / COUNT(*), 2) AS hint_level_pct,
  COUNT(template_id) FILTER (WHERE template_id IS NOT NULL AND btrim(template_id) != '') AS template_id_present,
  ROUND(100.0 * COUNT(template_id) FILTER (WHERE template_id IS NOT NULL AND btrim(template_id) != '') / COUNT(*), 2) AS template_id_pct,
  COUNT(help_request_index) FILTER (WHERE help_request_index IS NOT NULL) AS help_index_present,
  ROUND(100.0 * COUNT(help_request_index) FILTER (WHERE help_request_index IS NOT NULL) / COUNT(*), 2) AS help_index_pct,
  COUNT(sql_engage_subtype) FILTER (WHERE sql_engage_subtype IS NOT NULL AND btrim(sql_engage_subtype) != '') AS subtype_present,
  ROUND(100.0 * COUNT(sql_engage_subtype) FILTER (WHERE sql_engage_subtype IS NOT NULL AND btrim(sql_engage_subtype) != '') / COUNT(*), 2) AS subtype_pct,
  COUNT(sql_engage_row_id) FILTER (WHERE sql_engage_row_id IS NOT NULL AND btrim(sql_engage_row_id) != '') AS row_id_present,
  ROUND(100.0 * COUNT(sql_engage_row_id) FILTER (WHERE sql_engage_row_id IS NOT NULL AND btrim(sql_engage_row_id) != '') / COUNT(*), 2) AS row_id_pct,
  COUNT(policy_version) FILTER (WHERE policy_version IS NOT NULL AND btrim(policy_version) != '') AS policy_version_present,
  ROUND(100.0 * COUNT(policy_version) FILTER (WHERE policy_version IS NOT NULL AND btrim(policy_version) != '') / COUNT(*), 2) AS policy_version_pct
FROM interaction_events 
WHERE event_type = 'hint_view';

-- Post-cutoff hint view completeness.
SELECT 
  COUNT(*) AS total_hint_views,
  COUNT(hint_id) FILTER (WHERE hint_id IS NOT NULL AND btrim(hint_id) != '') AS hint_id_present,
  COUNT(template_id) FILTER (WHERE template_id IS NOT NULL AND btrim(template_id) != '') AS template_id_present,
  COUNT(hint_text) FILTER (WHERE hint_text IS NOT NULL AND btrim(hint_text) != '') AS hint_text_present
FROM interaction_events 
WHERE event_type = 'hint_view'
  AND created_at >= :audit_start::timestamptz;

-- ============================================================================
-- Audit accounts created during the dry run.
SELECT id, email, role, learner_id, name, created_at
FROM auth_accounts
WHERE email LIKE 'neon-readiness-audit-%@sql-adapt.test'
ORDER BY created_at DESC
LIMIT 20;

-- Audit learner and section linkage.
SELECT u.id AS learner_id, u.name AS learner_name, s.id AS section_id,
       s.name AS section_name, e.joined_at
FROM users u
LEFT JOIN section_enrollments e ON e.student_user_id = u.id
LEFT JOIN course_sections s ON s.id = e.section_id
WHERE u.id = :audit_learner_id;

-- ============================================================================
-- Global missing hint IDs.
SELECT COUNT(*) AS missing_hint_id
FROM interaction_events
WHERE event_type = 'hint_view' AND hint_id IS NULL;

-- Post-cutoff missing hint IDs.
SELECT COUNT(*) AS missing_hint_id
FROM interaction_events
WHERE event_type = 'hint_view'
  AND hint_id IS NULL
  AND created_at >= :audit_start::timestamptz;

-- Audit-learner missing hint IDs.
SELECT COUNT(*) AS missing_hint_id
FROM interaction_events
WHERE user_id = :audit_learner_id
  AND event_type = 'hint_view'
  AND hint_id IS NULL
  AND created_at >= :audit_start::timestamptz;

-- Missing template_id (Paper Data Contract).
SELECT COUNT(*) AS missing_template_id
FROM interaction_events
WHERE event_type = 'hint_view'
  AND (template_id IS NULL OR btrim(template_id) = '')
  AND created_at >= :audit_start::timestamptz;

-- ============================================================================
-- Concept-view completeness.
SELECT COUNT(*) AS bad_concept_rows
FROM interaction_events
WHERE event_type = 'concept_view'
  AND (concept_id IS NULL OR source IS NULL)
  AND created_at >= :audit_start::timestamptz;

-- Concept view completeness summary.
SELECT 
  COUNT(*) AS total_concept_views,
  COUNT(concept_id) FILTER (WHERE concept_id IS NOT NULL AND btrim(concept_id) != '') AS concept_id_present,
  ROUND(100.0 * COUNT(concept_id) FILTER (WHERE concept_id IS NOT NULL AND btrim(concept_id) != '') / COUNT(*), 2) AS concept_id_pct,
  COUNT(source) FILTER (WHERE source IS NOT NULL AND btrim(source) != '') AS source_present,
  ROUND(100.0 * COUNT(source) FILTER (WHERE source IS NOT NULL AND btrim(source) != '') / COUNT(*), 2) AS source_pct
FROM interaction_events 
WHERE event_type = 'concept_view';

-- ============================================================================
-- Session-end completeness.
SELECT COUNT(*) AS bad_session_end_rows
FROM interaction_events
WHERE event_type = 'session_end'
  AND (total_time IS NULL OR problems_attempted IS NULL OR problems_solved IS NULL)
  AND created_at >= :audit_start::timestamptz;

-- Session end completeness summary.
SELECT 
  COUNT(*) AS total_session_ends,
  COUNT(total_time) FILTER (WHERE total_time IS NOT NULL) AS total_time_present,
  ROUND(100.0 * COUNT(total_time) FILTER (WHERE total_time IS NOT NULL) / COUNT(*), 2) AS total_time_pct,
  COUNT(problems_attempted) FILTER (WHERE problems_attempted IS NOT NULL) AS attempted_present,
  ROUND(100.0 * COUNT(problems_attempted) FILTER (WHERE problems_attempted IS NOT NULL) / COUNT(*), 2) AS attempted_pct,
  COUNT(problems_solved) FILTER (WHERE problems_solved IS NOT NULL) AS solved_present,
  ROUND(100.0 * COUNT(problems_solved) FILTER (WHERE problems_solved IS NOT NULL) / COUNT(*), 2) AS solved_pct
FROM interaction_events 
WHERE event_type = 'session_end';

-- ============================================================================
-- Editor telemetry burst metrics (Paper Data Contract).
-- ============================================================================

-- Code change burst analysis.
WITH code_changes AS (
  SELECT 
    id,
    timestamp,
    LAG(timestamp) OVER (ORDER BY timestamp) AS prev_timestamp
  FROM interaction_events
  WHERE event_type = 'code_change'
    AND created_at >= :audit_start::timestamptz
)
SELECT 
  COUNT(*) AS total_code_changes,
  COUNT(*) FILTER (WHERE prev_timestamp IS NOT NULL 
                   AND EXTRACT(EPOCH FROM (timestamp::timestamp - prev_timestamp::timestamp)) < 1) AS under_1s,
  ROUND(100.0 * COUNT(*) FILTER (WHERE prev_timestamp IS NOT NULL 
                                 AND EXTRACT(EPOCH FROM (timestamp::timestamp - prev_timestamp::timestamp)) < 1) 
    / COUNT(*), 2) AS pct_under_1s,
  COUNT(*) FILTER (WHERE prev_timestamp IS NOT NULL 
                   AND EXTRACT(EPOCH FROM (timestamp::timestamp - prev_timestamp::timestamp)) < 5) AS under_5s,
  ROUND(100.0 * COUNT(*) FILTER (WHERE prev_timestamp IS NOT NULL 
                                 AND EXTRACT(EPOCH FROM (timestamp::timestamp - prev_timestamp::timestamp)) < 5) 
    / COUNT(*), 2) AS pct_under_5s
FROM code_changes;

-- Average code changes after a hint (Paper Data Contract).
WITH hint_events AS (
  SELECT 
    id AS hint_id,
    session_id,
    problem_id,
    timestamp AS hint_timestamp,
    LEAD(timestamp) OVER (PARTITION BY session_id, problem_id ORDER BY timestamp) AS next_event_time
  FROM interaction_events
  WHERE event_type = 'hint_view'
    AND created_at >= :audit_start::timestamptz
),
code_changes_after_hint AS (
  SELECT 
    h.hint_id,
    COUNT(e.id) AS code_change_count
  FROM hint_events h
  LEFT JOIN interaction_events e ON 
    e.session_id = h.session_id 
    AND e.problem_id = h.problem_id
    AND e.event_type = 'code_change'
    AND e.timestamp > h.hint_timestamp
    AND (h.next_event_time IS NULL OR e.timestamp < h.next_event_time)
  GROUP BY h.hint_id
)
SELECT 
  COUNT(*) AS total_hints,
  ROUND(AVG(code_change_count), 2) AS avg_code_changes_after_hint,
  MAX(code_change_count) AS max_code_changes_after_hint,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY code_change_count) AS median_code_changes_after_hint
FROM code_changes_after_hint;

-- ============================================================================
-- Post-hint outcome derivation (Paper Data Contract - Message 4/5).
-- ============================================================================

-- Hint response window analysis.
WITH hint_events AS (
  SELECT 
    id AS hint_event_id,
    session_id,
    problem_id,
    hint_id,
    hint_text,
    hint_level,
    template_id,
    timestamp AS hint_timestamp,
    LEAD(timestamp) OVER (PARTITION BY session_id, problem_id ORDER BY timestamp) AS next_event_time,
    ROW_NUMBER() OVER (PARTITION BY session_id, problem_id ORDER BY timestamp) AS hint_sequence
  FROM interaction_events
  WHERE event_type = 'hint_view'
    AND created_at >= :audit_start::timestamptz
),
hint_outcomes AS (
  SELECT 
    h.hint_event_id,
    h.hint_id,
    h.hint_level,
    h.template_id,
    h.hint_timestamp,
    COUNT(e.id) AS events_after_hint,
    COUNT(e.id) FILTER (WHERE e.event_type = 'code_change') AS code_changes_after_hint,
    COUNT(e.id) FILTER (WHERE e.event_type = 'execution') AS executions_after_hint,
    COUNT(e.id) FILTER (WHERE e.event_type = 'error') AS errors_after_hint,
    COUNT(e.id) FILTER (WHERE e.event_type = 'hint_view') AS next_hint_viewed,
    BOOL_OR(e.event_type = 'escalation_triggered' OR e.event_type = 'guidance_escalate') AS escalated_after_hint,
    BOOL_OR(e.event_type = 'execution' AND e.successful = true) AS had_successful_execution,
    MIN(e.timestamp) FILTER (WHERE e.event_type IN ('code_change', 'execution', 'error', 'hint_view')) AS first_event_after_hint,
    CASE 
      WHEN COUNT(e.id) FILTER (WHERE e.event_type = 'hint_view') > 0 THEN 'next_hint'
      WHEN COUNT(e.id) FILTER (WHERE e.event_type = 'problem_change' OR e.event_type = 'problem_change_request') > 0 THEN 'problem_change'
      WHEN COUNT(e.id) FILTER (WHERE e.event_type = 'session_end') > 0 THEN 'session_end'
      WHEN h.next_event_time IS NULL THEN 'end_of_trace'
      ELSE 'other'
    END AS window_closed_by
  FROM hint_events h
  LEFT JOIN interaction_events e ON 
    e.session_id = h.session_id 
    AND e.problem_id = h.problem_id
    AND e.timestamp > h.hint_timestamp
    AND (h.next_event_time IS NULL OR e.timestamp < h.next_event_time)
  GROUP BY h.hint_event_id, h.hint_id, h.hint_level, h.template_id, h.hint_timestamp, h.next_event_time
)
SELECT 
  hint_event_id,
  hint_id,
  hint_level,
  template_id,
  hint_timestamp,
  first_event_after_hint,
  events_after_hint,
  code_changes_after_hint,
  executions_after_hint,
  errors_after_hint,
  next_hint_viewed,
  escalated_after_hint,
  NOT had_successful_execution AS left_problem_without_execution,
  window_closed_by
FROM hint_outcomes
ORDER BY hint_timestamp
LIMIT 100;

-- ============================================================================
-- Session-level hint outcome summary.
SELECT 
  session_id,
  problem_id,
  COUNT(*) FILTER (WHERE event_type = 'hint_view') AS hints_viewed,
  COUNT(*) FILTER (WHERE event_type = 'execution' AND successful = true) AS successful_executions,
  COUNT(*) FILTER (WHERE event_type = 'error') AS errors,
  COUNT(*) FILTER (WHERE event_type = 'escalation_triggered' OR event_type = 'guidance_escalate') AS escalations
FROM interaction_events
WHERE created_at >= :audit_start::timestamptz
GROUP BY session_id, problem_id
HAVING COUNT(*) FILTER (WHERE event_type = 'hint_view') > 0
ORDER BY hints_viewed DESC
LIMIT 50;

-- ============================================================================
-- Audit-session timestamp sanity.
SELECT event_type, session_id, problem_id, timestamp, created_at
FROM interaction_events
WHERE session_id = :audit_session_id
ORDER BY timestamp ASC, created_at ASC
LIMIT 200;

-- Audit-learner monotonicity check.
SELECT COUNT(*) AS timestamp_monotonicity_violations
FROM (
  SELECT timestamp,
         LAG(timestamp) OVER (ORDER BY timestamp ASC, created_at ASC, id ASC) AS prev_timestamp
  FROM interaction_events
  WHERE user_id = :audit_learner_id
    AND created_at >= :audit_start::timestamptz
) ordered_events
WHERE prev_timestamp IS NOT NULL AND timestamp < prev_timestamp;

-- ============================================================================
-- Auth telemetry counts.
SELECT outcome, role, COUNT(*)
FROM auth_events
GROUP BY outcome, role
ORDER BY role, outcome;

-- Audit auth telemetry rows.
SELECT id, timestamp, email_hash, account_id, learner_id, role, outcome,
       failure_reason, created_at
FROM auth_events
WHERE learner_id = :audit_learner_id
   OR created_at >= :audit_start::timestamptz
ORDER BY created_at DESC
LIMIT 50;

-- ============================================================================
-- Textbook provenance linkability.
SELECT tu.unit_id, tu.title, COUNT(tl.event_id) AS linked_events
FROM textbook_units tu
LEFT JOIN textbook_unit_event_links tl ON tl.unit_id = tu.id
WHERE tu.user_id = :audit_learner_id
GROUP BY tu.unit_id, tu.title
ORDER BY linked_events DESC
LIMIT 20;

-- ============================================================================
-- Audit interaction rows for paper-critical fields.
SELECT id, event_type, session_id, section_id, problem_id, hint_id,
       concept_id, source, total_time, problems_attempted, problems_solved,
       unit_id, saved_to_notes, timestamp, created_at
FROM interaction_events
WHERE user_id = :audit_learner_id
  AND created_at >= :audit_start::timestamptz
ORDER BY timestamp ASC, created_at ASC
LIMIT 200;
