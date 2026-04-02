// Conversion utilities for imperial/metric measurement systems
// All database values stored in METRIC (canonical form)

// Conversion constants
const M_TO_FT = 3.28084;
const SQM_TO_RS = 0.107639; // 1 m² = 0.107639 roofing squares

/**
 * Convert linear measurement from metric to imperial
 * @param meters Value in meters
 * @returns Value in feet (2 decimal precision)
 */
export function convertLinear(meters: number): number {
  return Number((meters * M_TO_FT).toFixed(2));
}

/**
 * Convert area measurement from metric to imperial
 * @param sqm Value in square meters
 * @returns Value in roofing squares (3 decimal precision, formatted as string)
 */
export function convertArea(sqm: number): string {
  return (sqm * SQM_TO_RS).toFixed(3);
}

/**
 * Convert linear rate from metric to imperial
 * @param ratePerMeter Rate in $/m
 * @returns Rate in $/ft (2 decimal precision)
 */
export function convertLinearRate(ratePerMeter: number): number {
  return Number((ratePerMeter / M_TO_FT).toFixed(2));
}

/**
 * Convert area rate from metric to imperial
 * @param ratePerSqm Rate in $/m²
 * @returns Rate in $/Rs (2 decimal precision)
 */
export function convertAreaRate(ratePerSqm: number): number {
  return Number((ratePerSqm / SQM_TO_RS).toFixed(2));
}

/**
 * Convert user input FROM imperial TO metric for storage
 * @param feet Value in feet
 * @returns Value in meters
 */
export function convertLinearToMetric(feet: number): number {
  return feet / M_TO_FT;
}

/**
 * Convert user input FROM imperial TO metric for storage
 * @param roofingSquares Value in roofing squares
 * @returns Value in square meters
 */
export function convertAreaToMetric(roofingSquares: number): number {
  return roofingSquares / SQM_TO_RS;
}
