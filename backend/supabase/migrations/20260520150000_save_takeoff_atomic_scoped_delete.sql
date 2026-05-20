-- ============================================================================
-- Phase 7 fix: scope save_takeoff_atomic DELETE by page_id
-- ============================================================================
--
-- Problem: the previous version deleted ALL measurements for the quote on
-- every save (DELETE WHERE quote_id = p_quote_id). This means saving page 2
-- wipes page 1's measurements.
--
-- Fix: if the caller supplies "current_page_id" in the payload, delete only
-- that page's measurements. Legacy callers that omit it get the original
-- quote-wide delete (backward-compatible).
--
-- Payload contract (new key, optional):
--   { "current_page_id": "<uuid>" }
--
-- With current_page_id supplied:
--   DELETE WHERE quote_id = p_quote_id AND (page_id = current_page_id OR page_id IS NULL)
--   → clears the page being re-saved, leaves other pages untouched.
--   The OR page_id IS NULL clause handles legacy rows with no page assignment.
--
-- Without current_page_id (legacy / single-page):
--   DELETE WHERE quote_id = p_quote_id  (unchanged behaviour)
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
  -- Phase 7 scoped-delete: optional page context from caller.
  v_current_page_id   uuid := nullif(p_payload->>'current_page_id', '')::uuid;
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

  -- Persist canvas snapshots.
  if v_canvas_path is not null or v_lines_path is not null
     or v_canvas_url is not null or v_lines_url is not null then
    update public.quotes
       set takeoff_canvas_path = coalesce(v_canvas_path, takeoff_canvas_path),
           takeoff_lines_path  = coalesce(v_lines_path,  takeoff_lines_path),
           takeoff_canvas_url  = coalesce(v_canvas_url,  takeoff_canvas_url),
           takeoff_lines_url   = coalesce(v_lines_url,   takeoff_lines_url)
     where id = p_quote_id;
  end if;

  -- Scoped delete (Phase 7 fix):
  --   With page context → delete only this page's rows (and unassigned rows).
  --   Without page context → legacy quote-wide delete (single-page callers).
  if v_current_page_id is not null then
    delete from public.quote_takeoff_measurements
     where quote_id = p_quote_id
       and (page_id = v_current_page_id or page_id is null);
  else
    delete from public.quote_takeoff_measurements
     where quote_id = p_quote_id;
  end if;

  if jsonb_array_length(v_measurements) > 0 then
    insert into public.quote_takeoff_measurements (
      quote_id, company_id, component_library_id, measurement_type, measurement_value,
      measurement_unit, canvas_points, is_visible,
      page_id
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
      nullif(m->>'page_id', '')::uuid
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
  'Phase 7 (scoped-delete fix): when payload includes current_page_id, only '
  'deletes that page''s measurements before reinserting. Legacy callers without '
  'current_page_id get the original quote-wide delete (backward-compatible). '
  'Each measurement row may also carry page_id for per-page association.';

COMMIT;
