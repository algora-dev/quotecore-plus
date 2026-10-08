import type { Point, RoofEdge, RoofInput } from './types';
import { containsPoint, distance, dot, fingerprint, projection, sub, unit } from './math';
import { geometryPolicy, type GeometryChange } from './geometryPolicy';
import { pointOrder } from './geometryLines';

interface End { edge: RoofEdge; end: 'a' | 'b'; point: Point }
/** Join a physical junction ONCE before pairwise intersection/polygonisation.
 * Pairwise trim-to-line used to leave three nearby intersections: a tiny triangle.
 * Outline corners are fixed anchors and genuine short source segments survive. */
export function sharedJunctions(roof: RoofInput, lines: RoofEdge[], perimeter: RoofEdge[]): { edges: RoofEdge[]; changes: GeometryChange[] } {
  const edges = structuredClone(lines), p = geometryPolicy(roof), changes: GeometryChange[] = [];
  const keep = new Set(roof.geometryKeepSeparateEdgeIds ?? []), protectedPoints = edges.filter(e => keep.has(e.id)).flatMap(e => [e.a, e.b]);
  const ends: End[] = edges.filter(e => !keep.has(e.id)).flatMap(edge => (['a', 'b'] as const).map(end => ({ edge, end, point: { ...edge[end] } })))
    .sort((a, b) => pointOrder(a.point, b.point) || a.edge.id.localeCompare(b.edge.id));
  const groups: End[][] = [];
  for (const end of ends) {
    // Complete-link grouping with a cap on the diameter (not transitive union).
    const g = groups.find(group => group.every(q => q.edge.id !== end.edge.id && distance(q.point, end.point) <= p.junction));
    if (g) g.push(end); else groups.push([end]);
  }
  const outlinePoints = perimeter.map(e => e.a);
  for (const g of groups) {
    const mean = g.reduce((q, e) => ({ x: q.x + e.point.x / g.length, y: q.y + e.point.y / g.length }), { x: 0, y: 0 });
    const corners = outlinePoints.filter(q => g.every(e => distance(e.point, q) <= p.junction));
    corners.sort((a, b) => distance(a, mean) - distance(b, mean) || pointOrder(a, b));
    let target: Point = corners[0] ?? mean;
    if (!corners.length) {
      const hits = perimeter.map(e => ({ edge: e, ...projection(mean, e.a, e.b) })).filter(h => h.distance <= p.junction && g.every(e => distance(e.point, h.point) <= p.junction));
      hits.sort((a, b) => a.distance - b.distance || a.edge.id.localeCompare(b.edge.id));
      if (hits.length) target = hits[0].point;
      else if (g.length < 2) continue;
    }
    if (protectedPoints.some(q => distance(q, target) < p.junction && distance(q, target) > 1e-6)) continue;
    if (g.every(e => distance(e.point, target) < 1e-7)) continue;
    if (!roof.outlines.some(o => containsPoint(o.polygon, target)) && !perimeter.some(e => projection(target, e.a, e.b).distance < 1e-6)) continue;
    const inside = (q: Point) => roof.outlines.some(o => containsPoint(o.polygon, q)) || perimeter.some(e => projection(q, e.a, e.b).distance < 1e-6);
    if (g.some(e => inside(e.point) && [.25, .5, .75].some(t => !inside({ x: e.point.x + (target.x - e.point.x) * t, y: e.point.y + (target.y - e.point.y) * t })))) continue;
    // Prevent a short detail from disappearing or a line reversing direction.
    if (g.some(e => {
      const other = e.edge[e.end === 'a' ? 'b' : 'a'], old = sub(e.point, other), next = sub(target, other);
      return distance(target, other) < distance(e.point, other) * .5 || dot(unit(old), unit(next)) < Math.cos(7.5 * Math.PI / 180);
    })) continue;
    const before = [...new Map(g.map(e => [e.edge.id, structuredClone(e.edge)])).values()];
    for (const e of g) e.edge[e.end] = { ...target };
    changes.push({ id: `geometry-${fingerprint([g.map(e => e.edge.id), target])}`, kind: 'shared-junction', sourceIds: [...new Set(g.map(e => e.edge.id))], before,
      after: [...new Map(g.map(e => [e.edge.id, structuredClone(e.edge)])).values()], maxMoveMm: Math.max(...g.map(e => distance(e.point, target))) * p.scale,
      message: 'Connected nearby endpoints at one shared junction; original measurements retained.' });
  }
  return { edges, changes };
}
