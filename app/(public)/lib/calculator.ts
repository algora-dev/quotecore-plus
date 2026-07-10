/**
 * Shared calculator math functions for free public tools.
 *
 * Reuses pitch/area functions from `app/lib/pricing/engine.ts` where possible.
 * Used by /free-roofing-calculator and future industry-specific calculators.
 */

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

// ─── Pitch ───────────────────────────────────────────

/** Convert pitch degrees to a ratio (e.g. 25° → { x: 1, y: 2.144 }) */
export function degreesToRatio(degrees: number): { x: number; y: number } {
  if (!degrees || degrees <= 0) return { x: 0, y: 0 };
  return { x: 1, y: 1 / Math.tan(degrees * RAD) };
}

/** Convert a ratio (1:y) to pitch degrees */
export function ratioToDegrees(x: number, y: number): number {
  if (!x || x <= 0 || !y || y <= 0) return 0;
  return Math.atan(x / y) * DEG;
}

/** Common pitch quick-select values in degrees */
export const COMMON_PITCHES = [10, 15, 20, 25, 30, 35, 40, 45];

// ─── Rafter ──────────────────────────────────────────

/** Calculate rafter length from span and pitch */
export function rafterLength(span: number, pitchDegrees: number): number {
  if (!span || span <= 0) return 0;
  return (span / 2) / Math.cos((pitchDegrees || 0) * RAD);
}

// ─── Hip/Valley ──────────────────────────────────────

/** Calculate hip/valley length from span, run, and pitch */
export function hipValleyLength(span: number, run: number, pitchDegrees: number): number {
  if (!span || span <= 0 || !run || run <= 0) return 0;
  const halfSpan = span / 2;
  const pitchRad = (pitchDegrees || 0) * RAD;
  const hipAngleRad = Math.atan(Math.tan(pitchRad) * Math.cos(45 * RAD));
  const diagonal = Math.sqrt(halfSpan * halfSpan + run * run);
  return diagonal / Math.cos(hipAngleRad);
}

// ─── Area ────────────────────────────────────────────

export function rectangleArea(width: number, length: number): number {
  return (width || 0) * (length || 0);
}

export function triangleArea(base: number, height: number): number {
  return ((base || 0) * (height || 0)) / 2;
}

export function trapezoidArea(sideA: number, sideB: number, height: number): number {
  return (((sideA || 0) + (sideB || 0)) / 2) * (height || 0);
}

export function circleArea(radius: number): number {
  return Math.PI * (radius || 0) * (radius || 0);
}

// ─── Volume ──────────────────────────────────────────

export function volumeFromAreaDepth(area: number, depth: number): number {
  return (area || 0) * (depth || 0);
}

export function volumeFromDimensions(width: number, length: number, depth: number): number {
  return (width || 0) * (length || 0) * (depth || 0);
}

export function materialWeight(volume: number, densityKgPerM3: number): number {
  return (volume || 0) * (densityKgPerM3 || 0);
}

export const MATERIAL_DENSITIES: Record<string, number> = {
  Concrete: 2400,
  'Wet concrete': 2400,
  'Dry concrete': 2200,
  Gravel: 1800,
  Sand: 1600,
  Topsoil: 1400,
  Asphalt: 2300,
  'Crushed stone': 1600,
};

// ─── Trigonometry ────────────────────────────────────

export interface TriangleSolution {
  a?: number;
  b?: number;
  c?: number;
  angleA?: number;
  angleB?: number;
  angleC?: number;
  error?: string;
}

export function solveRightTriangle(input: {
  a?: number; b?: number; c?: number; angleA?: number; angleB?: number;
}): TriangleSolution {
  let { a, b, c, angleA, angleB } = input;

  if (angleA != null && angleA > 0) { angleB = 90 - angleA; }
  else if (angleB != null && angleB > 0) { angleA = 90 - angleB; }

  const knownSides = [a, b, c].filter((s) => s != null && s > 0).length;
  const knownAngles = [angleA, angleB].filter((an) => an != null && an > 0).length;

  if (knownSides + knownAngles < 2) {
    return { error: 'Enter at least 2 known values (sides or 1 side + 1 angle).' };
  }

  if (a != null && b != null && a > 0 && b > 0) {
    c = Math.sqrt(a * a + b * b);
    angleA = Math.atan(a / b) * DEG; angleB = 90 - angleA;
  } else if (a != null && c != null && a > 0 && c > 0 && c > a) {
    b = Math.sqrt(c * c - a * a);
    angleA = Math.asin(a / c) * DEG; angleB = 90 - angleA;
  } else if (b != null && c != null && b > 0 && c > 0 && c > b) {
    a = Math.sqrt(c * c - b * b);
    angleA = Math.acos(b / c) * DEG; angleB = 90 - angleA;
  } else if (c != null && angleA != null && c > 0 && angleA > 0) {
    a = c * Math.sin(angleA * RAD); b = c * Math.cos(angleA * RAD); angleB = 90 - angleA;
  } else if (c != null && angleB != null && c > 0 && angleB > 0) {
    a = c * Math.cos(angleB * RAD); b = c * Math.sin(angleB * RAD); angleA = 90 - angleB;
  } else if (a != null && angleA != null && a > 0 && angleA > 0) {
    b = a / Math.tan(angleA * RAD); c = a / Math.sin(angleA * RAD); angleB = 90 - angleA;
  } else if (b != null && angleB != null && b > 0 && angleB > 0) {
    a = b / Math.tan(angleB * RAD); c = b / Math.sin(angleB * RAD); angleA = 90 - angleB;
  } else if (a != null && angleB != null && a > 0 && angleB > 0) {
    b = a * Math.tan(angleB * RAD); c = a / Math.cos(angleB * RAD); angleA = 90 - angleB;
  } else if (b != null && angleA != null && b > 0 && angleA > 0) {
    a = b * Math.tan(angleA * RAD); c = b / Math.cos(angleA * RAD); angleB = 90 - angleA;
  } else {
    return { error: 'Could not solve with the given values. Check your inputs.' };
  }

  const round = (n?: number) => (n != null ? Math.round(n * 1000) / 1000 : undefined);
  return { a: round(a), b: round(b), c: round(c), angleA: round(angleA), angleB: round(angleB), angleC: 90 };
}

// ─── Material Estimator ──────────────────────────────

export interface MaterialEstimate {
  quantity: number;
  unit: string;
  wastePercent: number;
  rawArea: number;
  areaWithWaste: number;
  costEstimate?: number;
}

export function estimateMaterial(
  area: number,
  coveragePerUnit: number,
  unitName: string,
  wastePercent: number = 10,
  pricePerUnit?: number,
): MaterialEstimate {
  const rawArea = area || 0;
  const areaWithWaste = rawArea * (1 + wastePercent / 100);
  const quantity = coveragePerUnit > 0 ? areaWithWaste / coveragePerUnit : 0;
  const costEstimate = pricePerUnit != null && pricePerUnit > 0 ? quantity * pricePerUnit : undefined;

  return {
    quantity: Math.round(quantity * 100) / 100,
    unit: unitName,
    wastePercent,
    rawArea,
    areaWithWaste,
    costEstimate,
  };
}

// Roofing-specific materials (coverage per m² of roof area)
export const ROOFING_MATERIALS: Record<string, { coverage: number; unit: string }> = {
  'Concrete tiles': { coverage: 0.1, unit: 'tiles' },
  'Clay tiles': { coverage: 0.12, unit: 'tiles' },
  'Metal roofing sheets': { coverage: 0.5, unit: 'sheets' },
  'Asphalt shingles': { coverage: 0.33, unit: 'bundles' },
  'Membrane (rolls)': { coverage: 10, unit: 'rolls' },
  'Corrugated iron': { coverage: 0.77, unit: 'sheets' },
};

// General construction materials
export const MATERIAL_COVERAGES: Record<string, { coverage: number; unit: string }> = {
  ...ROOFING_MATERIALS,
};

// ─── Unit Conversion ─────────────────────────────────

export type UnitSystem = 'metric' | 'imperial';

export function convertLength(value: number, from: UnitSystem, to: UnitSystem): number {
  if (from === to) return value;
  return from === 'metric' ? value * 3.28084 : value / 3.28084;
}

export function convertArea(value: number, from: UnitSystem, to: UnitSystem): number {
  if (from === to) return value;
  return from === 'metric' ? value * 10.7639 : value / 10.7639;
}

export function convertVolume(value: number, from: UnitSystem, to: UnitSystem): number {
  if (from === to) return value;
  return from === 'metric' ? value * 35.3147 : value / 35.3147;
}

export function lengthUnit(system: UnitSystem): string {
  return system === 'metric' ? 'm' : 'ft';
}

export function areaUnit(system: UnitSystem): string {
  return system === 'metric' ? 'm²' : 'ft²';
}

export function volumeUnit(system: UnitSystem): string {
  return system === 'metric' ? 'm³' : 'ft³';
}

// ─── Pitch factor re-exports (from engine.ts) ────────

export { rafterPitchFactor, hipValleyPitchFactor, pitchFactor } from '@/app/lib/pricing/engine';
