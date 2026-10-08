/** Soft feature evidence in the roof's LOCAL axes, independent of labels.
 * These hints never delete a non-45° edge or determine physical cuts. */
import type { Point, RoofEdge, RoofInput } from './types';
import { distance, dot, projection, signedArea, sub, unit } from './math';
export interface GeometryFeature {
  edgeId: string;
  suggestedKind: 'hip' | 'valley' | 'ridge' | 'unknown';
  confidence: 'supporting' | 'ambiguous';
  reason: string;
}
export function geometryFeatures(roof: RoofInput, edges: RoofEdge[]): GeometryFeature[] {
  const rings = roof.outlines.map(o => signedArea(o.polygon) > 0 ? o.polygon : [...o.polygon].reverse());
  const corners = rings.flatMap(ring => ring.map((point, i) => {
    const previous = ring[(i + ring.length - 1) % ring.length], next = ring[(i + 1) % ring.length];
    const a = sub(point, previous), b = sub(next, point);
    return { point, first: unit(sub(previous, point)), second: unit(b), reflex: a.x * b.y - a.y * b.x < 0 };
  }));
  const runs = rings.flatMap(r => r.map((a, i) => ({ a, b: r[(i + 1) % r.length] })));
  const acute = (a: Point, b: Point) => Math.acos(Math.min(1, Math.abs(dot(a, b)))) * 180 / Math.PI;
  return edges.map(e => {
    const d = unit(sub(e.b, e.a));
    for (const point of [e.a, e.b]) {
      const c = corners.find(c => distance(c.point, point) < 1e-5);
      if (!c) continue;
      const diagonal = [acute(d, c.first), acute(d, c.second)].some(deg => deg >= 40 && deg <= 50);
      if (diagonal) return { edgeId: e.id, suggestedKind: c.reflex ? 'valley' : 'hip', confidence: 'supporting',
        reason: `Diagonal at a ${c.reflex ? 're-entrant' : 'convex'} outline corner (40–50° to a local eave). Confirm drainage; this is not a hard component classification.` };
    }
    const normalEnd = runs.some(r => [e.a, e.b].some(point => {
      const hit = projection(point, r.a, r.b);
      return hit.distance < 1e-5 && hit.t > 1e-5 && hit.t < 1 - 1e-5 && acute(d, unit(sub(r.b, r.a))) >= 85;
    }));
    if (normalEnd) return { edgeId: e.id, suggestedKind: 'ridge', confidence: 'supporting', reason: 'Spine ends approximately perpendicular to the middle of an exterior run: possible ridge-to-rake junction.' };
    return { edgeId: e.id, suggestedKind: 'unknown', confidence: 'ambiguous', reason: 'Boundary retained as drawn. Its role follows the reviewed faces and water arrows, not its name or screen angle.' };
  });
}
