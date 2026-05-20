-- ============================================================================
-- Generic Trades Phase 7: update save_takeoff_atomic to accept page_id
-- ============================================================================
--
-- Source plan: docs/generic-trades/C2-implementation-plan.md Phase 7.0
-- Gerald round-2 M-01 follow-up + D-read-site-audit.md Step 2.4
--
-- What changes:
--   1. Each measurement row in the payload may now include "page_id" (uuid).
--      If supplied, it is written to quote_takeoff_measurements.page_id
--      (Phase 2 column, nullable). Existing callers that omit page_id
--      continue to write NULL — same as before.
--   2. The DELETE clause is still quote-wide (DELETE WHERE quote_id = ...).
--      This is intentional for v1 single-page operation. Phase 7 multi-page
--      UI uses a separate page per save, but the RPC still replaces all
--      measurements for the quote on each save. Multi-page callers will
--      need a scoped-delete approach in a future migration; documented here
--      as a known design note.
--
-- All other RPC behaviour preserved:
--   - SECURITY DEFINER, ownership check, canvas-snapshot update,
--     roof-area insert, component-entry upsert, quota/RLS.
--   - P0001/P0002/P0003 not used by this RPC (those are create_quote_atomic).
-- ============================================================================

BEGIN;

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

  -- Phase 7 design note: still quote-wide delete for v1 single-page operation.
  -- Multi-page callers will scope this by page_id in a future migration.
  delete from public.quote_takeoff_measurements
   where quote_id = p_quote_id;

  if jsonb_array_length(v_measurements) > 0 then
    insert into public.quote_takeoff_measurements (
      quote_id, company_id, component_library_id, measurement_type, measurement_value,
      measurement_unit, canvas_points, is_visible,
      page_id   -- Phase 7: optional per-measurement page reference
    )
    select
      p_quote_id,
      coalesce((m->>'company_id')::uuid, v_company_id),
      nullif(m->>'component_library_id','')::uuid,
      m->>'measurement_type',
      (m->>'measurement_value')::numeric,
      m->>'measurement_unit',
      m->'canvas_points',
      coalesce((m->>'is_visible')::boolean, true),
      nullif(m->>'page_id', '')::uuid   -- NULL when not supplied by caller
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

COMMENT ON FUNCTION public.save_takeoff_atomic(uuid, jsonb) IS
  'Phase 7 update: measurements now accept optional page_id per row. '
  'Callers that omit page_id get NULL (backward-compatible). DELETE is '
  'still quote-wide for v1 single-page operation; scope by page_id in '
  'a future migration for full multi-page semantics.';

COMMIT;
