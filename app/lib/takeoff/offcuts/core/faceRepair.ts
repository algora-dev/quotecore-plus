import type { Issue, Point, RoofFace, RoofInput } from './types';
import { deriveFaces, type FaceDetection } from './graph';
import type { BoundaryRepair } from './drafting';
import { area, fromRing, intersect, subtract, unionAll } from './regions';
import { containsPoint, distance, projection } from './math';
import { validatePartition } from './partition';

export interface LocalRepairResult extends FaceDetection {
  roof: RoofInput;
  preservedFaceIds: string[];
}
function interior(face: RoofFace, p: Point): boolean {
  return containsPoint(face.polygon, p) && face.polygon.every((a, i) =>
    projection(p, a, face.polygon[(i + 1) % face.polygon.length]).distance > 1e-6);
}
/** Accept a displayed suggestion in a COPY of the review data. Rebuild only
 * cells inside the old face(s) touched by the repaired line. Other reviewed
 * polygons, names, arrows, locks and approvals stay byte-for-byte unchanged.
 * A repair may never overwrite an unrelated hand-drawn face to make a raw
 * graph look tidier. A repair crossing that boundary requires manual review. */
export function applyLocalFaceRepair(roof: RoofInput, previous: RoofFace[], repair: BoundaryRepair): LocalRepairResult {
  const next = structuredClone(roof), edge = next.edges.find(e => e.id === repair.edgeId);
  if (!edge || distance(edge[repair.end], repair.from) > 1e-5) throw new Error('This connection has changed. Find faces again before accepting it.');
  const before = structuredClone(edge);
  edge[repair.end] = { ...repair.to };
  const detected = deriveFaces(next);
  if(detected.normalisedEdges)next.edges=structuredClone(detected.normalisedEdges);
  const samples = [repair.from, ...[.1, .25, .5, .75, .9].map(t => ({
    x: before.a.x + t * (before.b.x - before.a.x), y: before.a.y + t * (before.b.y - before.a.y),
  }))];
  const affected = previous.filter(f => samples.some(p => interior(f, p)));
  const affectedIds = new Set(affected.map(f => f.id));
  const kept = previous.filter(f => !affectedIds.has(f.id));
  const footprint = unionAll(affected.map(f => fromRing(f.polygon)));
  const candidates = detected.faces.filter(f => {
    const r = fromRing(f.polygon), a = area(r);
    return a > 1e-8 && area(intersect(r, footprint)) > a - Math.max(1e-5, a * 1e-10);
  });
  const candidateCover = unionAll(candidates.map(f => fromRing(f.polygon)));
  const residual = area(subtract(footprint, candidateCover)) + area(subtract(candidateCover, footprint));
  // If the user's approved shape differs materially from the raw graph, do
  // not silently replace it. Their other manual faces remain intact either way.
  if (!affected.length || !candidates.length || residual > Math.max(1e-4, area(footprint) * 1e-9)) {
    return { ...detected, roof: next, faces: structuredClone(previous), preservedFaceIds: previous.map(f => f.id),
      issues: [...validatePartition(next, previous), { severity: 'error', code: 'LOCAL_REPAIR_REVIEW',
        faceId: affected[0]?.id, objectId: repair.edgeId, location: repair.to,
        message: 'Connection applied, but its new cells differ from your manually reviewed outline. Split or adjust only this face; other faces were kept.' }] };
  }
  const usedIds = new Set(previous.map(f => f.id)), usedNames = new Set(previous.map(f => f.name));
  let serial = Math.max(0, ...previous.map(f => Number(f.id.match(/^face-(\d+)$/)?.[1] ?? 0))) + 1;
  const remap = new Map<string, string>();
  const replaced = candidates.map((f, i): RoofFace => {
    const parent = affected.find(old => area(intersect(fromRing(old.polygon), fromRing(f.polygon))) > area(fromRing(f.polygon)) * .99);
    // Reuse one affected identifier/name where possible, but never steal an ID
    // from a face elsewhere whose shape and confirmation we are preserving.
    let id: string, name: string;
    const old = affected[i];
    if (old) { id = old.id; name = old.name; }
    else {
      while (usedIds.has(`face-${serial}`) || usedNames.has(`Face ${serial}`)) serial++;
      id = `face-${serial}`; name = `Face ${serial++}`;
    }
    usedIds.add(id); usedNames.add(name); remap.set(f.id, id);
    return { ...f, id, name, pitchDeg: parent?.pitchDeg ?? f.pitchDeg,
      flow: parent?.flowSource === 'manual' ? structuredClone(parent.flow) : f.flow,
      flowSource: parent?.flowSource === 'manual' ? 'manual' : 'inferred',
      lap: parent?.lap ?? f.lap, lapLocked: parent?.lapLocked ?? false,
      laneOffsetMm: parent?.laneOffsetMm ?? 0, laneOffsetLocked: parent?.laneOffsetLocked ?? false,
      confirmed: false, directionApproval: undefined };
  });
  const faces = [...structuredClone(kept), ...replaced];
  const byId = new Map(detected.faces.map(f => [f.id, f]));
  const issues: Issue[] = detected.issues.filter(i => !['UNCOVERED_ROOF', 'FACE_OUTSIDE_ROOF', 'FACE_OVERLAP', 'OUTLINE_OVERLAP', 'DRAWING_SLIVER', 'FLOW_REVIEW'].includes(i.code)).map(i => {
    if (!i.faceId) return i;
    if (remap.has(i.faceId)) return { ...i, faceId: remap.get(i.faceId) };
    const old = kept.find(f => {
      const raw = byId.get(i.faceId!); if (!raw) return false;
      const a = fromRing(f.polygon), b = fromRing(raw.polygon);
      return area(subtract(a, b)) + area(subtract(b, a)) < 1e-5;
    });
    return { ...i, faceId: old?.id };
  });
  for (const f of replaced) if (!f.flow) issues.push({ severity: 'warning', code: 'FLOW_REVIEW', faceId: f.id, message: 'Choose the water direction for this repaired face.' });
  issues.push(...validatePartition(next, faces));
  return { ...detected, roof: next, faces, issues, preservedFaceIds: kept.map(f => f.id) };
}
