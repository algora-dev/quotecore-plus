import type { MeasurementSystem } from '@/app/lib/types';
import { areaInputToMetric } from '@/app/lib/measurements/conversions';

export type QuantitySpacingRoundUp = 1 | 5 | 10;

/** Strictly advance to the next whole/5/10 increment. */
export function roundUpToNext(value: number, increment: QuantitySpacingRoundUp): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const next = Math.floor(value / increment + Number.EPSILON) + 1;
  return next * increment;
}

export function calculateQuantityBySpacing(args: {
  linealMetres: number;
  spacingMetres: number;
  allowancePercent: number;
  roundUp: QuantitySpacingRoundUp;
}): number {
  const { linealMetres, spacingMetres, allowancePercent, roundUp } = args;
  if (!Number.isFinite(linealMetres) || linealMetres <= 0 || !Number.isFinite(spacingMetres) || spacingMetres <= 0) return 0;
  const spaced = linealMetres / spacingMetres;
  const withAllowance = spaced * (1 + Math.max(0, allowancePercent || 0) / 100);
  return roundUpToNext(withAllowance, roundUp);
}

/** Convert a rate entered per displayed area unit to canonical units per m². */
export function unitsPerDisplayedAreaToMetric(rate: number, system: MeasurementSystem): number {
  const oneDisplayUnitInM2 = areaInputToMetric(1, system);
  return oneDisplayUnitInM2 > 0 ? rate / oneDisplayUnitInM2 : rate;
}

/** Convert canonical units per m² back to units per the user's displayed area unit. */
export function unitsPerMetricAreaToDisplayed(ratePerM2: number, system: MeasurementSystem): number {
  const oneDisplayUnitInM2 = areaInputToMetric(1, system);
  return Number.isFinite(ratePerM2) && oneDisplayUnitInM2 > 0 ? ratePerM2 * oneDisplayUnitInM2 : ratePerM2;
}

export function calculateRequiredAreaUnits(areaM2: number, unitsPerM2: number | null | undefined): number | null {
  if (unitsPerM2 == null || !Number.isFinite(Number(unitsPerM2)) || Number(unitsPerM2) < 0) return null;
  return Math.max(0, areaM2) * Number(unitsPerM2);
}
