/**
 * Roof Pitch Estimator - pure geometry engine.
 *
 * Estimates roof pitch from user-clicked points on an image (photo of the
 * roof elevation). Client-side only, no calibration: all measurements come
 * from the same image so pixel units cancel out.
 *
 * Modes:
 *  - single plane: eave point + ridge point -> atan(rise/run)
 *  - two plane: left eave + ridge + right eave -> angle of each roof plane
 *    relative to the eave-to-eave baseline; average only when consistent.
 *
 * Intended for remote ESTIMATING, not survey-grade measurement. Never
 * publish a fixed accuracy claim (see build brief).
 */

export interface Pt {
  x: number;
  y: number;
}

/** Rotation angle (radians) of the line a->b relative to horizontal. */
export function levelAngleRad(a: Pt, b: Pt): number {
  return Math.atan2(b.y - a.y, b.x - a.x);
}

/** Degrees for display. */
export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Single-plane pitch in degrees from an eave (low) point and ridge (high) point. */
export function singlePlanePitch(eave: Pt, ridge: Pt): number {
  const run = Math.abs(ridge.x - eave.x);
  const rise = Math.abs(ridge.y - eave.y);
  if (run < 1 || rise < 1) return 0;
  return radToDeg(Math.atan2(rise, run));
}

export interface TwoPlaneResult {
  leftDeg: number;
  rightDeg: number;
  diffDeg: number;
  /** Average of both planes - only meaningful when `consistent`. */
  avgDeg: number;
  /** True when both planes agree closely enough to trust the average. */
  consistent: boolean;
}

/**
 * Two-plane pitch: angle of each roof plane relative to the eave-to-eave
 * baseline. If the camera was square-on, both angles approximate the true
 * pitch. Large divergence = different pitches and/or perspective distortion.
 */
export function twoPlanePitch(leftEave: Pt, ridge: Pt, rightEave: Pt): TwoPlaneResult {
  const baseline = levelAngleRad(leftEave, rightEave);
  // Left plane: direction eave -> ridge, measured above the baseline.
  const leftVec = Math.atan2(ridge.y - leftEave.y, ridge.x - leftEave.x);
  let leftDeg = Math.abs(radToDeg(leftVec - baseline));
  // Right plane: direction ridge -> right eave, measured above the baseline.
  const rightVec = Math.atan2(rightEave.y - ridge.y, rightEave.x - ridge.x);
  let rightDeg = Math.abs(radToDeg(rightVec - baseline));
  // Normalise into a sane pitch range (0-80); reflections wrap near 180.
  leftDeg = normaliseAngle(leftDeg);
  rightDeg = normaliseAngle(rightDeg);
  const diffDeg = Math.abs(leftDeg - rightDeg);
  const avgDeg = (leftDeg + rightDeg) / 2;
  // 4 degrees of divergence is the "check your image" threshold.
  const consistent = diffDeg <= 4;
  return { leftDeg, rightDeg, diffDeg, avgDeg, consistent };
}

function normaliseAngle(deg: number): number {
  let d = deg;
  if (d > 90) d = 180 - d; // mirror
  return Math.min(Math.max(d, 0), 80);
}

/** Common UK-style roof pitches (degrees) used for the "closest" hint. */
export const COMMON_PITCHES_DEG = [
  10, 12.5, 15, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35, 37.5, 40, 45, 47.5, 50,
];

/** Closest common pitch to `deg`, plus its 1:X ratio form. */
export function closestCommonPitch(deg: number): { deg: number; ratio: string } {
  let best = COMMON_PITCHES_DEG[0];
  for (const p of COMMON_PITCHES_DEG) {
    if (Math.abs(p - deg) < Math.abs(best - deg)) best = p;
  }
  // Ratio 1:X (rise:run). E.g. 26.57deg = 1:2 (6:12).
  const x = 1 / Math.tan((best * Math.PI) / 180);
  const ratio = `1:${x.toFixed(x < 10 ? 2 : 1).replace(/\.?0+$/, '')}`;
  return { deg: best, ratio };
}
