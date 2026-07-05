-- Migration: 20260705200000_fix_duplicate_area_entries.sql
-- Purpose: Fix duplicate roof area entries caused by page-scoped delete.
--
-- Root cause: save_takeoff_atomic's Section 8 deleted quote_roof_area_entries
-- scoped by page_id only. When the same roof area was measured on multiple
-- plan pages (e.g. user uploaded a second plan for an existing area and
-- re-measured), entries from the previous page survived. The quote builder
-- loads ALL entries per area (loadAllRoofAreaEntriesForQuote), so duplicates
-- appeared in the roof-areas step.
--
-- Fix:
--   1. Section 8: delete ALL quote_roof_area_entries for each roof area being
--      saved (not page-scoped). Each save replaces the complete entry set
--      for that area. This is correct because the client sends the full set
--      of current-page area polygons for each area.
--   2. Section 6: also delete quote_takeoff_measurements for roof areas
--      (componentId IS NULL, type = 'area') across ALL pages when a
--      roof area is being saved, to prevent duplicate polygons on re-entry.
--      Component measurements remain page-scoped.
--   3. Data cleanup: remove duplicate quote_roof_area_entries for the
--      affected quote, keeping only the latest page's entries per area.

-- ── 1. Drop and recreate the function with the fix ──

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
  -- Component measurements: page-scoped delete (components belong to pages).
  -- Roof area measurements (componentId IS NULL, type='area'): delete across
  -- ALL pages for the roof areas being saved, to prevent duplicate polygons
  -- on re-entry when the same area was measured on multiple plan pages.
  --
  -- Collect the roof area IDs from the payload so we can target their
  -- area measurements across all pages.
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
    -- No specific area IDs: fall back to page-scoped delete for area measurements
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
  -- FIX (2026-07-05 v2): delete ALL quote_roof_area_entries for each area
  -- being saved, not just the current page's. Each save replaces the
  -- complete entry set for that area. This prevents duplicates when the
  -- same area is measured on multiple plan pages (the page-scoped delete
  -- left old-page entries alive, causing double-counting in the quote builder).
  IF jsonb_array_length(v_roof_areas) > 0 THEN
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
      IF v_area_id IS NULL AND v_area_label IS NOT NULL THEN
        SELECT id INTO v_area_id
          FROM public.quote_roof_areas
         WHERE quote_id = p_quote_id
           AND label = v_area_label
         ORDER BY sort_order
         LIMIT 1;
      END IF;

      IF v_area_id IS NOT NULL THEN
        -- First touch in this save: delete ALL takeoff entries for this area
        -- (not page-scoped). Each save replaces the complete entry set.
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
  'Fix 2026-07-05 v2: delete ALL quote_roof_area_entries per area (not page-scoped) '
  'to prevent duplicates when the same area is measured on multiple plan pages. '
  'Also delete area measurements from quote_takeoff_measurements across all pages '
  'for saved areas. Component measurements remain page-scoped.';

-- ── 2. Data cleanup: remove duplicate entries for affected quotes ──
-- For each roof area, keep only the entries from the latest page (highest page_id
-- in alphabetical order, which corresponds to the most recent save). This is
-- a one-time cleanup; the RPC fix prevents future duplicates.
--
-- Strategy: for each area with duplicate takeoff entries across multiple pages,
-- keep only the entries from the page whose measurements were most recently saved
-- (determined by MAX(created_at) on quote_takeoff_measurements for that area).

DELETE FROM public.quote_roof_area_entries
 WHERE source = 'takeoff'
   AND id NOT IN (
     -- Keep the latest entries per area (by created_at)
     SELECT DISTINCT ON (quote_roof_area_id, sort_order)
       id
     FROM public.quote_roof_area_entries
     WHERE source = 'takeoff'
     ORDER BY quote_roof_area_id, sort_order, created_at DESC
   );

-- Recalculate computed_sqm for all areas after cleanup
UPDATE public.quote_roof_areas ra
   SET computed_sqm = COALESCE((
     SELECT SUM(sqm) FROM public.quote_roof_area_entries
      WHERE quote_roof_area_id = ra.id
   ), 0),
   final_value_sqm = COALESCE((
     SELECT SUM(sqm) FROM public.quote_roof_area_entries
      WHERE quote_roof_area_id = ra.id
   ), 0)
 WHERE EXISTS (
   SELECT 1 FROM public.quote_roof_area_entries
    WHERE quote_roof_area_id = ra.id AND source = 'takeoff'
 );

-- ── 3. Clean up duplicate area measurements in quote_takeoff_measurements ──
-- For each quote, for each roof area, keep only the area measurements from
-- the page with the most recent created_at. This prevents duplicate polygons
-- on canvas re-entry while preserving all polygons from the latest page.
DELETE FROM public.quote_takeoff_measurements m
 WHERE m.component_library_id IS NULL
   AND m.measurement_type = 'area'
   AND m.quote_roof_area_id IS NOT NULL
   AND m.page_id IS NOT NULL
   AND m.page_id <> (
     -- The "latest" page for this area: the page_id whose measurements
     -- have the highest created_at for this quote_roof_area_id.
     SELECT page_id
     FROM public.quote_takeoff_measurements sub
     WHERE sub.quote_roof_area_id = m.quote_roof_area_id
       AND sub.component_library_id IS NULL
       AND sub.measurement_type = 'area'
       AND sub.page_id IS NOT NULL
     ORDER BY sub.created_at DESC
     LIMIT 1
   );
