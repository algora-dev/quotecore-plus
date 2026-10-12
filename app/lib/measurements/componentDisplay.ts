// Component quantity display (owner spec 2026-10-12): area-measured components
// with a lineal cover can display their quantity as lineal metres, both, or
// area-only. The stored measurement is ALWAYS m²; lm is derived at display:
// lm = m² / (cover_width_mm / 1000). Pricing never changes.

import { formatArea } from './displayHelpers';
import { convertLinear } from './conversions';
import { normalizeMeasurementSystem, type MeasurementSystem } from '../types';

export type QuantityDisplay = 'area' | 'lineal' | 'both';

export function normalizeQuantityDisplay(v: unknown): QuantityDisplay {
  return v === 'lineal' || v === 'both' ? v : 'area';
}

/** lm = m² ÷ (cover mm / 1000). Null when the cover is missing/invalid. */
export function linealFromAreaM2(areaM2: number, coverWidthMm: unknown): number | null {
  const mm = Number(coverWidthMm);
  if (!Number.isFinite(areaM2) || !(areaM2 > 0) || !Number.isFinite(mm) || mm <= 0) return null;
  return areaM2 / (mm / 1000);
}

/** Roofing lineal metres keep the trade "lm" suffix in metric (not bare "m"). */
export function formatLinealMetres(lm: number, system: MeasurementSystem): string {
  return normalizeMeasurementSystem(system) === 'metric'
    ? `${lm.toFixed(2)} lm`
    : `${convertLinear(lm)} ft`;
}

/**
 * Format an area-stored quantity per the component's display preference.
 *  - 'lineal' → "283.11 lm"
 *  - 'both'   → "283.11 lm / 215.20 m²"
 *  - 'area' (default / invalid cover) → "215.20 m²"
 */
export function formatComponentQuantity(
  areaM2: number,
  opts: {
    quantityDisplay?: string | null;
    coverWidthMm?: string | number | null;
    unitSystem: MeasurementSystem;
  },
): string {
  const pref = normalizeQuantityDisplay(opts.quantityDisplay);
  const lm = pref !== 'area' ? linealFromAreaM2(areaM2, opts.coverWidthMm) : null;
  if (lm != null && pref === 'lineal') return formatLinealMetres(lm, opts.unitSystem);
  if (lm != null && pref === 'both') {
    return `${formatLinealMetres(lm, opts.unitSystem)} / ${formatArea(areaM2, opts.unitSystem)}`;
  }
  return formatArea(areaM2, opts.unitSystem);
}
