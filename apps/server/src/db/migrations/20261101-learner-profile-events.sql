-- profile-event-idempotency-v1: pause profile/event writers during cutover.
-- Preserve historical totals: recorded interaction IDs are treated as handled;
-- ambiguous old failures are not reconstructed. Calls without IDs stay legacy.
BEGIN;
CREATE TABLE IF NOT EXISTS learner_profile_events (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id TEXT NOT NULL,
  problem_id TEXT,
  event_type TEXT,
  PRIMARY KEY (user_id, event_id)
);
INSERT INTO learner_profile_events (user_id, event_id, problem_id, event_type)
SELECT user_id, id, problem_id, event_type FROM interaction_events
ON CONFLICT (user_id, event_id) DO NOTHING;
COMMIT;
-- Rollback: revert application code first; retain claims for a later redeploy.
