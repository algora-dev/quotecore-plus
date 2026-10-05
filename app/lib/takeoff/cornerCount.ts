/**
 * Corner counting for roof outlines (owner request 2026-09-30).
 *
 * Roof outlines are polygons whose vertices ARE the corners. Each vertex's
 * turn direction, compared against the polygon's winding, classifies it:
 *   - turn matches winding -> convex  -> EXTERNAL corner (cap / extra fit)
 *   - turn opposes winding -> concave -> INTERNAL corner (extra cutting)
 * Vertices whose turn deviates less than a small angle threshold from
 * straight-through are ignored so AI-scan and hand-drawn near-collinear
 * noise never inflates counts.
 *
 * Counts ride the existing point/quantity entry flow: value = count,
 * points = the counted vertex positions (so the plan can highlight them),
 * provenance on entryInputs (value_basis 'corner_all' | 'corner_external'
 * | 'corner_internal' + corner_count). Point rows are scale-independent -
 * calibration recompute skips them by design.
 */

export interface CornerPoint {
  x: number;
  y: number;
}

/** Which corner set a count-based component consumes. */
export type CornerBasis = 'all' | 'external' | 'internal';

/** Persisted on entryInputs.value_basis for corner-derived point entries. */
export type CornerValueBasis = 'corner_all' | 'corner_external' | 'corner_internal';

export function cornerValueBasis(basis: CornerBasis): CornerValueBasis {
  return `corner_${basis}` as CornerValueBasis;
}

export function isCornerValueBasis(value: unknown): value is CornerValueBasis {
  return value === 'corner_all' || value === 'corner_external' || value === 'corner_internal';
}

export function cornerBasisFromValueBasis(value: CornerValueBasis): CornerBasis {
  return value.slice('corner_'.length) as CornerBasis;
}

export interface CornerClassification {
  /** Convex vertices (external corners) in polygon order. */
  externalPoints: CornerPoint[];
  /** Concave vertices (internal corners) in polygon order. */
  internalPoints: CornerPoint[];
  externalCount: number;
  internalCount: number;
  totalCount: number;
}

/** Vertices deviating less than this from straight are noise, not corners. */
const DEFAULT_MIN_TURN_DEGREES = 10;

const emptyClassification = (): CornerClassification => ({
  externalPoints: [],
  internalPoints: [],
  externalCount: 0,
  internalCount: 0,
  totalCount: 0,
});

/**
 * Classify one polygon's corners. Robust to winding direction (CW/CCW) and
 * y-down image coordinates via the signed-area winding-sign approach
 * (mirrors outlineGeometry.classifyOutlineVertices, which stays scan-side).
 *
 * Degenerate input (< 3 finite points, zero area) returns all-zero counts -
 * readout callers render "no corners", never a math error.
 */
export function classifyOutlineCorners(
  points: ReadonlyArray<CornerPoint | { x: number; y: number }> | null | undefined,
  opts?: { minTurnDegrees?: number },
): CornerClassification {
  if (!Array.isArray(points) || points.length < 3) return emptyClassification();
  const clean = points.filter(
    (p): p is CornerPoint => !!p && Number.isFinite(p.x) && Number.isFinite(p.y),
  );
  if (clean.length < 3) return emptyClassification();

  const n = clean.length;
  let signedAreaTwice = 0;
  for (let i = 0; i < n; i++) {
    const cur = clean[i];
    const next = clean[(i + 1) % n];
    signedAreaTwice += cur.x * next.y - next.x * cur.y;
  }
  if (!Number.isFinite(signedAreaTwice) || signedAreaTwice === 0) return emptyClassification();
  const winding = Math.sign(signedAreaTwice);

  const minTurnRad =
    ((opts?.minTurnDegrees ?? DEFAULT_MIN_TURN_DEGREES) * Math.PI) / 180;

  const externalPoints: CornerPoint[] = [];
  const internalPoints: CornerPoint[] = [];
  for (let i = 0; i < n; i++) {
    const prev = clean[(i - 1 + n) % n];
    const cur = clean[i];
    const next = clean[(i + 1) % n];

    // Incoming travel vector: previous -> current.
    const inX = cur.x - prev.x;
    const inY = cur.y - prev.y;
    // Outgoing travel vector: current -> next.
    const outX = next.x - cur.x;
    const outY = next.y - cur.y;

    const cross = inX * outY - inY * outX;
    if (cross === 0) continue;

    // Turn magnitude: angle between the two travel directions
    // (0 = straight through, pi/2 = right-angle corner, pi = spike).
    const turn = Math.atan2(Math.abs(cross), inX * outX + inY * outY);
    if (turn < minTurnRad) continue;

    if (Math.sign(cross) === winding) {
      externalPoints.push({ x: cur.x, y: cur.y });
    } else {
      internalPoints.push({ x: cur.x, y: cur.y });
    }
  }

  return {
    externalPoints,
    internalPoints,
    externalCount: externalPoints.length,
    internalCount: internalPoints.length,
    totalCount: externalPoints.length + internalPoints.length,
  };
}

/** Aggregate corners across outlines (v1: whole-quote totals). */
export function cornerTotalsAcross(
  outlines: ReadonlyArray<{ points?: ReadonlyArray<CornerPoint | { x: number; y: number }> | null } | null>,
  opts?: { minTurnDegrees?: number },
): CornerClassification {
  const externalPoints: CornerPoint[] = [];
  const internalPoints: CornerPoint[] = [];
  for (const o of outlines) {
    if (!o || !Array.isArray(o.points) || o.points.length < 3) continue;
    const c = classifyOutlineCorners(o.points, opts);
    externalPoints.push(...c.externalPoints);
    internalPoints.push(...c.internalPoints);
  }
  return {
    externalPoints,
    internalPoints,
    externalCount: externalPoints.length,
    internalCount: internalPoints.length,
    totalCount: externalPoints.length + internalPoints.length,
  };
}

/** Count + marker points for a chosen basis (what the dropdown applies). */
export function cornerSelection(
  totals: CornerClassification,
  basis: CornerBasis,
): { count: number; points: CornerPoint[] } {
  if (basis === 'external') {
    return { count: totals.externalCount, points: [...totals.externalPoints] };
  }
  if (basis === 'internal') {
    return { count: totals.internalCount, points: [...totals.internalPoints] };
  }
  return {
    count: totals.totalCount,
    points: [...totals.externalPoints, ...totals.internalPoints],
  };
}
