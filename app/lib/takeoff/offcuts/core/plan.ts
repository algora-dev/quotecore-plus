import type { RoofFace, Solution } from './types';
import { bounds } from './regions';
import { supplyView } from './supply';
export interface ReuseGroup {
  id: string; sourceFaceId: string; destinationFaceId: string; rootBankId?: string; supplyBlockId?: string;
  offcutIds: string[]; demandIds: string[]; sheetCount: number;
}
export interface FacePlan {
  faceId: string; name: string; sheetCount: number; newCount: number; reuseCount: number; primary: boolean;
  sources: { faceId: string; count: number }[]; feeds: { faceId: string; count: number }[];
  extraLengthMm: number;
  newFillerCount: number; newCutCount: number; selfFill: boolean;
  projectedSpanMm: number; eaveSpanMm: number; ridgeSpanMm: number;
}
/** The roofer sees face-to-face sets; physical identities stay underneath.
 * Split on a real gap between destination lanes rather than drawing imaginary
 * material across straight fillers or another source's offcuts. */
export function reuseGroups(solution: Solution): ReuseGroup[] {
  const demands = new Map(solution.demands.map(d => [d.id, d])), offcuts = new Map(solution.offcuts.map(o => [o.id, o]));
  const supply=supplyView(solution);
  const buckets = new Map<string, { source: string; destination: string; root?: string; block?: string; members: { offcut: string; demand: string; lane: number }[] }>();
  for (const p of solution.placements) {
    const d = demands.get(p.demandId), o = offcuts.get(p.offcutId ?? '');
    if (p.kind !== 'reuse' || !d || !o) continue;
    const block=supply.blockByPlacement.get(d.id);
    const key = `${o.sourceFaceId}|${d.faceId}|${block ?? o.rootBankId ?? ""}`, bucket = buckets.get(key) ?? { source: o.sourceFaceId, destination: d.faceId, root: o.rootBankId, block, members: [] };
    bucket.members.push({ offcut: o.id, demand: d.id, lane: d.laneIndex }); buckets.set(key, bucket);
  }
  const groups: ReuseGroup[] = [];
  for (const bucket of buckets.values()) {
    bucket.members.sort((a, b) => a.lane - b.lane);
    let group: ReuseGroup | undefined, last = -Infinity;
    for (const member of bucket.members) {
      if (!group || member.lane !== last + 1) {
        group = { id: `reuse:${bucket.source}:${bucket.destination}:${bucket.block??"legacy"}:${member.lane}`, sourceFaceId: bucket.source, destinationFaceId: bucket.destination, rootBankId: bucket.root, supplyBlockId: bucket.block, offcutIds: [], demandIds: [], sheetCount: 0 };
        groups.push(group);
      }
      group.offcutIds.push(member.offcut); group.demandIds.push(member.demand); group.sheetCount++; last = member.lane;
    }
  }
  return groups;
}
export function materialPlan(faces: RoofFace[], solution: Solution): FacePlan[] {
  const demands = new Map(solution.demands.map(d => [d.id, d])), offcuts = new Map(solution.offcuts.map(o => [o.id, o]));
  const supply=supplyView(solution);
  return faces.map(face => {
    const target = solution.placements.filter(p => demands.get(p.demandId)?.faceId === face.id), sources = new Map<string, number>(), feeds = new Map<string, number>();
    for (const p of solution.placements) if (p.kind === 'reuse') {
      const o = offcuts.get(p.offcutId ?? ''), d = demands.get(p.demandId); if (!o || !d) continue;
      if (d.faceId === face.id) sources.set(o.sourceFaceId, (sources.get(o.sourceFaceId) ?? 0) + 1);
      if (o.sourceFaceId === face.id) feeds.set(d.faceId, (feeds.get(d.faceId) ?? 0) + 1);
    }
    const newCount = target.filter(p => p.kind === 'new').length;
    const ds=solution.demands.filter(d=>d.faceId===face.id);
    const xs=ds.flatMap(d=>{const b=bounds(d.cover);return [b.minX+d.origin.x,b.maxX+d.origin.x];});
    const newFillerCount=target.filter(p=>p.kind==='new'&&supply.fillerDemandIds.has(p.demandId)).length;
    return { faceId: face.id, name: face.name, sheetCount: target.length, newCount, reuseCount: target.length - newCount,
      primary: solution.bankLayout?.primaryFaceIds.includes(face.id) ?? newCount === target.length,
      newFillerCount, newCutCount:newCount-newFillerCount, selfFill:solution.bankLayout?.selfFillFaceIds?.includes(face.id)??false,
      projectedSpanMm:xs.length?Math.max(...xs)-Math.min(...xs):0,
      eaveSpanMm:ds.reduce((n,d)=>n+(d.eaveOverlapMm??0),0),ridgeSpanMm:ds.reduce((n,d)=>n+(d.ridgeOverlapMm??0),0),
      sources: [...sources].map(([faceId, count]) => ({ faceId, count })), feeds: [...feeds].map(([faceId, count]) => ({ faceId, count })),
      extraLengthMm: (solution.bankLayout?.extraLengthByFace[face.id] ?? 0) + (solution.bankLayout?.tailExtensionByFace?.[face.id] ?? 0) };
  });
}
/** Lengths here include any selected extra stock. They are PLAN-derived lengths,
 * not verified site measurements, supplier orders, or spare-sheet allowances. */
export function newStockSchedule(solution: Solution): { faceId: string; lengthMm: number; count: number; role: string }[] {
  const supply=supplyView(solution);
  const fresh = new Set(solution.placements.filter(p => p.kind === 'new').map(p => p.demandId));
  const groups = new Map<string, { faceId: string; lengthMm: number; count: number; role: string }>();
  for (const d of solution.demands) if (fresh.has(d.id)) {
    const b = bounds(d.blank), lengthMm = b.maxY - b.minY, role = supply.fillerDemandIds.has(d.id) ? 'filler (may be cut)' : 'main cutting stock', key = `${d.faceId}/${lengthMm.toFixed(4)}/${role}`;
    const group = groups.get(key) ?? { faceId: d.faceId, lengthMm, count: 0, role }; group.count++; groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.faceId.localeCompare(b.faceId) || b.lengthMm - a.lengthMm);
}
