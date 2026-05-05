// Display formatting helpers for measurements
import { convertLinear, convertArea, convertLinearRate, convertAreaRate } from './conversions';
import type { MeasurementSystem } from '../types';

/**
 * Format linear measurement with appropriate unit
 * @param meters Value in meters (canonical storage)
 * @param system Target display system
 * @returns Formatted string with unit (e.g., "10.0 m" or "32.81 ft")
 */
export function formatLinear(meters: number, system: MeasurementSystem): string {
  if (system === 'imperial') {
    return `${convertLinear(meters)} ft`;
  }
  return `${meters.toFixed(2)} m`;
}

/**
 * Format area measurement with appropriate unit
 * @param sqm Value in square meters (canonical storage)
 * @param system Target display system
 * @returns Formatted string with unit (e.g., "100.0 m²" or "1.076 Rs")
 */
export function formatArea(sqm: number, system: MeasurementSystem): string {
  if (system === 'imperial') {
    return `${convertArea(sqm)} Rs`;
  }
  return `${sqm.toFixed(2)} m²`;
}

/**
 * Format linear rate with appropriate unit
 * @param ratePerMeter Rate in $/m (canonical storage)
 * @param system Target display system
 * @returns Formatted string (e.g., "$5.00/m" or "$1.52/ft")
 */
export function formatLinearRate(ratePerMeter: number, system: MeasurementSystem): string {
  if (system === 'imperial') {
    return `$${convertLinearRate(ratePerMeter)}/ft`;
  }
  return `$${ratePerMeter.toFixed(2)}/m`;
}

/**
 * Format area rate with appropriate unit
 * @param ratePerSqm Rate in $/m² (canonical storage)
 * @param system Target display system
 * @returns Formatted string (e.g., "$15.00/m²" or "$1.61/Rs")
 */
export function formatAreaRate(ratePerSqm: number, system: MeasurementSystem): string {
  if (system === 'imperial') {
    return `$${convertAreaRate(ratePerSqm)}/Rs`;
  }
  return `$${ratePerSqm.toFixed(2)}/m²`;
}

/**
 * Get unit label for measurement type
 * @param measurementType Type of measurement
 * @param system Target display system
 * @returns Unit label (e.g., "m²", "Rs", "m", "ft")
 */
export function getUnitLabel(
  measurementType: 'area' | 'lineal' | 'quantity' | 'fixed',
  system: MeasurementSystem
): string {
  if (measurementType === 'area') {
    return system === 'imperial' ? 'Rs' : 'm²';
  }
  if (measurementType === 'lineal') {
    return system === 'imperial' ? 'ft' : 'm';
  }
  if (measurementType === 'quantity') {
    return 'each';
  }
  return '';
}
