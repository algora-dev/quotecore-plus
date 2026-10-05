-- patch_052: Mobile takeoff M5 — update-in-place roof-area geometry editing
-- (spec 2026-09-21 §8.5, §11.3; M0 gap review trap 3).
--
-- Problem: save_takeoff_atomic persists measurements as a page-scoped
-- DELETE + INSERT. Editing a saved roof outline's vertices through that path
-- would recreate the polygon as a NEW measurement row (and, via the
-- (quote_roof_area_id, page_id) insertion-order pitch zip, silently detach
-- it from its quote_roof_area_entries pitch). The mobile precision editor
-- needs an AUTHORISED update-in-place path that:
--   * updates the EXISTING quote_takeoff_measurements row (type 'area') by
--     id — never delete+insert, never a duplicate row (O05/O12);
--   * re-derives measurement_value SERVER-side from the new polygon and the
--     page's own effective calibration scale (never trusts a client-computed
--     area, §11.3);
--   * recomputes source-linked dependent entries (entry_inputs value_basis
--     'plan'/'pitched' attached to this polygon via source_geometry_id, or a
--     unique quote_roof_area_id match) at constant scale from the NEW
--     points (O07); independent lines/typed quantities are untouched;
--   * preserves pitch/labels/ownership (no writes to quote_roof_areas or
--     quote_roof_area_entries — polygon order within (area, page) groups is
--     unchanged by an UPDATE, so the insertion-order pitch zip is preserved);
--   * guards concurrency with the SAME advisory lock + optimistic
--     session-version check as save_takeoff_atomic (O13), incrementing the
--     version on success.
--
-- Idempotence (O12): the function is a pure UPDATE-by-id. Retrying after a
-- lost save response re-applies the same geometry to the same row — no
-- second row can ever appear.
--
-- Additive only: no table changes, no drops. New function, new name.

CREATE OR REPLACE FUNCTION public.update_takeoff_area_geometry_v1(
  p_quote_id         uuid,
  p_measurement_id   uuid,
  p_page_id          uuid,
  p_points           jsonb,
  p_session_version  integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_company_id        uuid;
  v_caller_company_id uuid;
  v_caller_uid        uuid := auth.uid();
  v_scale             numeric;
  v_scale_unit        text;
  v_row_unit          text;
  v_s                 numeric;      -- scale expressed in the row's unit
  v_px_area           numeric := 0;
  v_new_value         numeric;
  v_n                 integer;
  v_i                 integer;
  v_j                 integer;
  v_p                 jsonb;
  v_q                 jsonb;
  v_x1 numeric; v_y1 numeric; v_x2 numeric; v_y2 numeric;
  v_x3 numeric; v_y3 numeric; v_x4 numeric; v_y4 numeric;
  v_k                 integer;
  v_d1 numeric; v_d2 numeric; v_d3 numeric; v_d4 numeric;
  v_session_id        uuid;
  v_current_version   integer;
  v_pitch             numeric := 0;
  v_derived           record;
  v_derived_plan      numeric;
  v_derived_value     numeric;
  v_found             boolean;
BEGIN
  -- ── 1. Ownership check (identical to save_takeoff_atomic) ───────────────
  SELECT company_id INTO v_company_id FROM public.quotes WHERE id = p_quote_id;
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'Quote % not found', p_quote_id;
  END IF;
  IF v_caller_uid IS NOT NULL THEN
    SELECT company_id INTO v_caller_company_id FROM public.users WHERE id = v_caller_uid;
    IF v_caller_company_id IS NULL OR v_caller_company_id <> v_company_id THEN
      RAISE EXCEPTION 'Unauthorized';
    END IF;
  END IF;

  -- ── 2. Page belongs to quote (raise BEFORE any write) ───────────────────
  IF NOT EXISTS (
    SELECT 1 FROM public.takeoff_pages tp
     WHERE tp.id = p_page_id AND tp.quote_id = p_quote_id
  ) THEN
    RAISE EXCEPTION 'AREA_PAGE_MISMATCH: page % does not belong to quote %', p_page_id, p_quote_id;
  END IF;

  -- ── 3. Advisory lock + optimistic version guard (O13) ───────────────────
  PERFORM pg_advisory_xact_lock(
    ('x' || substr(p_quote_id::text, 1, 8))::bit(32)::bigint
  );
  IF p_session_version IS NOT NULL THEN
    SELECT id, version INTO v_session_id, v_current_version
      FROM public.takeoff_sessions WHERE quote_id = p_quote_id;
    IF v_session_id IS NOT NULL AND v_current_version IS DISTINCT FROM p_session_version THEN
      RAISE EXCEPTION 'STALE_TAKEOFF_VERSION: expected % got %', p_session_version, v_current_version;
    END IF;
  END IF;

  -- ── 4. Server-side geometry validation (§11.3: never trust the client) ──
  IF jsonb_typeof(p_points) <> 'array' THEN
    RAISE EXCEPTION 'AREA_GEOMETRY_INVALID: points must be an array';
  END IF;
  v_n := jsonb_array_length(p_points);
  IF v_n < 3 THEN
    RAISE EXCEPTION 'AREA_GEOMETRY_INVALID: an outline needs at least 3 distinct points';
  END IF;
  IF v_n > 200 THEN
    RAISE EXCEPTION 'AREA_GEOMETRY_INVALID: too many points (%) — bound is 200', v_n;
  END IF;

  FOR v_i IN 0 .. v_n - 1 LOOP
    v_p := p_points -> v_i;
    IF v_p IS NULL
       OR jsonb_typeof(v_p -> 'x') IS DISTINCT FROM 'number'
       OR jsonb_typeof(v_p -> 'y') IS DISTINCT FROM 'number'
       OR NOT (v_p ->> 'x')::numeric::float8 <  'Infinity'
       OR (v_p ->> 'x')::numeric::float8 <= -1000000
       OR (v_p ->> 'x')::numeric::float8 >=  1000000
       OR (v_p ->> 'y')::numeric::float8 <= -1000000
       OR (v_p ->> 'y')::numeric::float8 >=  1000000 THEN
      RAISE EXCEPTION 'AREA_GEOMETRY_INVALID: point % has non-finite or out-of-bounds coordinates', v_i;
    END IF;
    -- Duplicate vertices (any pair) invalidate the polygon.
    FOR v_j IN v_i + 1 .. v_n - 1 LOOP
      v_q := p_points -> v_j;
      IF (v_p ->> 'x')::numeric = (v_q ->> 'x')::numeric
         AND (v_p ->> 'y')::numeric = (v_q ->> 'y')::numeric THEN
        RAISE EXCEPTION 'AREA_GEOMETRY_INVALID: duplicate vertices at % and %', v_i, v_j;
      END IF;
    END LOOP;
  END LOOP;

  -- Shoelace area.
  FOR v_i IN 0 .. v_n - 1 LOOP
    v_j := (v_i + 1) % v_n;
    v_px_area := v_px_area
      + (p_points -> v_i ->> 'x')::numeric * (p_points -> v_j ->> 'y')::numeric
      - (p_points -> v_j ->> 'x')::numeric * (p_points -> v_i ->> 'y')::numeric;
  END LOOP;
  v_px_area := abs(v_px_area / 2);
  IF v_px_area <= 1e-9 THEN
    RAISE EXCEPTION 'AREA_GEOMETRY_INVALID: polygon has zero area';
  END IF;

  -- Proper self-intersection check (shared joints between consecutive edges
  -- are legal). O(n^2) with n <= 200 is bounded and runs before any write.
  FOR v_i IN 0 .. v_n - 1 LOOP
    v_j := (v_i + 1) % v_n;
    v_x1 := (p_points -> v_i ->> 'x')::numeric::float8;
    v_y1 := (p_points -> v_i ->> 'y')::numeric::float8;
    v_x2 := (p_points -> v_j ->> 'x')::numeric::float8;
    v_y2 := (p_points -> v_j ->> 'y')::numeric::float8;
    FOR v_k IN 0 .. v_n - 1 LOOP
      -- skip the edge itself and its two neighbours (they legally share joints)
      IF v_k = v_i OR v_k = v_j OR (v_k + 1) % v_n = v_i THEN
        CONTINUE;
      END IF;
      v_x3 := (p_points -> v_k ->> 'x')::numeric::float8;
      v_y3 := (p_points -> v_k ->> 'y')::numeric::float8;
      v_x4 := (p_points -> ((v_k + 1) % v_n) ->> 'x')::numeric::float8;
      v_y4 := (p_points -> ((v_k + 1) % v_n) ->> 'y')::numeric::float8;
      v_d1 := (v_x4 - v_x3) * (v_y1 - v_y3) - (v_y4 - v_y3) * (v_x1 - v_x3);
      v_d2 := (v_x4 - v_x3) * (v_y2 - v_y3) - (v_y4 - v_y3) * (v_x2 - v_x3);
      v_d3 := (v_x2 - v_x1) * (v_y3 - v_y1) - (v_y2 - v_y1) * (v_x3 - v_x1);
      v_d4 := (v_x2 - v_x1) * (v_y4 - v_y1) - (v_y2 - v_y1) * (v_x4 - v_x1);
      IF ((v_d1 > 0 AND v_d2 < 0) OR (v_d1 < 0 AND v_d2 > 0))
         AND ((v_d3 > 0 AND v_d4 < 0) OR (v_d3 < 0 AND v_d4 > 0)) THEN
        RAISE EXCEPTION 'AREA_GEOMETRY_INVALID: polygon edges cross (self-intersection)';
      END IF;
    END LOOP;
  END LOOP;

  -- ── 5. Resolve the page's effective scale SERVER-side (§11.3) ───────────
  SELECT
    tp.scale_calibration,
    tp.calibration_metadata
  INTO v_p, v_q
  FROM public.takeoff_pages tp
  WHERE tp.id = p_page_id AND tp.quote_id = p_quote_id;

  BEGIN
    v_scale := ((v_q -> 'effective' ->> 'scale'))::numeric;
    v_scale_unit := coalesce(v_q -> 'effective' ->> 'unit', 'feet');
  EXCEPTION WHEN OTHERS THEN
    v_scale := NULL;
    v_scale_unit := 'feet';
  END;
  IF v_scale IS NULL AND jsonb_typeof(v_p) = 'array' AND jsonb_array_length(v_p) > 0 THEN
    -- Legacy array: mean of per-reference scales mirrors the TS
    -- effectiveScaleFromLegacyCalibrations aggregation closely enough for a
    -- value re-derivation; rows written before this patch used the same mean.
    SELECT avg((e ->> 'scale')::numeric) INTO v_scale
      FROM jsonb_array_elements(v_p) AS e;
    v_scale_unit := 'feet';
  END IF;
  IF v_scale IS NULL OR v_scale <= 0 THEN
    RAISE EXCEPTION 'AREA_SCALE_UNAVAILABLE: this page has no calibration scale — calibrate before editing outlines';
  END IF;

  -- ── 6. Target row: must be this quote's area row on this page ───────────
  SELECT measurement_unit INTO v_row_unit
    FROM public.quote_takeoff_measurements
   WHERE id = p_measurement_id
     AND quote_id = p_quote_id
     AND component_library_id IS NULL
     AND measurement_type = 'area';
  IF v_row_unit IS NULL THEN
    RAISE EXCEPTION 'AREA_ROW_NOT_FOUND: measurement % is not a roof-area polygon of quote %', p_measurement_id, p_quote_id;
  END IF;

  -- Express the scale in the row's own stored unit.
  v_s := v_scale;
  IF v_row_unit = 'meters' AND v_scale_unit = 'feet' THEN
    v_s := v_scale * 0.3048;
  ELSIF v_row_unit = 'feet' AND v_scale_unit = 'meters' THEN
    v_s := v_scale / 0.3048;
  END IF;

  v_new_value := v_px_area * v_s * v_s;

  -- Pitch for dependent 'pitched' entries: the polygon's own per-entry pitch
  -- (quote_roof_area_entries insertion-order zip over the (area, page)
  -- group). Missing pitch behaves as 0 degrees (identical to
  -- computeCalibrationRecompute's resolved?.pitch ?? 0). Best-effort: stays 0
  -- when the zip cannot resolve.
  WITH area_group AS (
    SELECT quote_roof_area_id AS ara
      FROM public.quote_takeoff_measurements WHERE id = p_measurement_id
  ),
  area_rows AS (
    SELECT m.id, row_number() OVER (ORDER BY m.created_at) AS rn
      FROM public.quote_takeoff_measurements m
      CROSS JOIN area_group g
     WHERE m.quote_id = p_quote_id
       AND m.component_library_id IS NULL
       AND m.measurement_type = 'area'
       AND m.page_id IS NOT DISTINCT FROM p_page_id
       AND m.quote_roof_area_id = g.ara
  ),
  entries AS (
    SELECT qrae.pitch_degrees,
           row_number() OVER (ORDER BY qrae.sort_order NULLS LAST, qrae.created_at) AS rn
      FROM public.quote_roof_area_entries qrae
      CROSS JOIN area_group g
     WHERE qrae.quote_roof_area_id = g.ara
       AND qrae.page_id = p_page_id
       AND qrae.source = 'takeoff'
  )
  SELECT e.pitch_degrees INTO v_pitch
    FROM area_rows a JOIN entries e ON e.rn = a.rn
   WHERE a.id = p_measurement_id;

  -- ── 7. UPDATE the existing row IN PLACE (never delete+insert, O05) ──────
  UPDATE public.quote_takeoff_measurements
     SET canvas_points      = p_points,
         measurement_value  = v_new_value
   WHERE id = p_measurement_id
     AND quote_id = p_quote_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'AREA_ROW_NOT_FOUND: measurement % not found for quote %', p_measurement_id, p_quote_id;
  END IF;

  -- ── 8. Source-linked dependent entries at constant scale (O07) ──────────
  -- Geometry-free attached entries only: entry_inputs.value_basis in
  -- ('plan','pitched') AND linked to THIS polygon via entry_inputs
  -- source_geometry_id, the native source_geometry_id column, or a UNIQUE
  -- quote_roof_area_id match on this page (mirrors the TS recompute).
  FOR v_derived IN
    SELECT m.id,
           m.entry_inputs,
           m.entry_inputs ->> 'value_basis' AS basis,
           coalesce(
             nullif(m.entry_inputs ->> 'source_geometry_id', ''),
             nullif(m.source_geometry_id, '')
           ) AS src,
           (
             SELECT count(*) FROM public.quote_takeoff_measurements am
              WHERE am.quote_id = p_quote_id
                AND am.component_library_id IS NULL
                AND am.measurement_type = 'area'
                AND am.page_id IS NOT DISTINCT FROM p_page_id
                AND am.quote_roof_area_id = m.quote_roof_area_id
           ) AS area_row_count
      FROM public.quote_takeoff_measurements m
     WHERE m.quote_id = p_quote_id
       AND m.id <> p_measurement_id
       AND (m.page_id = p_page_id OR m.page_id IS NULL)
       AND m.entry_inputs IS NOT NULL
       AND m.entry_inputs ->> 'value_basis' IN ('plan', 'pitched')
       AND m.entry_inputs ? 'plan_value'
  LOOP
    IF v_derived.src = p_measurement_id::text THEN
      NULL; -- explicit link — recompute below
    ELSIF v_derived.src IS NULL AND v_derived.area_row_count = 1 THEN
      NULL; -- unique area match — recompute below
    ELSE
      CONTINUE; -- unlinked/ambiguous: NEVER guessed (O07: independent stays untouched)
    END IF;

    v_derived_plan := v_px_area * v_s * v_s;
    v_derived_value := v_derived_plan;
    IF v_derived.basis = 'pitched' AND v_pitch > 0 AND v_pitch < 90 THEN
      v_derived_value := v_derived_plan / cos(radians(v_pitch));
    END IF;

    UPDATE public.quote_takeoff_measurements
       SET measurement_value = v_derived_value,
           entry_inputs = jsonb_set(
             entry_inputs,
             '{plan_value}',
             to_jsonb(v_derived_plan::double precision)
           )
     WHERE id = v_derived.id;
  END LOOP;

  -- ── 9. Increment session version (same protocol as every save) ─────────
  IF v_session_id IS NOT NULL THEN
    UPDATE public.takeoff_sessions SET version = version + 1 WHERE id = v_session_id;
  ELSE
    UPDATE public.takeoff_sessions SET version = version + 1 WHERE quote_id = p_quote_id;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'value', v_new_value::double precision,
    'session_version', (
      SELECT version FROM public.takeoff_sessions WHERE quote_id = p_quote_id
    )
  );
END;
$function$;

COMMENT ON FUNCTION public.update_takeoff_area_geometry_v1(uuid, uuid, uuid, jsonb, integer) IS
  'Update-in-place roof-area geometry edit (patch_052, mobile takeoff M5): '
  'updates the existing area-type measurement row by id with server-side '
  'geometry validation and server-derived area from the page calibration '
  'scale; recomputes source-linked dependent entries at constant scale; '
  'advisory lock + optimistic session-version guard; never delete+insert.';

REVOKE EXECUTE ON FUNCTION public.update_takeoff_area_geometry_v1(uuid, uuid, uuid, jsonb, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_takeoff_area_geometry_v1(uuid, uuid, uuid, jsonb, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_takeoff_area_geometry_v1(uuid, uuid, uuid, jsonb, integer) TO service_role;
