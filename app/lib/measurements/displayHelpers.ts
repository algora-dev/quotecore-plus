// Display formatting helpers for measurements.
// All inputs are in METRIC (canonical storage). Output is formatted for the
// caller's chosen MeasurementSystem.

import {
  convertLinear,
  convertArea,        // -> RS (string, 3dp)
  convertAreaFt2,     // -> ft² (number, 2dp)
  convertLinearRate,
  convertAreaRate,    // -> $/RS (2dp)
  convertAreaFt2Rate, // -> $/ft² (4dp)
} from './conversions';
import { normalizeMeasurementSystem } from '../types';
import type { MeasurementSystem } from '../types';

/** Format a linear measurement (stored in meters) with the right unit suffix. */
export function formatLinear(meters: number, system: MeasurementSystem): string {
  const norm = normalizeMeasurementSystem(system);
  if (norm === 'metric') return `${meters.toFixed(2)} m`;
  // Both imperial flavours use feet for linear.
  return `${convertLinear(meters)} ft`;
}

/** Format an area (stored in m²) with the right unit suffix. */
export function formatArea(sqm: number, system: MeasurementSystem): string {
  const norm = normalizeMeasurementSystem(system);
  if (norm === 'metric') return `${sqm.toFixed(2)} m²`;
  if (norm === 'imperial_ft') return `${convertAreaFt2(sqm)} ft²`;
  return `${convertArea(sqm)} RS`;
}

/** Format a linear rate ($/m canonical) with the right per-unit suffix. */
export function formatLinearRate(ratePerMeter: number, system: MeasurementSystem): string {
  const norm = normalizeMeasurementSystem(system);
  if (norm === 'metric') return `$${ratePerMeter.toFixed(2)}/m`;
  return `$${convertLinearRate(ratePerMeter)}/ft`;
}

/** Format an area rate ($/m² canonical) with the right per-unit suffix. */
export function formatAreaRate(ratePerSqm: number, system: MeasurementSystem): string {
  const norm = normalizeMeasurementSystem(system);
  if (norm === 'metric') return `$${ratePerSqm.toFixed(2)}/m²`;
  if (norm === 'imperial_ft') return `$${convertAreaFt2Rate(ratePerSqm)}/ft²`;
  return `$${convertAreaRate(ratePerSqm)}/RS`;
}

// All measurement types that exist in the DB + app, including generic-trades additions.
// area-valued: area, length_x_height, multi_lineal_lxh, irregular_area, volume
// linear-valued: lineal, multi_lineal, curved_line
// count-valued: quantity, fixed, point
type MeasurementTypeArg =
  | 'area' | 'lineal' | 'quantity' | 'fixed'         // original types
  | 'length_x_height' | 'multi_lineal_lxh'            // area-producing generics
  | 'irregular_area'                                   // area-producing generic
  | 'multi_lineal' | 'curved_line'                    // linear generics
  | 'volume'                                           // volume
  | 'point'                                            // count
  | string;                                            // forward-compat escape hatch

/** Get just the unit label (no value) for a given measurement type + system. */
export function getUnitLabel(
  measurementType: MeasurementTypeArg,
  system: MeasurementSystem
): string {
  const norm = normalizeMeasurementSystem(system);

  // Area-valued types (store m², display as area)
  if (
    measurementType === 'area' ||
    measurementType === 'length_x_height' ||
    measurementType === 'multi_lineal_lxh' ||
    measurementType === 'irregular_area'
  ) {
    if (norm === 'metric') return 'm²';
    if (norm === 'imperial_ft') return 'ft²';
    return 'RS';
  }

  // Linear-valued types (store m, display as length)
  if (
    measurementType === 'lineal' ||
    measurementType === 'multi_lineal' ||
    measurementType === 'curved_line'
  ) {
    return norm === 'metric' ? 'm' : 'ft';
  }

  // Volume
  if (measurementType === 'volume') {
    return norm === 'metric' ? 'm³' : 'ft³';
  }

  // Count / fixed / point
  if (measurementType === 'quantity' || measurementType === 'point') return 'each';

  return '';
}

/** Human-friendly label for the system itself (used in selectors / settings). */
export function describeMeasurementSystem(system: MeasurementSystem): string {
  const norm = normalizeMeasurementSystem(system);
  if (norm === 'metric') return 'Metric (m, m²)';
  if (norm === 'imperial_ft') return 'Imperial - feet & ft²';
  return 'Imperial - feet & Roofing Squares';
}

/** Short label, e.g. for the convert button. */
export function shortMeasurementSystemLabel(system: MeasurementSystem): string {
  const norm = normalizeMeasurementSystem(system);
  if (norm === 'metric') return 'Metric';
  if (norm === 'imperial_ft') return 'Imperial (ft²)';
  return 'Imperial (RS)';
}
