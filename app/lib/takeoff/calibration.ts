// Deterministic calibration maths (spec section 9).
// scale semantics match the existing workstation: real working units per scene pixel.
// Single implementation for manual, AI and recomputation consumers.
import type { DistanceUnit, EffectiveCalibration, Point, WorkingUnit } from './calibrationTypes';
import { convertToWorkingUnit, METERS_PER_FOOT } from './calibrationCandidates';
import { distance } from './calibrationCoordinates';

export const DISAGREEMENT_WARNING_THRESHOLD_PCT = 10;
export const AGGREGATION_POLICY = 'mean-distance-per-scene-pixel-v1' as const;
export const MAX_ACCEPTED_REFERENCES = 3;

export interface CalibrationReferenceInput {
  id: string;
  sceneP1: Point;
  sceneP2: Point;
  confirmedDistance: number;
  confirmedUnit: DistanceUnit;
}

export interface ComputeOptions {
  disagreementThresholdPct?: number;
}

function validateReference(ref: CalibrationReferenceInput, index: number): void {
  if (typeof ref.id !== 'string' || ref.id.length === 0) {
    throw new Error(`reference ${index}: missing id`);
  }
  const coords = [ref.sceneP1.x, ref.sceneP1.y, ref.sceneP2.x, ref.sceneP2.y];
  if (!coords.every(Number.isFinite)) {
    throw new Error(`reference ${ref.id}: non-finite scene endpoints`);
  }
  if (!Number.isFinite(ref.confirmedDistance) || ref.confirmedDistance <= 0) {
    throw new Error(`reference ${ref.id}: distance must be a positive finite number`);
  }
  if (distance(ref.sceneP1, ref.sceneP2) <= 0) {
    throw new Error(`reference ${ref.id}: zero scene pixel span`);
  }
}

/**
 * Arithmetic MEAN of per-reference ratios D_i/P_i (real working units per scene pixel).
 * NOT sum(distances)/sum(pixels) and NOT 1/mean(pixelsPerUnit). Every distance is
 * converted to workingUnit before averaging. Malformed references are rejected, never
 * silently omitted. 1 <= n <= 3.
 */
export function computeEffectiveCalibration(
  references: readonly CalibrationReferenceInput[],
  workingUnit: WorkingUnit,
  options: ComputeOptions = {},
): EffectiveCalibration {
  if (!Array.isArray(references) || references.length === 0) {
    throw new Error('computeEffectiveCalibration: at least one accepted reference is required');
  }
  if (references.length > MAX_ACCEPTED_REFERENCES) {
    throw new Error(
      `computeEffectiveCalibration: at most ${MAX_ACCEPTED_REFERENCES} references, got ${references.length}`,
    );
  }
  references.forEach(validateReference);

  const scales = references.map((ref) => {
    const d = convertToWorkingUnit(ref.confirmedDistance, ref.confirmedUnit, workingUnit);
    const p = distance(ref.sceneP1, ref.sceneP2);
    return d / p;
  });

  const mean = scales.reduce((sum, s) => sum + s, 0) / scales.length;
  if (!Number.isFinite(mean) || mean <= 0) {
    throw new Error('computeEffectiveCalibration: non-finite or non-positive mean scale');
  }

  const max = Math.max(...scales);
  const min = Math.min(...scales);
  const scaleRangePct = (100 * (max - min)) / mean;

  const threshold = options.disagreementThresholdPct ?? DISAGREEMENT_WARNING_THRESHOLD_PCT;
  const disagreementWarning = scaleRangePct > threshold
    ? `Accepted references disagree by ${scaleRangePct.toFixed(2)}% (threshold ${threshold}%); ` +
      'review or remove a reference, or acknowledge using this average'
    : null;

  return {
    scale: mean,
    unit: workingUnit,
    aggregationPolicy: AGGREGATION_POLICY,
    contributingCalibrationIds: references.map((r) => r.id),
    validCalibrationCount: scales.length,
    scaleRangePct,
    disagreementWarning,
  };
}

/** Measured line length = pixel line length x S_effective (working units). */
export function calibratedLength(pixelLength: number, scale: number): number {
  if (!Number.isFinite(pixelLength) || pixelLength < 0) {
    throw new Error(`calibratedLength: invalid pixel length ${pixelLength}`);
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error(`calibratedLength: invalid scale ${scale}`);
  }
  return pixelLength * scale;
}

/** Measured polygon area = pixel polygon area x S_effective^2 (area uses scale squared). */
export function calibratedArea(pixelArea: number, scale: number): number {
  if (!Number.isFinite(pixelArea) || pixelArea < 0) {
    throw new Error(`calibratedArea: invalid pixel area ${pixelArea}`);
  }
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error(`calibratedArea: invalid scale ${scale}`);
  }
  return pixelArea * scale * scale;
}

/** Convenience: convert a scale between working units (e.g. 0.03048 m/px -> 0.1 ft/px). */
export function convertScale(scale: number, from: WorkingUnit, to: WorkingUnit): number {
  if (from === to) return scale;
  return from === 'meters' ? scale / METERS_PER_FOOT : scale * METERS_PER_FOOT;
}

/** Shape of the workstation's stored per-page Calibration rows (TW lines ~188-198). */
export interface LegacyCalibrationLike {
  id: string;
  point1: Point;
  point2: Point;
  unit: 'feet' | 'meters';
  actualDistance?: number;
  pixelDistance?: number;
  scale?: number;
}

/**
 * Effective scale for legacy per-page Calibration records via the SAME
 * unit-normalised arithmetic mean used everywhere else (P1/P3 unification).
 * Single-calibration identity: returns exactly that calibration's scale.
 * Returns 0 for an empty set (callers treat 0 as "no calibration").
 */
export function effectiveScaleFromLegacyCalibrations(
  cals: readonly LegacyCalibrationLike[],
): number {
  if (!Array.isArray(cals) || cals.length === 0) return 0;
  const workingUnit: WorkingUnit = cals[0].unit === 'meters' ? 'meters' : 'feet';
  const refs = cals.map((cal) => {
    const px =
      typeof cal.pixelDistance === 'number' && cal.pixelDistance > 0
        ? cal.pixelDistance
        : distance(cal.point1, cal.point2);
    const d =
      typeof cal.actualDistance === 'number' && cal.actualDistance > 0
        ? cal.actualDistance
        : (cal.scale ?? 0) * px;
    return {
      id: cal.id,
      sceneP1: cal.point1,
      sceneP2: cal.point2,
      confirmedDistance: d,
      confirmedUnit: (cal.unit === 'meters' ? 'm' : 'ft') as DistanceUnit,
    };
  });
  return computeEffectiveCalibration(refs, workingUnit).scale;
}
