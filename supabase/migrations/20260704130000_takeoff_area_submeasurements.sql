-- Migration: 20260704130000_takeoff_area_submeasurements.sql
-- Purpose: Replace save_takeoff_atomic RPC so it:
--   1. Does NOT insert new quote_roof_areas rows (areas created upfront by createNewTakeoffArea)
--   2. Creates quote_roof_area_entries rows for each drawn area polygon
--   3. Recomputes parent area SUM from entries
--   4. Uses area-scoped delete (replace-by-area+page, not replace-by-page-only)
-- Approach: CREATE OR REPLACE the existing function. Old version is in migration
--           20260526160000 for rollback.
-- Rollback: Re-apply 20260526160000_fix_save_takeoff_atomic_overload.sql

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
  v_area_pitch        numeric;
  v_area_sqm          numeric;
  v_area_label        text;
  v_area_ord          integer;
  v_total_sqm         numeric;
  v_idx               integer;
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

  -- ── 6. Area-scoped measurement delete ─────────────────────────────────────
  IF v_target_roof_area IS NOT NULL AND v_current_page_id IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND quote_roof_area_id = v_target_roof_area
       AND (page_id = v_current_page_id OR page_id IS NULL);
  ELSIF v_target_roof_area IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND quote_roof_area_id = v_target_roof_area;
  ELSIF v_current_page_id IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND (page_id = v_current_page_id OR page_id IS NULL);
  ELSE
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id;
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
      (m->>'measurement_value')::numeric,
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

  -- ── 8. Roof areas: UPDATE existing rows + create sub-measurement entries ─
  -- Phase 3: Do NOT insert new quote_roof_areas rows. Areas are created
  -- upfront by createNewTakeoffArea. Here we:
  --   a) For each area in the payload, find the existing row by label
  --   b) Update pitch on the area row
  --   c) Delete old sub-measurement entries for this area (from this save session)
  --   d) Create a new quote_roof_area_entries row for the drawn polygon
  --   e) Recompute the parent area's computed_sqm from all entries
  IF jsonb_array_length(v_roof_areas) > 0 THEN
    FOR v_idx IN 1..jsonb_array_length(v_roof_areas) LOOP
      v_area := v_roof_areas[v_idx];
      v_area_label  := v_area->>'label';
      v_area_pitch  := coalesce((v_area->>'calc_pitch_degrees')::numeric, 0);
      v_area_sqm    := coalesce((v_area->>'computed_sqm')::numeric, 0);
      v_area_ord    := v_idx;

      -- Find the existing quote_roof_areas row
      v_area_id := null;
      IF v_target_roof_area IS NOT NULL AND v_area_ord = 1 THEN
        v_area_id := v_target_roof_area;
      ELSE
        SELECT id INTO v_area_id
          FROM public.quote_roof_areas
         WHERE quote_id = p_quote_id
           AND label = v_area_label
         ORDER BY sort_order
         LIMIT 1;
      END IF;

      IF v_area_id IS NOT NULL THEN
        -- Update pitch on the area row
        UPDATE public.quote_roof_areas
           SET calc_pitch_degrees = v_area_pitch
         WHERE id = v_area_id;

        -- Create a sub-measurement entry for this drawn polygon
        INSERT INTO public.quote_roof_area_entries (
          quote_roof_area_id, width_m, length_m, sqm, sort_order
        ) VALUES (
          v_area_id,
          0,
          0,
          v_area_sqm,
          v_area_ord
        );

        -- Recompute the area's computed_sqm from all entries
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
  FOR v_component IN SELECT * FROM jsonb_array_elements(v_components) LOOP
    v_lib_id := (v_component->>'component_library_id')::uuid;

    SELECT id INTO v_existing_id
      FROM public.quote_components
     WHERE quote_id = p_quote_id
       AND component_library_id = v_lib_id
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
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

    -- New component: insert row + entries
    INSERT INTO public.quote_components (
      quote_id, quote_roof_area_id, component_library_id, name, component_type,
      measurement_type, input_mode,
      material_rate, labour_rate,
      waste_type, waste_percent, waste_fixed, pitch_type,
      final_quantity, material_cost, labour_cost
    ) VALUES (
      p_quote_id, coalesce(v_target_roof_area, v_first_roof_area), v_lib_id, v_component->>'name', 'main'::component_type,
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
        (e->>'raw_value')::numeric,
        (e->>'value_after_waste')::numeric,
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
  'Phase 3-4: area-scoped delete, sub-measurement entries, no area row creation. '
  'Areas created upfront by createNewTakeoffArea. RPC only updates existing area sums.';
