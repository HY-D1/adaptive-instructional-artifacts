-- Neon research-readiness audit SQL, 2026-04-07.
-- Secrets omitted. Replace :audit_start, :audit_learner_id, and :audit_session_id
-- when rerunning against a new audited session.

-- Captured audit session used for evidence artifact 07:
-- :audit_start = '2026-04-07T22:34:53.915Z'
-- :audit_learner_id = 'abb443fe-ce38-4fd3-a0bb-7a84ffa1cf87'
-- :audit_session_id = 'session-1775601297009-rbpg9kg'

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

-- Concept-view completeness.
SELECT COUNT(*) AS bad_concept_rows
FROM interaction_events
WHERE event_type = 'concept_view'
  AND (concept_id IS NULL OR source IS NULL)
  AND created_at >= :audit_start::timestamptz;

-- Session-end completeness.
SELECT COUNT(*) AS bad_session_end_rows
FROM interaction_events
WHERE event_type = 'session_end'
  AND (total_time IS NULL OR problems_attempted IS NULL OR problems_solved IS NULL)
  AND created_at >= :audit_start::timestamptz;

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

-- Textbook provenance linkability.
SELECT tu.unit_id, tu.title, COUNT(tl.event_id) AS linked_events
FROM textbook_units tu
LEFT JOIN textbook_unit_event_links tl ON tl.unit_id = tu.id
WHERE tu.user_id = :audit_learner_id
GROUP BY tu.unit_id, tu.title
ORDER BY linked_events DESC
LIMIT 20;

-- Audit interaction rows for paper-critical fields.
SELECT id, event_type, session_id, section_id, problem_id, hint_id,
       concept_id, source, total_time, problems_attempted, problems_solved,
       unit_id, saved_to_notes, timestamp, created_at
FROM interaction_events
WHERE user_id = :audit_learner_id
  AND created_at >= :audit_start::timestamptz
ORDER BY timestamp ASC, created_at ASC
LIMIT 200;
