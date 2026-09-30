import type { Demand, Offcut, Placement, Profile } from './types';
import type { FaceMatch } from './matching';
import { area, fitY, rotate180 } from './regions';
import { isStraightFiller } from './material';
import { dot } from './math';

interface Pattern { placements: Placement[]; ids: Set<string>; offcuts: Set<string>; area: number; groupArea: number; sourceArea: number; key: string }
export interface CoherentMatch extends FaceMatch {
  reusedArea: number; cutArea: number; cutCount: number; newCutCount: number;
  sourceUtilisation: number; retainedFraction: number; groupsUsed: number;
}

/** Exact sheet fits under an ORDERED cut-set mapping. A set may be translated
 * and turned end-for-end, but sheets are not arbitrarily permuted/interleaved.
 * Separate hip halves may join on one target. New straight fillers are skipped.
 * All input inventory must belong to one root material bank. */
export function matchCoherentSets(demands: Demand[], inventory: Offcut[], profile: Profile,
  check:()=>void=()=>{}, preserveBankRegistration=false): CoherentMatch {
  const cuts=demands.filter(d=>!isStraightFiller(d.required));
  const cutArea=cuts.reduce((n,d)=>n+area(d.required),0), byLane=new Map(cuts.map(d=>[d.laneIndex,d]));
  const buckets=new Map<string,Offcut[]>();
  for(const o of inventory){
    const key=o.cutSetId??`${o.sourceFaceId}:legacy`;
    const list=buckets.get(key)??[]; list.push(o);buckets.set(key,list);
  }
  // Gaps between real source pieces split a set; the intervening filler cannot
  // be represented by a fictitious triangular envelope.
  const groups:Offcut[][]=[];
  for(const list of buckets.values()){
    list.sort((a,b)=>(a.sourceLaneIndex??0)-(b.sourceLaneIndex??0)||a.id.localeCompare(b.id));
    let group:Offcut[]=[];
    for(const o of list){
      if(group.length && (o.sourceLaneIndex??0)!==(group[group.length-1].sourceLaneIndex??0)+1){groups.push(group);group=[];}
      group.push(o);
    }
    if(group.length)groups.push(group);
  }
  let states:Pattern[]=[{placements:[],ids:new Set(),offcuts:new Set(),area:0,groupArea:0,sourceArea:0,key:''}];
  let groupNo=0;
  for(const group of groups){
    check();const patterns:Pattern[]=[], seen=new Set<string>(), groupArea=group.reduce((n,o)=>n+area(o.region),0);
    const fitCache=new Map<string,Placement|null>();
    for(const rotation of (profile.allowEndForEnd?[0,180]:[0]) as (0|180)[]){
      const sign=rotation===180?-1:1;
      const shifts=new Set<number>();
      for(const o of group)for(const d of cuts)shifts.add(d.laneIndex-sign*(o.sourceLaneIndex??0));
      for(const shift of shifts){
        check();const placements:Placement[]=[],ids=new Set<string>(),offcuts=new Set<string>();let saved=0,sourceArea=0;
        for(const o of group){
          const d=byLane.get(sign*(o.sourceLaneIndex??0)+shift);
          if(d && preserveBankRegistration && (o.sourceCrossMm === undefined || Math.abs(o.sourceCrossMm-(dot(d.frame.origin,d.frame.u)*d.frame.mmPerSceneUnit+d.origin.x))>.01))continue;
          if(!d || (rotation===180?-o.lap:o.lap)!==d.lap || Math.abs(o.widthMm-d.widthMm)>1e-6)continue;
          const cacheKey=`${o.id}/${d.id}/${rotation}`;
          let fit=fitCache.get(cacheKey);
          if(fit===undefined){
            const available=rotation===180?rotate180(o.region,o.widthMm):o.region;
            const dy=area(available)+1e-3>=area(d.required)?fitY(available,d.required):null;
            fit=dy===null?null:{demandId:d.id,kind:'reuse',offcutId:o.id,rotation,translateY:dy};fitCache.set(cacheKey,fit);
          }
          if(fit){placements.push(fit);ids.add(d.id);offcuts.add(o.id);saved+=area(d.required);sourceArea+=area(o.region);}
        }
        if(!placements.length)continue;
        const key=placements.map(p=>`${p.demandId}/${p.offcutId}/${p.rotation}`).sort().join('|');
        if(seen.has(key))continue;seen.add(key);
        patterns.push({placements,ids,offcuts,area:saved,groupArea,sourceArea,key:`${groupNo}:${key}`});
      }
    }
    patterns.sort((a,b)=>b.area-a.area || (b.sourceArea/b.groupArea)-(a.sourceArea/a.groupArea) || a.key.localeCompare(b.key));
    const options=patterns.slice(0,10), next=[...states];
    for(const state of states)for(const p of options){
      if([...p.ids].some(id=>state.ids.has(id))||[...p.offcuts].some(id=>state.offcuts.has(id)))continue;
      next.push({placements:[...state.placements,...p.placements],ids:new Set([...state.ids,...p.ids]),offcuts:new Set([...state.offcuts,...p.offcuts]),
        area:state.area+p.area,groupArea:state.groupArea+p.groupArea,sourceArea:state.sourceArea+p.sourceArea,key:state.key+';'+p.key});
    }
    next.sort((a,b)=>b.area-a.area||a.groupArea-b.groupArea||a.key.localeCompare(b.key));
    const unique=new Set<string>();states=next.filter(s=>{const key=[...s.ids].sort().join('|')+'#'+[...s.offcuts].sort().join('|');if(unique.has(key))return false;unique.add(key);return true;}).slice(0,24);
    groupNo++;
  }
  const best=states[0], fitted=new Map(best.placements.map(p=>[p.demandId,p]));
  let freshArea=0;
  const placements=demands.map((d):Placement=>{const p=fitted.get(d.id);if(p)return p;freshArea+=area(d.blank);return{demandId:d.id,kind:'new',rotation:0,translateY:0};});
  const sources=new Set(inventory.filter(o=>best.offcuts.has(o.id)).map(o=>o.sourceFaceId));
  return{placements,freshArea,used:best.offcuts,sourceCount:sources.size,reusedArea:best.area,cutArea,cutCount:cuts.length,
    newCutCount:cuts.filter(d=>!fitted.has(d.id)).length,sourceUtilisation:best.groupArea?best.sourceArea/best.groupArea:0,
    retainedFraction:best.sourceArea?best.area/best.sourceArea:0,groupsUsed:best.key.split(';').filter(Boolean).length};
}
