-- Migration: extend the quotes.entry_mode CHECK constraint to allow 'blank'.
--
-- Background: 'entry_mode' was added in patch 019 with values ('manual',
-- 'digital'). The new "Blank Quote" flow introduces a third entry mode where
-- the user skips the quote builder phase entirely and goes straight to a
-- blank-quote editor whose lines become the master summary data.
--
-- The CHECK constraint is the only thing standing in the way of writing
-- 'blank' to the column - the rest of the column shape (TEXT, default
-- 'manual') is fine. We drop the existing check and re-create it with the
-- expanded value set. No data backfill needed: existing rows keep their
-- current value, and new manual/digital writes are unaffected.

-- Drop the legacy named constraint. Postgres auto-names the check, so we
-- look it up by definition signature first. (Trying ALTER TABLE ... DROP
-- CONSTRAINT directly would need the exact name, which can differ across
-- environments if it was ever recreated.)
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.quotes'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%entry_mode%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.quotes DROP CONSTRAINT %I', cname);
  END IF;
END$$;

-- Re-create with the expanded value set.
ALTER TABLE public.quotes
  ADD CONSTRAINT quotes_entry_mode_check
  CHECK (entry_mode IN ('manual', 'digital', 'blank'));

COMMENT ON COLUMN public.quotes.entry_mode IS
  'Quote entry method: ''manual'' (traditional quote builder), ''digital'' (digital takeoff canvas), or ''blank'' (skip quote builder; line items live directly in customer_quote_lines).';
