-- H-01: Durable quote ownership that survives profile deletion.
--
-- `quotes.created_by_user_id` is `ON DELETE SET NULL` on `public.users`,
-- so deleting a profile nulls the only user→quote link. The orphan recovery
-- code in `/auth/callback` relies on that column, which means a manually
-- deleted profile makes old quotes unrecoverable by auth user ID.
--
-- Fix: add a denormalized `created_by_email` column that is populated on
-- insert and never nulled by FK cascade. The recovery code can then match
-- by email (durable on `auth.users`) instead of the nullable FK.

ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS created_by_email text;

-- Backfill from existing rows via the current profile join.
UPDATE public.quotes q
  SET created_by_email = u.email
  FROM public.users u
  WHERE q.created_by_user_id = u.id
    AND q.created_by_email IS NULL;

-- Index for recovery lookups by email.
CREATE INDEX IF NOT EXISTS idx_quotes_created_by_email
  ON public.quotes (created_by_email)
  WHERE created_by_email IS NOT NULL;

-- Trigger to keep created_by_email populated on insert.
CREATE OR REPLACE FUNCTION public.set_quote_created_by_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by_email IS NULL AND NEW.created_by_user_id IS NOT NULL THEN
    SELECT email INTO NEW.created_by_email
      FROM public.users
      WHERE id = NEW.created_by_user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quotes_set_created_by_email ON public.quotes;
CREATE TRIGGER trg_quotes_set_created_by_email
  BEFORE INSERT ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_quote_created_by_email();

COMMENT ON COLUMN public.quotes.created_by_email IS
  'Denormalized email of the creating user. Survives profile deletion (FK is ON DELETE SET NULL). Used for orphan recovery in /auth/callback.';
