import type { Demand, Point, Region, Solution } from './types';
import { area, bandRing, bounds, components, fromRing, intersect, unionAll } from './regions';
import { demandPointToScene, scenePointToDemand } from './material';
import { fingerprint } from './math';
import { supplyView } from './supply';
import { reuseDepth } from './reuseDepth';

export type SectionRole = 'new-bank' | 'new-filler' | 'offcut' | 'self-fill' | 'bank-continuation';
export interface MaterialSection {
  id: string; faceId: string; role: SectionRole; supplyBlockId: string;
  /** External reuse generation; shared-bank continuations stay at generation 0. */
  reuseGeneration: number;
  /** Contiguous visible region in scene coordinates. Never an invented envelope. */
  region: Region;
  demandIds: string[]; offcutIds: string[]; rootDemandIds: string[];
  sourceFaceIds: string[]; cutKinds: string[]; cutSetIds: string[];
  /** Unique touched positions, not necessarily independent purchased sheets. */
  positionCount: number;
  /** Full purchased roots allocated ONLY to their first new section. */
  purchasedDemandIds: string[];
  sharedPurchasedDemandIds: string[];
  purchasedLinealM: number;
  netCoverAreaM2: number;
  /** Sum of net cut-piece maximum run lengths, NOT additive purchased stock. */
  cutPieceRunLinealM: number;
}
export function mapRegion(region: Region, map: (p: Point) => Point): Region {
  return unionAll(region.flatMap(b => {
    const ring = bandRing(b).map(map);
    const clean = ring.filter((p, i) => Math.hypot(p.x-ring[(i+ring.length-1)%ring.length].x,p.y-ring[(i+ring.length-1)%ring.length].y)>1e-7);
    return clean.length >= 3 ? [fromRing(clean)] : [];
  }));
}
export function purchasedLengthMm(demand: Demand): number {
  const b = bounds(demand.blank); return b.maxY - b.minY;
}
interface Member {
  demand: Demand; scene: Region; root: string; offcutId?: string;
  source?: string; cutKind?: string; cutSet?: string; role: SectionRole; block: string; depth: number;
}
/** View-model derived from the selected physical allocation. Sections do not
 * change cuts, purchase sheets, merge source identities or rerun the optimiser.
 * Split on role, immediate cut site/set and real disconnected
 * geometry. Exact lengths remain in the section schedule; minor allowance changes do not draw extra stripes. One full-width root remains one purchase even if visible in two
 * disconnected regions or multiple faces. */
export function materialSections(s: Solution): MaterialSection[] {
  const ds = new Map(s.demands.map(d => [d.id,d])), os = new Map(s.offcuts.map(o => [o.id,o]));
  const depths=reuseDepth(s);
  const supply = supplyView(s), buckets = new Map<string, Member[]>();
  const seen = new Set<string>();
  for (const p of s.placements) {
    const d = ds.get(p.demandId); if (!d || seen.has(d.id)) continue; seen.add(d.id);
    const o = os.get(p.offcutId ?? '');
    const role: SectionRole = p.kind==='new' ? supply.fillerDemandIds.has(d.id) ? 'new-filler' : 'new-bank' :
      supply.continuationDemandIds.has(d.id) ? 'bank-continuation' : o?.sourceFaceId===d.faceId ? 'self-fill' : 'offcut';
    const block = supply.blockByPlacement.get(d.id) ?? `unresolved:${d.id}`;
    const key = JSON.stringify([d.faceId,role,block,depths.get(d.id)??0,p.kind==='reuse'?o?.sourceFaceId:'',p.kind==='reuse'?o?.cutSetId:'',
      p.kind==='reuse'?p.rotation:'purchased-operation']);
    const member: Member = { demand:d, scene:mapRegion(d.cover,q=>demandPointToScene(q,d)), root:p.kind==='new'?d.id:o?.rootDemandId??o?.sourceDemandId??'',
      role,block,depth:depths.get(d.id)??0,offcutId:p.kind==='reuse'?o?.id:undefined,source:o?.sourceFaceId,cutKind:o?.cutKind,cutSet:o?.cutSetId };
    const bucket=buckets.get(key)??[]; bucket.push(member); buckets.set(key,bucket);
  }
  const sections: MaterialSection[]=[];
  for (const [key,members] of buckets) {
    for (const [index,region] of components(unionAll(members.map(m=>m.scene))).entries()) {
      const included=members.map(m=>({m,part:intersect(m.scene,region)})).filter(({part})=>area(part)>1e-8);
      if (!included.length) continue;
      const first=included[0].m, unique=(values:(string|undefined)[])=>[...new Set(values.filter((v):v is string=>!!v))].sort();
      let netCoverAreaM2=0,cutPieceRunLinealM=0;
      for (const {m,part} of included) {
        const local=mapRegion(part,p=>scenePointToDemand(p,m.demand));
        const b=bounds(local); netCoverAreaM2+=area(local)/1e6;cutPieceRunLinealM+=(b.maxY-b.minY)/1000;
      }
      sections.push({id:`section:${first.demand.faceId}:${fingerprint([key,index,included.map(i=>i.m.demand.id)])}`,
        faceId:first.demand.faceId,role:first.role,supplyBlockId:first.block,reuseGeneration:first.depth,region,
        demandIds:unique(included.map(i=>i.m.demand.id)),offcutIds:unique(included.map(i=>i.m.offcutId)),
        rootDemandIds:unique(included.map(i=>i.m.root)),sourceFaceIds:unique(included.map(i=>i.m.source)),
        cutKinds:unique(included.map(i=>i.m.cutKind)),cutSetIds:unique(included.map(i=>i.m.cutSet)),
        positionCount:included.length,purchasedDemandIds:[],sharedPurchasedDemandIds:[],purchasedLinealM:0,
        netCoverAreaM2,cutPieceRunLinealM});
    }
  }
  // Stable order, including narrow/disjoint regions of the same physical sheet.
  sections.sort((a,b)=>a.faceId.localeCompare(b.faceId)||Math.min(...a.demandIds.map(id=>ds.get(id)!.laneIndex))-Math.min(...b.demandIds.map(id=>ds.get(id)!.laneIndex))||bounds(a.region).minY-bounds(b.region).minY||a.id.localeCompare(b.id));
  const allocated = new Set<string>();
  for (const section of sections) if (section.role==='new-bank'||section.role==='new-filler') {
    for (const id of section.demandIds) {
      if (allocated.has(id)) { section.sharedPurchasedDemandIds.push(id); continue; }
      allocated.add(id);section.purchasedDemandIds.push(id);section.purchasedLinealM+=purchasedLengthMm(ds.get(id)!)/1000;
    }
  }
  return sections;
}
