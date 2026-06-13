-- ============================================================================
-- P1-1b Multi-Area Takeoff: schema + RPC update
-- ============================================================================
--
-- What this migration does:
--
-- 1. Adds three columns to takeoff_pages:
--    - quote_roof_area_id: links a page to its designated quote_roof_areas row.
--      Set by createTakeoffPageForArea when creating a new-area page (Option B/C).
--    - canvas_image_path: per-page canvas snapshot (plan + coloured measurements).
--    - lines_image_path:  per-page lines-only snapshot.
--
-- 2. Updates save_takeoff_atomic to accept target_roof_area_id in the payload:
--    - Step 8 (roof areas): if target_roof_area_id is supplied, UPDATE the
--      pre-created area row instead of INSERT a new one. This prevents the
--      duplicate-area accumulation bug.
--    - Step 9 (components): if target_roof_area_id is supplied, look up
--      existing components by (quote_id, component_library_id, quote_roof_area_id)
--      so components are routed to the correct area. New components created
--      under target_roof_area_id, not v_first_roof_area.
--    - Step 5 (images): also write canvas_image_path / lines_image_path to the
--      takeoff_pages row identified by current_page_id (when present).
-- ============================================================================

BEGIN;

-- ── 1. Schema additions ───────────────────────────────────────────────────

ALTER TABLE public.takeoff_pages
  ADD COLUMN IF NOT EXISTS quote_roof_area_id UUID
    REFERENCES public.quote_roof_areas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS canvas_image_path TEXT,
  ADD COLUMN IF NOT EXISTS lines_image_path  TEXT;

-- ── 2. Updated RPC ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.save_takeoff_atomic(p_quote_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_company_id          uuid;
  v_caller_company_id   uuid;
  v_caller_uid          uuid := auth.uid();
  v_quote_trade         text;
  v_first_roof_area     uuid;
  v_target_roof_area_id uuid := nullif(p_payload->>'target_roof_area_id', '')::uuid;
  v_canvas_path         text := p_payload->>'canvas_image_path';
  v_lines_path          text := p_payload->>'lines_image_path';
  v_canvas_url          text := p_payload->>'canvas_image_url';
  v_lines_url           text := p_payload->>'lines_image_url';
  v_measurements        jsonb := coalesce(p_payload->'measurements', '[]'::jsonb);
  v_roof_areas          jsonb := coalesce(p_payload->'roof_areas',   '[]'::jsonb);
  v_components          jsonb := coalesce(p_payload->'components',   '[]'::jsonb);
  v_current_page_id     uuid := nullif(p_payload->>'current_page_id', '')::uuid;
  v_submitted_version   integer := (p_payload->>'session_version')::integer;
  v_component           jsonb;
  v_new_component_id    uuid;
  v_existing_id         uuid;
  v_effective_area_id   uuid;
  v_lib_id              uuid;
  v_lib_company_id      uuid;
  v_lib_mtype           text;
  v_session_id          uuid;
  v_current_version     integer;
BEGIN
  -- ── 1. Ownership check + trade fetch ─────────────────────────────────────
  SELECT company_id, coalesce(trade::text, 'roofing')
    INTO v_company_id, v_quote_trade
    FROM public.quotes WHERE id = p_quote_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id;
  END IF;
  IF v_caller_uid IS NOT NULL THEN
    SELECT company_id INTO v_caller_company_id
      FROM public.users WHERE id = v_caller_uid;
    IF v_caller_company_id IS NULL OR v_caller_company_id <> v_company_id THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- ── 2. Advisory lock ─────────────────────────────────────────────────────
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(p_quote_id::text, 1, 8))::bit(32)::bigint
  );

  -- ── 3. Optimistic version check ──────────────────────────────────────────
  IF v_submitted_version IS NOT NULL THEN
    SELECT id, version INTO v_session_id, v_current_version
      FROM public.takeoff_sessions
     WHERE quote_id = p_quote_id;
    IF v_session_id IS NOT NULL AND v_current_version IS DISTINCT FROM v_submitted_version THEN
      RAISE EXCEPTION 'STALE_TAKEOFF_VERSION: expected % got %',
        v_submitted_version, v_current_version;
    END IF;
  END IF;

  -- ── 4. Component compatibility pre-flight ────────────────────────────────
  FOR v_component IN SELECT * FROM jsonb_array_elements(v_components) LOOP
    v_lib_id := nullif(v_component->>'component_library_id', '')::uuid;
    IF v_lib_id IS NULL THEN
      RAISE EXCEPTION 'Component payload missing component_library_id';
    END IF;
    SELECT company_id, measurement_type::text
      INTO v_lib_company_id, v_lib_mtype
      FROM public.component_library WHERE id = v_lib_id;
    IF v_lib_company_id IS NULL THEN
      RAISE EXCEPTION 'Component library % not found', v_lib_id;
    END IF;
    IF v_lib_company_id <> v_company_id THEN
      RAISE EXCEPTION 'Component library % does not belong to this company', v_lib_id;
    END IF;
    IF NOT public.is_measurement_type_allowed_for_trade(v_quote_trade, v_lib_mtype) THEN
      RAISE EXCEPTION 'Component % (measurement_type=%) is not compatible with trade %',
        v_lib_id, v_lib_mtype, v_quote_trade;
    END IF;
  END LOOP;

  -- ── 5. Canvas snapshots ───────────────────────────────────────────────────
  -- Always update the quote-level columns (latest canvas for re-entry modal).
  IF v_canvas_path IS NOT NULL OR v_lines_path IS NOT NULL
     OR v_canvas_url IS NOT NULL OR v_lines_url IS NOT NULL THEN
    UPDATE public.quotes
       SET takeoff_canvas_path = coalesce(v_canvas_path, takeoff_canvas_path),
           takeoff_lines_path  = coalesce(v_lines_path,  takeoff_lines_path),
           takeoff_canvas_url  = coalesce(v_canvas_url,  takeoff_canvas_url),
           takeoff_lines_url   = coalesce(v_lines_url,   takeoff_lines_url)
     WHERE id = p_quote_id;
    -- Also store per-page when current_page_id is known.
    IF v_current_page_id IS NOT NULL THEN
      UPDATE public.takeoff_pages
         SET canvas_image_path = coalesce(v_canvas_path, canvas_image_path),
             lines_image_path  = coalesce(v_lines_path,  lines_image_path)
       WHERE id = v_current_page_id
         AND quote_id = p_quote_id;
    END IF;
  END IF;

  -- ── 6. Scoped measurement delete ──────────────────────────────────────────
  IF v_current_page_id IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND (page_id = v_current_page_id OR page_id IS NULL);
  ELSE
    DELETE FROM public.quote_takeoff_measurements WHERE quote_id = p_quote_id;
  END IF;

  -- ── 7. Insert new measurements ────────────────────────────────────────────
  IF jsonb_array_length(v_measurements) > 0 THEN
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_measurements) AS m
       WHERE nullif(m->>'page_id', '') IS NOT NULL
         AND NOT EXISTS (
           SELECT 1 FROM public.takeoff_pages tp
            WHERE tp.id = nullif(m->>'page_id', '')::uuid
              AND tp.quote_id = p_quote_id
         )
    ) THEN
      RAISE EXCEPTION 'One or more page_id values do not belong to quote %', p_quote_id;
    END IF;
    INSERT INTO public.quote_takeoff_measurements (
      quote_id, company_id, component_library_id, measurement_type, measurement_value,
      measurement_unit, canvas_points, is_visible, page_id
    )
    SELECT
      p_quote_id,
      coalesce((m->>'company_id')::uuid, v_company_id),
      nullif(m->>'component_library_id','')::uuid,
      m->>'measurement_type',
      (m->>'measurement_value')::numeric,
      m->>'measurement_unit',
      m->'canvas_points',
      coalesce((m->>'is_visible')::boolean, true),
      nullif(m->>'page_id', '')::uuid
    FROM jsonb_array_elements(v_measurements) AS m;
  END IF;

  -- ── 8. Roof areas ─────────────────────────────────────────────────────────
  -- P1-1b: if target_roof_area_id is supplied, UPDATE the pre-created row
  -- (avoids duplicate area accumulation). Otherwise INSERT as before.
  IF v_target_roof_area_id IS NOT NULL THEN
    -- Update the pre-created area with drawn values (if any were submitted).
    IF jsonb_array_length(v_roof_areas) > 0 THEN
      UPDATE public.quote_roof_areas
         SET label               = coalesce((v_roof_areas->0)->>'label', label),
             final_value_sqm     = coalesce(((v_roof_areas->0)->>'final_value_sqm')::numeric, final_value_sqm),
             computed_sqm        = coalesce(((v_roof_areas->0)->>'computed_sqm')::numeric, computed_sqm),
             calc_pitch_degrees  = coalesce(((v_roof_areas->0)->>'calc_pitch_degrees')::numeric, calc_pitch_degrees),
             is_locked           = true
       WHERE id = v_target_roof_area_id
         AND quote_id = p_quote_id;
    END IF;
    v_first_roof_area := v_target_roof_area_id;
  ELSIF jsonb_array_length(v_roof_areas) > 0 THEN
    -- Original behaviour: INSERT new area rows.
    WITH inserted AS (
      INSERT INTO public.quote_roof_areas (
        quote_id, label, input_mode, final_value_sqm, computed_sqm, calc_pitch_degrees, is_locked
      )
      SELECT
        p_quote_id, ra->>'label', 'final'::input_mode,
        (ra->>'final_value_sqm')::numeric, (ra->>'computed_sqm')::numeric,
        (ra->>'calc_pitch_degrees')::numeric, true
      FROM jsonb_array_elements(v_roof_areas) WITH ORDINALITY AS t(ra, ord)
      ORDER BY t.ord
      RETURNING id
    )
    SELECT id INTO v_first_roof_area FROM inserted LIMIT 1;
  END IF;

  -- ── 9. Components: area-aware upsert ─────────────────────────────────────
  -- P1-1b: when target_roof_area_id is set, route components to that area
  -- only. Look up by (quote_id, component_library_id, quote_roof_area_id)
  -- so page-1 components are never touched by a new-area save.
  FOR v_component IN SELECT * FROM jsonb_array_elements(v_components) LOOP
    v_lib_id := (v_component->>'component_library_id')::uuid;

    -- Determine effective area for this save.
    v_effective_area_id := coalesce(v_target_roof_area_id, v_first_roof_area);

    IF v_target_roof_area_id IS NOT NULL THEN
      -- New-area save: look up by (quote_id, lib_id, target area).
      SELECT id INTO v_existing_id
        FROM public.quote_components
       WHERE quote_id = p_quote_id
         AND component_library_id = v_lib_id
         AND quote_roof_area_id = v_target_roof_area_id
       LIMIT 1;
    ELSE
      -- Original behaviour: look up by (quote_id, lib_id) — any area.
      SELECT id INTO v_existing_id
        FROM public.quote_components
       WHERE quote_id = p_quote_id
         AND component_library_id = v_lib_id
       LIMIT 1;
    END IF;

    IF v_existing_id IS NOT NULL THEN
      -- Reconcile entries for the found component.
      DELETE FROM public.quote_component_entries
       WHERE quote_component_id = v_existing_id;
      IF jsonb_array_length(coalesce(v_component->'entries', '[]'::jsonb)) > 0 THEN
        INSERT INTO public.quote_component_entries (
          quote_component_id, raw_value, value_after_waste, sort_order
        )
        SELECT
          v_existing_id,
          (e->>'raw_value')::numeric,
          (e->>'value_after_waste')::numeric,
          coalesce((e->>'sort_order')::int, 0)
        FROM jsonb_array_elements(v_component->'entries') AS e;
      END IF;
      UPDATE public.quote_components c
         SET final_quantity = coalesce((
               SELECT sum(value_after_waste) FROM public.quote_component_entries
                WHERE quote_component_id = v_existing_id), 0),
             material_cost  = coalesce((
               SELECT sum(value_after_waste) FROM public.quote_component_entries
                WHERE quote_component_id = v_existing_id), 0) * c.material_rate,
             labour_cost    = coalesce((
               SELECT sum(value_after_waste) FROM public.quote_component_entries
                WHERE quote_component_id = v_existing_id), 0) * c.labour_rate
       WHERE c.id = v_existing_id;
      CONTINUE;
    END IF;

    -- New component: insert under the effective area.
    INSERT INTO public.quote_components (
      quote_id, quote_roof_area_id, component_library_id, name, component_type,
      measurement_type, input_mode,
      material_rate, labour_rate,
      waste_type, waste_percent, waste_fixed, pitch_type,
      final_quantity, material_cost, labour_cost
    ) VALUES (
      p_quote_id, v_effective_area_id, v_lib_id, v_component->>'name', 'main'::component_type,
      coalesce(v_component->>'measurement_type', 'lineal')::measurement_type,
      'calculated'::input_mode,
      coalesce((v_component->>'material_rate')::numeric, 0),
      coalesce((v_component->>'labour_rate')::numeric, 0),
      coalesce((v_component->>'waste_type')::waste_type, 'none'::waste_type),
      coalesce((v_component->>'waste_percent')::numeric, 0),
      coalesce((v_component->>'waste_fixed')::numeric, 0),
      coalesce((v_component->>'pitch_type')::pitch_type, 'none'::pitch_type),
      coalesce((v_component->>'final_quantity')::numeric, 0),
      coalesce((v_component->>'material_cost')::numeric, 0),
      coalesce((v_component->>'labour_cost')::numeric, 0)
    )
    RETURNING id INTO v_new_component_id;

    IF jsonb_array_length(coalesce(v_component->'entries', '[]'::jsonb)) > 0 THEN
      INSERT INTO public.quote_component_entries (
        quote_component_id, raw_value, value_after_waste, sort_order
      )
      SELECT
        v_new_component_id,
        (e->>'raw_value')::numeric,
        (e->>'value_after_waste')::numeric,
        coalesce((e->>'sort_order')::int, 0)
      FROM jsonb_array_elements(v_component->'entries') AS e;
    END IF;
  END LOOP;

  -- ── 10. Increment session version ────────────────────────────────────────
  IF v_session_id IS NOT NULL THEN
    UPDATE public.takeoff_sessions SET version = version + 1 WHERE id = v_session_id;
  ELSE
    UPDATE public.takeoff_sessions SET version = version + 1 WHERE quote_id = p_quote_id;
  END IF;

END;
$function$;

COMMENT ON FUNCTION public.save_takeoff_atomic(uuid, jsonb) IS
  'P1-1b multi-area: target_roof_area_id routing — area-aware component lookup, '
  'UPDATE pre-created roof area instead of INSERT, per-page image columns. '
  'Backward-compatible: callers without target_roof_area_id use original behaviour.';

COMMIT;
