-- Migration: 20260708160000_rpc_v8_entry_inputs.sql
-- Purpose: Per-entry input reference values (height/depth) — READ-ONLY display.
--
-- Context (2026-07-08 afternoon): the quote builder component phase shows
-- each entry's final value but not the inputs that produced it. User-entered
-- heights (freestyle L×H) and depths (volume custom depth) were discarded at
-- multiply time; preset height/depth lived only in component_library. This
-- adds a nullable `entry_inputs` JSONB snapshot ({"height_m", "depth_m",
-- "source": "user"|"preset"}) so the UI can display the values used.
-- NOTHING reads entry_inputs for calculation — display only.
--
-- Changes from v7 (20260708120000):
--   NEW: quote_component_entries.entry_inputs jsonb (additive, nullable).
--   NEW: quote_takeoff_measurements.entry_inputs jsonb (additive, nullable)
--     — hydration passthrough so takeoff re-entry + re-save doesn't wipe
--     user-entered values.
--   Section 7 (measurement insert): passes through m->'entry_inputs'.
--   Section 9 (both entry INSERTs): passes through e->'entry_inputs'.
--
-- Everything else is byte-identical to v7.

ALTER TABLE public.quote_component_entries
  ADD COLUMN IF NOT EXISTS entry_inputs jsonb;

ALTER TABLE public.quote_takeoff_measurements
  ADD COLUMN IF NOT EXISTS entry_inputs jsonb;

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
  v_comp_area_id      uuid;
  v_parent_pitch      numeric;
BEGIN
  -- == 1. Ownership check + trade fetch =====================================
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

  -- == 2. Advisory lock ======================================================
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(p_quote_id::text, 1, 8))::bit(32)::bigint
  );

  -- == 3. Optimistic version check ==========================================
  IF v_submitted_version IS NOT NULL THEN
    SELECT id, version INTO v_session_id, v_current_version
      FROM public.takeoff_sessions
     WHERE quote_id = p_quote_id;

    IF v_session_id IS NOT NULL AND v_current_version IS DISTINCT FROM v_submitted_version THEN
      RAISE EXCEPTION 'STALE_TAKEOFF_VERSION: expected % got %',
        v_submitted_version, v_current_version;
    END IF;
  END IF;

  -- == 4. Component compatibility pre-flight ================================
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

  -- == 5. Canvas snapshots ===================================================
  IF v_canvas_path IS NOT NULL OR v_lines_path IS NOT NULL
     OR v_canvas_url IS NOT NULL OR v_lines_url IS NOT NULL THEN
    UPDATE public.quotes
       SET takeoff_canvas_path = coalesce(v_canvas_path, takeoff_canvas_path),
           takeoff_lines_path  = coalesce(v_lines_path,  takeoff_lines_path),
           takeoff_canvas_url  = coalesce(v_canvas_url,  takeoff_canvas_url),
           takeoff_lines_url   = coalesce(v_lines_url,   takeoff_lines_url)
     WHERE id = p_quote_id;
  END IF;

  -- == 6. Measurement delete (PAGE-SCOPED, v5: area delete also area-scoped) =
  -- The client sends ONLY current-page measurements (fromPageId filter),
  -- so deleting only the current page's rows replaces exactly what the
  -- payload re-sends. Other pages' measurements survive.

  -- Component measurements (page-scoped + area-scoped when target provided)
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

  -- Roof area measurements (v5: area-scoped when target provided)
  IF v_target_roof_area IS NOT NULL AND v_current_page_id IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND quote_roof_area_id = v_target_roof_area
       AND component_library_id IS NULL
       AND measurement_type = 'area'
       AND (page_id = v_current_page_id OR page_id IS NULL);
  ELSIF v_target_roof_area IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND quote_roof_area_id = v_target_roof_area
       AND component_library_id IS NULL
       AND measurement_type = 'area';
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

  -- == 7. Insert new measurements ============================================
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
      measurement_unit, canvas_points, is_visible, page_id, quote_roof_area_id,
      entry_inputs
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
      ),
      nullif(m->'entry_inputs', 'null'::jsonb)
    FROM jsonb_array_elements(v_measurements) AS m;
  END IF;

  -- == 8. Roof areas: update rows + replace CURRENT PAGE's entries ==========
  -- v6 (2026-07-06): per-entry pitch_degrees stored on each entry.
  -- Parent calc_pitch_degrees only set when currently NULL/0 (first area
  -- wins); subsequent areas with different pitches don't overwrite it.
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
          -- v4: page-scoped delete. Entries this area accumulated on OTHER
          -- pages survive; the payload replaces only this page's entries.
          IF v_current_page_id IS NOT NULL THEN
            DELETE FROM public.quote_roof_area_entries
             WHERE quote_roof_area_id = v_area_id
               AND source = 'takeoff'
               AND (page_id = v_current_page_id OR page_id IS NULL);
          ELSE
            DELETE FROM public.quote_roof_area_entries
             WHERE quote_roof_area_id = v_area_id
               AND source = 'takeoff';
          END IF;
          v_processed_areas := v_processed_areas || v_area_id;
        END IF;

        -- v6: only set parent pitch when it's currently NULL/0 (first area
        -- wins). Subsequent areas with different pitches store their pitch
        -- on the entry itself, not the parent.
        SELECT calc_pitch_degrees INTO v_parent_pitch
          FROM public.quote_roof_areas WHERE id = v_area_id;
        IF v_parent_pitch IS NULL OR v_parent_pitch = 0 THEN
          UPDATE public.quote_roof_areas
             SET calc_pitch_degrees = v_area_pitch
           WHERE id = v_area_id;
        END IF;

        -- v6: insert with per-entry pitch_degrees
        INSERT INTO public.quote_roof_area_entries (
          quote_roof_area_id, width_m, length_m, sqm, sort_order, source, page_id, pitch_degrees
        ) VALUES (
          v_area_id, 0, 0, v_area_sqm, v_area_ord::int, 'takeoff', v_current_page_id, v_area_pitch
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

  -- == 9. Components: upsert entries + recalculate totals ====================
  FOR v_component IN SELECT * FROM jsonb_array_elements(v_components) LOOP
    v_lib_id := (v_component->>'component_library_id')::uuid;
    v_comp_area_id := nullif(v_component->>'quote_roof_area_id', '')::uuid;

    SELECT id INTO v_existing_id
      FROM public.quote_components
     WHERE quote_id = p_quote_id
       AND component_library_id = v_lib_id
       AND COALESCE(quote_roof_area_id, '00000000-0000-0000-0000-000000000000'::uuid)
         = COALESCE(v_comp_area_id, '00000000-0000-0000-0000-000000000000'::uuid)
     LIMIT 1;

    IF v_existing_id IS NOT NULL THEN
      IF v_current_page_id IS NOT NULL THEN
        DELETE FROM public.quote_component_entries
         WHERE quote_component_id = v_existing_id
           AND (page_id = v_current_page_id OR page_id IS NULL);
      ELSE
        DELETE FROM public.quote_component_entries
         WHERE quote_component_id = v_existing_id;
      END IF;

      IF jsonb_array_length(coalesce(v_component->'entries', '[]'::jsonb)) > 0 THEN
        -- v7: entries carry the pitch they were calculated at
        -- v8: entries carry the input reference values (display only)
        INSERT INTO public.quote_component_entries (
          quote_component_id, raw_value, value_after_waste, sort_order, page_id, pitch_degrees,
          entry_inputs
        )
        SELECT
          v_existing_id,
          coalesce(nullif(e->>'raw_value', '')::numeric, 0),
          coalesce(nullif(e->>'value_after_waste', '')::numeric, 0),
          coalesce((e->>'sort_order')::int, 0),
          v_current_page_id,
          nullif(e->>'pitch_degrees', '')::numeric,
          nullif(e->'entry_inputs', 'null'::jsonb)
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
             ), 0) * c.labour_rate,
             -- v7: record the pitch this component group was calculated at
             calc_pitch_degrees = coalesce(
               nullif(v_component->>'calc_pitch_degrees', '')::numeric,
               c.calc_pitch_degrees
             )
       WHERE c.id = v_existing_id;

      CONTINUE;
    END IF;

    INSERT INTO public.quote_components (
      quote_id, quote_roof_area_id, component_library_id, name, component_type,
      measurement_type, input_mode,
      material_rate, labour_rate,
      waste_type, waste_percent, waste_fixed, pitch_type,
      calc_pitch_degrees,
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
      nullif(v_component->>'calc_pitch_degrees', '')::numeric,
      coalesce((v_component->>'final_quantity')::numeric, 0),
      coalesce((v_component->>'material_cost')::numeric, 0),
      coalesce((v_component->>'labour_cost')::numeric, 0)
    )
    RETURNING id INTO v_new_component_id;

    IF jsonb_array_length(coalesce(v_component->'entries', '[]'::jsonb)) > 0 THEN
      -- v7: entries carry the pitch they were calculated at
      -- v8: entries carry the input reference values (display only)
      INSERT INTO public.quote_component_entries (
        quote_component_id, raw_value, value_after_waste, sort_order, page_id, pitch_degrees,
        entry_inputs
      )
      SELECT
        v_new_component_id,
        coalesce(nullif(e->>'raw_value', '')::numeric, 0),
        coalesce(nullif(e->>'value_after_waste', '')::numeric, 0),
        coalesce((e->>'sort_order')::int, 0),
        v_current_page_id,
        nullif(e->>'pitch_degrees', '')::numeric,
        nullif(e->'entry_inputs', 'null'::jsonb)
      FROM jsonb_array_elements(v_component->'entries') AS e;
    END IF;
  END LOOP;

  -- == 10. Increment session version =========================================
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
