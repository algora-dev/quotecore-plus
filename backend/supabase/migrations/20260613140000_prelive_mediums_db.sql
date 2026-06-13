-- =====================================================================
-- 20260613140000_prelive_mediums_db.sql
-- Gerald pre-live audit DB-layer Mediums: M-02, M-06, M-07.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- M-02: generate_invoice_number is SECURITY DEFINER and mutates
--       invoice_number_sequences, but had no explicit grant lockdown.
--       Direct RPC callers could burn/skip invoice numbers for known
--       company ids. Lock it to service_role only (matches the
--       secdef_function_lockdown convention). The app calls it via the
--       admin client (now folded into create_invoice_atomic).
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.generate_invoice_number(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_invoice_number(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_invoice_number(uuid) TO service_role;

-- ---------------------------------------------------------------------
-- M-06: match_doc_chunks was revoked from anon/authenticated/PUBLIC but
--       had no explicit service-role grant, so the server-side help-doc
--       search could fail after lockdown depending on ownership. Add the
--       explicit grant. (Signature: see ai_assistant_foundation migration.)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_sig text;
BEGIN
  -- Resolve the actual argument signature so the GRANT matches regardless
  -- of the exact parameter list defined in the foundation migration.
  SELECT pg_get_function_identity_arguments(p.oid)
    INTO v_sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'match_doc_chunks'
   LIMIT 1;

  IF v_sig IS NULL THEN
    RAISE NOTICE 'match_doc_chunks not found; skipping grant (M-06).';
  ELSE
    EXECUTE format(
      'REVOKE ALL ON FUNCTION public.match_doc_chunks(%s) FROM PUBLIC, anon, authenticated;',
      v_sig);
    EXECUTE format(
      'GRANT EXECUTE ON FUNCTION public.match_doc_chunks(%s) TO service_role;',
      v_sig);
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- M-07: "max 3 open follow-ups per document" was enforced only in app
--       code (count-then-insert), so double-clicks / parallel requests
--       could exceed the cap. Enforce it in the DB with a BEFORE INSERT
--       trigger that counts open (status='scheduled') siblings for the
--       same parent under a per-parent advisory lock, making the
--       check+insert atomic. App-side cap stays as UX/fast-fail.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_open_followup_cap()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_max      integer := 3;   -- mirrors MAX_OPEN_PER_* in scheduled.ts
  v_parent   uuid;
  v_open     integer;
  v_lock_key bigint;
BEGIN
  -- Only open rows tied to a parent entity count against the cap.
  IF NEW.status IS DISTINCT FROM 'scheduled' THEN
    RETURN NEW;
  END IF;

  v_parent := COALESCE(NEW.quote_id, NEW.order_id, NEW.invoice_id);
  IF v_parent IS NULL THEN
    RETURN NEW;  -- not a per-document follow-up; no cap applies.
  END IF;

  -- Serialise concurrent inserts for the same parent so the count below
  -- and the insert are not raceable. Salt keeps this namespace distinct.
  v_lock_key := hashtext(v_parent::text)::bigint # 7711577975248322561;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT COUNT(*) INTO v_open
    FROM public.scheduled_messages
   WHERE status = 'scheduled'
     AND COALESCE(quote_id, order_id, invoice_id) = v_parent;

  IF v_open >= v_max THEN
    RAISE EXCEPTION 'open_followup_cap_reached'
      USING ERRCODE = 'P0017',
            DETAIL  = format('parent=%s open=%s max=%s', v_parent, v_open, v_max);
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_enforce_open_followup_cap ON public.scheduled_messages;
CREATE TRIGGER trg_enforce_open_followup_cap
  BEFORE INSERT ON public.scheduled_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_open_followup_cap();

COMMENT ON FUNCTION public.enforce_open_followup_cap IS
  'M-07: race-proof cap of 3 open (status=scheduled) follow-ups per parent (quote/order/invoice). Counts siblings under a per-parent advisory lock; raises P0017 on overflow. App-side cap is UX only.';

COMMIT;
