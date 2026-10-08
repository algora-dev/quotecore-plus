// Pure geometry helpers for the precision edit draft.
// Spec: §6.3 midpoint insertion, §6.4 deletion minimums, §8.4 validity rules,
// §17.3 tolerances. Reuses existing domain conventions (coordinate tolerance
// mirrors calibrationCoordinates COORD_TOLERANCE); keeps everything pure and
// node-testable. No simplification is ever applied here — a collinear midpoint
// inserted by the user must survive (spec §6.3/§8.4).

import type { Point } from '../calibrationTypes';
import type { ScenePoint, Vertex, ValidationIssue, EditableGeometry } from './precisionTypes';

/** Numerical tolerance for vertex distinctness, zero-edges and zero area. */
export const GEOMETRY_TOLERANCE = 1e-6;

/** Absolute tolerance for self-intersection segment tests in scene units. */
export const SELF_INTERSECTION_TOLERANCE = 1e-9;

/** Minimum vertex count for a closed outline (spec §6.4 / §8.4). */
export const MIN_CLOSED_OUTLINE_VERTICES = 3;

// ─── Stable IDs ──────────────────────────────────────────────────────────

/**
 * Stable vertex ID. Random, never coordinate-derived: coordinates mutate during
 * drags; identity must survive undo/redo. Uses the platform CSP-safe
 * crypto.randomUUID when available, falling back to a UUIDv4-shaped random id
 * (test/older-runtime path only).
 */
export function newVertexId(): string {
  const c = globalThis.crypto as Crypto | undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  // Fallback (non-crypto-quality is fine: identity only needs uniqueness).
  return 'v-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Import an existing bare point array into draft vertices with fresh stable IDs. */
export function verticesFromPoints(points: readonly ScenePoint[]): Vertex[] {
  return points.map((point) => ({ id: newVertexId(), point: { x: point.x, y: point.y } }));
}

// ─── Predicates & measures ───────────────────────────────────────────────

export function isFinitePoint(p: Point): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}

export function pointsDistinct(a: ScenePoint, b: ScenePoint, tolerance: number = GEOMETRY_TOLERANCE): boolean {
  return Math.hypot(a.x - b.x, a.y - b.y) > tolerance;
}

/** True when all vertices are pairwise distinct (beyond tolerance). */
export function verticesDistinct(vertices: readonly Vertex[]): boolean {
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (!pointsDistinct(vertices[i].point, vertices[j].point)) return false;
    }
  }
  return true;
}

/** |signed| area via the shoelace sum (always >= 0). */
export function polygonArea(vertices: readonly Vertex[]): number {
  const n = vertices.length;
  let twice = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i].point;
    const b = vertices[(i + 1) % n].point;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.abs(twice) / 2;
}

export function polygonPerimeter(vertices: readonly Vertex[], closed: boolean): number {
  let sum = 0;
  const n = vertices.length;
  const edges = closed ? n : Math.max(0, n - 1);
  for (let i = 0; i < edges; i++) {
    const a = vertices[i].point;
    const b = vertices[(i + 1) % n].point;
    sum += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return sum;
}

/** Sign of the polygon winding (+1 CCW in standard axes, -1 CW); 0 when degenerate. */
export function windingSign(vertices: readonly Vertex[]): number {
  const n = vertices.length;
  let twice = 0;
  for (let i = 0; i < n; i++) {
    const a = vertices[i].point;
    const b = vertices[(i + 1) % n].point;
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.sign(twice);
}

// ─── Self-intersection (simple polygon check) ────────────────────────────

function segmentsIntersect(
  p1: Point, p2: Point, p3: Point, p4: Point,
  tolerance: number,
): boolean {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) > SELF_INTERSECTION_TOLERANCE) {
    const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
    const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
    // Strictly interior crossings count; shared endpoints (t/u at 0/1 within
    // tolerance) are the polygon's own joints and do not count.
    const eps = tolerance;
    return t > eps && t < 1 - eps && u > eps && u < 1 - eps;
  }
  // Parallel/collinear: treat as intersecting only when overlapping over a
  // measurable length (overlapping edges invalidate the boundary per §8.4).
  const cross = (p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x;
  if (Math.abs(cross) > GEOMETRY_TOLERANCE * (1 + Math.hypot(d1x, d1y))) return false;
  // Collinear: project p3/p4 onto segment p1..p2 and test overlap.
  const len2 = d1x * d1x + d1y * d1y;
  if (len2 <= GEOMETRY_TOLERANCE * GEOMETRY_TOLERANCE) return false;
  const t3 = ((p3.x - p1.x) * d1x + (p3.y - p1.y) * d1y) / len2;
  const t4 = ((p4.x - p1.x) * d1x + (p4.y - p1.y) * d1y) / len2;
  const lo = Math.max(0, Math.min(t3, t4));
  const hi = Math.min(1, Math.max(t3, t4));
  return hi - lo > GEOMETRY_TOLERANCE;
}

/**
 * Self-intersection test for a CLOSED outline. Adjacent edges (sharing a
 * vertex) never count. Returns the first offending pair of vertex indices,
 * or null when the boundary is simple. Tolerance policy (spec §8.4): proper
 * crossings and overlapping collinear edges invalidate; exact vertex-sharing
 * at joints does not.
 */
export function findSelfIntersection(
  vertices: readonly Vertex[],
  tolerance: number = GEOMETRY_TOLERANCE,
): readonly [number, number] | null {
  const n = vertices.length;
  if (n < 4) return null; // triangle cannot self-intersect
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    for (let k = i + 1; k < n; k++) {
      const l = (k + 1) % n;
      // Skip adjacent edges (share vertex j==k or l==i).
      if (k === j || l === i) continue;
      if (segmentsIntersect(
        vertices[i].point, vertices[j].point,
        vertices[k].point, vertices[l].point,
        tolerance,
      )) {
        return [i, k];
      }
    }
  }
  return null;
}

// ─── Validation (spec §8.4 / §11) ────────────────────────────────────────

export type ValidationOptions = Readonly<{
  /** Scene raster extent for out-of-bounds warnings (spec §8.4: clamp/warn,
   *  never accept an invisible off-image point silently). */
  sceneWidth?: number;
  sceneHeight?: number;
}>;

/**
 * Validate a draft outline. Severity policy:
 *  - blocking issues must be repaired before saveEdit will produce a save plan;
 *  - warnings do not block but must be surfaced.
 * A collinear midpoint is deliberately permitted (spec §6.3/§8.4) — never an issue.
 */
export function validateOutline(
  draft: EditableGeometry,
  options: ValidationOptions = {},
): readonly ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const { vertices, closed } = draft;

  // Non-finite coordinates: hard blocking.
  const nonFinite = vertices.filter((v) => !isFinitePoint(v.point)).map((v) => v.id);
  if (nonFinite.length > 0) {
    issues.push({
      code: 'non-finite-coordinate',
      severity: 'blocking',
      message: 'A point has invalid coordinates.',
      vertexIds: nonFinite,
    });
    return issues; // nothing else is meaningful with non-finite input
  }

  // Distinct vertices / zero-length edges.
  const duplicateIds: string[] = [];
  for (let i = 0; i < vertices.length; i++) {
    for (let j = i + 1; j < vertices.length; j++) {
      if (!pointsDistinct(vertices[i].point, vertices[j].point)) {
        duplicateIds.push(vertices[i].id, vertices[j].id);
      }
    }
  }
  if (duplicateIds.length > 0) {
    issues.push({
      code: 'duplicate-vertex',
      severity: 'blocking',
      message: 'Two points occupy the same position.',
      vertexIds: [...new Set(duplicateIds)],
    });
  }

  if (closed) {
    if (vertices.length < MIN_CLOSED_OUTLINE_VERTICES) {
      issues.push({
        code: 'insufficient-vertices',
        severity: 'blocking',
        message: `An outline needs at least ${MIN_CLOSED_OUTLINE_VERTICES} points.`,
      });
    }
    if (verticesDistinct(vertices) && vertices.length >= MIN_CLOSED_OUTLINE_VERTICES) {
      const area = polygonArea(vertices);
      if (area <= GEOMETRY_TOLERANCE) {
        issues.push({
          code: 'degenerate-area',
          severity: 'blocking',
          message: 'The outline has no area.',
        });
      }
      const crossing = findSelfIntersection(vertices);
      if (crossing && area > GEOMETRY_TOLERANCE) {
        issues.push({
          code: 'self-intersection',
          severity: 'blocking',
          message: 'The outline crosses itself.',
          vertexIds: [vertices[crossing[0]].id, vertices[crossing[1]].id],
        });
      }
    }
  } else if (vertices.length > 0 && vertices.length < MIN_CLOSED_OUTLINE_VERTICES) {
    // Open creation path: not an error, but the outline is not yet closeable.
    issues.push({
      code: 'outline-open',
      severity: 'blocking',
      message: 'Place more points before closing the outline.',
    });
  }

  // Out-of-raster warning (spec §8.4 + calibrationCoordinates.isPointInRaster
  // convention: pixel edges at integer boundaries, documented tolerance).
  if (options.sceneWidth != null && options.sceneHeight != null) {
    const out = vertices.filter(
      (v) => v.point.x < -GEOMETRY_TOLERANCE || v.point.y < -GEOMETRY_TOLERANCE ||
             v.point.x > options.sceneWidth! + GEOMETRY_TOLERANCE ||
             v.point.y > options.sceneHeight! + GEOMETRY_TOLERANCE,
    );
    if (out.length > 0) {
      issues.push({
        code: 'vertex-out-of-raster',
        severity: 'warning',
        message: 'A point lies outside the plan image.',
        vertexIds: out.map((v) => v.id),
      });
    }
  }

  return issues;
}

export function hasBlockingIssue(issues: readonly ValidationIssue[]): boolean {
  return issues.some((i) => i.severity === 'blocking');
}

// ─── Remote-drag delta helper (spec §5.2 / §17.4 E) ──────────────────────

/**
 * Convert a client-CSS-pixel drag delta into a scene delta using ONLY the
 * linear part of the inverse scene->client affine. Never apply the inverse's
 * translation to a delta, and never map the finger position itself.
 */
export function sceneDeltaFromClientDelta(
  inverseSceneToClient: readonly number[],
  deltaClient: Readonly<{ x: number; y: number }>,
): ScenePoint {
  const [a, b, c, d] = inverseSceneToClient;
  return { x: a * deltaClient.x + c * deltaClient.y, y: b * deltaClient.x + d * deltaClient.y };
}
