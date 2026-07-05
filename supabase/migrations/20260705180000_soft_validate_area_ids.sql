-- Migration: 20260705180000_soft_validate_area_ids.sql
-- Purpose (2026-07-05): The hard validation block in save_takeoff_atomic
--   raised an exception when any measurement had a quote_roof_area_id that
--   didn't belong to the quote. This blocked the ENTIRE save, including
--   valid measurements. The client has a fallback bug where hydrated area
--   polygons can send their measurement id as quote_roof_area_id.
--   Fix: replace the hard RAISE EXCEPTION with a soft cleanup that nulls
--   out invalid quote_roof_area_id values in the measurements JSON before
--   insert. The coalesce in the INSERT then falls back to v_target_roof_area.
--   This way, one bad measurement doesn't block the entire save.
-- Rollback: re-apply 20260705170000_drafts_dont_count_quotas.sql

CREATE OR REPLACE FUNCTION public.save_takeoff_atomic(
  p_quote_id   uuid,
  p_payload    jsonb,
  p_caller_uid uuid DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id        uuid;
  v_quote_trade       text;
  v_caller_company_id uuid;
  v_session_id        uuid;
  v_current_version   integer;
  v_submitted_version integer;
  v_canvas_path       text := nullif(p_payload->>'canvas_image_path', '');
  v_lines_path        text := nullif(p_payload->>'lines_image_path', '');
  v_canvas_url        text := nullif(p_payload->>'canvas_image_url', '');
  v_lines_url         text := nullif(p_payload->>'lines_image_url', '');
  v_measurements      jsonb := coalesce(p_payload->'measurements', '[]'::jsonb);
  v_roof_areas        jsonb := coalesce(p_payload->'roof_areas',   '[]'::jsonb);
  v_components        jsonb := coalesce(p_payload->'components',   '[]'::jsonb);
  v_current_page_id   uuid := nullif(p_payload->>'current_page_id', '')::uuid;
  v_target_roof_area  uuid := nullif(p_payload->>'target_roof_area_id', '')::uuid;
  v_component         jsonb;
  v_new_component_id  uuid;
  v_existing_id       uuid;
  v_lib_id            uuid;
  v_lib_company_id    uuid;
  v_lib_mtype         text;
  v_area              jsonb;
  v_area_id           uuid;
  v_area_candidate    uuid;
  v_area_pitch        numeric;
  v_area_sqm          numeric;
  v_area_label        text;
  v_area_ord          integer;
  v_total_sqm         numeric;
  v_processed_areas   uuid[] := '{}';
  v_comp_area         uuid;
  v_first_roof_area   uuid;
  v_valid_area_ids    uuid[];
  v_m                 jsonb;
  v_m_area_id         text;
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

  -- ── 5a. Soft-validate measurement quote_roof_area_id values ──────────────
  -- Area-ownership fix (2026-07-05): instead of RAISE EXCEPTION (which blocked
  -- the entire save), null out any quote_roof_area_id that doesn't belong to
  -- this quote. The coalesce in the INSERT then falls back to v_target_roof_area.
  -- This prevents one bad measurement from blocking the entire save.
  IF jsonb_array_length(v_measurements) > 0 THEN
    -- Build the set of valid area ids for this quote.
    SELECT array_agg(ra.id) INTO v_valid_area_ids
      FROM public.quote_roof_areas ra WHERE ra.quote_id = p_quote_id;

    -- Null out invalid quote_roof_area_id values in-place.
    FOR v_m IN SELECT value FROM jsonb_array_elements(v_measurements) LOOP
      v_m_area_id := nullif(v_m->>'quote_roof_area_id', '');
      IF v_m_area_id IS NOT NULL THEN
        -- Check if it's a valid uuid AND belongs to this quote.
        BEGIN
          IF v_m_area_id::uuid != ALL(COALESCE(v_valid_area_ids, ARRAY[]::uuid[])) THEN
            -- Invalid: null it out in the JSON array.
            v_measurements := jsonb_set(
              v_measurements,
              ARRAY[(SELECT ordinality::text - 1 FROM jsonb_array_elements(v_measurements) WITH ORDINALITY WHERE value = v_m)],
              jsonb_build_object('quote_roof_area_id', null),
              false
            );
          END IF;
        EXCEPTION WHEN invalid_text_representation THEN
          -- Not a valid uuid at all: null it out.
          v_measurements := jsonb_set(
            v_measurements,
            ARRAY[(SELECT ordinality::text - 1 FROM jsonb_array_elements(v_measurements) WITH ORDINALITY WHERE value = v_m)],
            jsonb_build_object('quote_roof_area_id', null),
            false
          );
        END;
      END IF;
    END LOOP;
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

  -- ── 8. Roof areas: update existing rows + replace takeoff sub-entries ────
  IF jsonb_array_length(v_roof_areas) > 0 THEN
    -- Resolve first roof area id for fallback.
    SELECT id INTO v_first_roof_area
      FROM public.quote_roof_areas
     WHERE quote_id = p_quote_id
     ORDER BY sort_order
     LIMIT 1;

    FOR v_area, v_area_ord IN
      SELECT value, ordinality
        FROM jsonb_array_elements(v_roof_areas) WITH ORDINALITY
    LOOP
      v_area_label := v_area->>'label';
      v_area_pitch := coalesce((v_area->>'calc_pitch_degrees')::numeric, 0);
      v_area_sqm   := coalesce((v_area->>'computed_sqm')::numeric, 0);

      -- Resolve the area row.
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
      IF v_area_id IS NULL AND v_first_roof_area IS NOT NULL AND v_area_ord = 1 THEN
        v_area_id := v_first_roof_area;
      END IF;

      IF v_area_id IS NOT NULL THEN
        -- Update existing area row with pitch + computed area.
        UPDATE public.quote_roof_areas
           SET calc_pitch_degrees = v_area_pitch,
               final_value_sqm = v_area_sqm
         WHERE id = v_area_id;

        IF NOT (v_area_id = ANY(v_processed_areas)) THEN
          v_processed_areas := array_append(v_processed_areas, v_area_id);

          -- RC-6 fix: page-scoped delete for takeoff sub-entries.
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

          INSERT INTO public.quote_roof_area_entries (
            quote_roof_area_id, source, sqm, calc_pitch_degrees, page_id
          ) VALUES (
            v_area_id, 'takeoff', v_area_sqm, v_area_pitch, v_current_page_id
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- ── 9. Components: upsert + insert entries ───────────────────────────────
  FOR v_component IN SELECT * FROM jsonb_array_elements(v_components) LOOP
    v_lib_id := nullif(v_component->>'component_library_id', '')::uuid;

    -- Area-ownership fix (2026-07-05): each component group carries its own
    -- roof-area id; fall back to the save-level target/first area for legacy
    -- payloads. Validate it belongs to this quote.
    v_comp_area := coalesce(
      nullif(v_component->>'quote_roof_area_id', '')::uuid,
      v_target_roof_area,
      v_first_roof_area
    );
    IF v_comp_area IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.quote_roof_areas ra
       WHERE ra.id = v_comp_area AND ra.quote_id = p_quote_id
    ) THEN
      -- Soft fallback: use first roof area instead of raising.
      v_comp_area := v_first_roof_area;
    END IF;

    SELECT id INTO v_existing_id
      FROM public.quote_components
     WHERE quote_id = p_quote_id
       AND component_library_id = v_lib_id
       AND quote_roof_area_id IS NOT DISTINCT FROM v_comp_area
     LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.quote_components (
        quote_id, quote_roof_area_id, component_library_id, name, component_type,
        measurement_type, default_pitch_type, default_pitch_degrees,
        default_waste_type, default_waste_percent, default_waste_fixed,
        default_material_rate, default_labour_rate,
        priced_quantity, pack_size_snapshot
      ) VALUES (
        p_quote_id, v_comp_area, v_lib_id, v_component->>'name', 'main'::component_type,
        v_component->>'measurement_type',
        coalesce(v_component->>'pitch_type', 'none'),
        coalesce(nullif(v_component->>'pitch_degrees', '')::numeric, 0),
        coalesce(v_component->>'waste_type', 'none'),
        coalesce(nullif(v_component->>'waste_percent', '')::numeric, 0),
        coalesce(nullif(v_component->>'waste_fixed', '')::numeric, 0),
        coalesce(nullif(v_component->>'material_rate', '')::numeric, 0),
        coalesce(nullif(v_component->>'labour_rate', '')::numeric, 0),
        nullif(v_component->>'priced_quantity', '')::numeric,
        nullif(v_component->>'pack_size_snapshot', '')::numeric
      )
      RETURNING id INTO v_new_component_id;
      v_existing_id := v_new_component_id;
    ELSE
      UPDATE public.quote_components
         SET default_pitch_type = coalesce(v_component->>'pitch_type', default_pitch_type),
             default_pitch_degrees = coalesce(nullif(v_component->>'pitch_degrees', '')::numeric, default_pitch_degrees),
             default_waste_type = coalesce(v_component->>'waste_type', default_waste_type),
             default_waste_percent = coalesce(nullif(v_component->>'waste_percent', '')::numeric, default_waste_percent),
             default_waste_fixed = coalesce(nullif(v_component->>'waste_fixed', '')::numeric, default_waste_fixed)
       WHERE id = v_existing_id;
    END IF;

    -- Delete existing entries for this component on the current page.
    IF v_current_page_id IS NOT NULL THEN
      DELETE FROM public.quote_component_entries
       WHERE quote_component_id = v_existing_id
         AND (page_id = v_current_page_id OR page_id IS NULL);
    ELSE
      DELETE FROM public.quote_component_entries
       WHERE quote_component_id = v_existing_id;
    END IF;

    -- Insert new entries from the payload.
    INSERT INTO public.quote_component_entries (
      quote_component_id, measurement_type, measurement_value,
      value_after_pitch, value_after_waste,
      material_cost, labour_cost,
      page_id, quote_roof_area_id
    )
    SELECT
      v_existing_id,
      e->>'measurement_type',
      coalesce(nullif(e->>'measurement_value', '')::numeric, 0),
      coalesce(nullif(e->>'value_after_pitch', '')::numeric, 0),
      coalesce(nullif(e->>'value_after_waste', '')::numeric, 0),
      coalesce(nullif(e->>'material_cost', '')::numeric, 0),
      coalesce(nullif(e->>'labour_cost', '')::numeric, 0),
      v_current_page_id,
      v_comp_area
    FROM jsonb_array_elements(v_component->'entries') AS e;
  END LOOP;

  -- ── 10. Recalculate all component totals ────────────────────────────────
  PERFORM public.recalcAllQuoteComponents(p_quote_id);

  -- ── 11. Upsert takeoff session + bump version ───────────────────────────
  IF v_session_id IS NULL THEN
    INSERT INTO public.takeoff_sessions (quote_id, version)
    VALUES (p_quote_id, 1)
    ON CONFLICT (quote_id) DO NOTHING;
  END IF;

  UPDATE public.takeoff_sessions
     SET version = version + 1,
         updated_at = now()
   WHERE quote_id = p_quote_id;

  -- ── 12. Update quote updated_at ──────────────────────────────────────────
  UPDATE public.quotes SET updated_at = now() WHERE id = p_quote_id;
END;
$$;

COMMENT ON FUNCTION public.save_takeoff_atomic(uuid, jsonb, uuid) IS
  'Fix 2026-07-05 (soft validation): invalid quote_roof_area_id values in '
  'measurements are nulled out instead of raising an exception. The coalesce '
  'in the INSERT falls back to v_target_roof_area. Component area validation '
  'also softened to fall back to first roof area. Prior: per-area quote_components.';
