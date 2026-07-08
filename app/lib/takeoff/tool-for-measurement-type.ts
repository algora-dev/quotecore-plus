/**
 * P1-2: Central canonical mapping from measurement_type string to the
 * canvas tool that handles it. Use this everywhere instead of inline
 * switch/if chains - keeps tool-selection logic in one place.
 */

export type CanvasTool = 'area' | 'line' | 'multi_line' | 'point' | null;

/**
 * Returns the canvas tool for a given measurement type, or `null` for
 * types that use manual entry only (hours, fixed, fixed_per_segment).
 */
export function toolForMeasurementType(type: string): CanvasTool {
  switch (type.toLowerCase()) {
    case 'area':
    case 'volume':
    case 'volume_3d': // L×W×D — drawn as an area polygon, then depth prompt (2026-07-08)
    case 'irregular_area':
      return 'area';
    case 'lineal':
    case 'linear':
    case 'length_x_height':
    case 'length_x_height_freestyle':
      return 'line';
    case 'multi_lineal':
    case 'multi_lineal_lxh':
    case 'multi_lineal_lxh_freestyle':
      return 'multi_line';
    case 'point':
    case 'count':
    case 'quantity':
    case 'hours_days':
    case 'hours':
    case 'fixed':
    case 'fixed_per_segment':
      return 'point';
    default:
      return null; // manual entry only
  }
}
