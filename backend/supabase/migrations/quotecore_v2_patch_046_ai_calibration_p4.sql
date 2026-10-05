-- patch_046: AI-assisted calibration P4 - versioned persistence + feature flag
-- Mirrors patch_042 (Smart Assistant dark launch) exactly: NOT a companies
-- column (companies_update_own lets any member UPDATE their company row, so
-- a column there could be self-enabled from the client). All writes are
-- service-role only; absence of a row = disabled.
-- Additive/nullable ONLY - no existing column restructured, legacy readers of
-- takeoff_pages.scale_calibration / quote_takeoff_measurements keep working.

-- 1) Calibration feature flags table (mirrors assistant_feature_flags)
CREATE TABLE IF NOT EXISTS public.calibration_feature_flags (
  company_id uuid NOT NULL PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES public.users(id)
);

COMMENT ON TABLE public.calibration_feature_flags IS
  'AI-assisted calibration dark-launch exposure flag. Writes are service-role only (admin panel / set_calibration_flag RPC). Absence of a row = disabled.';

-- 2) RLS on, members can read (entry-point gating), nobody else writes.
ALTER TABLE public.calibration_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS calibration_feature_flags_read_own ON public.calibration_feature_flags;
CREATE POLICY calibration_feature_flags_read_own ON public.calibration_feature_flags
  FOR SELECT
  TO authenticated
  USING (public.user_belongs_to_company(company_id));

-- No INSERT/UPDATE/DELETE policies: writes are service-role only.

-- 3) Helper fn used by gating code (defensive default: disabled).
CREATE OR REPLACE FUNCTION public.calibration_ai_enabled(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(
    (SELECT f.enabled FROM public.calibration_feature_flags f
      WHERE f.company_id = p_company_id),
    false
  );
$$;

REVOKE EXECUTE ON FUNCTION public.calibration_ai_enabled(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.calibration_ai_enabled(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.calibration_ai_enabled(uuid) TO service_role;

-- 4) Service-role grant/revoke RPC (admin wiring; UI panel is P7 polish).
--    Matches the assistant-flag trust model: service_role ONLY.
CREATE OR REPLACE FUNCTION public.set_calibration_flag(
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

  INSERT INTO public.calibration_feature_flags (company_id, enabled, updated_by)
  VALUES (p_company_id, p_enabled, p_updated_by)
  ON CONFLICT (company_id) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_calibration_flag(uuid, boolean, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_calibration_flag(uuid, boolean, uuid) TO service_role;

-- 5) Versioned calibration metadata on takeoff_pages (P4, spec 11.1).
--    calibration_metadata: versioned envelope (schemaVersion 1, calibrationCodec
--      format: AcceptedReferenceDraft[] + EffectiveCalibration). NULL = legacy
--      row whose calibration (if any) still lives in scale_calibration.
--      Legacy readers of scale_calibration are unaffected; the legacy column
--      continues to be written alongside the envelope until P8 retires it.
--    image_revision: server-established identity of the immutable source image
--      (sha256 content digest + orientation-normalisation version). Backfilled
--      lazily by the server on the next calibration commit; NULL = not yet
--      established (calibration UI treats NULL as unavailable).
ALTER TABLE public.takeoff_pages
  ADD COLUMN IF NOT EXISTS calibration_metadata jsonb NULL,
  ADD COLUMN IF NOT EXISTS image_revision text NULL;

COMMENT ON COLUMN public.takeoff_pages.calibration_metadata IS
  'P4 versioned calibration envelope (app/lib/takeoff/calibrationCodec schemaVersion 1). NULL = legacy row (read scale_calibration array).';
COMMENT ON COLUMN public.takeoff_pages.image_revision IS
  'Server-established immutable source-image revision: sha256 content digest + orientation-normalisation version. Backfilled lazily on next calibration commit.';

-- 6) Durable source-geometry provenance link (P4, spec 10.3 / [C11]).
--    Populated for geometry-free dependent entries (attached/reused roof-area
--    components). The save_takeoff_atomic RPC does not enumerate this column,
--    so today the durable link rides inside entry_inputs jsonb (jsonb
--    passthrough, survives delete+reinsert); this column is the additive
--    forward-looking slot for a later RPC revision that writes it natively.
--    Nullable + unused by existing readers = zero behaviour change.
ALTER TABLE public.quote_takeoff_measurements
  ADD COLUMN IF NOT EXISTS source_geometry_id text NULL;

COMMENT ON COLUMN public.quote_takeoff_measurements.source_geometry_id IS
  'Durable source-geometry provenance for dependent (geometry-free) entries, spec 10.3. Written via entry_inputs jsonb passthrough today; native RPC write lands with the next save_takeoff_atomic revision.';

-- 7) Enable for Shaun's test company (owner secarter23@gmail.com), the same
--    documented idempotent grant pattern patch_042 used for the assistant flag.
INSERT INTO public.calibration_feature_flags (company_id, enabled)
SELECT u.company_id, true
FROM public.users u
WHERE u.email = 'secarter23@gmail.com' AND u.role = 'owner' AND u.company_id IS NOT NULL
ON CONFLICT (company_id) DO UPDATE SET enabled = true, updated_at = now();
