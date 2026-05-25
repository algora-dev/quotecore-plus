-- =============================================================================
-- Gerald Round 8 H-01: add trade/measurement compatibility validation inside
-- save_takeoff_atomic before it inserts/reconciles quote_components.
--
-- Previously the RPC wrote directly to quote_components without running the
-- central assertComponentCompatibleWithQuote() guard (which lives in TS).
-- The TS regression script only scanned .ts/.tsx files, not SQL bodies.
--
-- This migration replaces the function with one that:
--   1. Resolves the quote's trade (falls back to 'roofing' when null).
--   2. Before any quote_components insert or reconcile, verifies:
--        a. component_library.company_id = v_company_id (cross-company guard)
--        b. component_library.measurement_type is in the allowed set for the
--           quote's trade (mirrors TRADE_ALLOWED_MEASUREMENT_TYPES in TS).
--   3. Raises an exception on any violation so the whole atomic call rolls back.
--
-- The allowlist is encoded as a SQL helper function
-- is_measurement_type_allowed_for_trade() so it can be tested independently
-- and updated without touching the main RPC body.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- Helper: mirrors TRADE_ALLOWED_MEASUREMENT_TYPES from TS
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_measurement_type_allowed_for_trade(
  p_trade       text,
  p_mtype       text
) RETURNS boolean
  LANGUAGE sql
  IMMUTABLE
  SECURITY INVOKER
AS $$
  SELECT p_mtype = ANY(
    CASE p_trade
      WHEN 'roofing' THEN
        ARRAY['area','lineal','linear','quantity','fixed']
      WHEN 'cladding' THEN
        ARRAY['area','multi_lineal_lxh','length_x_height','irregular_area',
              'lineal','linear','multi_lineal','quantity','count','fixed']
      WHEN 'generic' THEN
        ARRAY['area','lineal','linear','multi_lineal','multi_lineal_lxh',
              'length_x_height','volume','irregular_area','curved_line',
              'hours_days','count','quantity','fixed']
      WHEN 'plumbing' THEN
        ARRAY['lineal','linear','multi_lineal','curved_line','area','volume',
              'count','quantity','fixed','hours_days']
      WHEN 'electrical' THEN
        ARRAY['lineal','linear','multi_lineal','curved_line','area',
              'count','quantity','fixed','hours_days']
      WHEN 'landscaping' THEN
        ARRAY['area','irregular_area','lineal','linear','multi_lineal',
              'multi_lineal_lxh','length_x_height','volume','curved_line',
              'count','quantity','fixed','hours_days']
      WHEN 'flooring' THEN
        ARRAY['area','irregular_area','lineal','linear','multi_lineal',
              'curved_line','volume','count','quantity','fixed','hours_days']
      WHEN 'tiling' THEN
        ARRAY['area','irregular_area','multi_lineal_lxh','length_x_height',
              'lineal','linear','multi_lineal','curved_line',
              'count','quantity','fixed','hours_days']
      WHEN 'foundations' THEN
        ARRAY['area','irregular_area','lineal','linear','multi_lineal',
              'curved_line','volume','count','quantity','fixed','hours_days']
      WHEN 'insulation' THEN
        ARRAY['area','irregular_area','multi_lineal_lxh','length_x_height',
              'lineal','linear','multi_lineal','count','quantity','fixed','hours_days']
      WHEN 'painting' THEN
        ARRAY['area','irregular_area','multi_lineal_lxh','length_x_height',
              'lineal','linear','multi_lineal','curved_line',
              'count','quantity','fixed','hours_days']
      WHEN 'fencing' THEN
        ARRAY['lineal','linear','multi_lineal','multi_lineal_lxh',
              'length_x_height','area','irregular_area','curved_line',
              'count','quantity','fixed','hours_days']
      WHEN 'concrete' THEN
        ARRAY['area','irregular_area','lineal','linear','multi_lineal',
              'curved_line','volume','count','quantity','fixed','hours_days']
      WHEN 'construction' THEN
        ARRAY['area','lineal','linear','multi_lineal','multi_lineal_lxh',
              'length_x_height','volume','irregular_area','curved_line',
              'hours_days','count','quantity','fixed']
      -- Unknown trade: allow everything rather than hard-block (fail-open,
      -- consistent with TS assertCompatible behaviour for unknown trades).
      ELSE
        ARRAY['area','lineal','linear','multi_lineal','multi_lineal_lxh',
              'length_x_height','volume','irregular_area','curved_line',
              'hours_days','count','quantity','fixed']
    END
  );
$$;

REVOKE ALL ON FUNCTION public.is_measurement_type_allowed_for_trade(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_measurement_type_allowed_for_trade(text, text)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Replace save_takeoff_atomic with trade-compatibility-validated version
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
  -- Ownership check
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
  -- Fail the whole call early if any component is incompatible so the
  -- caller gets a clear error rather than a partial write.
  for v_component in select * from jsonb_array_elements(v_components) loop
    v_lib_id := (v_component->>'component_library_id')::uuid;
    if v_lib_id is null then
      raise exception 'Component payload missing component_library_id';
    end if;

    select company_id, measurement_type::text
      into v_lib_company_id, v_lib_mtype
      from public.component_library
     where id = v_lib_id;

    -- Cross-company guard
    if v_lib_company_id is null then
      raise exception 'Component library % not found', v_lib_id;
    end if;
    if v_lib_company_id <> v_company_id then
      raise exception 'Component library % does not belong to this company', v_lib_id;
    end if;

    -- Trade/measurement compatibility guard
    if not public.is_measurement_type_allowed_for_trade(v_quote_trade, v_lib_mtype) then
      raise exception
        'Component % (measurement_type=%) is not compatible with trade %',
        v_lib_id, v_lib_mtype, v_quote_trade;
    end if;
  end loop;

  -- Page-scoped delete: remove measurements that belong to the current page.
  if v_current_page_id is not null then
    -- Validate page belongs to this quote before deleting.
    if not exists (
      select 1 from public.takeoff_pages tp
      join public.takeoff_sessions ts on ts.id = tp.session_id
      where tp.id = v_current_page_id and ts.quote_id = p_quote_id
    ) then
      raise exception 'Page % does not belong to quote %', v_current_page_id, p_quote_id;
    end if;

    delete from public.quote_takeoff_measurements
     where quote_id = p_quote_id
       and page_id = v_current_page_id;
  else
    -- Legacy path: no page context, delete all measurements for quote.
    delete from public.quote_takeoff_measurements
     where quote_id = p_quote_id;
  end if;

  -- Insert measurements
  if jsonb_array_length(v_measurements) > 0 then
    insert into public.quote_takeoff_measurements (
      quote_id, page_id, component_library_id, measurement_type,
      value_m2_or_m, value_after_waste, label, sort_order
    )
    select
      p_quote_id,
      case
        when (m->>'page_id') is not null and (m->>'page_id') <> ''
        then (m->>'page_id')::uuid
        else v_current_page_id
      end,
      (m->>'component_library_id')::uuid,
      (m->>'measurement_type')::measurement_type,
      (m->>'value_m2_or_m')::numeric,
      (m->>'value_after_waste')::numeric,
      m->>'label',
      coalesce((m->>'sort_order')::int, 0)
    from jsonb_array_elements(v_measurements) with ordinality as t(m, ord)
    order by t.ord;
  end if;

  -- Roof areas (legacy path for non-page takeoff)
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

  -- Components: reconcile existing, insert new (compatibility already validated above).
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

    -- New component insert.
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
      0, 0, 0
    ) returning id into v_new_component_id;

    -- Insert entries for new component if provided.
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

      -- Calculate initial totals.
      update public.quote_components c
         set final_quantity = coalesce((
               select sum(value_after_waste)
                 from public.quote_component_entries
                where quote_component_id = v_new_component_id
             ), 0),
             material_cost  = coalesce((
               select sum(value_after_waste)
                 from public.quote_component_entries
                where quote_component_id = v_new_component_id
             ), 0) * c.material_rate,
             labour_cost    = coalesce((
               select sum(value_after_waste)
                 from public.quote_component_entries
                where quote_component_id = v_new_component_id
             ), 0) * c.labour_rate
       where c.id = v_new_component_id;
    end if;
  end loop;

  -- Update canvas/lines image paths on the quote if provided.
  if v_canvas_path is not null or v_lines_path is not null
     or v_canvas_url is not null or v_lines_url is not null then
    update public.quotes
       set takeoff_canvas_path = coalesce(v_canvas_path, takeoff_canvas_path),
           takeoff_lines_path  = coalesce(v_lines_path,  takeoff_lines_path),
           takeoff_canvas_url  = coalesce(v_canvas_url,  takeoff_canvas_url),
           takeoff_lines_url   = coalesce(v_lines_url,   takeoff_lines_url)
     where id = p_quote_id;
  end if;

end;
$function$;

COMMIT;
