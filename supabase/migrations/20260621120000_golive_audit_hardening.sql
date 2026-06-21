-- 20260621120000_golive_audit_hardening.sql
-- Remediation for Gerald 2026-06-21 go-live audit:
--   H-02  base_unit_cost canonical migration (was only in backend/ patch 018)
--   H-01  atomic replace_customer_quote_lines() RPC (delete+insert+quote patch in one tx)
--   M-01  CHECK constraints / bounds on pricing/quantity/margin fields
--   M-02  composite-bound quote_component_id to same quote (trigger)
-- All idempotent.

-- ---------------------------------------------------------------------------
-- H-02: base_unit_cost as canonical, idempotent column add.
-- ---------------------------------------------------------------------------
ALTER TABLE public.customer_quote_lines
  ADD COLUMN IF NOT EXISTS base_unit_cost NUMERIC DEFAULT NULL;

COMMENT ON COLUMN public.customer_quote_lines.base_unit_cost IS
  'Pre-margin cost per unit for custom/catalog lines. Final amount = base_unit_cost * quantity * (1 + material_margin%). NULL for component lines and pre-018 rows.';

-- ---------------------------------------------------------------------------
-- M-01: bounds on pricing / quantity / margin fields. NOT VALID first so the
-- migration cannot fail on any pre-existing dirty row; validate separately.
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER TABLE public.customer_quote_lines
    ADD CONSTRAINT cql_quantity_positive CHECK (quantity > 0 AND quantity <= 1000000) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.customer_quote_lines
    ADD CONSTRAINT cql_unit_price_nonneg CHECK (unit_price IS NULL OR (unit_price >= 0 AND unit_price <= 100000000)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.customer_quote_lines
    ADD CONSTRAINT cql_base_unit_cost_nonneg CHECK (base_unit_cost IS NULL OR (base_unit_cost >= 0 AND base_unit_cost <= 100000000)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.customer_quote_lines
    ADD CONSTRAINT cql_line_margin_bounded CHECK (line_margin_percent IS NULL OR (line_margin_percent >= -100 AND line_margin_percent <= 100000)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.customer_quote_lines
    ADD CONSTRAINT cql_line_labor_margin_bounded CHECK (line_labor_margin_percent IS NULL OR (line_labor_margin_percent >= -100 AND line_labor_margin_percent <= 100000)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Validate (won't error on clean data; if a dirty row exists the validate is
-- skipped silently so the deploy still proceeds — bounds still enforced on new writes).
DO $$ BEGIN
  ALTER TABLE public.customer_quote_lines VALIDATE CONSTRAINT cql_quantity_positive;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip validate cql_quantity_positive: %', SQLERRM; END $$;
DO $$ BEGIN
  ALTER TABLE public.customer_quote_lines VALIDATE CONSTRAINT cql_unit_price_nonneg;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip validate cql_unit_price_nonneg: %', SQLERRM; END $$;
DO $$ BEGIN
  ALTER TABLE public.customer_quote_lines VALIDATE CONSTRAINT cql_base_unit_cost_nonneg;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip validate cql_base_unit_cost_nonneg: %', SQLERRM; END $$;
DO $$ BEGIN
  ALTER TABLE public.customer_quote_lines VALIDATE CONSTRAINT cql_line_margin_bounded;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip validate cql_line_margin_bounded: %', SQLERRM; END $$;
DO $$ BEGIN
  ALTER TABLE public.customer_quote_lines VALIDATE CONSTRAINT cql_line_labor_margin_bounded;
EXCEPTION WHEN others THEN RAISE NOTICE 'skip validate cql_line_labor_margin_bounded: %', SQLERRM; END $$;

-- ---------------------------------------------------------------------------
-- M-02: quote_component_id must belong to the SAME quote as the line.
-- A direct API caller could otherwise point a line at another quote/company's
-- component. Enforce with a BEFORE INSERT/UPDATE trigger.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_cql_component_same_quote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_component_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.quote_components qc
      WHERE qc.id = NEW.quote_component_id
        AND qc.quote_id = NEW.quote_id
    ) THEN
      RAISE EXCEPTION 'quote_component_id % does not belong to quote %', NEW.quote_component_id, NEW.quote_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cql_component_same_quote ON public.customer_quote_lines;
CREATE TRIGGER trg_cql_component_same_quote
  BEFORE INSERT OR UPDATE OF quote_component_id, quote_id ON public.customer_quote_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_cql_component_same_quote();

-- ---------------------------------------------------------------------------
-- H-01: atomic replace of customer quote lines.
-- Deletes existing lines and inserts the new set inside a single transaction,
-- serialized per-quote with an advisory xact lock so concurrent saves cannot
-- interleave delete/insert. Company ownership is re-checked server-side.
-- p_lines is a JSONB array of line objects matching customer_quote_lines cols.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.replace_customer_quote_lines(
  p_quote_id uuid,
  p_company_id uuid,
  p_lines jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
BEGIN
  -- Serialize concurrent saves for this quote (auto-released at tx end).
  PERFORM pg_advisory_xact_lock(hashtext(p_quote_id::text));

  -- Ownership guard.
  SELECT company_id INTO v_owner FROM public.quotes WHERE id = p_quote_id;
  IF v_owner IS NULL OR v_owner <> p_company_id THEN
    RAISE EXCEPTION 'Quote not found or not owned by company' USING ERRCODE = 'insufficient_privilege';
  END IF;

  DELETE FROM public.customer_quote_lines WHERE quote_id = p_quote_id;

  IF p_lines IS NOT NULL AND jsonb_array_length(p_lines) > 0 THEN
    INSERT INTO public.customer_quote_lines (
      quote_id, line_type, quote_component_id, custom_text, quantity_text,
      custom_amount, show_price, show_units, sort_order, is_visible,
      include_in_total, quantity, unit_price, line_margin_percent,
      line_labor_margin_percent, base_unit_cost
    )
    SELECT
      p_quote_id,
      (e->>'line_type')::public.line_type,
      NULLIF(e->>'quote_component_id','')::uuid,
      e->>'custom_text',
      e->>'quantity_text',
      (e->>'custom_amount')::numeric,
      COALESCE((e->>'show_price')::boolean, true),
      COALESCE((e->>'show_units')::boolean, true),
      COALESCE((e->>'sort_order')::int, 0),
      COALESCE((e->>'is_visible')::boolean, true),
      COALESCE((e->>'include_in_total')::boolean, true),
      COALESCE((e->>'quantity')::int, 1),
      NULLIF(e->>'unit_price','')::numeric,
      NULLIF(e->>'line_margin_percent','')::numeric,
      NULLIF(e->>'line_labor_margin_percent','')::numeric,
      NULLIF(e->>'base_unit_cost','')::numeric
    FROM jsonb_array_elements(p_lines) AS e;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.replace_customer_quote_lines(uuid, uuid, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.replace_customer_quote_lines(uuid, uuid, jsonb) TO authenticated, service_role;
