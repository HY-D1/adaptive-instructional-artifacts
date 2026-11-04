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
-- Withdrawal is a manual psql transaction (BEGIN; SET LOCAL sql_adapt.allow_research_delete = 'on'; DELETE ...; COMMIT;)
-- because db.deleteUser over the Neon HTTP driver cannot carry SET LOCAL.
-- TRUNCATE on these tables is blocked too (statement-level trigger), same opt-in.
-- A cascade from users into interaction_events also fires the interaction_events
-- trigger; the same SET LOCAL covers it.
--
-- Additive and idempotent; triggers only fire on DELETE (row-level) and
-- TRUNCATE (statement-level), neither of which the application issues on these
-- tables, so older code keeps working on the migrated schema.
-- Applied by this migration only; initializeSchema() (AUTO_SCHEMA_INIT=false in
-- production) deliberately does not install it.
BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE OR REPLACE FUNCTION prevent_research_delete() RETURNS trigger AS $fn$
BEGIN
  IF current_setting('sql_adapt.allow_research_delete', true) = 'on' THEN
    IF TG_LEVEL = 'ROW' THEN
      RETURN OLD;
    END IF;
    -- statement-level trigger: OLD is not assigned, so return NULL
    RETURN NULL;
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
      EXECUTE format('DROP TRIGGER IF EXISTS protect_research_delete ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER protect_research_delete BEFORE DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION prevent_research_delete()',
        t
      );
      EXECUTE format('DROP TRIGGER IF EXISTS protect_research_truncate ON public.%I', t);
      EXECUTE format(
        'CREATE TRIGGER protect_research_truncate BEFORE TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION prevent_research_delete()',
        t
      );
    ELSE
      RAISE EXCEPTION 'cannot protect missing table public.%', t;
    END IF;
  END LOOP;
END $$;

COMMIT;
-- Rollback: DROP TRIGGER protect_research_delete / protect_research_truncate ON <table>; DROP FUNCTION prevent_research_delete();
