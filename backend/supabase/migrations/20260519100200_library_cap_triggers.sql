-- Gerald audit H-04: enforce component_library and flashing_library caps
-- at the DB boundary, not just in server actions. Pre-this migration, a
-- malicious authenticated user could `supabase.from('component_library').insert(...)`
-- directly via PostgREST and bypass UI/server-action enforcement entirely,
-- because the existing RLS policy on component_library only checks tenant
-- scoping (`user_belongs_to_company`).
--
-- Strategy: BEFORE INSERT triggers that call require_component_slot() /
-- require_flashing_slot(). The trigger functions are SECURITY DEFINER
-- owned by postgres so they can call the (now service-role-only) helper
-- functions regardless of caller identity. RAISE EXCEPTION in the
-- helpers surfaces as PostgREST 4xx with the same P0010/P0011/P0012
-- SQLSTATEs the app already handles.
--
-- The helpers already acquire a `pg_advisory_xact_lock` on the company id
-- so concurrent inserts can't race past the cap (well-defined cap
-- behaviour even under load).
--
-- Service-role inserts (admin client) also pass through the trigger.
-- That's intentional: today our admin/cron paths don't bulk-insert
-- library rows. If we later need a bypass (e.g. data migration), wrap
-- the bulk INSERT in `ALTER TABLE ... DISABLE TRIGGER` under a one-shot
-- migration, not in app code.

BEGIN;

-- =============================================================================
-- component_library trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tg_enforce_component_cap()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Soft-deletes (is_active=false) don't consume a slot, so re-inserting
  -- an inactive row is a no-op for cap purposes. Active inserts (default
  -- TRUE) must go through the slot check.
  IF NEW.is_active IS DISTINCT FROM FALSE THEN
    PERFORM public.require_component_slot(NEW.company_id);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_enforce_component_cap() FROM PUBLIC, anon, authenticated;
-- (Trigger functions don't need EXECUTE grants for callers; the trigger
-- fires under the table owner's authority automatically.)

DROP TRIGGER IF EXISTS component_library_enforce_cap ON public.component_library;
CREATE TRIGGER component_library_enforce_cap
  BEFORE INSERT ON public.component_library
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enforce_component_cap();

-- An UPDATE that flips is_active from false -> true also consumes a slot.
-- Catch the reactivation path.
CREATE OR REPLACE FUNCTION public.tg_enforce_component_cap_reactivate()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  IF NEW.is_active IS TRUE AND (OLD.is_active IS DISTINCT FROM TRUE) THEN
    PERFORM public.require_component_slot(NEW.company_id);
  END IF;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_enforce_component_cap_reactivate() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS component_library_enforce_cap_reactivate ON public.component_library;
CREATE TRIGGER component_library_enforce_cap_reactivate
  BEFORE UPDATE OF is_active ON public.component_library
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enforce_component_cap_reactivate();

-- =============================================================================
-- flashing_library trigger
-- =============================================================================

CREATE OR REPLACE FUNCTION public.tg_enforce_flashing_cap()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  PERFORM public.require_flashing_slot(NEW.company_id);
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.tg_enforce_flashing_cap() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS flashing_library_enforce_cap ON public.flashing_library;
CREATE TRIGGER flashing_library_enforce_cap
  BEFORE INSERT ON public.flashing_library
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_enforce_flashing_cap();

COMMIT;
