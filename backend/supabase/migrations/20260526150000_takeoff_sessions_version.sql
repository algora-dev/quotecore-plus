-- 20260526150000_takeoff_sessions_version.sql
--
-- P1-1a: Add version column to takeoff_sessions for optimistic concurrency
-- control. Prevents silent data loss when the same takeoff is saved from
-- two browser tabs simultaneously.
--
-- The app layer reads the current version before opening the canvas and
-- passes it back on save. If the DB version has advanced (another tab
-- saved), the save is rejected with a STALE_TAKEOFF_VERSION error and the
-- user is prompted to reload.
--
-- pg_advisory_xact_lock is added inside save_takeoff_atomic to serialise
-- concurrent saves for the same quote at the transaction level.

ALTER TABLE public.takeoff_sessions
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.takeoff_sessions.version IS
  'Optimistic concurrency counter. Incremented on every save_takeoff_atomic '
  'call. The app submits the version it last read; the RPC rejects if it has '
  'advanced (concurrent edit from another session).';

-- Update save_takeoff_atomic to:
--   1. Acquire a quote-scoped advisory lock (serialises concurrent saves)
--   2. Check submitted version matches current version
--   3. Increment version on every successful save
CREATE OR REPLACE FUNCTION public.save_takeoff_atomic(
  p_quote_id uuid,
  p_payload  json
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  -- Payload fields
  v_canvas_path     text;
  v_lines_path      text;
  v_canvas_url      text;
  v_lines_url       text;
  v_measurements    jsonb;
  v_roof_areas      jsonb;
  v_components      jsonb;
  v_current_page_id uuid;
  v_submitted_version integer;

  -- Derived
  v_company_id      uuid;
  v_component       jsonb;
  v_lib_id          uuid;
  v_existing_id     uuid;
  v_first_roof_area uuid;
  v_session_id      uuid;
  v_current_version integer;
BEGIN
  -- ── 1. Ownership check ────────────────────────────────────────────────
  SELECT company_id INTO v_company_id
    FROM public.quotes
   WHERE id = p_quote_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id;
  END IF;

  -- ── 2. Advisory lock: serialise concurrent saves for this quote ───────
  -- Uses the lower 32 bits of the quote UUID as the lock key.
  -- The lock is released automatically at transaction end.
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(p_quote_id::text, 1, 8))::bit(32)::bigint
  );

  -- ── 3. Extract payload fields ─────────────────────────────────────────
  v_canvas_path     := p_payload::json->>'canvas_image_path';
  v_lines_path      := p_payload::json->>'lines_image_path';
  v_canvas_url      := p_payload::json->>'canvas_image_url';
  v_lines_url       := p_payload::json->>'lines_image_url';
  v_measurements    := coalesce((p_payload::json->>'measurements')::jsonb, '[]'::jsonb);
  v_roof_areas      := coalesce((p_payload::json->>'roof_areas')::jsonb, '[]'::jsonb);
  v_components      := coalesce((p_payload::json->>'components')::jsonb, '[]'::jsonb);
  v_current_page_id := nullif(p_payload::json->>'current_page_id', '')::uuid;
  v_submitted_version := (p_payload::json->>'session_version')::integer; -- nullable

  -- ── 4. Optimistic version check (when client submits a version) ───────
  IF v_submitted_version IS NOT NULL THEN
    SELECT ts.id, ts.version INTO v_session_id, v_current_version
      FROM public.takeoff_sessions ts
     WHERE ts.quote_id = p_quote_id;

    IF v_session_id IS NOT NULL AND v_current_version IS DISTINCT FROM v_submitted_version THEN
      RAISE EXCEPTION 'STALE_TAKEOFF_VERSION: expected % got %',
        v_submitted_version, v_current_version;
    END IF;
  END IF;

  -- ── 5. Canvas snapshot ────────────────────────────────────────────────
  IF v_canvas_path IS NOT NULL OR v_lines_path IS NOT NULL
     OR v_canvas_url IS NOT NULL OR v_lines_url IS NOT NULL THEN
    UPDATE public.quotes
       SET takeoff_canvas_path = coalesce(v_canvas_path, takeoff_canvas_path),
           takeoff_lines_path  = coalesce(v_lines_path,  takeoff_lines_path),
           takeoff_canvas_url  = coalesce(v_canvas_url,  takeoff_canvas_url),
           takeoff_lines_url   = coalesce(v_lines_url,   takeoff_lines_url)
     WHERE id = p_quote_id;
  END IF;

  -- ── 6. Scoped measurement delete ──────────────────────────────────────
  IF v_current_page_id IS NOT NULL THEN
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id
       AND (page_id = v_current_page_id OR page_id IS NULL);
  ELSE
    DELETE FROM public.quote_takeoff_measurements
     WHERE quote_id = p_quote_id;
  END IF;

  -- ── 7. Insert new measurements ────────────────────────────────────────
  IF jsonb_array_length(v_measurements) > 0 THEN
    -- Validate page_id references
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

  -- ── 8. Roof areas ─────────────────────────────────────────────────────
  IF jsonb_array_length(v_roof_areas) > 0 THEN
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

  -- ── 9. Components: upsert entries + recalculate totals ────────────────
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

    INSERT INTO public.quote_components (
      quote_id, quote_roof_area_id, component_library_id, name, component_type,
      measurement_type, input_mode,
      material_rate, labour_rate,
      waste_type, waste_percent, waste_fixed, pitch_type,
      final_quantity, material_cost, labour_cost
    ) VALUES (
      p_quote_id, v_first_roof_area, v_lib_id, v_component->>'name', 'main'::component_type,
      coalesce(v_component->>'measurement_type', 'lineal')::measurement_type,
      'calculated'::input_mode,
      coalesce((v_component->>'material_rate')::numeric, 0),
      coalesce((v_component->>'labour_rate')::numeric, 0),
      coalesce((v_component->>'waste_type')::waste_type, 'none'::waste_type),
      coalesce((v_component->>'waste_percent')::numeric, 0),
      coalesce((v_component->>'waste_fixed')::numeric, 0),
      coalesce(v_component->>'pitch_type', 'none'),
      coalesce((v_component->>'final_quantity')::numeric, 0),
      coalesce((v_component->>'material_cost')::numeric, 0),
      coalesce((v_component->>'labour_cost')::numeric, 0)
    );
  END LOOP;

  -- ── 10. Increment session version ─────────────────────────────────────
  IF v_session_id IS NOT NULL THEN
    UPDATE public.takeoff_sessions
       SET version = version + 1
     WHERE id = v_session_id;
  ELSE
    -- Session might not exist yet (first save before initializeTakeoffPage ran).
    -- Look it up and update if found.
    UPDATE public.takeoff_sessions
       SET version = version + 1
     WHERE quote_id = p_quote_id;
  END IF;

END;
$$;
