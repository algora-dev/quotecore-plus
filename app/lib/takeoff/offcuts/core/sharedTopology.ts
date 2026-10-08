/** Review mesh: one node/edge identity for every shared boundary. No stock logic. */
import type { Point, RoofFace, RoofInput } from './types';
import { distance, fingerprint, projection, validateRing } from './math';
import { area, fromRing, subtract, unionAll } from './regions';
import { refreshFaceBoundary } from './reviewGeometry';

export interface SharedNode { id: string; point: Point; faceIds: string[]; outer: boolean; fixed: boolean }
export interface SharedEdge { id: string; a: string; b: string; faceIds: string[]; outer: boolean }
export interface SharedRoofTopology { nodes: SharedNode[]; edges: SharedEdge[]; faceNodes: Record<string, string[]> }
const EPS = 1e-5;
export function buildSharedTopology(roof: RoofInput, faces: RoofFace[]): SharedRoofTopology {
  if (faces.some(f => validateRing(f.polygon))) throw new Error('Correct the invalid face before editing shared boundaries.');
  const pts = faces.flatMap(f => f.polygon); if (pts.length > 6000) throw new Error('Too many vertices for interactive shared editing.');
  const outer = roof.outlines.flatMap(o => o.polygon.map((a, i) => ({ a, b: o.polygon[(i + 1) % o.polygon.length] })));
  const nodes: SharedNode[] = [], edges = new Map<string, SharedEdge>(), faceNodes: Record<string, string[]> = {};
  const nodeAt = (p: Point, faceId: string): SharedNode => {
    let n = nodes.find(n => distance(n.point, p) < EPS);
    if (!n) { n = { id: `node-${fingerprint(p)}`, point: { ...p }, faceIds: [], outer: outer.some(e => projection(p, e.a, e.b).distance < EPS), fixed: outer.some(e => distance(e.a, p) < EPS) }; nodes.push(n); }
    if (!n.faceIds.includes(faceId)) n.faceIds.push(faceId);
    return n;
  };
  for (const f of faces) {
    const ids: string[] = [];
    for (let i = 0; i < f.polygon.length; i++) {
      const a = f.polygon[i], b = f.polygon[(i + 1) % f.polygon.length];
      const hits = [{ p: a, t: 0 }, ...pts.map(p => ({ p, ...projection(p, a, b) })).filter(h => h.distance < EPS && h.t > 1e-7 && h.t < 1 - 1e-7)];
      hits.sort((a, b) => a.t - b.t);
      for (const h of hits) { const id = nodeAt(h.p, f.id).id; if (ids.at(-1) !== id) ids.push(id); }
    }
    if (ids[0] === ids.at(-1)) ids.pop(); faceNodes[f.id] = ids;
    for (let i = 0; i < ids.length; i++) {
      const [a, b] = [ids[i], ids[(i + 1) % ids.length]].sort(), id = `edge-${fingerprint([a, b])}`;
      const pa = nodes.find(n => n.id === a)!.point, pb = nodes.find(n => n.id === b)!.point;
      const edge = edges.get(id) ?? { id, a, b, faceIds: [], outer: outer.some(e => projection(pa, e.a, e.b).distance < EPS && projection(pb, e.a, e.b).distance < EPS) };
      if (!edge.faceIds.includes(f.id)) edge.faceIds.push(f.id); edges.set(id, edge);
    }
  }
  if ([...edges.values()].some(e => e.faceIds.length > 2)) throw new Error('More than two faces share a boundary. Merge the overlap before moving it.');
  return { nodes, edges: [...edges.values()], faceNodes };
}
export function assertReviewEdit(roof: RoofInput, before: RoofFace[], after: RoofFace[]): void {
  if (after.some(f => validateRing(f.polygon))) throw new Error('That move would fold or collapse a face. Use Merge to remove a division.');
  const original = unionAll(before.map(f => fromRing(f.polygon))), next = unionAll(after.map(f => fromRing(f.polygon)));
  const outline = unionAll(roof.outlines.map(o => fromRing(o.polygon))), tolerance = Math.max(1e-5, area(outline) * 1e-9);
  const overlap = (faces: RoofFace[], covered: ReturnType<typeof unionAll>) => Math.max(0, faces.reduce((n, f) => n + area(fromRing(f.polygon)), 0) - area(covered));
  if (area(subtract(original, next)) > tolerance || area(subtract(next, outline)) > area(subtract(original, outline)) + tolerance || overlap(after, next) > overlap(before, original) + tolerance)
    throw new Error('That edit would leave a gap, overlap or move outside the master outline. Snap to the shared boundary instead.');
}
export function applyNodePositions(roof: RoofInput, faces: RoofFace[], mesh: SharedRoofTopology, positions: Map<string, Point>): RoofFace[] {
  const nodes = new Map(mesh.nodes.map(n => [n.id, n]));
  const perimeter = roof.outlines.flatMap(o => o.polygon.map((a, i) => ({ a, b: o.polygon[(i + 1) % o.polygon.length] })));
  for (const [id, point] of positions) {
    if (![point.x, point.y].every(Number.isFinite)) throw new Error('Invalid vertex position.');
    const node = nodes.get(id); if (!node) throw new Error('The shared boundary changed. Select it again.');
    if (node.fixed && distance(point, node.point) > EPS) throw new Error('This corner belongs to the master roof outline. Change the roof outline in Digital takeoff.');
    if (node.outer && !perimeter.some(e => projection(node.point, e.a, e.b).distance < EPS && projection(point, e.a, e.b).distance < EPS))
      throw new Error('Keep this junction on the master roof outline.');
  }
  const result = faces.map(f => {
    if (!mesh.faceNodes[f.id].some(id => positions.has(id))) return structuredClone(f);
    let polygon = mesh.faceNodes[f.id].map(id => ({ ...(positions.get(id) ?? nodes.get(id)!.point) }));
    polygon = polygon.filter((p, i) => distance(p, polygon[(i + polygon.length - 1) % polygon.length]) > EPS);
    return refreshFaceBoundary({ ...f, polygon, confirmed: false, directionApproval: undefined, provenance: 'edited' }, roof);
  });
  assertReviewEdit(roof, faces, result); buildSharedTopology(roof, result);
  return result;
}
export function moveSharedVertex(roof: RoofInput, faces: RoofFace[], original: Point, target: Point): RoofFace[] {
  const mesh = buildSharedTopology(roof, faces), node = mesh.nodes.find(n => distance(n.point, original) < EPS);
  if (!node) throw new Error('Select the vertex again.');
  return applyNodePositions(roof, faces, mesh, new Map([[node.id, target]]));
}
export function moveSharedEdge(roof: RoofInput, faces: RoofFace[], a: Point, b: Point, shift: Point): RoofFace[] {
  const mesh = buildSharedTopology(roof, faces), dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
  if (length < EPS) throw new Error('Choose a longer boundary.');
  const n = { x: -dy / length, y: dx / length }, step = shift.x * n.x + shift.y * n.y;
  const selected = mesh.nodes.filter(p => projection(p.point, a, b).distance < EPS);
  if (!mesh.edges.some(e => e.faceIds.length === 2 && selected.some(n => n.id === e.a) && selected.some(n => n.id === e.b))) throw new Error('Move an internal shared edge, not the master outline.');
  const perimeter = roof.outlines.flatMap(o => o.polygon.map((a, i) => ({ a, b: o.polygon[(i + 1) % o.polygon.length] })));
  const positions = new Map(selected.map(node => {
    let p = { x: node.point.x + n.x * step, y: node.point.y + n.y * step };
    if (node.outer && !node.fixed) {
      const edges = perimeter.filter(e => projection(node.point, e.a, e.b).distance < EPS);
      const hit = edges.map(e => projection(p, e.a, e.b)).sort((a, b) => a.distance - b.distance)[0]; if (hit) p = hit.point;
    }
    return [node.id, p] as const;
  }));
  return applyNodePositions(roof, faces, mesh, positions);
}
