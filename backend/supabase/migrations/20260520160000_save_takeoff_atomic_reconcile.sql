-- ============================================================================
-- Gerald round-5 fixes: C-02, M-01, M-02
-- ============================================================================
--
-- C-02: Reconcile existing component entries on re-save.
--       Previously skipped with CONTINUE. Now deletes+reinserts entries and
--       recalculates final_quantity / material_cost / labour_cost.
--
-- M-01: Validate current_page_id and per-measurement page_id belong to the
--       quote before writing.
--
-- M-02: Accept measurement_type from payload instead of hardcoding 'lineal'.
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
  v_current_page_id   uuid := nullif(p_payload->>'current_page_id', '')::uuid;
  v_component         jsonb;
  v_new_component_id  uuid;
  v_existing_id       uuid;
  v_lib_id            uuid;
  v_meas_page_id      uuid;
begin
  -- Ownership check
  select company_id into v_company_id
    from public.quotes where id = p_quote_id;
  if v_company_id is null then
    raise exception 'Quote % not found', p_quote_id;
  end if;
  if v_caller_uid is not null then
    select company_id into v_caller_company_id
      from public.users where id = v_caller_uid;
    if v_caller_company_id is null or v_caller_company_id <> v_company_id then
      raise exception 'Unauthorized';
    end if;
  end if;

  -- M-01: validate current_page_id belongs to this quote.
  if v_current_page_id is not null then
    if not exists (
      select 1 from public.takeoff_pages
       where id = p_quote_id and quote_id = p_quote_id
       -- correct check:
    ) then
      -- Rewrite: proper check
      null;
    end if;
    -- Proper ownership check for current_page_id:
    if not exists (
      select 1 from public.takeoff_pages
       where id = v_current_page_id
         and quote_id = p_quote_id
    ) then
      raise exception 'Page % does not belong to quote %', v_current_page_id, p_quote_id;
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

  -- Scoped delete (page-aware).
  if v_current_page_id is not null then
    delete from public.quote_takeoff_measurements
     where quote_id = p_quote_id
       and (page_id = v_current_page_id or page_id is null);
  else
    delete from public.quote_takeoff_measurements
     where quote_id = p_quote_id;
  end if;

  -- Insert measurements.
  -- M-01: validate each per-measurement page_id belongs to the quote.
  if jsonb_array_length(v_measurements) > 0 then
    -- Validate all page_ids in the payload in one query.
    if exists (
      select 1
        from jsonb_array_elements(v_measurements) as m
       where nullif(m->>'page_id', '') is not null
         and not exists (
           select 1 from public.takeoff_pages tp
            where tp.id = nullif(m->>'page_id', '')::uuid
              and tp.quote_id = p_quote_id
         )
    ) then
      raise exception 'One or more page_id values do not belong to quote %', p_quote_id;
    end if;

    insert into public.quote_takeoff_measurements (
      quote_id, company_id, component_library_id, measurement_type, measurement_value,
      measurement_unit, canvas_points, is_visible, page_id
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

  -- Roof areas (unchanged).
  if jsonb_array_length(v_roof_areas) > 0 then
    with inserted as (
      insert into public.quote_roof_areas (
        quote_id, label, input_mode, final_value_sqm, computed_sqm, calc_pitch_degrees, is_locked
      )
      select
        p_quote_id, ra->>'label', 'final'::input_mode,
        (ra->>'final_value_sqm')::numeric, (ra->>'computed_sqm')::numeric,
        (ra->>'calc_pitch_degrees')::numeric, true
      from jsonb_array_elements(v_roof_areas) with ordinality as t(ra, ord)
      order by t.ord
      returning id
    )
    select id into v_first_roof_area from inserted limit 1;
  end if;

  -- Components: C-02 reconcile + M-02 real measurement_type.
  for v_component in select * from jsonb_array_elements(v_components) loop
    v_lib_id := (v_component->>'component_library_id')::uuid;

    select id into v_existing_id
      from public.quote_components
     where quote_id = p_quote_id
       and component_library_id = v_lib_id
     limit 1;

    if v_existing_id is not null then
      -- C-02: reconcile entries for existing component instead of skipping.
      delete from public.quote_component_entries
       where quote_component_id = v_existing_id;

      if jsonb_array_length(coalesce(v_component->'entries', '[]'::jsonb)) > 0 then
        insert into public.quote_component_entries (
          quote_component_id, raw_value, value_after_waste, sort_order
        )
        select
          v_existing_id,
          (e->>'raw_value')::numeric,
          (e->>'value_after_waste')::numeric,
          coalesce((e->>'sort_order')::int, 0)
        from jsonb_array_elements(v_component->'entries') as e;
      end if;

      -- Recalculate component totals from fresh entries.
      update public.quote_components c
         set final_quantity = coalesce((
               select sum(value_after_waste)
                 from public.quote_component_entries
                where quote_component_id = v_existing_id
             ), 0),
             material_cost  = coalesce((
               select sum(value_after_waste)
                 from public.quote_component_entries
                where quote_component_id = v_existing_id
             ), 0) * c.material_rate,
             labour_cost    = coalesce((
               select sum(value_after_waste)
                 from public.quote_component_entries
                where quote_component_id = v_existing_id
             ), 0) * c.labour_rate
       where c.id = v_existing_id;

      continue;
    end if;

    -- New component.
    insert into public.quote_components (
      quote_id, quote_roof_area_id, component_library_id, name, component_type,
      -- M-02: use real measurement_type from payload, fallback to lineal.
      measurement_type, input_mode,
      material_rate, labour_rate,
      waste_type, waste_percent, waste_fixed, pitch_type,
      final_quantity, material_cost, labour_cost
    ) values (
      p_quote_id, v_first_roof_area, v_lib_id, v_component->>'name', 'main'::component_type,
      coalesce(v_component->>'measurement_type', 'lineal')::measurement_type,
      'calculated'::input_mode,
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
  'Round-5 reconcile: C-02 existing components now have entries deleted+reinserted '
  'and totals recalculated on every save; M-01 page_id values validated against '
  'takeoff_pages.quote_id; M-02 measurement_type from payload used instead of '
  'hardcoded lineal.';

COMMIT;
