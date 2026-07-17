-- ============================================================================
-- AI-Assisted Digital Takeoff — Phase A: DB foundation
--
-- Adds: is_system flag on component_library, unique index for system rows,
--       company_component_count excludes system rows, ensure_ai_system_components
--       SECURITY DEFINER RPC, takeoff_pages.ai_scan_result snapshot,
--       ai_scan_usage analytics table.
--
-- Risk: LOW. All changes are additive/inert. Nothing on dev/main references
-- these until the feature code merges. The shared DB serves dev+main+previews.
-- ============================================================================

-- 1. Flag column -------------------------------------------------------------
ALTER TABLE component_library
  ADD COLUMN IF NOT EXISTS is_system boolean NOT NULL DEFAULT false;

-- 2. Prevent duplicate system rows per company -------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_component_library_system_name
  ON component_library (company_id, name)
  WHERE is_system = true;

-- 3. company_component_count: exclude system rows ----------------------------
--    Copy-exact-body rule: copied from live DB, added one predicate.
CREATE OR REPLACE FUNCTION public.company_component_count(p_company_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COUNT(*)::integer
    FROM public.component_library
   WHERE company_id = p_company_id
     AND is_active  = true
     AND is_system  = false;
$function$;

-- 4. ensure_ai_system_components(p_company_id) --------------------------------
--    SECURITY DEFINER: validates caller company, early-returns when seeded,
--    bypass-GUC inserts the 6 system placeholder components.
--    Lazy seeding — called from takeoff page.tsx server load before component fetch.
CREATE OR REPLACE FUNCTION public.ensure_ai_system_components(p_company_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_existing integer;
BEGIN
  -- Validate caller company (prevents cross-company abuse)
  IF p_company_id IS NULL OR p_company_id <> current_company_id() THEN
    RAISE EXCEPTION 'not_authorised' USING ERRCODE = 'P0001';
  END IF;

  -- Early-return if already seeded (one cheap indexed count)
  SELECT COUNT(*) INTO v_existing
    FROM public.component_library
   WHERE company_id = p_company_id
     AND is_system = true;

  IF v_existing >= 6 THEN
    RETURN;
  END IF;

  -- Bypass the component cap (same pattern as seed_starter_components)
  PERFORM set_config('app.bypass_component_cap', 'on', true);

  INSERT INTO public.component_library (
    company_id, name, component_type, measurement_type,
    default_material_rate, default_labour_rate,
    default_waste_type, default_waste_percent, default_waste_fixed,
    default_pitch_type, eligible_for_orders, is_active, sort_order,
    pricing_strategy, is_system, collection_id
  ) VALUES
    (p_company_id, 'Hip',      'main', 'lineal', 0, 0, 'none', 0, 0, 'valley_hip', false, true, 900, 'per_unit', true, NULL),
    (p_company_id, 'Valley',   'main', 'lineal', 0, 0, 'none', 0, 0, 'valley_hip', false, true, 901, 'per_unit', true, NULL),
    (p_company_id, 'Ridge',    'main', 'lineal', 0, 0, 'none', 0, 0, 'none',       false, true, 902, 'per_unit', true, NULL),
    (p_company_id, 'Barge',    'main', 'lineal', 0, 0, 'none', 0, 0, 'rafter',     false, true, 903, 'per_unit', true, NULL),
    (p_company_id, 'Spouting', 'main', 'lineal', 0, 0, 'none', 0, 0, 'none',       false, true, 904, 'per_unit', true, NULL),
    (p_company_id, 'Roof Area','main', 'area',   0, 0, 'none', 0, 0, 'rafter',     false, true, 905, 'per_unit', true, NULL)
  ON CONFLICT DO NOTHING;
END $function$;

GRANT EXECUTE ON FUNCTION public.ensure_ai_system_components(uuid)
  TO authenticated;

-- 5. takeoff_pages.ai_scan_result — validated AI scan snapshot ---------------
--    Powers "Reset AI Entries" with zero AI cost. Written once after apply.
ALTER TABLE takeoff_pages
  ADD COLUMN IF NOT EXISTS ai_scan_result jsonb DEFAULT NULL;

-- 6. ai_scan_usage — analytics / cost log + future quota source --------------
CREATE TABLE IF NOT EXISTS public.ai_scan_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  quote_id    uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  page_id     uuid REFERENCES public.takeoff_pages(id) ON DELETE SET NULL,
  success     boolean NOT NULL,
  model       text,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_scan_usage_company
  ON public.ai_scan_usage (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_scan_usage_quote
  ON public.ai_scan_usage (quote_id);

-- RLS: users see only their own company's scan history
ALTER TABLE public.ai_scan_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY ai_scan_usage_all_same_company
  ON public.ai_scan_usage
  FOR ALL
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

GRANT SELECT, INSERT ON public.ai_scan_usage TO authenticated;
