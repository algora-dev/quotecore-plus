import type { ReactNode } from 'react';
import { formatArea, formatLinear, formatVolume, getUnitLabel } from '@/app/lib/measurements/displayHelpers';
import type { MeasurementSystem } from '@/app/lib/types';

/**
 * Format a raw quantity value with the correct unit for its measurement type.
 * Extracted from QuoteBuilder so it can be shared across sub-components.
 */
export function formatQuantity(
  qty: number,
  measurementType: string,
  system: MeasurementSystem,
): string {
  if (measurementType === 'area' || measurementType === 'irregular_area') {
    return formatArea(qty, system);
  }
  if (
    measurementType === 'lineal' ||
    measurementType === 'linear' ||
    measurementType === 'multi_lineal' ||
    measurementType === 'curved_line' ||
    measurementType === 'rafter' ||
    measurementType === 'valley_hip'
  ) {
    return formatLinear(qty, system);
  }
  if (measurementType === 'volume' || measurementType === 'volume_3d') {
    return formatVolume(qty, system);
  }
  return `${qty.toFixed(1)} ${getUnitLabel(measurementType as never, system)}`;
}

/**
 * Fixed Quantity strategies: show rounded purchasable units (priced_quantity)
 * with actual in italic brackets e.g. "5 (4.84)". per_unit = NULL priced_quantity
 * so falls back to formatQuantity, rendering exactly as before.
 */
export function formatPricedQuantity(
  c: {
    final_quantity: number | null;
    priced_quantity?: number | string | null;
    pack_size_snapshot?: number | string | null;
    measurement_type: string;
  },
  system: MeasurementSystem,
): ReactNode {
  const actual = Number(c.final_quantity ?? 0);
  // Supabase returns numeric columns as strings at runtime — use Number().
  const priced = c.priced_quantity != null ? Number(c.priced_quantity) : null;
  const packSnap = c.pack_size_snapshot != null ? Number(c.pack_size_snapshot) : null;
  if (priced != null && !isNaN(priced)) {
    const fractional =
      packSnap && !isNaN(packSnap) && packSnap > 0 ? actual / packSnap : actual;
    return (
      <>
        {priced.toFixed(0)} <span className="italic text-slate-400">({fractional.toFixed(2)})</span>
      </>
    );
  }
  return formatQuantity(actual, c.measurement_type, system);
}
