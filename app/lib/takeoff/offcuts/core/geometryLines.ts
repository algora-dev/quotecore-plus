/** Canonical separators. Measurements are immutable; duplicates are review copies. */
import type { RoofEdge, RoofInput, Point } from './types';
import { distance, dot, sub, unit, projection, fingerprint } from './math';
import { geometryPolicy, type GeometryChange } from './geometryPolicy';

/** Compare full overlapping runs, not just a close endpoint or midpoint.
 * The maximum pairwise spread is bounded: a chain of near-lines cannot consume
 * a genuine wider strip. Meaningful crossings are never treated as duplicates. */
function parallelOverlap(a: RoofEdge, b: RoofEdge, limit: number, cosine: number): boolean {
  const length = distance(a.a, a.b), other = distance(b.a, b.b);
  if (length < 1e-7 || other < 1e-7 || Math.abs(dot(unit(sub(a.b, a.a)), unit(sub(b.b, b.a)))) < cosine) return false;
  const d = unit(sub(a.b, a.a));
  const x = dot(sub(b.a, a.a), d), y = dot(sub(b.b, a.a), d);
  const lo = Math.max(0, Math.min(x, y)), hi = Math.min(length, Math.max(x, y));
  if (hi - lo < Math.min(length, other) * .85) return false;
  const p = (t: number) => ({ x: a.a.x + t * d.x, y: a.a.y + t * d.y });
  return projection(p(lo), b.a, b.b).distance <= limit && projection(p(hi), b.a, b.b).distance <= limit;
}
function canonicalMean(group: RoofEdge[]): RoofEdge {
  // Direction is geometric; reversing a source row does not change the result.
  const ordered = group.map(e => e.a.x < e.b.x || e.a.x === e.b.x && e.a.y < e.b.y ? e : { ...e, a: e.b, b: e.a });
  const origin = ordered.reduce((p, e) => ({ x: p.x + (e.a.x + e.b.x) / 2 / group.length, y: p.y + (e.a.y + e.b.y) / 2 / group.length }), { x: 0, y: 0 });
  const dir = unit(ordered.reduce((p, e) => { const v = unit(sub(e.b, e.a)); return { x: p.x + v.x, y: p.y + v.y }; }, { x: 0, y: 0 }));
  const stations = ordered.flatMap(e => [dot(sub(e.a, origin), dir), dot(sub(e.b, origin), dir)]);
  const p = (t: number) => ({ x: origin.x + t * dir.x, y: origin.y + t * dir.y });
  return { ...group[0], a: p(Math.min(...stations)), b: p(Math.max(...stations)), kind: group.every(e => e.kind === group[0].kind) ? group[0].kind : 'unknown' };
}
export function consolidateRuns(roof: RoofInput, perimeter: RoofEdge[]): { edges: RoofEdge[]; changes: GeometryChange[] } {
  const policy = geometryPolicy(roof), keep = new Set(roof.geometryKeepSeparateEdgeIds ?? []);
  const changes: GeometryChange[] = [], rest: RoofEdge[] = [];
  const input = roof.edges.filter(e => !roof.faceDetectionIgnoredEdgeIds?.includes(e.id) && distance(e.a, e.b) > 1e-7)
    .map(e => structuredClone(e)).sort((a, b) => Math.min(a.a.x, a.b.x) - Math.min(b.a.x, b.b.x) || Math.min(a.a.y, a.b.y) - Math.min(b.a.y, b.b.y) || a.id.localeCompare(b.id));
  for (const e of input) {
    // An outer matching run annotates the MASTER edge. It is not a second edge.
    const matched = keep.has(e.id) ? undefined : perimeter.find(p => {
      if (!parallelOverlap(e, p, policy.merge, policy.parallelCos)) return false;
      return projection(e.a, p.a, p.b).distance <= policy.merge && projection(e.b, p.a, p.b).distance <= policy.merge;
    });
    if (!matched) { rest.push(e); continue; }
    const a = projection(e.a, matched.a, matched.b).point, b = projection(e.b, matched.a, matched.b).point;
    changes.push({ id: `geometry-${fingerprint([e.id, matched.id])}`, kind: 'outline-alignment', sourceIds: [e.id], before: [e], after: [{ ...e, a, b }],
      maxMoveMm: Math.max(distance(e.a, a), distance(e.b, b)) * policy.scale, message: 'Used the master roof outline instead of a nearby duplicate perimeter measurement.' });
  }
  const groups: RoofEdge[][] = [];
  for (const e of rest) {
    const group = keep.has(e.id) ? undefined : groups.find(g => g.every(q => !keep.has(q.id) && parallelOverlap(q, e, policy.merge, policy.parallelCos)));
    if (group) group.push(e); else groups.push([e]);
  }
  const edges = groups.map(g => {
    if (g.length === 1) return g[0];
    const after = canonicalMean(g);
    changes.push({ id: `geometry-${fingerprint(g.map(e => e.id).sort())}`, kind: 'duplicate-line', sourceIds: g.map(e => e.id), before: g, after: [after],
      maxMoveMm: Math.max(...g.flatMap(e => [projection(e.a, after.a, after.b).distance, projection(e.b, after.a, after.b).distance])) * policy.scale,
      message: 'Combined overlapping near-parallel measurements into one shared internal boundary.' });
    return after;
  });
  return { edges, changes };
}
/** Geometric ordering used for stable junction clustering. */
export function pointOrder(a: Point, b: Point): number { return a.x - b.x || a.y - b.y; }
