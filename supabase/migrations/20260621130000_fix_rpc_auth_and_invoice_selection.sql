-- 20260621130000_fix_rpc_auth_and_invoice_selection.sql
-- Gerald re-audit R1 blockers:
--   H-01-R1  replace_customer_quote_lines: add auth.uid() caller-membership check
--            so direct authenticated Supabase RPC callers cannot overwrite another
--            tenant's quote lines even if they know the victim quote_id + company_id.
--
-- (H-03-R1 is a TypeScript-only fix in new-from-quote/page.tsx; no DB change needed.)

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

  -- H-01-R1: verify the authenticated caller belongs to p_company_id.
  -- service_role runs as postgres/authenticated with auth.uid() = NULL, so we
  -- also allow the service_role path (used only by Gavin's server actions
  -- which already gate on requireCompanyContext()). All other authenticated
  -- callers must be a member of the target company.
  IF auth.uid() IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.users u
      WHERE u.id = auth.uid()
        AND u.company_id = p_company_id
    ) THEN
      RAISE EXCEPTION 'Not authorized for company %', p_company_id
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  -- Ownership guard: confirm the quote itself belongs to p_company_id.
  SELECT company_id INTO v_owner FROM public.quotes WHERE id = p_quote_id;
  IF v_owner IS NULL OR v_owner <> p_company_id THEN
    RAISE EXCEPTION 'Quote not found or not owned by company'
      USING ERRCODE = 'insufficient_privilege';
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
