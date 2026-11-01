-- Rehearsal only: undo the exact temporary pilot default after deploying code
-- that explicitly writes usernames. Leave all other defaults and data intact.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username'
      AND column_default = '(gen_random_uuid())::text'
  ) THEN
    ALTER TABLE public.users ALTER COLUMN username DROP DEFAULT;
  END IF;
END
$$;
