-- retrieval-provenance-v1: ensure the table linkTextbookRetrievals() writes to
-- exists. It was previously created only by migrate-neon.sql, so databases
-- provisioned through initializeSchema() logged a warning and dropped links.
-- Additive and idempotent; safe to run while writers are active.
BEGIN;
CREATE TABLE IF NOT EXISTS interaction_textbook_unit_retrievals (
  id SERIAL PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES interaction_events(id) ON DELETE CASCADE,
  unit_id TEXT NOT NULL,
  rank INTEGER,
  source_kind TEXT,
  score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_event_unit_retrieval'
      AND conrelid = 'interaction_textbook_unit_retrievals'::regclass
  ) THEN
    ALTER TABLE interaction_textbook_unit_retrievals
      ADD CONSTRAINT unique_event_unit_retrieval UNIQUE (event_id, unit_id);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_retrievals_event_id ON interaction_textbook_unit_retrievals(event_id);
CREATE INDEX IF NOT EXISTS idx_retrievals_unit_id ON interaction_textbook_unit_retrievals(unit_id);
COMMIT;
-- Rollback: none needed (additive). Do not drop: it holds research provenance.
