import type { MeasurementType, MeasurementSystem, PricingStrategy, WasteUnit, WasteType, PitchType } from '@/app/lib/types';
import { normalizeMeasurementSystem } from '@/app/lib/types';

export function buildMeasurementLabels(system: MeasurementSystem): Record<MeasurementType, string> {
  const norm = normalizeMeasurementSystem(system);
  const areaUnit = norm === 'metric' ? 'm²' : norm === 'imperial_ft' ? 'ft²' : 'RS';
  const linealUnit = norm === 'metric' ? 'm' : 'ft';
  const volumeUnit = norm === 'metric' ? 'm³' : 'ft³';
  return {
    area: `Area (${areaUnit})`,
    lineal: `Linear: Single (${linealUnit})`,
    // `linear` is the legacy enum value (zero rows in production). Kept in
    // the lookup so an unmigrated row would still render a label rather
    // than crashing; new code uses `lineal`.
    linear: `Linear: Single (${linealUnit})`,
    quantity: 'Quantity',
    fixed: 'Fixed',
    // Phase 2 (Generic Trades) additions. Visible in the dropdown only when
    // NEXT_PUBLIC_GENERIC_TRADES_V1 is on; otherwise filtered out below.
    length_x_height: `Length x Height: Single (${areaUnit})`,
    volume: `Volume - Preset Depth (${volumeUnit})`,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    volume_3d: `Volume (${volumeUnit})`,
    hours_days: 'Hours / Days',
    count: 'Count (each)',
    curved_line: `Curved Line (${linealUnit})`,
    irregular_area: `Irregular Area (${areaUnit})`,
    multi_lineal: `Linear: Multi-Length (${linealUnit})`,
    multi_lineal_lxh: `Length x Height: Multi-Length (${areaUnit})`,
    length_x_height_freestyle: `Length x Height: Custom (${areaUnit})`,
    multi_lineal_lxh_freestyle: `Length x Height: Multi-Length Custom (${areaUnit})`,
  };
}

/** Measurement types shown when the generic-trades flag is off. */
export const ROOFING_DEFAULT_TYPES = new Set<MeasurementType>([
  'area',
  'lineal',
  'quantity',
  'fixed',
]);

export const PRICING_STRATEGY_LABELS: Record<PricingStrategy, string> = {
  per_unit: 'Per unit (default)',
  per_pack_length: 'Fixed Quantity (e.g. 20m cable rolls)',
  per_pack_area: 'Fixed Quantity (e.g. 50m² tile bundles)',
  // per_pack_coverage retained for legacy components only; hidden from new
  // components via allowedStrategiesFor.
  per_pack_coverage: 'Fixed Quantity (coverage - legacy)',
  per_pack_volume: 'Fixed Quantity (e.g. 5m³ concrete units),'
};

export const WASTE_UNIT_LABELS: Record<WasteUnit, string> = {
  percent: 'Percentage (% of measured)',
  flat: 'Flat \u2014 total length (added once to total)',
  flat_per_segment: 'Flat \u2014 per segment (added per point-to-point length)',
};

/** Which pricing strategies are allowed for which measurement types.
 *  Mirrors ck_component_library_strategy_compat from the Phase 2 migration. */
export function allowedStrategiesFor(mt: MeasurementType): PricingStrategy[] {
  // per_unit always allowed.
  const base: PricingStrategy[] = ['per_unit'];
  if (['lineal', 'linear', 'multi_lineal', 'curved_line'].includes(mt)) {
    base.push('per_pack_length');
  }
  if (['area', 'length_x_height', 'length_x_height_freestyle', 'irregular_area', 'multi_lineal_lxh', 'multi_lineal_lxh_freestyle'].includes(mt)) {
    // per_pack_coverage removed from new components; enum retained for legacy.
    base.push('per_pack_area');
  }
  if (mt === 'volume' || mt === 'volume_3d') {
    base.push('per_pack_volume');
  }
  return base;
}

export const WASTE_LABELS: Record<WasteType, string> = {
  none: 'None',
  percent: 'Percentage',
  fixed: 'Fixed (total)',
  fixed_per_segment: 'Fixed (per segment)',
};

export const PITCH_LABELS: Record<PitchType, string> = {
  none: 'None',
  rafter: 'Rafter Pitch',
  valley_hip: 'Valley/Hip Pitch',
};
