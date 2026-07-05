-- Migration: 20260705220000_multipage_entry_scoping.sql
-- Purpose: Fix multi-page data loss + wrong plan image fallback.
--
-- Root causes fixed:
--   A. quote_component_entries had no page_id, so the RPC's "delete all +
--      replace with current page" pattern destroyed other pages' component
--      entries on every save (e.g. Main Roof Plan 2's Valley/Ridge lost).
--   B. Migration 20260705200000 made the roof-area-entry delete span ALL
--      pages, which fixed duplicates but reintroduced multi-page loss (the
--      client-side fromPageId filter already prevents the duplicates, so a
--      page-scoped delete is both safe and correct).
--   C. takeoff_pages rows for the FIRST plan upload have no
--      image_storage_path (the image lives in quote_files), so the client
--      fell back to the route-level planUrl = MOST RECENT plan -> Page 1
--      displayed the newest plan's image.
--
-- Changes:
--   1. ADD COLUMN quote_component_entries.page_id (nullable FK).
--   2. save_takeoff_atomic v4:
--      - Section 6 area-measurement delete: page-scoped again.
--      - Section 8 roof-area-entry delete: page-scoped again (entries from
--        other pages survive; totals recompute across ALL entries).
--      - Section 9: component entry delete page-scoped; inserts stamped
--        with v_current_page_id. Component matching stays
--        (component_library_id, quote_roof_area_id) from v3.
--   3. Backfill takeoff_pages.image_storage_path for page 1 rows from the
--      OLDEST quote_files plan.
--   4. Best-effort backfill of quote_component_entries.page_id.
--   5. Data repair for quote ee6609ab: restore Main Roof's lost Plan 2
--      component entries (Valley + Ridge) from quote_takeoff_measurements.

-- ── 1. Add page_id to quote_component_entries ───────────────────────────────
ALTER TABLE public.quote_component_entries
  ADD COLUMN IF NOT EXISTS page_id uuid REFERENCES public.takeoff_pages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quote_component_entries_page_id
  ON public.quote_component_entries(page_id);

-- ── 2. save_takeoff_atomic v4 ────────────────────────────────────────────────
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

  -- ── 6. Measurement delete (PAGE-SCOPED, v4) ──────────────────────────────
  -- The client sends ONLY current-page measurements (fromPageId filter),
  -- so deleting only the current page's rows replaces exactly what the
  -- payload re-sends. Other pages' measurements survive.

  -- Component measurements (page-scoped)
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

  -- Roof area measurements (page-scoped, v4: reverted from all-pages —
  -- the all-pages delete destroyed other pages' area polygons; the client
  -- fromPageId filter already prevents cross-page duplicates)
  IF v_current_page_id IS NOT NULL THEN
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

  -- ── 8. Roof areas: update rows + replace CURRENT PAGE's entries (v4) ─────
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
  -- v3: match by (quote_id, component_library_id, quote_roof_area_id).
  -- v4: entry delete is PAGE-SCOPED and inserts are stamped with page_id,
  -- so a component measured on two plans keeps both plans' entries.
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
      -- v4: delete only the current page's entries (plus legacy NULL-page
      -- rows). Other pages' entries survive.
      IF v_current_page_id IS NOT NULL THEN
        DELETE FROM public.quote_component_entries
         WHERE quote_component_id = v_existing_id
           AND (page_id = v_current_page_id OR page_id IS NULL);
      ELSE
        DELETE FROM public.quote_component_entries
         WHERE quote_component_id = v_existing_id;
      END IF;

      IF jsonb_array_length(coalesce(v_component->'entries', '[]'::jsonb)) > 0 THEN
        INSERT INTO public.quote_component_entries (
          quote_component_id, raw_value, value_after_waste, sort_order, page_id
        )
        SELECT
          v_existing_id,
          coalesce(nullif(e->>'raw_value', '')::numeric, 0),
          coalesce(nullif(e->>'value_after_waste', '')::numeric, 0),
          coalesce((e->>'sort_order')::int, 0),
          v_current_page_id
        FROM jsonb_array_elements(v_component->'entries') AS e;
      END IF;

      -- Totals recompute across ALL surviving entries (all pages).
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

    -- New component: insert row + entries, routed to the payload's area.
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
        quote_component_id, raw_value, value_after_waste, sort_order, page_id
      )
      SELECT
        v_new_component_id,
        coalesce(nullif(e->>'raw_value', '')::numeric, 0),
        coalesce(nullif(e->>'value_after_waste', '')::numeric, 0),
        coalesce((e->>'sort_order')::int, 0),
        v_current_page_id
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
  'v4 2026-07-05: page-scoped deletes for area + component entries so '
  'multi-page data survives; entries stamped with page_id; components '
  'matched by (component_library_id, quote_roof_area_id).';

-- ── 3. Backfill takeoff_pages.image_storage_path for first-plan pages ──────
-- The first plan upload stores its image in quote_files only; the page row
-- was created with image_storage_path = NULL, which made the client fall
-- back to the route-level planUrl (most recent plan = wrong image).
UPDATE public.takeoff_pages tp
SET image_storage_path = (
  SELECT qf.storage_path FROM public.quote_files qf
  WHERE qf.quote_id = tp.quote_id AND qf.file_type = 'plan'
  ORDER BY qf.uploaded_at ASC LIMIT 1
)
WHERE tp.image_storage_path IS NULL
  AND tp.page_order = 1
  AND EXISTS (
    SELECT 1 FROM public.quote_files qf2
    WHERE qf2.quote_id = tp.quote_id AND qf2.file_type = 'plan'
  );

-- ── 4. Best-effort backfill of quote_component_entries.page_id ─────────────
-- When all of a component's measurements live on exactly one page, its
-- entries must belong to that page.
UPDATE public.quote_component_entries qce
SET page_id = sub.only_page
FROM (
  SELECT qc.id AS qc_id, MIN(qtm.page_id::text)::uuid AS only_page
  FROM public.quote_components qc
  JOIN public.quote_takeoff_measurements qtm
    ON qtm.quote_id = qc.quote_id
   AND qtm.component_library_id = qc.component_library_id
   AND COALESCE(qtm.quote_roof_area_id, '00000000-0000-0000-0000-000000000000'::uuid)
     = COALESCE(qc.quote_roof_area_id, '00000000-0000-0000-0000-000000000000'::uuid)
  WHERE qtm.page_id IS NOT NULL
  GROUP BY qc.id
  HAVING COUNT(DISTINCT qtm.page_id) = 1
) sub
WHERE qce.quote_component_id = sub.qc_id
  AND qce.page_id IS NULL;

-- ── 5. Data repair for quote ee6609ab ───────────────────────────────────────
-- Main Roof's entries came from Page 1 (37cb1f2b); its Plan 2 (a84f00a7)
-- measurements (Valley 8.53 m, Ridge 9.54 m) never made it into
-- quote_component_entries because the old RPC deleted-all-then-replaced.
-- Restore them using the exact per-component transform ratio
-- (value_after_waste / raw_value is constant per component+area since
-- waste % and pitch are fixed).

-- 5a. Stamp the known page on Main Roof's existing Page-1 entries
-- (multi-page component: the general backfill above skips it).
UPDATE public.quote_component_entries
SET page_id = '37cb1f2b-a356-46ee-956b-ad5fb21943db'
WHERE id IN (
  'c77ba661-74f8-4502-9489-4c8f6bedf18d',  -- Main Roof Valley (Page 1)
  '8d50f336-3ab5-4277-bda8-6b3cd15d827d'   -- Main Roof Ridge (Page 1)
) AND page_id IS NULL;

-- 5b. Insert the lost Plan 2 entries (idempotent).
INSERT INTO public.quote_component_entries (
  quote_component_id, raw_value, value_after_waste, sort_order, page_id
)
SELECT
  'd0aad2ed-eb94-42c9-b59d-ff4a5b10fbd7',  -- Main Roof Valley Flashing
  8.532362837346414,
  8.532362837346414 * (e.value_after_waste / e.raw_value),
  1,
  'a84f00a7-8530-4b79-ab37-a9be519c51f4'
FROM public.quote_component_entries e
WHERE e.id = 'c77ba661-74f8-4502-9489-4c8f6bedf18d'
  AND NOT EXISTS (
    SELECT 1 FROM public.quote_component_entries x
    WHERE x.quote_component_id = 'd0aad2ed-eb94-42c9-b59d-ff4a5b10fbd7'
      AND x.page_id = 'a84f00a7-8530-4b79-ab37-a9be519c51f4'
  );

INSERT INTO public.quote_component_entries (
  quote_component_id, raw_value, value_after_waste, sort_order, page_id
)
SELECT
  '2dc7fe7d-3238-43d0-b0d5-4a14c00aead0',  -- Main Roof Ridge
  9.53539950389346,
  9.53539950389346 * (e.value_after_waste / e.raw_value),
  1,
  'a84f00a7-8530-4b79-ab37-a9be519c51f4'
FROM public.quote_component_entries e
WHERE e.id = '8d50f336-3ab5-4277-bda8-6b3cd15d827d'
  AND NOT EXISTS (
    SELECT 1 FROM public.quote_component_entries x
    WHERE x.quote_component_id = '2dc7fe7d-3238-43d0-b0d5-4a14c00aead0'
      AND x.page_id = 'a84f00a7-8530-4b79-ab37-a9be519c51f4'
  );

-- 5c. Recompute Main Roof component totals from ALL entries.
UPDATE public.quote_components c
SET final_quantity = t.total,
    material_cost  = t.total * c.material_rate,
    labour_cost    = t.total * c.labour_rate
FROM (
  SELECT quote_component_id, SUM(value_after_waste) AS total
  FROM public.quote_component_entries
  WHERE quote_component_id IN (
    'd0aad2ed-eb94-42c9-b59d-ff4a5b10fbd7',
    '2dc7fe7d-3238-43d0-b0d5-4a14c00aead0'
  )
  GROUP BY quote_component_id
) t
WHERE c.id = t.quote_component_id;
