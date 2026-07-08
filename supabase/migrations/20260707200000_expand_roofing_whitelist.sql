-- Migration: 20260707200000_expand_roofing_whitelist.sql
-- Purpose: Expand the roofing trade whitelist to include all measurement types
--          a roofer might need (volume_3d, wall-area types, count, hours, etc.)
--          Also syncs types that were in TS but missing from SQL (multi_lineal,
--          multi_lineal_lxh, freestyle variants, volume_3d).
-- Approach: CREATE OR REPLACE the is_measurement_type_allowed_for_trade function.

CREATE OR REPLACE FUNCTION public.is_measurement_type_allowed_for_trade(p_trade text, p_mtype text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $function$
  SELECT p_mtype = ANY(
    CASE p_trade
      WHEN 'roofing'      THEN ARRAY[
        'area','lineal','linear','multi_lineal','multi_lineal_lxh',
        'multi_lineal_lxh_freestyle','length_x_height','length_x_height_freestyle',
        'irregular_area','volume','volume_3d','curved_line',
        'count','quantity','fixed','hours_days'
      ]
      WHEN 'cladding'     THEN ARRAY[
        'area','multi_lineal_lxh','length_x_height','multi_lineal_lxh_freestyle',
        'length_x_height_freestyle','irregular_area','lineal','linear',
        'multi_lineal','quantity','count','fixed'
      ]
      WHEN 'generic'      THEN ARRAY[
        'area','lineal','linear','multi_lineal','multi_lineal_lxh',
        'multi_lineal_lxh_freestyle','length_x_height','length_x_height_freestyle',
        'volume','volume_3d','irregular_area','curved_line',
        'hours_days','count','quantity','fixed'
      ]
      WHEN 'plumbing'     THEN ARRAY[
        'lineal','linear','multi_lineal','curved_line','area','volume','volume_3d',
        'count','quantity','fixed','hours_days'
      ]
      WHEN 'electrical'   THEN ARRAY[
        'lineal','linear','multi_lineal','curved_line','area',
        'count','quantity','fixed','hours_days'
      ]
      WHEN 'landscaping'  THEN ARRAY[
        'area','irregular_area','lineal','linear','multi_lineal',
        'multi_lineal_lxh','multi_lineal_lxh_freestyle','length_x_height',
        'length_x_height_freestyle','volume','volume_3d','curved_line',
        'count','quantity','fixed','hours_days'
      ]
      WHEN 'flooring'     THEN ARRAY[
        'area','irregular_area','lineal','linear','multi_lineal','curved_line',
        'volume','volume_3d','count','quantity','fixed','hours_days'
      ]
      WHEN 'tiling'       THEN ARRAY[
        'area','irregular_area','multi_lineal_lxh','multi_lineal_lxh_freestyle',
        'length_x_height','length_x_height_freestyle','lineal','linear',
        'multi_lineal','curved_line','count','quantity','fixed','hours_days'
      ]
      WHEN 'foundations'  THEN ARRAY[
        'area','irregular_area','lineal','linear','multi_lineal','curved_line',
        'volume','volume_3d','count','quantity','fixed','hours_days'
      ]
      WHEN 'insulation'   THEN ARRAY[
        'area','irregular_area','multi_lineal_lxh','multi_lineal_lxh_freestyle',
        'length_x_height','length_x_height_freestyle','lineal','linear',
        'multi_lineal','count','quantity','fixed','hours_days'
      ]
      WHEN 'painting'     THEN ARRAY[
        'area','irregular_area','multi_lineal_lxh','multi_lineal_lxh_freestyle',
        'length_x_height','length_x_height_freestyle','lineal','linear',
        'multi_lineal','curved_line','count','quantity','fixed','hours_days'
      ]
      WHEN 'fencing'      THEN ARRAY[
        'lineal','linear','multi_lineal','multi_lineal_lxh','multi_lineal_lxh_freestyle',
        'length_x_height','length_x_height_freestyle','area','irregular_area',
        'curved_line','count','quantity','fixed','hours_days'
      ]
      WHEN 'concrete'     THEN ARRAY[
        'area','irregular_area','lineal','linear','multi_lineal','curved_line',
        'volume','volume_3d','count','quantity','fixed','hours_days'
      ]
      WHEN 'construction' THEN ARRAY[
        'area','lineal','linear','multi_lineal','multi_lineal_lxh',
        'multi_lineal_lxh_freestyle','length_x_height','length_x_height_freestyle',
        'volume','volume_3d','irregular_area','curved_line',
        'hours_days','count','quantity','fixed'
      ]
      ELSE ARRAY[
        'area','lineal','linear','multi_lineal','multi_lineal_lxh',
        'multi_lineal_lxh_freestyle','length_x_height','length_x_height_freestyle',
        'volume','volume_3d','irregular_area','curved_line',
        'hours_days','count','quantity','fixed'
      ]
    END
  );
$function$;
