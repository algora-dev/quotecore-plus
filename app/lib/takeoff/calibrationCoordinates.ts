// Explicit affine transforms between the source, analysis and scene coordinate spaces.
// Spec: docs/AI_ASSISTED_CALIBRATION_IMPLEMENTATION_PLAN.md sections 5.1, 5.2, 5.5.
//
// Raster convention: geometric pixel edges at integer boundaries, pixel centres at i + 0.5.
// A point is in-raster when 0 <= x <= width and 0 <= y <= height (within a documented
// floating-point tolerance). No viewport state is ever consumed here: scene coordinates are
// device-independent and viewport mapping happens only at render time.
import type { Affine2D, Point } from './calibrationTypes';

/** Longest-edge cap of the workstation reference scene (TakeoffWorkstation MAX_CANVAS_DIM). */
export const MAX_CANVAS_DIM = 2000;

/** Documented numerical tolerance for raster bounds checks and singularity detection. */
export const COORD_TOLERANCE = 1e-6;

const SINGULAR_EPS = 1e-9;

export class TransformError extends Error {}

function assertFiniteAffine(t: Affine2D, label: string): void {
  for (const v of t) {
    if (!Number.isFinite(v)) {
      throw new TransformError(`${label}: affine contains non-finite value ${v}`);
    }
  }
}

/** x' = a*x + c*y + e; y' = b*x + d*y + f. */
export function applyAffine(t: Affine2D, p: Point): Point {
  assertFiniteAffine(t, 'applyAffine');
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    throw new TransformError(`applyAffine: non-finite point (${p.x}, ${p.y})`);
  }
  return {
    x: t[0] * p.x + t[2] * p.y + t[4],
    y: t[1] * p.x + t[3] * p.y + t[5],
  };
}

/** Result(x) = outer(inner(x)). */
export function composeAffine(outer: Affine2D, inner: Affine2D): Affine2D {
  assertFiniteAffine(outer, 'composeAffine outer');
  assertFiniteAffine(inner, 'composeAffine inner');
  const [a1, b1, c1, d1, e1, f1] = outer;
  const [a2, b2, c2, d2, e2, f2] = inner;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

export function affineDeterminant(t: Affine2D): number {
  return t[0] * t[3] - t[1] * t[2];
}

export function isAffineInvertible(t: Affine2D): boolean {
  if (!t.every(Number.isFinite)) return false;
  return Math.abs(affineDeterminant(t)) > SINGULAR_EPS;
}

export function invertAffine(t: Affine2D): Affine2D {
  assertFiniteAffine(t, 'invertAffine');
  const det = affineDeterminant(t);
  if (Math.abs(det) <= SINGULAR_EPS) {
    throw new TransformError(`invertAffine: singular transform (determinant ${det})`);
  }
  const [a, b, c, d, e, f] = t;
  return [
    d / det,
    -b / det,
    -c / det,
    a / det,
    (c * f - d * e) / det,
    (b * e - a * f) / det,
  ];
}

/** Distance between p and its image after applying t then t^-1 (numerical round-trip error). */
export function roundTripError(t: Affine2D, p: Point): number {
  return distance(applyAffine(invertAffine(t), applyAffine(t, p)), p);
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Uniform source-to-scene mapping consistent with the workstation background:
 * uniform scale capping the longest edge at maxDim (default 2000), aspect preserved,
 * no stretching to rounded canvas dimensions, never enlarging.
 */
export function buildSourceToScene(
  sourceWidth: number,
  sourceHeight: number,
  maxDim: number = MAX_CANVAS_DIM,
): { transform: Affine2D; sceneWidth: number; sceneHeight: number } {
  if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) ||
      sourceWidth <= 0 || sourceHeight <= 0) {
    throw new TransformError(
      `buildSourceToScene: invalid source dimensions ${sourceWidth}x${sourceHeight}`,
    );
  }
  if (!Number.isFinite(maxDim) || maxDim <= 0) {
    throw new TransformError(`buildSourceToScene: invalid maxDim ${maxDim}`);
  }
  const longest = Math.max(sourceWidth, sourceHeight);
  const scale = longest > maxDim ? maxDim / longest : 1;
  return {
    transform: [scale, 0, 0, scale, 0, 0],
    sceneWidth: sourceWidth * scale,
    sceneHeight: sourceHeight * scale,
  };
}

/**
 * Analysis (crop raster submitted to vision) to source mapping:
 * sourceX = cropX + analysisX * cropW / inputW (same for y). Handles non-integer
 * resize ratios exactly; crop origin (0,0) and full size degenerate to identity.
 */
export function buildAnalysisToSource(
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  inputW: number,
  inputH: number,
): Affine2D {
  const nums = [cropX, cropY, cropW, cropH, inputW, inputH];
  if (nums.some((v) => !Number.isFinite(v))) {
    throw new TransformError('buildAnalysisToSource: non-finite argument');
  }
  if (cropW <= 0 || cropH <= 0 || inputW <= 0 || inputH <= 0) {
    throw new TransformError(
      `buildAnalysisToSource: non-positive size (${cropW}x${cropH} -> ${inputW}x${inputH})`,
    );
  }
  return [cropW / inputW, 0, 0, cropH / inputH, cropX, cropY];
}

export function isPointInRaster(p: Point, width: number, height: number, tolerance: number = COORD_TOLERANCE): boolean {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return false;
  return p.x >= -tolerance && p.x <= width + tolerance &&
         p.y >= -tolerance && p.y <= height + tolerance;
}

/** Rejects points outside the declared input raster instead of clamping them to a border. */
export function assertPointInRaster(p: Point, width: number, height: number, label: string): void {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
    throw new TransformError(`${label}: non-finite point (${p.x}, ${p.y})`);
  }
  if (!isPointInRaster(p, width, height)) {
    throw new TransformError(
      `${label}: point (${p.x}, ${p.y}) outside raster 0..${width} x 0..${height}`,
    );
  }
}

/**
 * Round-trip helper for the full analysis -> source -> scene chain.
 * Returns the scene point and the numerical error of inverting back to analysis coords.
 */
export function analysisPointToScene(
  analysisToSource: Affine2D,
  sourceToScene: Affine2D,
  p: Point,
): { source: Point; scene: Point; roundTripErrorPx: number } {
  const source = applyAffine(analysisToSource, p);
  const scene = applyAffine(sourceToScene, source);
  const backToAnalysis = composeAffine(
    invertAffine(analysisToSource),
    invertAffine(sourceToScene),
  );
  const roundTripErrorPx = distance(applyAffine(backToAnalysis, scene), p);
  return { source, scene, roundTripErrorPx };
}
