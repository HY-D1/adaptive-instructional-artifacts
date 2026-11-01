-- progress-idempotency-v1: apply with event/progress writes paused, before
-- deploying the matching application code. Existing totals are not changed.
-- Historical interactions are marked as handled; ambiguous old failures are
-- not reconstructed. Old clients that omit eventId retain legacy semantics.
BEGIN;
CREATE TABLE IF NOT EXISTS problem_progress_events (
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  problem_id TEXT NOT NULL,
  PRIMARY KEY (user_id, event_id)
);
INSERT INTO problem_progress_events (event_id, user_id, problem_id)
SELECT id, user_id, problem_id FROM interaction_events
WHERE event_type IN ('execution', 'error', 'hint_view')
ON CONFLICT (user_id, event_id) DO NOTHING;
COMMIT;
-- Rollback: revert application code before removing this table. Retaining the
-- table is safer and allows the new version to be deployed again.
