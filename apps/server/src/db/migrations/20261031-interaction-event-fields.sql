-- event-storage-v1: preserve existing optional frontend event fields.
-- Apply before deploying code that reads/writes these columns when AUTO_SCHEMA_INIT=false.
-- Rollback: revert application code first; retaining nullable columns preserves data.
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS condition_id TEXT;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS execution_time_ms DOUBLE PRECISION;
ALTER TABLE interaction_events ADD COLUMN IF NOT EXISTS metadata TEXT;
