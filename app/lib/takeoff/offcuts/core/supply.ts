import type { Demand, Solution } from './types';
import { area } from './regions';

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
  const usedSources=new Set(s.placements.filter(p=>p.kind==='reuse').map(p=>offcuts.get(p.offcutId??'')?.sourceDemandId));
  const primary=new Set(s.bankLayout?.primaryFaceIds??[]);
  // Grey denotes the ridge/gap FILLING ROLE, not an uncut rectangle. A grey
  // ridge sheet may have a valley cut below it and supply a coloured offcut.
  // That offcut still inherits its original cutting block, never 'grey stock'.
  const fillerDemandIds=new Set(fresh.filter(d=>d.zoneRole==='ridge-fill'||d.stockRole==='filler'||
    !primary.has(d.faceId)&&!usedSources.has(d.id)).map(d=>d.id));
  return {blocks,blockByRootDemand,blockByPlacement,fillerDemandIds};
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
