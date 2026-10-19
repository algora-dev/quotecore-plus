-- Migration: 20261019114500_quantity_by_spacing_all_trades.sql
-- Purpose: quantity_by_spacing is a universal input mode (brackets, fixings,
--          supports, etc.), not a trade-specific capability. Owner directive
--          2026-10-19: make it available to EVERY trade. The app whitelist
--          (app/lib/trades/measurement-type-whitelist.ts) already allows it
--          for all trades; this syncs the database compatibility helper so
--          save_takeoff_atomic stops rejecting quotes whose components use it.
-- Approach: CREATE OR REPLACE, based on the 20260707200000 live definition
--          (per-trade arrays preserved verbatim), adding 'quantity_by_spacing'
--          to every trade array AND the fallback. No other type changes.

CREATE OR REPLACE FUNCTION public.is_measurement_type_allowed_for_trade(p_trade text, p_mtype text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
AS $function$
  SELECT p_mtype = ANY(
    CASE p_trade
      WHEN 'roofing'      THEN ARRAY[
        'area','lineal','linear','multi_lineal','multi_lineal_lxh',
        'multi_lineal_lxh_freestyle','length_x_height','length_x_height_freestyle',
        'irregular_area','volume','volume_3d','curved_line',
        'count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'cladding'     THEN ARRAY[
        'area','multi_lineal_lxh','length_x_height','multi_lineal_lxh_freestyle',
        'length_x_height_freestyle','irregular_area','lineal','linear',
        'multi_lineal','quantity','count','fixed','quantity_by_spacing'
      ]
      WHEN 'generic'      THEN ARRAY[
        'area','lineal','linear','multi_lineal','multi_lineal_lxh',
        'multi_lineal_lxh_freestyle','length_x_height','length_x_height_freestyle',
        'volume','volume_3d','irregular_area','curved_line',
        'hours_days','count','quantity','fixed','quantity_by_spacing'
      ]
      WHEN 'plumbing'     THEN ARRAY[
        'lineal','linear','multi_lineal','curved_line','area','volume','volume_3d',
        'count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'electrical'   THEN ARRAY[
        'lineal','linear','multi_lineal','curved_line','area',
        'count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'landscaping'  THEN ARRAY[
        'area','irregular_area','lineal','linear','multi_lineal',
        'multi_lineal_lxh','multi_lineal_lxh_freestyle','length_x_height',
        'length_x_height_freestyle','volume','volume_3d','curved_line',
        'count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'flooring'     THEN ARRAY[
        'area','irregular_area','lineal','linear','multi_lineal','curved_line',
        'volume','volume_3d','count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'tiling'       THEN ARRAY[
        'area','irregular_area','multi_lineal_lxh','multi_lineal_lxh_freestyle',
        'length_x_height','length_x_height_freestyle','lineal','linear',
        'multi_lineal','curved_line','count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'foundations'  THEN ARRAY[
        'area','irregular_area','lineal','linear','multi_lineal','curved_line',
        'volume','volume_3d','count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'insulation'   THEN ARRAY[
        'area','irregular_area','multi_lineal_lxh','multi_lineal_lxh_freestyle',
        'length_x_height','length_x_height_freestyle','lineal','linear',
        'multi_lineal','count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'painting'     THEN ARRAY[
        'area','irregular_area','multi_lineal_lxh','multi_lineal_lxh_freestyle',
        'length_x_height','length_x_height_freestyle','lineal','linear',
        'multi_lineal','curved_line','count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'fencing'      THEN ARRAY[
        'lineal','linear','multi_lineal','multi_lineal_lxh','multi_lineal_lxh_freestyle',
        'length_x_height','length_x_height_freestyle','area','irregular_area',
        'curved_line','count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'concrete'     THEN ARRAY[
        'area','irregular_area','lineal','linear','multi_lineal','curved_line',
        'volume','volume_3d','count','quantity','fixed','hours_days','quantity_by_spacing'
      ]
      WHEN 'construction' THEN ARRAY[
        'area','lineal','linear','multi_lineal','multi_lineal_lxh',
        'multi_lineal_lxh_freestyle','length_x_height','length_x_height_freestyle',
        'volume','volume_3d','irregular_area','curved_line',
        'hours_days','count','quantity','fixed','quantity_by_spacing'
      ]
      ELSE ARRAY[
        'area','lineal','linear','multi_lineal','multi_lineal_lxh',
        'multi_lineal_lxh_freestyle','length_x_height','length_x_height_freestyle',
        'volume','volume_3d','irregular_area','curved_line',
        'hours_days','count','quantity','fixed','quantity_by_spacing'
      ]
    END
  );
$function$;

REVOKE ALL ON FUNCTION public.is_measurement_type_allowed_for_trade(text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_measurement_type_allowed_for_trade(text, text)
  TO authenticated, service_role;
