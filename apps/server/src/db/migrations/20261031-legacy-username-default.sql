-- Some legacy deployments require a username, although current signup writes no
-- such column. Preserve those deployments' existing values and constraints.
-- Fresh schemas and columns with an existing default are deliberately untouched.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'username'
      AND data_type = 'text'
      AND is_nullable = 'NO'
      AND column_default IS NULL
      AND is_generated = 'NEVER'
      AND identity_generation IS NULL
  ) THEN
    ALTER TABLE public.users ALTER COLUMN username
      SET DEFAULT pg_catalog.gen_random_uuid()::text;
  END IF;
END
$$;
