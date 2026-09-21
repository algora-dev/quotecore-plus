-- patch_051: Mobile takeoff touch workspace dark-launch flag (M2).
-- Mirrors patch_046 (calibration_feature_flags) exactly: NOT a companies
-- column; dedicated table with SELECT-only RLS for members (own company),
-- service-role writes only, absence of a row = disabled.
-- Additive ONLY - no existing object restructured.

-- 1) Takeoff touch feature flags table.
CREATE TABLE IF NOT EXISTS public.takeoff_touch_feature_flags (
  company_id uuid NOT NULL PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

COMMENT ON TABLE public.takeoff_touch_feature_flags IS
  'Mobile takeoff touch workspace dark-launch exposure flag. Writes are service-role only. Absence of a row = disabled (desktop experience bit-for-bit).';

-- 2) RLS on, members can read (entry-point gating), nobody else writes.
ALTER TABLE public.takeoff_touch_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS takeoff_touch_feature_flags_read_own ON public.takeoff_touch_feature_flags;
CREATE POLICY takeoff_touch_feature_flags_read_own ON public.takeoff_touch_feature_flags
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_company(company_id));

-- No INSERT/UPDATE/DELETE policies: writes are service-role only.

-- 3) Helper fn used by gating code (defensive default: disabled).
CREATE OR REPLACE FUNCTION public.takeoff_touch_enabled(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT f.enabled FROM public.takeoff_touch_feature_flags f
      WHERE f.company_id = p_company_id),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.takeoff_touch_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.takeoff_touch_enabled(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.takeoff_touch_enabled(uuid) TO service_role;

-- 4) Service-role grant/revoke RPC (admin wiring; matches patch_046 trust model).
CREATE OR REPLACE FUNCTION public.set_takeoff_touch_flag(
  p_company_id uuid,
  p_enabled boolean,
  p_updated_by uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.companies c WHERE c.id = p_company_id) THEN
    RAISE EXCEPTION 'unknown company: %', p_company_id;
  END IF;

  INSERT INTO public.takeoff_touch_feature_flags (company_id, enabled, updated_by)
  VALUES (p_company_id, p_enabled, p_updated_by)
  ON CONFLICT (company_id) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_takeoff_touch_flag(uuid, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_takeoff_touch_flag(uuid, boolean, uuid) TO service_role;
