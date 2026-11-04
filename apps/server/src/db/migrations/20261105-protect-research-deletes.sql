-- research-delete-guard-v1: block accidental deletion of research rows.
-- Production has foreign keys that CASCADE from users (interaction_events,
-- survey_invitations, student_condition_assignments, learner_profile_events,
-- problem_progress_events, bandit_reward_events, learner_sessions, ...), from
-- course_sections to section_enrollments, and from interaction_events to
-- textbook_unit_event_links. One stray DELETE FROM users would erase a
-- participant's whole record. These BEFORE DELETE triggers refuse the delete
-- unless the transaction explicitly opts in. The cascades themselves are kept.
--
-- Deliberate participant withdrawal (inside one transaction):
--   BEGIN;
--   SET LOCAL sql_adapt.allow_research_delete = 'on';
--   <the delete>;
--   COMMIT;
-- A cascade from users into interaction_events also fires the interaction_events
-- trigger; the same SET LOCAL covers it.
--
-- Additive and idempotent; triggers only fire on row deletes, which the
-- application never issues, so older code keeps working on the migrated schema.
-- Applied by this migration only; initializeSchema() (AUTO_SCHEMA_INIT=false in
-- production) deliberately does not install it.
BEGIN;

CREATE OR REPLACE FUNCTION prevent_research_delete() RETURNS trigger AS $fn$
BEGIN
  IF current_setting('sql_adapt.allow_research_delete', true) = 'on' THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'research rows are protected'
    USING ERRCODE = 'P0001',
          HINT = 'To delete deliberately, run SET LOCAL sql_adapt.allow_research_delete = ''on'' inside the same transaction.';
END;
$fn$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['users', 'course_sections', 'section_enrollments', 'interaction_events'] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('DROP TRIGGER IF EXISTS protect_research_delete ON %I', t);
      EXECUTE format(
        'CREATE TRIGGER protect_research_delete BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION prevent_research_delete()',
        t
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
-- Rollback: DROP TRIGGER protect_research_delete ON <table>; DROP FUNCTION prevent_research_delete();
