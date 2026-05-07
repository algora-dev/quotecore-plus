-- Fix `save_takeoff_atomic`: the original definition forgot to cast text
-- payload values into their Postgres enum column types, which made the RPC
-- error out as soon as the user actually drew measurements for a component
-- on the digital-takeoff canvas:
--
--   ERROR: 22P02 / 42804  column "waste_type" is of type waste_type but
--   expression is of type text
--
-- Old code paths populated `quote_components` via the supabase-js client
-- which auto-casts text -> enum, so this bug was masked until the atomic
-- RPC was first exercised end-to-end with components on 2026-05-07.
--
-- We replace the function definition with a version that:
--   1. Casts `waste_type` and `pitch_type` payload fields with `::waste_type`
--      and `::pitch_type` respectively (with a fallback to 'none').
--   2. Casts `measurement_type` and `input_mode` literals to their enums
--      explicitly so the function is robust to future enum churn.
--
-- Behaviour is otherwise identical to the previous version.

create or replace function public.save_takeoff_atomic(
  p_quote_id uuid,
  p_payload  jsonb
)
returns void
language plpgsql
security invoker
as $$
declare
  v_company_id        uuid;
  v_first_roof_area   uuid;
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
  -- Verify quote exists and capture company_id (also acts as ownership gate when called via RLS).
  select company_id into v_company_id
    from public.quotes
   where id = p_quote_id;

  if v_company_id is null then
    raise exception 'Quote % not found', p_quote_id;
  end if;

  -- Optional: persist canvas snapshots.
  if v_canvas_url is not null or v_lines_url is not null then
    update public.quotes
       set takeoff_canvas_url = coalesce(v_canvas_url, takeoff_canvas_url),
           takeoff_lines_url  = coalesce(v_lines_url,  takeoff_lines_url)
     where id = p_quote_id;
  end if;

  -- Replace the measurement set for this quote in one shot.
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

  -- Auto-create roof areas; remember the first one for component linkage.
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

  -- Auto-create quote_components + their entries; skip duplicates.
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
$$;

-- (grants are unchanged from the previous migration; CREATE OR REPLACE preserves them.)
