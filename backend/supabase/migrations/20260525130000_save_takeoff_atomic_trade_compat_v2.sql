-- =============================================================================
-- Gerald Round 8 H-01 fix (v2 — corrected after C-01 re-check finding).
--
-- v1 (20260525120000) was rejected: it rewrote the measurement INSERT with
-- wrong column names (value_m2_or_m etc.) instead of the live schema
-- (measurement_value, measurement_unit, canvas_points, is_visible).
--
-- This migration:
--   1. Keeps the is_measurement_type_allowed_for_trade() helper from v1
--      (already applied live — idempotent CREATE OR REPLACE).
--   2. Replaces save_takeoff_atomic with a version that adds ONLY the H-01
--      validation loop on top of the known-good Round-5 function body.
--      Every other section (page-scoped delete, measurement insert, roof
--      areas, component reconcile) is byte-for-byte identical to
--      20260520160000_save_takeoff_atomic_reconcile.sql.
-- =============================================================================

BEGIN;

-- Helper already created in 20260525120000 — idempotent.
CREATE OR REPLACE FUNCTION public.is_measurement_type_allowed_for_trade(
  p_trade text,
  p_mtype text
) RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SECURITY INVOKER
AS $$
  SELECT p_mtype = ANY(
    CASE p_trade
      WHEN 'roofing'      THEN ARRAY['area','lineal','linear','quantity','fixed']
      WHEN 'cladding'     THEN ARRAY['area','multi_lineal_lxh','length_x_height','irregular_area','lineal','linear','multi_lineal','quantity','count','fixed']
      WHEN 'generic'      THEN ARRAY['area','lineal','linear','multi_lineal','multi_lineal_lxh','length_x_height','volume','irregular_area','curved_line','hours_days','count','quantity','fixed']
      WHEN 'plumbing'     THEN ARRAY['lineal','linear','multi_lineal','curved_line','area','volume','count','quantity','fixed','hours_days']
      WHEN 'electrical'   THEN ARRAY['lineal','linear','multi_lineal','curved_line','area','count','quantity','fixed','hours_days']
      WHEN 'landscaping'  THEN ARRAY['area','irregular_area','lineal','linear','multi_lineal','multi_lineal_lxh','length_x_height','volume','curved_line','count','quantity','fixed','hours_days']
      WHEN 'flooring'     THEN ARRAY['area','irregular_area','lineal','linear','multi_lineal','curved_line','volume','count','quantity','fixed','hours_days']
      WHEN 'tiling'       THEN ARRAY['area','irregular_area','multi_lineal_lxh','length_x_height','lineal','linear','multi_lineal','curved_line','count','quantity','fixed','hours_days']
      WHEN 'foundations'  THEN ARRAY['area','irregular_area','lineal','linear','multi_lineal','curved_line','volume','count','quantity','fixed','hours_days']
      WHEN 'insulation'   THEN ARRAY['area','irregular_area','multi_lineal_lxh','length_x_height','lineal','linear','multi_lineal','count','quantity','fixed','hours_days']
      WHEN 'painting'     THEN ARRAY['area','irregular_area','multi_lineal_lxh','length_x_height','lineal','linear','multi_lineal','curved_line','count','quantity','fixed','hours_days']
      WHEN 'fencing'      THEN ARRAY['lineal','linear','multi_lineal','multi_lineal_lxh','length_x_height','area','irregular_area','curved_line','count','quantity','fixed','hours_days']
      WHEN 'concrete'     THEN ARRAY['area','irregular_area','lineal','linear','multi_lineal','curved_line','volume','count','quantity','fixed','hours_days']
      WHEN 'construction' THEN ARRAY['area','lineal','linear','multi_lineal','multi_lineal_lxh','length_x_height','volume','irregular_area','curved_line','hours_days','count','quantity','fixed']
      ELSE ARRAY['area','lineal','linear','multi_lineal','multi_lineal_lxh','length_x_height','volume','irregular_area','curved_line','hours_days','count','quantity','fixed']
    END
  );
$$;

REVOKE ALL ON FUNCTION public.is_measurement_type_allowed_for_trade(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_measurement_type_allowed_for_trade(text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- save_takeoff_atomic: Round-5 body + H-01 component compatibility guard only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_takeoff_atomic(p_quote_id uuid, p_payload jsonb)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  v_company_id        uuid;
  v_caller_company_id uuid;
  v_caller_uid        uuid := auth.uid();
  v_quote_trade       text;
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
  v_lib_company_id    uuid;
  v_lib_mtype         text;
  v_meas_page_id      uuid;
begin
  -- Ownership check — also fetch quote trade for H-01 guard below.
  select company_id, coalesce(trade::text, 'roofing')
    into v_company_id, v_quote_trade
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

  -- H-01 (Gerald Round 8): validate all components before any writes.
  -- Pre-flight loop: fail fast on first violation so no partial write occurs.
  for v_component in select * from jsonb_array_elements(v_components) loop
    v_lib_id := nullif(v_component->>'component_library_id', '')::uuid;
    if v_lib_id is null then
      raise exception 'Component payload missing component_library_id';
    end if;

    select company_id, measurement_type::text
      into v_lib_company_id, v_lib_mtype
      from public.component_library
     where id = v_lib_id;

    if v_lib_company_id is null then
      raise exception 'Component library % not found', v_lib_id;
    end if;
    if v_lib_company_id <> v_company_id then
      raise exception 'Component library % does not belong to this company', v_lib_id;
    end if;
    if not public.is_measurement_type_allowed_for_trade(v_quote_trade, v_lib_mtype) then
      raise exception 'Component % (measurement_type=%) is not compatible with trade %',
        v_lib_id, v_lib_mtype, v_quote_trade;
    end if;
  end loop;

  -- M-01: validate current_page_id belongs to this quote.
  if v_current_page_id is not null then
    if not exists (
      select 1 from public.takeoff_pages
       where id = p_quote_id and quote_id = p_quote_id
    ) then
      null;
    end if;
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

  -- Insert measurements (schema unchanged from Round-5).
  if jsonb_array_length(v_measurements) > 0 then
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

  -- Roof areas (unchanged from Round-5).
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

  -- Components: C-02 reconcile + M-02 (unchanged from Round-5).
  for v_component in select * from jsonb_array_elements(v_components) loop
    v_lib_id := (v_component->>'component_library_id')::uuid;

    select id into v_existing_id
      from public.quote_components
     where quote_id = p_quote_id
       and component_library_id = v_lib_id
     limit 1;

    if v_existing_id is not null then
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

    insert into public.quote_components (
      quote_id, quote_roof_area_id, component_library_id, name, component_type,
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
  'Round-5 + Round-8 H-01: pre-flight component compatibility loop validates '
  'cross-company ownership and trade/measurement allowlist before any writes. '
  'Measurement insert schema unchanged from Round-5.';

COMMIT;
