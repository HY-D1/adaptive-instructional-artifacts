-- survey-verification-v1: mark callback-only completions as unverified and
-- stop one Qualtrics response from completing several invitations.
-- Verify first; the unique index is skipped (with a NOTICE) if this returns rows:
--   SELECT qualtrics_response_id, COUNT(*) FROM survey_invitations
--   WHERE qualtrics_response_id IS NOT NULL GROUP BY 1 HAVING COUNT(*) > 1;
BEGIN;
ALTER TABLE survey_invitations ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'unverified'
  CHECK (verification_status IN ('unverified', 'verified'));
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM survey_invitations
    WHERE qualtrics_response_id IS NOT NULL
    GROUP BY qualtrics_response_id HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_survey_invitations_response_id_unique
      ON survey_invitations(qualtrics_response_id)
      WHERE qualtrics_response_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Duplicate qualtrics_response_id values exist; unique index not created';
  END IF;
END $$;
COMMIT;
-- Rollback: revert application code first; the column and index are additive.
