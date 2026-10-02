import { adjacentValleyParents } from './valleyReceivers';
import { receiverFreshOrder } from './receiverSafety';
import type { Draft, Issue, Placement, RoofFace, RoofInput, Solution } from './types';
import { deriveFaces, validatePartition } from './graph';
import { fromRing, intersect, rectangle, rings, subtract, union, area } from './regions';
import { fingerprint, signedArea } from './math';
import { generateDemands } from './material';
import { facesRevision, validateSolution } from './solver';
export function mergeFaces(a: RoofFace, b: RoofFace): RoofFace {
  const r = union(fromRing(a.polygon), fromRing(b.polygon)), rs = rings(r);
  if (rs.length !== 1 || signedArea(rs[0]) <= 0) throw new Error('Only adjacent faces that form one simple polygon can be merged.');
  return { ...a, polygon: rs[0], boundary: [], confirmed: false, provenance: 'edited' };
}
export function splitFace(face: RoofFace, axis: 'x' | 'y', coordinate: number): RoofFace[] {
  const r = fromRing(face.polygon), xs = face.polygon.map(p => p.x), ys = face.polygon.map(p => p.y);
  const minX = Math.min(...xs) - 1, maxX = Math.max(...xs) + 1, minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1;
  const cutter = axis === 'x' ? rectangle(minX, minY, coordinate, maxY) : rectangle(minX, minY, maxX, coordinate);
  const halves = [intersect(r, cutter), subtract(r, cutter)];
  const pieces = halves.flatMap(h => rings(h));
  if (pieces.length < 2 || pieces.some(p => signedArea(p) <= 0)) throw new Error('The split must pass through the face and produce simple polygons.');
  return pieces.map((polygon, i) => ({ ...face, id: `${face.id}:split:${i + 1}`, name: `${face.name}.${i + 1}`, polygon,
    boundary: [], confirmed: false, provenance: 'edited' }));
}
export function editPlacement(solution: Solution, offcutId: string, destinationId: string, rotation: 0 | 180, translateY: number): Solution {
  const next = structuredClone(solution); if(next.decisionTrace)next.decisionTrace.historic=true; delete next.comparison;
  const previous = next.placements.find(p => p.kind === 'reuse' && p.offcutId === offcutId);
  const target = next.placements.find(p => p.demandId === destinationId);
  if (!next.offcuts.some(o => o.id === offcutId) || !target) throw new Error('Select an existing offcut and target sheet lane.');
  if (previous && previous.demandId !== target.demandId) {
    // Swapping two reuse allocations preserves their physical identities. When
    // replacing a new source lane, dependants are caught by validation below.
    const oldTarget = { ...target };
    Object.assign(previous, { ...oldTarget, demandId: previous.demandId, manual: true });
  }
  Object.assign(target, { demandId: destinationId, kind: 'reuse', offcutId, rotation, translateY, manual: true } satisfies Placement);
  // Strip stale optional offcut IDs from any new placement.
  for (const p of next.placements) if (p.kind === 'new') { delete p.offcutId; p.rotation = 0; p.translateY = 0; }
  const freshIds = new Set(next.placements.filter(p => p.kind === 'new').map(p => p.demandId));
  next.metrics.newMaterialMm2 = next.demands.filter(d => freshIds.has(d.id)).reduce((n, d) => n + area(d.blank), 0);
  next.metrics.newSheetCount = freshIds.size;
  next.metrics.reusedPieceCount = next.placements.filter(p => p.kind === 'reuse').length;
  next.metrics.savedMm2 = next.metrics.baselineNewMaterialMm2 - next.metrics.newMaterialMm2;
  next.metrics.wasteMm2 = next.metrics.newMaterialMm2 - next.metrics.installedPhysicalMm2;
  next.issues = [...next.issues.filter(i => i.severity === 'warning'), ...validateSolution(next)];
  next.status = next.issues.some(i => i.severity === 'error') ? 'invalid' : 'prototype-review';
  return next;
}
export function validateDraft(draft: Draft): Issue[] {
  const issues = validatePartition(draft.roof, draft.faces), s = draft.solution;
  if (!s) return issues;
  if (fingerprint(s.profile) !== fingerprint(draft.profile) || fingerprint(s.settings) !== fingerprint(draft.settings)) issues.push({ severity: 'error', code: 'SOLUTION_RULES', message: 'Saved allocation rules do not match the reviewed material settings.' });
  if (draft.settings.stockMode === 'bank-first' && !s.bankLayout) issues.push({ severity: 'error', code: 'MISSING_BANK_LAYOUT', message: 'This bank-first solution has no verifiable stock/registration layout.' });
  if (Object.keys(s.lapByFace).length !== draft.faces.length || draft.faces.some(f => ![1, -1].includes(s.lapByFace[f.id]) || f.lapLocked && s.lapByFace[f.id] !== f.lap)) issues.push({ severity: 'error', code: 'LOCKED_LAP', message: 'The proposed lap directions do not match the face set or a user-locked direction.' });
  const request = { roof: draft.roof, faces: draft.faces, profile: draft.profile, settings: draft.settings };
  if (s.sourceRevision !== draft.roof.sourceRevision || s.facesRevision !== facesRevision(request)) issues.push({ severity: 'error', code: 'STALE_SOLUTION', message: 'Geometry, direction, calibration or material settings changed. Run the optimiser again.' });
  try {
    const expected = generateDemands(draft.roof, draft.faces, draft.profile, draft.settings, s.bankLayout).map(d => ({ ...d, lap: s.lapByFace[d.faceId] }));
    if (fingerprint(expected) !== fingerprint(s.demands)) issues.push({ severity: 'error', code: 'DEMAND_TAMPER', message: 'The sheet requirements no longer match the current reviewed roof.' });
  } catch (error) { issues.push({ severity: 'error', code: 'INPUTS', message: String(error) }); }
  if(s.engineVersion==='2.13'&&draft.settings.stockMode==='bank-first'){
    const expected=[...adjacentValleyParents(draft.faces,draft.roof)].filter(([id])=>receiverFreshOrder(s.demands.filter(d=>d.faceId===id)))
      .map(([id,parent])=>`${parent}/${id}`).sort();
    const actual=s.receiverSafety?.families.flatMap(f=>f.faceIds.map(id=>`${f.sourceFaceId}/${id}`)).sort();
    if(JSON.stringify(actual)!==JSON.stringify(expected))issues.push({severity:'error',code:'RECEIVER_SAFETY',message:'Receiver families do not match the approved roof. Recalculate the plan.'});
  }
  issues.push(...validateSolution(s)); return issues;
}
export function resetFaces(roof: RoofInput): RoofFace[] { return deriveFaces(roof).faces; }
