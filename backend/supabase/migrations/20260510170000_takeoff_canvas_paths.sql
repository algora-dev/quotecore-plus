-- =============================================================================
-- Takeoff canvas: persist storage paths, sign on render
-- =============================================================================
--
-- Background (Gerald audit pass 2): the digital takeoff system used to write a
-- 30-day signed URL into quotes.takeoff_canvas_url / takeoff_lines_url. After
-- 30 days the URL silently 401s and the takeoff snapshot disappears from the
-- summary page, even though the underlying object is still in storage.
--
-- Fix: store the storage path instead of a signed URL, and let render sites
-- mint a short-lived signed URL on the fly. Pages that already do this for
-- regular quote files (`getSignedUrl()` with a 1-hour TTL) get the same
-- behaviour for takeoff snapshots.
--
-- Migration plan
-- --------------
-- 1. Add takeoff_canvas_path / takeoff_lines_path columns (text, nullable).
-- 2. Backfill from existing *_url columns by extracting the path segment after
--    `/storage/v1/object/public/QUOTE-DOCUMENTS/` or `/storage/v1/object/sign/
--    QUOTE-DOCUMENTS/`. Anything older than that goes through the application's
--    re-sign-on-render path the next time the page loads (the URL columns are
--    kept around so nothing breaks during the rollout window).
-- 3. Update save_takeoff_atomic() to read canvas_path / lines_path keys from
--    the JSONB payload and write them into the new columns. The URL keys keep
--    working for one release so a deploy mid-rollout doesn't drop snapshots.
--
-- The *_url columns are retained for one release, then dropped in a follow-up
-- migration once every render site is reading from *_path.
-- =============================================================================

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS takeoff_canvas_path text,
  ADD COLUMN IF NOT EXISTS takeoff_lines_path  text;

COMMENT ON COLUMN quotes.takeoff_canvas_path IS
  'Storage object path for the takeoff canvas snapshot. Sign on render with getSignedUrl().';
COMMENT ON COLUMN quotes.takeoff_lines_path IS
  'Storage object path for the takeoff lines-only snapshot. Sign on render with getSignedUrl().';

-- ------------------------------------------------------------------
-- Backfill from existing URL columns.
-- Both public and signed URL shapes are handled; tokens and trailing
-- query strings get stripped.
-- ------------------------------------------------------------------
UPDATE quotes
SET takeoff_canvas_path = CASE
  WHEN takeoff_canvas_url IS NULL THEN NULL
  WHEN position('/storage/v1/object/sign/QUOTE-DOCUMENTS/'   IN takeoff_canvas_url) > 0
    THEN split_part(
           substring(takeoff_canvas_url FROM position('/storage/v1/object/sign/QUOTE-DOCUMENTS/' IN takeoff_canvas_url) + length('/storage/v1/object/sign/QUOTE-DOCUMENTS/')),
           '?', 1)
  WHEN position('/storage/v1/object/public/QUOTE-DOCUMENTS/' IN takeoff_canvas_url) > 0
    THEN split_part(
           substring(takeoff_canvas_url FROM position('/storage/v1/object/public/QUOTE-DOCUMENTS/' IN takeoff_canvas_url) + length('/storage/v1/object/public/QUOTE-DOCUMENTS/')),
           '?', 1)
  ELSE NULL
END
WHERE takeoff_canvas_path IS NULL AND takeoff_canvas_url IS NOT NULL;

UPDATE quotes
SET takeoff_lines_path = CASE
  WHEN takeoff_lines_url IS NULL THEN NULL
  WHEN position('/storage/v1/object/sign/QUOTE-DOCUMENTS/'   IN takeoff_lines_url) > 0
    THEN split_part(
           substring(takeoff_lines_url FROM position('/storage/v1/object/sign/QUOTE-DOCUMENTS/' IN takeoff_lines_url) + length('/storage/v1/object/sign/QUOTE-DOCUMENTS/')),
           '?', 1)
  WHEN position('/storage/v1/object/public/QUOTE-DOCUMENTS/' IN takeoff_lines_url) > 0
    THEN split_part(
           substring(takeoff_lines_url FROM position('/storage/v1/object/public/QUOTE-DOCUMENTS/' IN takeoff_lines_url) + length('/storage/v1/object/public/QUOTE-DOCUMENTS/')),
           '?', 1)
  ELSE NULL
END
WHERE takeoff_lines_path IS NULL AND takeoff_lines_url IS NOT NULL;

-- ------------------------------------------------------------------
-- save_takeoff_atomic: accept canvas_path / lines_path in payload.
-- The URL keys are still honoured so an in-flight deploy doesn't drop
-- snapshots. New code should pass *_path, not *_url.
-- ------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_takeoff_atomic(p_quote_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_company_id        uuid;
  v_caller_company_id uuid;
  v_caller_uid        uuid := auth.uid();
  v_first_roof_area   uuid;
  v_canvas_path       text := p_payload->>'canvas_image_path';
  v_lines_path        text := p_payload->>'lines_image_path';
  v_canvas_url        text := p_payload->>'canvas_image_url';
  v_lines_url         text := p_payload->>'lines_image_url';
  v_measurements      jsonb := coalesce(p_payload->'measurements', '[]'::jsonb);
  v_roof_areas        jsonb := coalesce(p_payload->'roof_areas',   '[]'::jsonb);
  v_components        jsonb := coalesce(p_payload->'components',   '[]'::jsonb);
  v_component         jsonb;
  v_new_component_id  uuid;
  v_existing_id       uuid;
  v_lib_id            uuid;
begin
  select company_id into v_company_id
    from public.quotes
   where id = p_quote_id;

  if v_company_id is null then
    raise exception 'Quote % not found', p_quote_id;
  end if;

  if v_caller_uid is not null then
    select company_id into v_caller_company_id
      from public.users
     where id = v_caller_uid;

    if v_caller_company_id is null or v_caller_company_id <> v_company_id then
      raise exception 'Unauthorized';
    end if;
  end if;

  -- Persist canvas snapshots: prefer paths, fall back to URLs for one release.
  if v_canvas_path is not null or v_lines_path is not null
     or v_canvas_url is not null or v_lines_url is not null then
    update public.quotes
       set takeoff_canvas_path = coalesce(v_canvas_path, takeoff_canvas_path),
           takeoff_lines_path  = coalesce(v_lines_path,  takeoff_lines_path),
           takeoff_canvas_url  = coalesce(v_canvas_url,  takeoff_canvas_url),
           takeoff_lines_url   = coalesce(v_lines_url,   takeoff_lines_url)
     where id = p_quote_id;
  end if;

  delete from public.quote_takeoff_measurements
   where quote_id = p_quote_id;

  if jsonb_array_length(v_measurements) > 0 then
    insert into public.quote_takeoff_measurements (
      quote_id, company_id, component_library_id, measurement_type, measurement_value,
      measurement_unit, canvas_points, is_visible
    )
    select
      p_quote_id,
      coalesce((m->>'company_id')::uuid, v_company_id),
      nullif(m->>'component_library_id','')::uuid,
      m->>'measurement_type',
      (m->>'measurement_value')::numeric,
      m->>'measurement_unit',
      m->'canvas_points',
      coalesce((m->>'is_visible')::boolean, true)
    from jsonb_array_elements(v_measurements) as m;
  end if;

  if jsonb_array_length(v_roof_areas) > 0 then
    with inserted as (
      insert into public.quote_roof_areas (
        quote_id, label, input_mode, final_value_sqm, computed_sqm, calc_pitch_degrees, is_locked
      )
      select
        p_quote_id,
        ra->>'label',
        'final'::input_mode,
        (ra->>'final_value_sqm')::numeric,
        (ra->>'computed_sqm')::numeric,
        (ra->>'calc_pitch_degrees')::numeric,
        true
      from jsonb_array_elements(v_roof_areas) with ordinality as t(ra, ord)
      order by t.ord
      returning id
    )
    select id into v_first_roof_area from inserted limit 1;
  end if;

  for v_component in select * from jsonb_array_elements(v_components) loop
    v_lib_id := (v_component->>'component_library_id')::uuid;

    select id into v_existing_id
      from public.quote_components
     where quote_id = p_quote_id
       and component_library_id = v_lib_id
     limit 1;

    if v_existing_id is not null then
      continue;
    end if;

    insert into public.quote_components (
      quote_id, quote_roof_area_id, component_library_id, name, component_type,
      measurement_type, input_mode,
      material_rate, labour_rate,
      waste_type, waste_percent, waste_fixed,
      pitch_type,
      final_quantity, material_cost, labour_cost
    ) values (
      p_quote_id, v_first_roof_area, v_lib_id, v_component->>'name', 'main'::component_type,
      'lineal'::measurement_type, 'calculated'::input_mode,
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
    returning id into v_new_component_id;

    if jsonb_array_length(coalesce(v_component->'entries', '[]'::jsonb)) > 0 then
      insert into public.quote_component_entries (
        quote_component_id, raw_value, value_after_waste, sort_order
      )
      select
        v_new_component_id,
        (e->>'raw_value')::numeric,
        (e->>'value_after_waste')::numeric,
        coalesce((e->>'sort_order')::int, 0)
      from jsonb_array_elements(v_component->'entries') as e;
    end if;
  end loop;
end;
$function$;
