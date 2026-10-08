import type { Point, RoofFace, RoofInput } from './types';
import { distance, projection, validateRing } from './math';
import { mergeFaces } from './editing';
import { refreshFaceBoundary } from './reviewGeometry';
import { assertReviewEdit, buildSharedTopology, applyNodePositions } from './sharedTopology';

export function sharedNeighbours(roof: RoofInput, faces: RoofFace[], faceId: string): string[] {
  try { return [...new Set(buildSharedTopology(roof, faces).edges.filter(e => e.faceIds.includes(faceId)).flatMap(e => e.faceIds))].filter(id => id !== faceId); }
  catch { return []; }
}
export function mergeSharedFaces(roof: RoofInput, faces: RoofFace[], first: string, second: string): RoofFace[] {
  if (!sharedNeighbours(roof, faces, first).includes(second)) throw new Error('Choose a neighbouring face with a shared boundary.');
  const a = faces.find(f => f.id === first)!, b = faces.find(f => f.id === second)!;
  const merged = refreshFaceBoundary(mergeFaces(a, b), roof);
  // A merge may join different falls. Ask instead of inheriting an arbitrary one.
  if (!a.flow || !b.flow || distance(a.flow, b.flow) > .05) { merged.flow = null; merged.flowSource = 'inferred'; }
  delete merged.directionApproval;
  const next = faces.filter(f => f.id !== second).map(f => f.id === first ? merged : structuredClone(f));
  assertReviewEdit(roof, faces, next); return next;
}
/** Split by a user drawn chord. Endpoints must touch this face, not a pixel-axis
 * coordinate field. Works on rotated/non-square roofs; rejects chords crossing voids. */
export function splitSharedFace(roof: RoofInput, faces: RoofFace[], faceId: string, first: Point, second: Point): RoofFace[] {
  const f = faces.find(f => f.id === faceId); if (!f) throw new Error('Select the face to split.');
  if (distance(first, second) < 1e-5) throw new Error('Choose two different points on the face boundary.');
  const inserted: Point[] = [];
  for (let i = 0; i < f.polygon.length; i++) {
    const a = f.polygon[i], b = f.polygon[(i + 1) % f.polygon.length];
    const hits = [first, second].map(p => ({ p, ...projection(p, a, b) })).filter(h => h.distance < 1e-5 && h.t > 1e-7 && h.t < 1 - 1e-7).sort((a, b) => a.t - b.t);
    inserted.push(a, ...hits.map(h => h.point));
  }
  const start = inserted.findIndex(p => distance(p, first) < 1e-5), finish = inserted.findIndex(p => distance(p, second) < 1e-5);
  if (start < 0 || finish < 0) throw new Error('Place both split points on the selected face boundary.');
  const [lo, hi] = [start, finish].sort((a, b) => a - b);
  const polygons = [inserted.slice(lo, hi + 1), [...inserted.slice(hi), ...inserted.slice(0, lo + 1)]];
  if (polygons.some(p => validateRing(p))) throw new Error('That split does not create two simple roof faces.');
  const used = new Set(faces.map(f => f.id)); let suffix = 1;
  while (used.has(`${f.id}:part:${suffix}`)) suffix++;
  const pieces = polygons.map((polygon, i) => refreshFaceBoundary({ ...f, id: i ? `${f.id}:part:${suffix}` : f.id,
    name: i ? `${f.name} (split)` : f.name, polygon, confirmed: false, directionApproval: undefined, provenance: 'edited' }, roof));
  const next = faces.flatMap(g => g.id === f.id ? pieces : [structuredClone(g)]);
  assertReviewEdit(roof, faces, next); buildSharedTopology(roof, next); return next;
}
/** Preserve unaffected user review through a local cleanup-exception rebuild.
 * Exact polygons only. A changed footprint never inherits approval. */
export function retainUnchangedReview(previous: RoofFace[], proposed: RoofFace[]): RoofFace[] {
  const matched = new Set<string>(), names = new Set(previous.map(f => f.name)), used = new Set(previous.map(f => f.id));
  let serial = 1;
  return proposed.map(f => {
    const old = previous.find(p => !matched.has(p.id) && p.polygon.length === f.polygon.length && p.polygon.every((point, i) => distance(point, f.polygon[i]) < 1e-5));
    if (old) { matched.add(old.id); return structuredClone(old); }
    while (used.has(`face-${serial}`) || names.has(`Face ${serial}`)) serial++;
    const id = `face-${serial}`, name = `Face ${serial++}`; used.add(id); names.add(name);
    return { ...f, id, name, confirmed: false, directionApproval: undefined };
  });
}

/** Advanced coordinate edits use the same shared node transaction as dragging.
 * Adding/removing topology belongs to the visible Split/Join tools. */
export function replaceSharedVertices(roof: RoofInput, faces: RoofFace[], faceId: string, polygon: Point[]): RoofFace[] {
  const face = faces.find(f => f.id === faceId); if (!face) throw new Error('Select a face.');
  if (polygon.length !== face.polygon.length) throw new Error('Use Split or Join to change vertex count. This editor moves the existing shared vertices.');
  const mesh = buildSharedTopology(roof, faces), positions = new Map<string, Point>();
  face.polygon.forEach((p, i) => { const node = mesh.nodes.find(n => distance(n.point, p) < 1e-5); if (node) positions.set(node.id, polygon[i]); });
  return applyNodePositions(roof, faces, mesh, positions);
}
