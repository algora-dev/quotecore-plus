-- Migration: 20260705210000_fix_component_area_routing.sql
-- Purpose: Fix components from one roof area overwriting components in
--   another roof area when they share the same component_library_id.
--
-- Root cause: save_takeoff_atomic Section 9 matched existing quote_components
-- by (quote_id, component_library_id) ONLY — ignoring quote_roof_area_id.
-- When Q Area sent Valley Flashing, the RPC found Main Roof's Valley Flashing
-- row and overwrote its entries. Main Roof's component data was destroyed.
--
-- Fix:
--   1. Match existing quote_components by (quote_id, component_library_id,
--      quote_roof_area_id). Same library component on different areas =
--      different quote_components rows.
--   2. Use the payload's quote_roof_area_id for new component inserts
--      (not v_target_roof_area / v_first_roof_area which may point to the
--      wrong area when saving from a non-first area).

CREATE OR REPLACE FUNCTION public.save_takeoff_atomic(p_quote_id uuid, p_payload jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_company_id        uuid;
  v_caller_company_id uuid;
  v_caller_uid        uuid := auth.uid();
  v_quote_trade       text;
  v_first_roof_area   uuid;
  v_target_roof_area  uuid := nullif(p_payload->>'target_roof_area_id', '')::uuid;
  v_canvas_path       text := p_payload->>'canvas_image_path';
  v_lines_path        text := p_payload->>'lines_image_path';
  v_canvas_url        text := p_payload->>'canvas_image_url';
  v_lines_url         text := p_payload->>'lines_image_url';
  v_measurements      jsonb := coalesce(p_payload->'measurements', '[]'::jsonb);
  v_roof_areas        jsonb := coalesce(p_payload->'roof_areas',   '[]'::jsonb);
  v_components        jsonb := coalesce(p_payload->'components',   '[]'::jsonb);
  v_current_page_id   uuid := nullif(p_payload->>'current_page_id', '')::uuid;
  v_submitted_version integer := (p_payload->>'session_version')::integer;
  v_component         jsonb;
  v_new_component_id  uuid;
  v_existing_id       uuid;
  v_lib_id            uuid;
  v_lib_company_id    uuid;
  v_lib_mtype         text;
  v_session_id        uuid;
  v_current_version   integer;
  v_area              jsonb;
  v_area_id           uuid;
  v_area_candidate    uuid;
  v_area_pitch        numeric;
  v_area_sqm          numeric;
  v_area_label        text;
  v_area_ord          integer;
  v_total_sqm         numeric;
  v_processed_areas   uuid[] := '{}';
  v_saved_area_ids    uuid[] := '{}';
  v_comp_area_id      uuid;
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

  -- ── 2. Advisory lock ──────────────────────────────────────────────────────
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
      FROM public.component_library
     WHERE id = v_lib_id;

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
  IF v_canvas_path IS NOT NULL OR v_lines_path IS NOT NULL
     OR v_canvas_url IS NOT NULL OR v_lines_url IS NOT NULL THEN
    UPDATE public.quotes
       SET takeoff_canvas_path = coalesce(v_canvas_path, takeoff_canvas_path),
           takeoff_lines_path  = coalesce(v_lines_path,  takeoff_lines_path),
           takeoff_canvas_url  = coalesce(v_canvas_url,  takeoff_canvas_url),
           takeoff_lines_url   = coalesce(v_lines_url,   takeoff_lines_url)
     WHERE id = p_quote_id;
  END IF;

  -- ── 6. Measurement delete ─────────────────────────────────────────────────
  -- Collect roof area IDs from the payload for area-measurement cleanup.
  IF jsonb_array_length(v_roof_areas) > 0 THEN
    FOR v_area IN SELECT * FROM jsonb_array_elements(v_roof_areas) LOOP
      v_area_candidate := nullif(v_area->>'quote_roof_area_id', '')::uuid;
      IF v_area_candidate IS NOT NULL THEN
        SELECT id INTO v_area_id
          FROM public.quote_roof_areas
         WHERE id = v_area_candidate AND quote_id = p_quote_id;
        IF v_area_id IS NOT NULL AND NOT (v_area_id = ANY(v_saved_area_ids)) THEN
          v_saved_area_ids := v_saved_area_ids || v_area_id;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- Delete component measurements (page-scoped)
  IF v_target_roof_area IS NOT NULL AND v_current_page_id IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND quote_roof_area_id = v_target_roof_area
       AND component_library_id IS NOT NULL
       AND (page_id = v_current_page_id OR page_id IS NULL);
  ELSIF v_target_roof_area IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND quote_roof_area_id = v_target_roof_area
       AND component_library_id IS NOT NULL;
  ELSIF v_current_page_id IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND component_library_id IS NOT NULL
       AND (page_id = v_current_page_id OR page_id IS NULL);
  ELSE
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND component_library_id IS NOT NULL;
  END IF;

  -- Delete roof area measurements (ALL pages for saved areas)
  IF array_length(v_saved_area_ids, 1) > 0 THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND component_library_id IS NULL
       AND measurement_type = 'area'
       AND quote_roof_area_id = ANY(v_saved_area_ids);
  ELSIF v_current_page_id IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND component_library_id IS NULL
       AND measurement_type = 'area'
       AND (page_id = v_current_page_id OR page_id IS NULL);
  ELSE
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND component_library_id IS NULL
       AND measurement_type = 'area';
  END IF;

  -- ── 7. Insert new measurements ────────────────────────────────────────────
  IF jsonb_array_length(v_measurements) > 0 THEN
    IF EXISTS (
      SELECT 1
        FROM jsonb_array_elements(v_measurements) AS m
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
      measurement_unit, canvas_points, is_visible, page_id, quote_roof_area_id
    )
    SELECT
      p_quote_id,
      coalesce((m->>'company_id')::uuid, v_company_id),
      nullif(m->>'component_library_id','')::uuid,
      m->>'measurement_type',
      coalesce(nullif(m->>'measurement_value', '')::numeric, 0),
      m->>'measurement_unit',
      m->'canvas_points',
      coalesce((m->>'is_visible')::boolean, true),
      nullif(m->>'page_id', '')::uuid,
      coalesce(
        nullif(m->>'quote_roof_area_id', '')::uuid,
        v_target_roof_area
      )
    FROM jsonb_array_elements(v_measurements) AS m;
  END IF;

  -- ── 8. Roof areas: update existing rows + replace ALL takeoff entries ────
  IF jsonb_array_length(v_roof_areas) > 0 THEN
    FOR v_area, v_area_ord IN
      SELECT value, ordinality
        FROM jsonb_array_elements(v_roof_areas) WITH ORDINALITY
    LOOP
      v_area_label := v_area->>'label';
      v_area_pitch := coalesce((v_area->>'calc_pitch_degrees')::numeric, 0);
      v_area_sqm   := coalesce((v_area->>'computed_sqm')::numeric, 0);

      v_area_id := null;
      v_area_candidate := nullif(v_area->>'quote_roof_area_id', '')::uuid;
      IF v_area_candidate IS NOT NULL THEN
        SELECT id INTO v_area_id
          FROM public.quote_roof_areas
         WHERE id = v_area_candidate AND quote_id = p_quote_id;
      END IF;
      IF v_area_id IS NULL AND v_target_roof_area IS NOT NULL AND v_area_ord = 1 THEN
        v_area_id := v_target_roof_area;
      END IF;
      IF v_area_id IS NULL AND v_area_label IS NOT NULL THEN
        SELECT id INTO v_area_id
          FROM public.quote_roof_areas
         WHERE quote_id = p_quote_id
           AND label = v_area_label
         ORDER BY sort_order
         LIMIT 1;
      END IF;

      IF v_area_id IS NOT NULL THEN
        IF NOT (v_area_id = ANY(v_processed_areas)) THEN
          DELETE FROM public.quote_roof_area_entries
           WHERE quote_roof_area_id = v_area_id
             AND source = 'takeoff';
          v_processed_areas := v_processed_areas || v_area_id;
        END IF;

        UPDATE public.quote_roof_areas
           SET calc_pitch_degrees = v_area_pitch
         WHERE id = v_area_id;

        INSERT INTO public.quote_roof_area_entries (
          quote_roof_area_id, width_m, length_m, sqm, sort_order, source, page_id
        ) VALUES (
          v_area_id, 0, 0, v_area_sqm, v_area_ord::int, 'takeoff', v_current_page_id
        );

        SELECT COALESCE(SUM(sqm), 0) INTO v_total_sqm
          FROM public.quote_roof_area_entries
         WHERE quote_roof_area_id = v_area_id;

        UPDATE public.quote_roof_areas
           SET computed_sqm = v_total_sqm,
               final_value_sqm = v_total_sqm
         WHERE id = v_area_id;
      END IF;

      IF v_first_roof_area IS NULL THEN
        v_first_roof_area := v_area_id;
      END IF;
    END LOOP;
  END IF;

  -- ── 9. Components: upsert entries + recalculate totals ────────────────────
  -- FIX (2026-07-05 v3): match existing quote_components by
  -- (quote_id, component_library_id, quote_roof_area_id) — NOT just
  -- (quote_id, component_library_id). Without the quote_roof_area_id check,
  -- a component from Q Area would find and overwrite Main Roof's component
  -- row (same library ID, different area), destroying Main Roof's data.
  FOR v_component IN SELECT * FROM jsonb_array_elements(v_components) LOOP
    v_lib_id := (v_component->>'component_library_id')::uuid;

    -- Extract the roof area ID from the payload.
    v_comp_area_id := nullif(v_component->>'quote_roof_area_id', '')::uuid;

    -- Match by (quote_id, component_library_id, quote_roof_area_id).
    -- COALESCE to handle NULL quote_roof_area_id (legacy/components not
    -- tied to a specific area).
    SELECT id INTO v_existing_id
      FROM public.quote_components
     WHERE quote_id = p_quote_id
       AND component_library_id = v_lib_id
       AND COALESCE(quote_roof_area_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(v_comp_area_id, '00000000-0000-0000-0000-000000000000'::uuid)
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      -- Delete existing entries for this component and replace with current
      -- page's entries. Note: this deletes ALL entries (cross-page). The
      -- recalcAllQuoteComponents call after the RPC will recalculate totals
      -- from the surviving entries. Multi-page component entry loss is a
      -- known limitation of the current architecture — to be addressed with
      -- page_id on quote_component_entries in a future migration.
      DELETE FROM public.quote_component_entries
       WHERE quote_component_id = v_existing_id;

      IF jsonb_array_length(coalesce(v_component->'entries', '[]'::jsonb)) > 0 THEN
        INSERT INTO public.quote_component_entries (
          quote_component_id, raw_value, value_after_waste, sort_order
        )
        SELECT
          v_existing_id,
          coalesce(nullif(e->>'raw_value', '')::numeric, 0),
          coalesce(nullif(e->>'value_after_waste', '')::numeric, 0),
          coalesce((e->>'sort_order')::int, 0)
        FROM jsonb_array_elements(v_component->'entries') AS e;
      END IF;

      UPDATE public.quote_components c
         SET final_quantity = coalesce((
               SELECT sum(value_after_waste)
                 FROM public.quote_component_entries
                WHERE quote_component_id = v_existing_id
             ), 0),
             material_cost  = coalesce((
               SELECT sum(value_after_waste)
                 FROM public.quote_component_entries
                WHERE quote_component_id = v_existing_id
             ), 0) * c.material_rate,
             labour_cost    = coalesce((
               SELECT sum(value_after_waste)
                 FROM public.quote_component_entries
                WHERE quote_component_id = v_existing_id
             ), 0) * c.labour_rate
       WHERE c.id = v_existing_id;

      CONTINUE;
    END IF;

    -- New component: insert row + entries.
    -- Use the payload's quote_roof_area_id (not v_target_roof_area /
    -- v_first_roof_area) so the component is routed to the correct area.
    INSERT INTO public.quote_components (
      quote_id, quote_roof_area_id, component_library_id, name, component_type,
      measurement_type, input_mode,
      material_rate, labour_rate,
      waste_type, waste_percent, waste_fixed, pitch_type,
      final_quantity, material_cost, labour_cost
    ) VALUES (
      p_quote_id,
      COALESCE(v_comp_area_id, v_target_roof_area, v_first_roof_area),
      v_lib_id, v_component->>'name', 'main'::component_type,
      coalesce(v_component->>'measurement_type', 'lineal')::measurement_type,
      'calculated'::input_mode,
      coalesce((v_component->>'material_rate')::numeric, 0),
      coalesce((v_component->>'labour_rate')::numeric, 0),
      coalesce(v_component->>'waste_type', 'none')::waste_type,
      coalesce((v_component->>'waste_percent')::numeric, 0),
      coalesce((v_component->>'waste_fixed')::numeric, 0),
      coalesce(v_component->>'pitch_type', 'none')::pitch_type,
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
        coalesce(nullif(e->>'raw_value', '')::numeric, 0),
        coalesce(nullif(e->>'value_after_waste', '')::numeric, 0),
        coalesce((e->>'sort_order')::int, 0)
      FROM jsonb_array_elements(v_component->'entries') AS e;
    END IF;
  END LOOP;

  -- ── 10. Increment session version ─────────────────────────────────────────
  IF v_session_id IS NOT NULL THEN
    UPDATE public.takeoff_sessions
       SET version = version + 1
     WHERE id = v_session_id;
  ELSE
    UPDATE public.takeoff_sessions
       SET version = version + 1
     WHERE quote_id = p_quote_id;
  END IF;

END;
$function$;

COMMENT ON FUNCTION public.save_takeoff_atomic(uuid, jsonb) IS
  'Fix 2026-07-05 v3: match quote_components by (component_library_id, '
  'quote_roof_area_id) so same library component on different areas creates '
  'separate quote_components rows. Prevents cross-area component overwriting.';

-- ── Data repair: fix the affected quote (42630e51) ──
-- The Q Area components were overwritten onto Main Roof. We need to:
-- 1. Delete the misrouted quote_components entries
-- 2. Rebuild quote_components from quote_takeoff_measurements
-- This is a one-time repair for this quote. The RPC fix prevents future issues.

-- First, delete all existing quote_component_entries and quote_components
-- for this quote — we'll rebuild them from quote_takeoff_measurements.
DELETE FROM public.quote_component_entries
 WHERE quote_component_id IN (
   SELECT id FROM public.quote_components WHERE quote_id = '42630e51-1f47-4e25-8b70-89823f62858d'
 );

DELETE FROM public.quote_components
 WHERE quote_id = '42630e51-1f47-4e25-8b70-89823f62858d';

-- Rebuild: for each (component_library_id, quote_roof_area_id) combination
-- in quote_takeoff_measurements, create a quote_components row with entries.
-- We use the measurement values + component_library defaults to compute
-- value_after_waste.
DO $$
DECLARE
  v_comp RECORD;
  v_entry RECORD;
  v_qc_id uuid;
  v_raw numeric;
  v_after_waste numeric;
  v_pitch numeric;
  v_waste_pct numeric;
  v_waste_fixed numeric;
  v_total numeric;
  v_mat_rate numeric;
  v_lab_rate numeric;
BEGIN
  FOR v_comp IN
    SELECT DISTINCT
      component_library_id,
      quote_roof_area_id
    FROM public.quote_takeoff_measurements
    WHERE quote_id = '42630e51-1f47-4e25-8b70-89823f62858d'
      AND component_library_id IS NOT NULL
    ORDER BY quote_roof_area_id, component_library_id
  LOOP
    -- Fetch library defaults
    SELECT
      default_material_rate,
      default_labour_rate,
      default_waste_percent,
      default_waste_fixed
    INTO
      v_mat_rate,
      v_lab_rate,
      v_waste_pct,
      v_waste_fixed
    FROM public.component_library
    WHERE id = v_comp.component_library_id;

    -- Fetch pitch from the roof area
    SELECT calc_pitch_degrees INTO v_pitch
    FROM public.quote_roof_areas
    WHERE id = v_comp.quote_roof_area_id;

    -- Create quote_components row
    INSERT INTO public.quote_components (
      quote_id, quote_roof_area_id, component_library_id, name,
      component_type, measurement_type, input_mode,
      material_rate, labour_rate,
      waste_type, waste_percent, waste_fixed, pitch_type,
      final_quantity, material_cost, labour_cost
    ) SELECT
      '42630e51-1f47-4e25-8b70-89823f62858d',
      v_comp.quote_roof_area_id,
      v_comp.component_library_id,
      cl.name,
      'main'::component_type,
      cl.measurement_type::measurement_type,
      'calculated'::input_mode,
      cl.default_material_rate,
      cl.default_labour_rate,
      COALESCE(cl.default_waste_type::text, 'none')::waste_type,
      COALESCE(cl.default_waste_percent, 0),
      COALESCE(cl.default_waste_fixed, 0),
      COALESCE(cl.default_pitch_type::text, 'none')::pitch_type,
      0, 0, 0
    FROM public.component_library cl
    WHERE cl.id = v_comp.component_library_id
    RETURNING id INTO v_qc_id;

    -- Insert entries from measurements
    v_total := 0;
    FOR v_entry IN
      SELECT measurement_value, ROW_NUMBER() OVER (ORDER BY created_at) as rn
      FROM public.quote_takeoff_measurements
      WHERE quote_id = '42630e51-1f47-4e25-8b70-89823f62858d'
        AND component_library_id = v_comp.component_library_id
        AND quote_roof_area_id = v_comp.quote_roof_area_id
    LOOP
      v_raw := v_entry.measurement_value;
      -- Apply waste: percentage + fixed
      v_after_waste := v_raw * (1 + COALESCE(v_waste_pct, 0) / 100) + COALESCE(v_waste_fixed, 0);
      -- Apply pitch factor if pitch > 0
      IF v_pitch > 0 THEN
        v_after_waste := v_after_waste / cos(radians(v_pitch));
      END IF;

      INSERT INTO public.quote_component_entries (
        quote_component_id, raw_value, value_after_waste, sort_order
      ) VALUES (
        v_qc_id, v_raw, v_after_waste, v_entry.rn::int
      );

      v_total := v_total + v_after_waste;
    END LOOP;

    -- Update totals
    UPDATE public.quote_components
    SET final_quantity = v_total,
        material_cost = v_total * v_mat_rate,
        labour_cost = v_total * v_lab_rate
    WHERE id = v_qc_id;
  END LOOP;
END $$;
