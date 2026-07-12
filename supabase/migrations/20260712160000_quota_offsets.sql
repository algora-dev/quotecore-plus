-- Company quota offsets table for admin manual resets
-- Allows admin to "reset" monthly quotas by setting an offset that subtracts from the RPC count

CREATE TABLE IF NOT EXISTS public.company_quota_offsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quota_key text NOT NULL,
  offset_value integer NOT NULL DEFAULT 0,
  period_start date NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, quota_key, period_start)
);

GRANT SELECT, INSERT, UPDATE ON public.company_quota_offsets TO authenticated, service_role;

-- Update company_invoice_count to subtract offset
CREATE OR REPLACE FUNCTION public.company_invoice_count(p_company_id uuid) RETURNS integer AS $$
DECLARE
  v_count integer;
  v_offset integer := 0;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.invoices
  WHERE company_id = p_company_id
    AND date_trunc('month', created_at) = date_trunc('month', now());

  SELECT COALESCE(SUM(offset_value), 0) INTO v_offset
  FROM public.company_quota_offsets
  WHERE company_id = p_company_id
    AND quota_key = 'invoices'
    AND period_start = date_trunc('month', now())::date;

  RETURN GREATEST(v_count - v_offset, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.company_invoice_count IS 'Calendar-month invoice count (excludes cancelled), minus admin offset.';

-- Update company_order_count to subtract offset
CREATE OR REPLACE FUNCTION public.company_order_count(p_company_id uuid) RETURNS integer AS $$
DECLARE
  v_count integer;
  v_offset integer := 0;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.material_orders
  WHERE company_id = p_company_id
    AND date_trunc('month', created_at) = date_trunc('month', now());

  SELECT COALESCE(SUM(offset_value), 0) INTO v_offset
  FROM public.company_quota_offsets
  WHERE company_id = p_company_id
    AND quota_key = 'orders'
    AND period_start = date_trunc('month', now())::date;

  RETURN GREATEST(v_count - v_offset, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.company_order_count IS 'Calendar-month material order count, minus admin offset.';
