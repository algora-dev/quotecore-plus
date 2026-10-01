/** Review tolerances are NOT cutting tolerances. Coordinates are never rounded,
 * rotated or projected into an ideal roof by these checks. Small discrepancies
 * stay measurable/visible; actual stock/containment maths stays unchanged. */
import { directionApproved } from './directions';
import type { Issue, Point, Ring, RoofEdge, RoofFace, RoofInput } from './types';
import { EPS, cross, distance, dot, projection, signedArea, sub, unit } from './math';

export const REVIEW_LIMITS = Object.freeze({
  exactAngleDeg: 1.5,
  maxAngleDeviationDeg: 7.5,
  maxDraftingWidthMm: 15,
  maxTotalDraftingAreaMm2: 50_000, // 0.05 m² across ALL coverage discrepancies
  maxRoofAreaFraction: 0.0005,    // also at most 0.05% of the reviewed plan area
  narrowFaceWidthMm: 100,
});

export function drawingToleranceMm(roof: RoofInput): number {
  if (!roof.calibrationConfirmed || !Number.isFinite(roof.mmPerSceneUnit) || roof.mmPerSceneUnit <= 0) return 0;
  // One source scene unit, bounded in physical units; independent of zoom/pan.
  return Math.min(REVIEW_LIMITS.maxDraftingWidthMm, Math.max(1, roof.mmPerSceneUnit));
}

/** Minimum width of the convex hull, not screen-axis bounds or area/perimeter.
 * This makes narrow-region detection invariant under whole-plan rotation. */
export function minimumWidth(points: Point[]): number {
  const sorted = points.map(p => ({ ...p })).sort((a, b) => a.x - b.x || a.y - b.y);
  const unique = sorted.filter((p, i) => !i || distance(p, sorted[i - 1]) > EPS);
  if (unique.length < 3) return 0;
  const half = (ps: Point[]): Point[] => {
    const out: Point[] = [];
    for (const p of ps) {
      while (out.length > 1 && cross(sub(out[out.length - 1], out[out.length - 2]), sub(p, out[out.length - 1])) <= EPS) out.pop();
      out.push(p);
    }
    return out;
  };
  const hull = [...half(unique).slice(0, -1), ...half([...unique].reverse()).slice(0, -1)];
  let width = Infinity;
  for (let i = 0; i < hull.length; i++) {
    const d = sub(hull[(i + 1) % hull.length], hull[i]);
    if (Math.hypot(d.x, d.y) < EPS) continue;
    const n = unit({ x: -d.y, y: d.x });
    const projections = hull.map(p => dot(sub(p, hull[i]), n));
    width = Math.min(width, Math.max(...projections) - Math.min(...projections));
  }
  return Number.isFinite(width) ? width : 0;
}
export function narrowFace(face: RoofFace, roof: RoofInput): boolean {
  return Number.isFinite(roof.mmPerSceneUnit) && roof.mmPerSceneUnit > 0 &&
    minimumWidth(face.polygon) * roof.mmPerSceneUnit < REVIEW_LIMITS.narrowFaceWidthMm;
}

/** Recover semantic boundary fragments after vertex/split/join edits. Interior
 * measurement lines and stale non-boundary edges cannot constrain a face's flow.
 * This derives labels only: it never changes the reviewed polygon. */
export function boundaryForPolygon(polygon: Ring, edges: RoofEdge[], toleranceScene = 1e-4): RoofEdge[] {
  const result: RoofEdge[] = [];
  const ordered = signedArea(polygon) > 0 ? polygon : [...polygon].reverse();
  for (let i = 0; i < ordered.length; i++) {
    const a = ordered[i], b = ordered[(i + 1) % ordered.length], d = sub(b, a), len = Math.hypot(d.x, d.y);
    if (len < EPS) continue;
    for (const edge of edges) {
      if (edge.kind === 'unknown' || distance(edge.a, edge.b) < EPS) continue;
      const along = unit(d), normal = { x: -along.y, y: along.x };
      // A boundary may cover only PART of a longer classified measurement.
      const edgeDirection = unit(sub(edge.b, edge.a));
      if (Math.abs(dot(along, edgeDirection)) < Math.cos(REVIEW_LIMITS.maxAngleDeviationDeg * Math.PI / 180)) continue;
      const lo = Math.max(0, Math.min(dot(sub(edge.a, a), along), dot(sub(edge.b, a), along)));
      const hi = Math.min(len, Math.max(dot(sub(edge.a, a), along), dot(sub(edge.b, a), along)));
      if (hi - lo <= EPS) continue;
      const p = { x: a.x + along.x * lo, y: a.y + along.y * lo };
      const q = { x: a.x + along.x * hi, y: a.y + along.y * hi };
      if (projection(p, edge.a, edge.b).distance > toleranceScene || projection(q, edge.a, edge.b).distance > toleranceScene) continue;
      // Reading normal also catches non-finite imported edge geometry below.
      if (!Number.isFinite(dot(normal, edge.a))) continue;
      result.push({ ...edge, a: p, b: q });
    }
  }
  return result;
}
export function refreshFaceBoundary(face: RoofFace, roof: RoofInput): RoofFace {
  const tolerance = drawingToleranceMm(roof) / (roof.mmPerSceneUnit || 1) + 1e-5;
  return { ...face, boundary: boundaryForPolygon(face.polygon, roof.edges, tolerance) };
}

/** Prefer actual outward spouting normals, weighted by run length. Never use
 * global north/east for inference or snapping. Conflicting eaves need review. */
export function inferredFlow(face: Pick<RoofFace, 'boundary'>): Point | null {
  const eaves = face.boundary.filter(e => e.kind === 'spouting' && distance(e.a, e.b) > EPS);
  if (!eaves.length) return null;
  let x = 0, y = 0;
  for (const e of eaves) { const d = sub(e.b, e.a); x += d.y; y -= d.x; }
  if (Math.hypot(x, y) < EPS) return null;
  const v = unit({ x, y }), limit = Math.cos(REVIEW_LIMITS.maxAngleDeviationDeg * Math.PI / 180);
  if (eaves.some(e => dot(v, unit({ x: e.b.y - e.a.y, y: e.a.x - e.b.x })) < limit)) return null;
  return v;
}

/** Old detector warnings are observations, not perpetual validation errors.
 * Recompute partition checks; forget deleted face IDs; a supplied direction
 * resolves inference failure; explicit review acknowledgements are checked below. */
export function currentDetectionIssues(issues: Issue[], faces: RoofFace[]): Issue[] {
  const byId = new Map(faces.map(f => [f.id, f]));
  const recomputed = /^(UNCOVERED_ROOF|FACE_OUTSIDE_ROOF|FACE_OVERLAP|OUTLINE_OVERLAP|INVALID_POLYGON|DRAWING_SLIVER|NARROW_FACE)$/;
  return issues.filter(i => {
    if (recomputed.test(i.code)) return false;
    if (i.faceId && !byId.has(i.faceId)) return false;
    if (i.code === 'FLOW_REVIEW' && i.faceId) {
      const flow = byId.get(i.faceId)?.flow;
      if (flow && Number.isFinite(flow.x) && Number.isFinite(flow.y) && Math.hypot(flow.x, flow.y) > EPS) return false;
    }
    return true;
  });
}

/** Shared plan/direction checks. Useful before a worker is launched. */
export function validateFaceDirections(face: RoofFace, roof: RoofInput): Issue[] {
  const issues: Issue[] = [], v = face.flow;
  if (!v || !Number.isFinite(v.x) || !Number.isFinite(v.y) || Math.hypot(v.x, v.y) < EPS) return issues;
  const flow = unit(v), across = { x: flow.y, y: -flow.x }, toDeg = 180 / Math.PI;
  const angleBetween = (a: Point, b: Point): number => Math.acos(Math.max(-1, Math.min(1, dot(a, b)))) * toDeg;
  let maxAcceptableDeviation = 0;
  const hard = (code: string, message: string, objectId?: string): void => {
    const approved = directionApproved(face);
    issues.push({ severity: approved ? 'warning' : 'error', code, faceId: face.id, objectId,
      message: approved ? `${message} User-confirmed direction and polygon used; inferred boundary expectations do not block this draft. Verify site measurements.` : message });
  };
  const boundary = boundaryForPolygon(face.polygon, face.boundary ?? [], 1e-4);
  for (const e of boundary) {
    const d = unit(sub(e.b, e.a));
    let deviation = 0, code = '', description = '';
    if (e.kind === 'spouting') { deviation = angleBetween(flow, { x: d.y, y: -d.x }); code = 'FLOW_EAVE_CONFLICT'; description = 'water must point out through its spouting, not inward or along it'; }
    else if (e.kind === 'ridge') { deviation = Math.abs(90 - angleBetween(flow, d)); code = 'RIDGE_DIRECTION'; description = 'the ridge should run across the water direction'; }
    else if (e.kind === 'barge') { deviation = Math.min(angleBetween(flow, d), angleBetween(flow, { x: -d.x, y: -d.y })); code = 'BARGE_DIRECTION'; description = 'the barge should run with the water direction'; }
    else continue;
    if (deviation > REVIEW_LIMITS.maxAngleDeviationDeg + EPS) hard(code, `${face.name}: ${description} (${deviation.toFixed(1)}° away). Check the arrow or boundary classification.`, e.id);
    else maxAcceptableDeviation = Math.max(maxAcceptableDeviation, deviation);
  }
  let worst = 0, shortEdges = 0;
  face.polygon.forEach((a, i) => {
    const b = face.polygon[(i + 1) % face.polygon.length], len = distance(a, b);
    if (len < EPS) return;
    const d = unit(sub(b, a));
    const angle = Math.atan2(Math.abs(dot(d, flow)), Math.abs(dot(d, across))) * toDeg;
    const deviation = Math.min(angle, Math.abs(angle - 45), Math.abs(angle - 90));
    if (deviation > REVIEW_LIMITS.exactAngleDeg && len * roof.mmPerSceneUnit <= drawingToleranceMm(roof)) { shortEdges++; return; }
    worst = Math.max(worst, deviation);
  });
  if (worst > REVIEW_LIMITS.maxAngleDeviationDeg + EPS) hard('UNSUPPORTED_ANGLE', `${face.name}: a boundary is ${worst.toFixed(1)}° away from the supported 0°/45°/90° directions relative to its water arrow. Check the arrow and outline, or use a clearer, near-top-down plan. The original shape has not been forced square.`);
  else maxAcceptableDeviation = Math.max(maxAcceptableDeviation, worst);
  if (maxAcceptableDeviation > REVIEW_LIMITS.exactAngleDeg + EPS) issues.push({ severity: 'warning', code: 'DRAWING_SKEW', faceId: face.id,
    message: `${face.name}: ${maxAcceptableDeviation.toFixed(1)}° drawing deviation accepted for this draft (limit ${REVIEW_LIMITS.maxAngleDeviationDeg}°). Cuts use the actual shape, not an ideal 45° roof. Check image quality and site dimensions.` });
  if (shortEdges) issues.push({ severity: 'warning', code: 'SHORT_EDGE_REVIEW', faceId: face.id,
    message: `${face.name}: ${shortEdges} very short boundary segment${shortEdges === 1 ? '' : 's'} retained as drawn. Inspect at higher zoom; these segments were not removed from the sheet calculation.` });
  return issues;
}
