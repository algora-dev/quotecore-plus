-- =====================================================================
-- 20260613120000_create_invoice_atomic.sql
-- Gerald pre-live audit H-03 (High): invoice monthly cap is raceable.
--
-- PROBLEM
--   Invoice creation enforced the per-calendar-month cap with a
--   count-then-insert sequence:
--       require_invoice_slot()        -- SELECT count >= limit ?  (read)
--       ...app builds payload...
--       INSERT INTO invoices ...      -- separate statement / txn (write)
--   Two concurrent creates both pass the read before either writes, so a
--   company on a 5/month plan can land 6+ invoices in the same month.
--   The quote path already solved this with create_quote_atomic() under a
--   per-company advisory transaction lock; this mirrors that exactly for
--   invoices.
--
-- FIX
--   create_invoice_atomic(company, user, payload) does, in ONE transaction
--   under a per-company advisory xact lock:
--     1. validate company exists
--     2. pg_advisory_xact_lock (invoice-namespaced key) -> serialise per company
--     3. active-subscription + invoices-feature + monthly-cap checks
--        (identical error codes to require_invoice_slot: P0001/P0012/P0015)
--     4. generate_invoice_number() (already atomic on its own sequence)
--     5. INSERT the invoices row from a whitelisted projection of payload
--     6. RETURN id
--   Line imports + activity logging stay in app code (not cap-sensitive)
--   and run AFTER this returns.
--
--   Lock key is salted (# 0x1NV0...) so invoice creation does not need-
--   lessly contend with quote creation on the same company.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.create_invoice_atomic(
  p_company_id uuid,
  p_user_id    uuid,
  p_payload    jsonb
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_company_exists boolean;
  v_active         boolean;
  v_has_feature    boolean;
  v_code           text;
  v_limit          integer;
  v_used           integer;
  v_invoice_number text;
  v_payment_ref    text;
  v_invoice_id     uuid;
  -- Salt the per-company lock so invoice creation gets its own namespace and
  -- does not block quote creation on the same company (and vice versa).
  v_lock_key       bigint := hashtext(p_company_id::text)::bigint # 6586966975248322561;
BEGIN
  -- 1. Company must exist (defends against a stale UI passing a dead id).
  SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = p_company_id)
    INTO v_company_exists;
  IF NOT v_company_exists THEN
    RAISE EXCEPTION 'unknown_company' USING ERRCODE = 'P0003';
  END IF;

  -- 2. Serialise invoice creation per company. Released at transaction end.
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- 3a. Active subscription.
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- 3b. Invoices feature on the effective plan.
  v_has_feature := public.company_has_feature(p_company_id, 'invoices');
  IF NOT v_has_feature THEN
    RAISE EXCEPTION 'feature_not_available:invoices' USING ERRCODE = 'P0012';
  END IF;

  -- 3c. Monthly cap (NULL = unlimited). Counted INSIDE the lock so the
  --     check and the insert below are not raceable.
  v_code := public.company_effective_plan_code(p_company_id);
  SELECT sp.monthly_invoice_limit
    INTO v_limit
    FROM public.subscription_plans sp
   WHERE sp.code = v_code;

  IF v_limit IS NOT NULL THEN
    v_used := public.company_invoice_count(p_company_id);
    IF v_used >= v_limit THEN
      RAISE EXCEPTION 'invoice_limit_reached'
        USING ERRCODE = 'P0015',
              DETAIL  = format('used=%s limit=%s plan=%s', v_used, v_limit, v_code);
    END IF;
  END IF;

  -- 4. Invoice number (atomic on its own per-company sequence).
  v_invoice_number := public.generate_invoice_number(p_company_id);
  v_payment_ref    := 'QCP-' || v_invoice_number;

  -- 5. Insert the invoices row from a WHITELISTED projection of the payload.
  --    company_id / user_id / invoice_number / payment_reference / status are
  --    set by us; callers cannot override them.
  INSERT INTO public.invoices (
    company_id,
    user_id,
    invoice_number,
    payment_reference,
    status,
    source_type,
    source_id,
    customer_name,
    customer_email,
    customer_snapshot,
    cq_company_name,
    cq_company_address,
    cq_company_email,
    cq_company_phone,
    cq_company_logo_url,
    cq_footer_text,
    business_snapshot,
    payment_details,
    template_id,
    notes,
    terms,
    currency
  )
  VALUES (
    p_company_id,
    p_user_id,
    v_invoice_number,
    v_payment_ref,
    'draft',
    COALESCE(NULLIF(p_payload->>'source_type', ''), 'blank'),
    NULLIF(p_payload->>'source_id', '')::uuid,
    COALESCE(p_payload->>'customer_name', ''),
    NULLIF(p_payload->>'customer_email', ''),
    COALESCE(p_payload->'customer_snapshot', '{}'::jsonb),
    NULLIF(p_payload->>'cq_company_name', ''),
    NULLIF(p_payload->>'cq_company_address', ''),
    NULLIF(p_payload->>'cq_company_email', ''),
    NULLIF(p_payload->>'cq_company_phone', ''),
    NULLIF(p_payload->>'cq_company_logo_url', ''),
    NULLIF(p_payload->>'cq_footer_text', ''),
    COALESCE(p_payload->'business_snapshot', '{}'::jsonb),
    COALESCE(p_payload->'payment_details', '{}'::jsonb),
    NULLIF(p_payload->>'template_id', '')::uuid,
    NULLIF(p_payload->>'notes', ''),
    NULLIF(p_payload->>'terms', ''),
    COALESCE(NULLIF(p_payload->>'currency', ''), 'GBP')
  )
  RETURNING id INTO v_invoice_id;

  RETURN v_invoice_id;
END $$;

COMMENT ON FUNCTION public.create_invoice_atomic(uuid, uuid, jsonb) IS
  'Single atomic chokepoint for invoice creation. Enforces effective-plan active state, invoices feature, and monthly cap under a per-company advisory lock, then inserts the row. Mirrors create_quote_atomic. Error codes: P0001 inactive, P0012 feature, P0015 monthly cap, P0003 unknown company.';

-- Service-role only: callers are server actions using the admin client. Do NOT
-- grant to authenticated/anon (the row insert is privileged + bypasses RLS).
REVOKE ALL ON FUNCTION public.create_invoice_atomic(uuid, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_invoice_atomic(uuid, uuid, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_invoice_atomic(uuid, uuid, jsonb) TO service_role;

COMMIT;
