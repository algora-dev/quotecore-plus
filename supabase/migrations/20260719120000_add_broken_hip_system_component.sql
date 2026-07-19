-- ============================================================================
-- Add broken_hip system component for AI takeoff
--
-- Updates ensure_ai_system_components to seed a 7th system component
-- (broken_hip) and bumps the early-return threshold from 6 to 7.
-- ============================================================================

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

  IF v_existing >= 7 THEN
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
    (p_company_id, 'Hip',        'main', 'lineal', 0, 0, 'none', 0, 0, 'valley_hip', false, true, 900, 'per_unit', true, NULL),
    (p_company_id, 'Valley',     'main', 'lineal', 0, 0, 'none', 0, 0, 'valley_hip', false, true, 901, 'per_unit', true, NULL),
    (p_company_id, 'Ridge',      'main', 'lineal', 0, 0, 'none', 0, 0, 'none',       false, true, 902, 'per_unit', true, NULL),
    (p_company_id, 'Barge',      'main', 'lineal', 0, 0, 'none', 0, 0, 'rafter',     false, true, 903, 'per_unit', true, NULL),
    (p_company_id, 'Spouting',   'main', 'lineal', 0, 0, 'none', 0, 0, 'none',       false, true, 904, 'per_unit', true, NULL),
    (p_company_id, 'Roof Area',  'main', 'area',   0, 0, 'none', 0, 0, 'rafter',     false, true, 905, 'per_unit', true, NULL),
    (p_company_id, 'Broken Hip', 'main', 'lineal', 0, 0, 'none', 0, 0, 'valley_hip', false, true, 906, 'per_unit', true, NULL)
  ON CONFLICT DO NOTHING;
END $function$;

GRANT EXECUTE ON FUNCTION public.ensure_ai_system_components(uuid)
  TO authenticated;
