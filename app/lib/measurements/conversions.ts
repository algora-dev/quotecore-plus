// Conversion utilities for metric / imperial measurement systems.
// All database values are stored in METRIC (m, m²) as the canonical form.
//
// Imperial comes in two area flavours users can pick from:
//   - Square Feet (ft²)         used by US roofers
//   - Roofing Squares (RS)      used by NZ/AU/UK roofers; 1 RS = 100 ft² = 9.2903 m²
// Linear is always in feet for both Imperial flavours.

import type { MeasurementSystem } from '../types';
import { normalizeMeasurementSystem } from '../types';

// -- Conversion constants ----------------------------------------------------
const M_TO_FT = 3.28084;
const SQM_TO_FT2 = 10.7639;
const SQM_TO_RS = 0.107639; // 1 m² = 0.107639 RS  (= 1/9.2903)

// -- Linear (m -> ft) --------------------------------------------------------

/** Display a linear measurement (stored in meters) in feet, 2dp. */
export function convertLinear(meters: number): number {
  return Number((meters * M_TO_FT).toFixed(2));
}

/** Convert a linear rate ($/m -> $/ft), 2dp. */
export function convertLinearRate(ratePerMeter: number): number {
  return Number((ratePerMeter / M_TO_FT).toFixed(2));
}

/** Customer typed feet, store as meters. */
export function convertLinearToMetric(feet: number): number {
  return feet / M_TO_FT;
}

// -- Area (m² -> ft²) --------------------------------------------------------

/** Display an area (stored in m²) in square feet, 2dp. */
export function convertAreaFt2(sqm: number): number {
  return Number((sqm * SQM_TO_FT2).toFixed(2));
}

/** Convert an area rate ($/m² -> $/ft²), 4dp (rates can be small per ft²). */
export function convertAreaFt2Rate(ratePerSqm: number): number {
  return Number((ratePerSqm / SQM_TO_FT2).toFixed(4));
}

/** Customer typed ft², store as m². */
export function convertAreaFt2ToMetric(ft2: number): number {
  return ft2 / SQM_TO_FT2;
}

// -- Area (m² -> Roofing Squares) --------------------------------------------

/** Display an area (stored in m²) in Roofing Squares, 3dp. Returned as string for backwards compat. */
export function convertArea(sqm: number): string {
  return (sqm * SQM_TO_RS).toFixed(3);
}

/** Numeric variant of convertArea for callers that want to keep doing math. */
export function convertAreaRs(sqm: number): number {
  return Number((sqm * SQM_TO_RS).toFixed(3));
}

/** Convert an area rate ($/m² -> $/RS), 2dp. */
export function convertAreaRate(ratePerSqm: number): number {
  return Number((ratePerSqm / SQM_TO_RS).toFixed(2));
}

/** Customer typed RS, store as m². */
export function convertAreaToMetric(roofingSquares: number): number {
  return roofingSquares / SQM_TO_RS;
}

// -- Polymorphic helpers (recommended for new call sites) --------------------

/**
 * Convert a linear value typed by the user (in their measurement system) into
 * canonical metric storage (meters).
 */
export function linearInputToMetric(input: number, system: MeasurementSystem): number {
  const norm = normalizeMeasurementSystem(system);
  if (norm === 'metric') return input;
  return convertLinearToMetric(input);
}

/**
 * Convert an area value typed by the user (in their measurement system) into
 * canonical metric storage (m²). Handles ft² vs Roofing Squares.
 */
export function areaInputToMetric(input: number, system: MeasurementSystem): number {
  const norm = normalizeMeasurementSystem(system);
  if (norm === 'metric') return input;
  if (norm === 'imperial_ft') return convertAreaFt2ToMetric(input);
  return convertAreaToMetric(input); // imperial_rs
}
