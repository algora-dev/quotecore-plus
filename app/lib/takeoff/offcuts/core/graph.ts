import type { Issue, Point, RoofEdge, RoofFace, RoofInput } from './types';
import { EPS, distance, projection, segmentHits, signedArea, validateRing } from './math';
import { area, fromRing, intersect, subtract, unionAll } from './regions';
import { validatePartition } from './partition';
import { inferredFlow } from './reviewGeometry';
export { validatePartition } from './partition';
export interface FaceDetection { faces: RoofFace[]; issues: Issue[] }
/** Nodes all crossings/collinear overlaps, then walks half edges. A boundary
 * polygon, not a scalar measurement or bounding box, is the input. */
export function deriveFaces(roof: RoofInput, snapTolerance = 1): FaceDetection {
  const issues: Issue[] = [], input: RoofEdge[] = [];
  if (!roof.outlines.length) return { faces: [], issues: [{ severity: 'error', code: 'NO_OUTLINE', message: 'Select at least one roof outline.' }] };
  for (const o of roof.outlines) {
    const invalid = validateRing(o.polygon); if (invalid) throw new Error(`${o.name}: ${invalid}`);
    o.polygon.forEach((p, i) => input.push({ id: `${o.id}:boundary:${i}`, a: { ...p }, b: { ...o.polygon[(i + 1) % o.polygon.length] }, kind: 'unknown' }));
  }
  for (const e of roof.edges) if (distance(e.a, e.b) > EPS) input.push({ ...e, a: { ...e.a }, b: { ...e.b } });
  if (input.length > 1200) throw new Error('V1 supports at most 1200 selected boundary/component segments.');
  // Only measurement endpoints move; accepted outline geometry is authoritative.
  const outlineCount = roof.outlines.reduce((n, o) => n + o.polygon.length, 0);
  let snapped = 0;
  for (let i = outlineCount; i < input.length; i++) for (const end of ['a', 'b'] as const) {
    const p = input[i][end]; let best: Point | null = null, bestD = snapTolerance + EPS;
    for (let j = 0; j < input.length; j++) if (j !== i) {
      const hit = projection(p, input[j].a, input[j].b);
      if (hit.distance < bestD) { bestD = hit.distance; best = hit.point; }
    }
    if (best && bestD > EPS && bestD <= snapTolerance) { input[i][end] = best; snapped++; }
  }
  if (snapped) issues.push({ severity: 'warning', code: 'SNAPPED_ENDPOINTS', message: `${snapped} line endpoints snapped within ${snapTolerance} scene units. Review the face boundaries.` });
  const splits = input.map(e => [e.a, e.b]);
  for (let i = 0; i < input.length; i++) for (let j = i + 1; j < input.length; j++) {
    const hits = segmentHits(input[i], input[j]); splits[i].push(...hits); splits[j].push(...hits);
  }
  const pts: Point[] = [];
  const idx = (p: Point): number => { const i = pts.findIndex(q => distance(p, q) < 1e-6); if (i >= 0) return i; pts.push({ ...p }); return pts.length - 1; };
  const links = new Map<string, { a: number; b: number; edge: RoofEdge }>();
  input.forEach((e, i) => {
    const ps = splits[i].sort((a, b) => projection(a, e.a, e.b).t - projection(b, e.a, e.b).t);
    for (let j = 0; j < ps.length - 1; j++) {
      const a = idx(ps[j]), b = idx(ps[j + 1]); if (a === b) continue;
      const key = a < b ? `${a}:${b}` : `${b}:${a}`, prev = links.get(key);
      if (prev && prev.edge.kind !== 'unknown' && e.kind !== 'unknown' && prev.edge.kind !== e.kind) {
        issues.push({ severity: 'error', code: 'CONFLICTING_EDGE', objectId: e.id, message: `Overlapping lines disagree: ${prev.edge.kind} / ${e.kind}.` });
      }
      if (!prev || prev.edge.kind === 'unknown') links.set(key, { a, b, edge: { ...e, a: pts[a], b: pts[b] } });
    }
  });
  const neighbors: number[][] = pts.map(() => []);
  for (const e of links.values()) { neighbors[e.a].push(e.b); neighbors[e.b].push(e.a); }
  neighbors.forEach((ns, i) => ns.sort((a, b) => Math.atan2(pts[a].y - pts[i].y, pts[a].x - pts[i].x) - Math.atan2(pts[b].y - pts[i].y, pts[b].x - pts[i].x)));
  for (let i = 0; i < neighbors.length; i++) if (neighbors[i].length === 1) issues.push({ severity: 'error', code: 'DANGLING_LINE', message: `A line terminates without closing a face at (${pts[i].x.toFixed(1)}, ${pts[i].y.toFixed(1)}).` });
  const visited = new Set<string>(), faces: RoofFace[] = [];
  for (const link of links.values()) for (const [startA, startB] of [[link.a, link.b], [link.b, link.a]]) {
    if (visited.has(`${startA}:${startB}`)) continue;
    let a = startA, b = startB; const cycle: number[] = [], boundary: RoofEdge[] = [];
    for (let count = 0; count <= links.size * 2; count++) {
      const key = `${a}:${b}`; if (visited.has(key)) break;
      visited.add(key); cycle.push(a);
      const e = links.get(a < b ? `${a}:${b}` : `${b}:${a}`)!;
      boundary.push({ ...e.edge, a: pts[a], b: pts[b] });
      const ns = neighbors[b], position = ns.indexOf(a), next = ns[(position - 1 + ns.length) % ns.length];
      a = b; b = next;
      if (a === startA && b === startB) break;
    }
    const polygon = cycle.map(i => pts[i]);
    if (polygon.length < 3 || signedArea(polygon) <= EPS) continue;
    const invalid = validateRing(polygon);
    if (invalid) { issues.push({ severity: 'error', code: 'OPEN_TOPOLOGY', message: `A candidate boundary is invalid: ${invalid}` }); continue; }
    const region = fromRing(polygon), outlineRegion = unionAll(roof.outlines.map(o => fromRing(o.polygon)));
    if (area(subtract(region, outlineRegion)) > 1e-5) continue;
    const flow = inferredFlow({ boundary });
    const owner = roof.outlines.find(o => area(intersect(region, fromRing(o.polygon))) > area(region) * 0.99);
    const id = `face-${faces.length + 1}`;
    faces.push({ id, name: `Face ${String.fromCharCode(65 + faces.length % 26)}${faces.length >= 26 ? Math.floor(faces.length / 26) : ''}`, polygon, boundary, flow, lap: 1, lapLocked: false,
      pitchDeg: owner?.suggestedPitchDeg ?? null, laneOffsetMm: 0, confirmed: false, provenance: 'derived' });
    if (!flow) issues.push({ severity: 'warning', code: 'FLOW_REVIEW', faceId: id, message: `${id}: missing or conflicting spouting direction. Set the water arrow manually.` });
  }
  issues.push(...validatePartition(roof, faces));
  return { faces, issues };
}
