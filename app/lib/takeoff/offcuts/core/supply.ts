import type { Demand, Solution } from './types';
import { area, bounds } from './regions';

export interface SupplyBlock {
  id: string;
  faceIds: string[];
  rootDemandIds: string[];
  newCount: number;
}
export interface SupplyView {
  blocks: SupplyBlock[];
  blockByRootDemand: Map<string,string>;
  blockByPlacement: Map<string,string>;
  fillerDemandIds: Set<string>;
  continuationDemandIds: Set<string>;
}

/** A direction family is not a material colour. Independent self-fill operations
 * F, K and D keep separate block IDs even when their directions are parallel.
 * Only an actual registered same-family continuation joins new purchasing faces
 * (A/J). Child cuts keep the ORIGINAL stock's block, not the last cutting face. */
export function supplyView(s: Pick<Solution,'demands'|'placements'|'offcuts'|'bankLayout'>): SupplyView {
  const demands=new Map(s.demands.map(d=>[d.id,d]));
  const offcuts=new Map(s.offcuts.map(o=>[o.id,o]));
  const fresh=s.placements.filter(p=>p.kind==='new').map(p=>demands.get(p.demandId)!).filter(Boolean);
  const freshFaces=new Set(fresh.map(d=>d.faceId)),parent=new Map([...freshFaces].map(id=>[id,id]));
  const root=(id:string):string=>{let p=parent.get(id)??id;while(parent.has(p)&&parent.get(p)!==p)p=parent.get(p)!;return p;};
  const join=(a:string,b:string):void=>{const x=root(a),y=root(b);if(x!==y)parent.set(x,y);};
  const self=new Set(s.bankLayout?.selfFillFaceIds??[]);
  for(const operation of s.bankLayout?.primaryOperations??[]){
    const members=operation.faceIds.filter(id=>freshFaces.has(id)&&!self.has(id));
    for(const id of members.slice(1))join(members[0],id);
  }
  for(const p of s.placements)if(p.kind==='reuse'){
    const d=demands.get(p.demandId),o=offcuts.get(p.offcutId??'');
    const original=demands.get(o?.rootDemandId??o?.sourceDemandId??'');
    if(!d||!original||!freshFaces.has(d.faceId)||self.has(d.faceId)||self.has(original.faceId))continue;
    if(d.materialBankId&&d.materialBankId===original.materialBankId&&d.faceId!==original.faceId){
      const cross=(d.frame.origin.x*d.frame.u.x+d.frame.origin.y*d.frame.u.y)*d.frame.mmPerSceneUnit+d.origin.x;
      // Inter-bank donation does not unite two unrelated purchasing operations.
      if(o?.sourceCrossMm!==undefined&&Math.abs(o.sourceCrossMm-cross)<.01)join(d.faceId,original.faceId);
    }
  }
  const byRoot=new Map<string,SupplyBlock>();
  for(const d of fresh){
    const key=root(d.faceId),b=byRoot.get(key)??{id:'',faceIds:[],rootDemandIds:[],newCount:0};
    if(!b.faceIds.includes(d.faceId))b.faceIds.push(d.faceId);
    b.rootDemandIds.push(d.id);b.newCount++;byRoot.set(key,b);
  }
  const blocks=[...byRoot.values()];
  for(const b of blocks){b.faceIds.sort();b.id=`supply:${b.faceIds.join('+')}`;b.rootDemandIds.sort();}
  blocks.sort((a,b)=>a.id.localeCompare(b.id));
  const blockByRootDemand=new Map(blocks.flatMap(b=>b.rootDemandIds.map(id=>[id,b.id] as const)));
  const blockByPlacement=new Map<string,string>();
  for(const p of s.placements){
    const o=offcuts.get(p.offcutId??''),original=p.kind==='new'?p.demandId:o?.rootDemandId??o?.sourceDemandId;
    const id=original&&blockByRootDemand.get(original);if(id)blockByPlacement.set(p.demandId,id);
  }
  // Grey is a VISUAL separator between cutting groups, not a synonym for a
  // rectangular sheet. A continuous main bank stays coloured even if its ridge
  // cells have square tops or a useful valley cut at the other end. A self-fill
  // operation stays one colour and its own hatch throughout.
  const fillerDemandIds=new Set<string>();
  const byPlacement=new Map(s.placements.map(p=>[p.demandId,p]));
  for(const faceId of new Set(s.demands.map(d=>d.faceId))){
    if(self.has(faceId))continue;
    const rows=s.demands.filter(d=>d.faceId===faceId).sort((a,b)=>a.laneIndex-b.laneIndex);
    const own=rows.filter(d=>byPlacement.get(d.id)?.kind==='new');
    const hasExternalReuse=rows.some(d=>{
      const p=byPlacement.get(d.id),o=offcuts.get(p?.offcutId??'');
      const r=demands.get(o?.rootDemandId??'');
      return p?.kind==='reuse'&&r?.faceId!==faceId&&!blocks.find(b=>b.id===blockByPlacement.get(d.id))?.faceIds.includes(faceId);
    });
    const length=(d:Demand)=>{const b=bounds(d.stockEndProof?.originalBlank??d.blank);return b.maxY-b.minY;};
    const longest=Math.max(0,...own.map(length));
    for(const d of own){
      const ridge=d.zoneRole==='ridge-fill'||d.stockRole==='filler';
      // A lower ridge shelf in a stepped primary remains an explicit new filler
      // between different cuts. Minor clearance/rounding differences do not
      // split one stock-size block into a grey stripe.
      const shorterShelf=ridge&&length(d)<longest-Math.max(150,longest*.03);
      if(shorterShelf||hasExternalReuse&&(ridge||!s.bankLayout?.primaryFaceIds.includes(faceId)))fillerDemandIds.add(d.id);
    }
  }
  const continuationDemandIds=new Set<string>();
  for(const p of s.placements)if(p.kind==='reuse'){
    const d=demands.get(p.demandId),o=offcuts.get(p.offcutId??'');if(!d||!o)continue;
    const operation=s.bankLayout?.primaryOperations?.find(op=>op.faceIds.includes(d.faceId)&&op.faceIds.includes(o.sourceFaceId));
    const cross=(d.frame.origin.x*d.frame.u.x+d.frame.origin.y*d.frame.u.y)*d.frame.mmPerSceneUnit+d.origin.x;
    if(operation&&d.faceId!==o.sourceFaceId&&o.sourceCrossMm!==undefined&&Math.abs(o.sourceCrossMm-cross)<.01)continuationDemandIds.add(d.id);
  }
  return {blocks,blockByRootDemand,blockByPlacement,fillerDemandIds,continuationDemandIds};
}

export interface MaterialSummary {
  netRoofMm2: number; suppliedMm2: number; reservedOnRoofMm2: number;
  cuttingRemainderMm2: number; overlapAndEnvelopeMm2: number;
  supplyUpliftPercent: number | null; cuttingRemainderPercent: number | null;
  newCutCount: number; newFillerCount: number; reuseCount: number;
}
/** Geometry-derived material requirement, not a profit prediction or a spare
 * allowance. Net roof surface already includes pitch. Supply uplift includes
 * physical laps, end allowances and conservative run envelopes as well as cuts. */
export function materialSummary(s:Solution):MaterialSummary {
  const supply=supplyView(s),freshIds=new Set(s.placements.filter(p=>p.kind==='new').map(p=>p.demandId));
  const supplied=s.demands.filter(d=>freshIds.has(d.id)).reduce((n,d)=>n+area(d.blank),0);
  const net=s.demands.reduce((n,d)=>n+area(d.cover),0),reserved=s.demands.reduce((n,d)=>n+area(d.required),0);
  return{netRoofMm2:net,suppliedMm2:supplied,reservedOnRoofMm2:reserved,
    cuttingRemainderMm2:supplied-reserved,overlapAndEnvelopeMm2:reserved-net,
    supplyUpliftPercent:net>0?(supplied/net-1)*100:null,
    cuttingRemainderPercent:supplied>0?(supplied-reserved)/supplied*100:null,
    newCutCount:freshIds.size-supply.fillerDemandIds.size,newFillerCount:supply.fillerDemandIds.size,
    reuseCount:s.placements.filter(p=>p.kind==='reuse').length};
}
export function isRidgeFillerRole(d:Demand):boolean{return d.zoneRole==='ridge-fill';}
