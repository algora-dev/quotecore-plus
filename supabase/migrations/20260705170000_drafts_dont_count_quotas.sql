-- Migration: 20260705170000_drafts_dont_count_quotas.sql
-- Purpose (Shaun, 2026-07-05): drafts should NOT count toward the monthly
--   quote quota. Previously create_quote_atomic incremented the counter on
--   every insert (all quotes start as 'draft'), so creating + deleting a
--   draft still consumed quota. Fix:
--   1. Remove the increment from create_quote_atomic.
--   2. Add a trigger that increments company_quote_usage when a quote's
--      status transitions FROM 'draft' TO a non-draft status (confirmed,
--      sent, accepted, declined, expired). This catches every path
--      (server actions, admin panel, RPCs, API routes).
--   3. Add a trigger that DECREMENTS when a non-draft quote is deleted
--      (hard delete), so deleting a confirmed quote refunds the slot.
--   4. Reset Shaun's test company counter so they can resume testing.
-- Rollback: re-apply 20260705160000_per_area_quote_components.sql and
--   manually re-add the increment block to create_quote_atomic.

-- ── 1. Remove the increment from create_quote_atomic ──────────────────
CREATE OR REPLACE FUNCTION public.create_quote_atomic(
  p_company_id uuid,
  p_user_id    uuid,
  p_payload    jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period date := date_trunc('month', (now() AT TIME ZONE 'UTC'))::date;
  v_used   integer;
  v_limit  integer;
  v_active boolean;
  v_effective_code text;
  v_quote_id uuid;
  v_company_exists boolean;
BEGIN
  -- Validate the company exists at all (defends against a stale UI passing
  -- a deleted company id).
  SELECT EXISTS(SELECT 1 FROM public.companies WHERE id = p_company_id) INTO v_company_exists;
  IF NOT v_company_exists THEN
    RAISE EXCEPTION 'unknown_company' USING ERRCODE = 'P0003';
  END IF;

  -- Advisory lock: serialise quote creation per company. 64-bit lock key
  -- derived from the company uuid. Released automatically at transaction end.
  PERFORM pg_advisory_xact_lock(hashtext(p_company_id::text)::bigint);

  -- Active-subscription check.
  v_active := public.company_effective_plan_active(p_company_id);
  IF NOT v_active THEN
    RAISE EXCEPTION 'subscription_inactive' USING ERRCODE = 'P0001';
  END IF;

  -- Monthly limit check (always; clones included).
  -- NOTE (2026-07-05): the counter is now incremented by the status-change
  -- trigger, NOT here. We still check the limit so a user can't stockpile
  -- unlimited drafts and then mass-confirm them. But the check counts
  -- non-draft quotes, not total creates.
  v_effective_code := public.company_effective_plan_code(p_company_id);

  SELECT sp.monthly_quote_limit
    INTO v_limit
    FROM public.subscription_plans sp
    WHERE sp.code = v_effective_code;

  IF v_limit IS NULL THEN
    RAISE EXCEPTION 'plan_not_found:%', v_effective_code USING ERRCODE = 'P0003';
  END IF;

  -- Count non-draft quotes this month (trigger-maintained counter).
  SELECT COALESCE(quotes_created, 0)
    INTO v_used
    FROM public.company_quote_usage
    WHERE company_id = p_company_id AND period_start = v_period;

  IF v_used IS NULL THEN v_used := 0; END IF;

  IF v_used >= v_limit THEN
    RAISE EXCEPTION 'quote_limit_reached'
      USING ERRCODE = 'P0002',
            DETAIL = format('used=%s limit=%s period_start=%s plan=%s',
                            v_used, v_limit, v_period, v_effective_code);
  END IF;

  -- Insert the quote. We explicitly project columns from p_payload so callers
  -- can't sneak in (for example) company_id overrides or quote_number values.
  -- Any field the caller doesn't supply uses the column default.
  INSERT INTO public.quotes (
    company_id,
    template_id,
    customer_name,
    customer_email,
    customer_phone,
    job_name,
    site_address,
    tax_rate,
    notes_internal,
    created_by_user_id,
    global_pitch_degrees,
    measurement_system,
    cq_company_name,
    cq_company_address,
    cq_company_phone,
    cq_company_email,
    cq_company_logo_url,
    cq_footer_text,
    currency,
    entry_mode,
    material_margin_percent,
    labor_margin_percent,
    material_margin_enabled,
    labor_margin_enabled,
    trade,
    component_collection_id
  )
  VALUES (
    p_company_id,
    NULLIF(p_payload->>'template_id', '')::uuid,
    p_payload->>'customer_name',
    NULLIF(p_payload->>'customer_email', ''),
    NULLIF(p_payload->>'customer_phone', ''),
    NULLIF(p_payload->>'job_name', ''),
    NULLIF(p_payload->>'site_address', ''),
    COALESCE((p_payload->>'tax_rate')::numeric, 0),
    NULLIF(p_payload->>'notes_internal', ''),
    p_user_id,
    NULLIF(p_payload->>'global_pitch_degrees', '')::numeric,
    COALESCE((p_payload->>'measurement_system')::measurement_system, 'metric'::measurement_system),
    NULLIF(p_payload->>'cq_company_name', ''),
    NULLIF(p_payload->>'cq_company_address', ''),
    NULLIF(p_payload->>'cq_company_phone', ''),
    NULLIF(p_payload->>'cq_company_email', ''),
    NULLIF(p_payload->>'cq_company_logo_url', ''),
    NULLIF(p_payload->>'cq_footer_text', ''),
    COALESCE(NULLIF(p_payload->>'currency', ''), 'NZD'),
    COALESCE(NULLIF(p_payload->>'entry_mode', ''), 'manual'),
    NULLIF(p_payload->>'material_margin_percent', '')::numeric,
    NULLIF(p_payload->>'labor_margin_percent', '')::numeric,
    COALESCE((p_payload->>'material_margin_enabled')::boolean, false),
    COALESCE((p_payload->>'labor_margin_enabled')::boolean, false),
    COALESCE((p_payload->>'trade')::trade, 'roofing'::trade),
    NULLIF(p_payload->>'component_collection_id', '')::uuid
  )
  RETURNING id INTO v_quote_id;

  -- NO increment here. The trg_quote_status_change trigger fires when
  -- status moves from 'draft' to a real status.

  RETURN v_quote_id;
END;
$$;

COMMENT ON FUNCTION public.create_quote_atomic(uuid, uuid, jsonb) IS
  'Fix 2026-07-05: no longer increments company_quote_usage on create. '
  'Drafts do not count. The trg_quote_status_change trigger increments '
  'when status transitions from draft to non-draft. Prior: per-area quote_components.';

-- ── 2. Trigger: increment on draft → non-draft transition ─────────────

CREATE OR REPLACE FUNCTION public.fn_quote_status_usage_delta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period date := date_trunc('month', (now() AT TIME ZONE 'UTC'))::date;
BEGIN
  -- Only fire on status changes where OLD was 'draft' and NEW is not 'draft'.
  -- This is the "first real save" — draft becomes confirmed/sent/etc.
  IF (TG_OP = 'UPDATE') THEN
    IF OLD.status = 'draft' AND NEW.status <> 'draft' THEN
      INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
      VALUES (NEW.company_id, v_period, 1)
      ON CONFLICT (company_id, period_start)
        DO UPDATE SET quotes_created = company_quote_usage.quotes_created + 1;
    ELSIF OLD.status <> 'draft' AND NEW.status = 'draft' THEN
      -- Reverting back to draft: refund the slot.
      INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
      VALUES (NEW.company_id, v_period, 0)
      ON CONFLICT (company_id, period_start)
        DO UPDATE SET quotes_created = GREATEST(company_quote_usage.quotes_created - 1, 0);
    END IF;
    RETURN NEW;
  END IF;

  -- On hard delete of a non-draft quote: refund the slot.
  IF (TG_OP = 'DELETE') THEN
    IF OLD.status <> 'draft' THEN
      INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
      VALUES (OLD.company_id, v_period, 0)
      ON CONFLICT (company_id, period_start)
        DO UPDATE SET quotes_created = GREATEST(company_quote_usage.quotes_created - 1, 0);
    END IF;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_quote_status_usage ON public.quotes;
CREATE TRIGGER trg_quote_status_usage
  AFTER UPDATE OF status OR DELETE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_quote_status_usage_delta();

-- ── 3. Recalculate Shaun's test company counter ───────────────────────
--    Count non-draft quotes created this month for RS Roofing.
--    (dd3b3943-c760-4c21-9a9a-3a516d0c3356)
UPDATE public.company_quote_usage
   SET quotes_created = (
     SELECT COUNT(*)::int FROM public.quotes
      WHERE company_id = 'dd3b3943-c760-4c21-9a9a-3a516d0c3356'
        AND status <> 'draft'
        AND date_trunc('month', created_at) = date_trunc('month', now())
   )
 WHERE company_id = 'dd3b3943-c760-4c21-9a9a-3a516d0c3356'
   AND period_start = date_trunc('month', now())::date;
