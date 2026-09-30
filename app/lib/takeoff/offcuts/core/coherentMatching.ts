import type { Demand, Offcut, Placement, Profile } from './types';
import type { FaceMatch } from './matching';
import { area, fitY, rotate180 } from './regions';
import { isStraightFiller } from './material';
import { dot } from './math';

interface Pattern {
  placements: Placement[]; ids: Set<string>; offcuts: Set<string>;
  area: number; sourceArea: number; saving: number; key: string;
  groups: Set<number>; runs: number;
}
export interface CoherentMatch extends FaceMatch {
  reusedArea: number; cutArea: number; cutCount: number; newCutCount: number;
  sourceUtilisation: number; retainedFraction: number; groupsUsed: number;
}

/** Modular at PHYSICAL SHEET boundaries, never at arbitrary polygon vertices.
 * Each mapping is an ordered source run (possibly reversed end-for-end). Two
 * portions of a set can flank new fillers or go to different faces on later
 * passes. Oversized pieces are recut by the exact containment fitter, including
 * a different angled end or a square end. An exact-shape match is not required.
 *
 * This matcher does not decide source policy. The bank search provides one or
 * two coherent pools; it does not offer every scrap from the whole roof. */
export function matchCoherentSets(demands: Demand[], inventory: Offcut[], profile: Profile,
  check:()=>void=()=>{}, preserveBankRegistration=false): CoherentMatch {
  const cuts=demands.filter(d=>!isStraightFiller(d.required));
  const cutArea=cuts.reduce((n,d)=>n+area(d.required),0);
  const byLane=new Map(demands.map(d=>[d.laneIndex,d]));
  const stockById=new Map(inventory.map(o=>[o.id,o]));
  const buckets=new Map<string,Offcut[]>();
  for(const o of inventory){
    const key=o.cutSetId??`${o.sourceFaceId}:legacy`;
    const list=buckets.get(key)??[];list.push(o);buckets.set(key,list);
  }
  const groups:Offcut[][]=[];
  for(const list of buckets.values()){
    list.sort((a,b)=>(a.sourceLaneIndex??0)-(b.sourceLaneIndex??0)||a.id.localeCompare(b.id));
    let group:Offcut[]=[];
    for(const o of list){
      if(group.length&&(o.sourceLaneIndex??0)!==(group[group.length-1].sourceLaneIndex??0)+1){groups.push(group);group=[];}
      group.push(o);
    }
    if(group.length)groups.push(group);
  }
  const groupAreas=groups.map(g=>g.reduce((n,o)=>n+area(o.region),0));
  const groupArea=(p:Pattern)=>[...p.groups].reduce((n,i)=>n+groupAreas[i],0);
  // Slightly favour simpler patterns when supplied material is nearly equal.
  const rank=(p:Pattern)=>p.saving-(p.runs-1)*profile.coverMm*10;
  const compare=(a:Pattern,b:Pattern)=>rank(b)-rank(a)||b.area-a.area||a.sourceArea-b.sourceArea||a.key.localeCompare(b.key);
  const empty:Pattern={placements:[],ids:new Set(),offcuts:new Set(),area:0,sourceArea:0,saving:0,key:'',groups:new Set(),runs:0};
  let states:Pattern[]=[empty];
  for(let groupNo=0;groupNo<groups.length;groupNo++){
    check();const group=groups[groupNo],patterns:Pattern[]=[],seen=new Set<string>();
    const fitCache=new Map<string,Placement|null>();
    const sourceById=new Map(group.map(o=>[o.id,o]));
    function addPattern(ps:Placement[]):void {
      if(!ps.length)return;
      const ordered=[...ps].sort((a,b)=>byDemand.get(a.demandId)!.laneIndex-byDemand.get(b.demandId)!.laneIndex);
      const key=ordered.map(p=>`${p.demandId}/${p.offcutId}/${p.rotation}`).join('|');
      if(seen.has(key))return;seen.add(key);
      let runs=0,last=-Infinity;
      for(const p of ordered){const lane=byDemand.get(p.demandId)!.laneIndex;if(lane!==last+1)runs++;last=lane;}
      // A match is a few real blocks, not alternating single scraps and new lanes.
      if(runs>2)return;
      patterns.push({placements:ordered,ids:new Set(ordered.map(p=>p.demandId)),offcuts:new Set(ordered.map(p=>p.offcutId!)),
        area:ordered.reduce((n,p)=>n+area(byDemand.get(p.demandId)!.required),0),
        saving:ordered.reduce((n,p)=>n+area(byDemand.get(p.demandId)!.blank),0),
        sourceArea:ordered.reduce((n,p)=>n+area(sourceById.get(p.offcutId!)!.region),0),
        key:`${groupNo}:${key}`,groups:new Set([groupNo]),runs});
    }
    const byDemand=new Map(demands.map(d=>[d.id,d]));
    for(const rotation of (profile.allowEndForEnd?[0,180]:[0]) as (0|180)[]){
      const sign=rotation===180?-1:1,shifts=new Set<number>();
      for(const o of group)for(const d of demands)shifts.add(d.laneIndex-sign*(o.sourceLaneIndex??0));
      for(const shift of shifts){
        check();const fitted:Placement[]=[];
        for(const o of group){
          const d=byLane.get(sign*(o.sourceLaneIndex??0)+shift);
          if(d&&preserveBankRegistration&&(o.sourceCrossMm===undefined||Math.abs(o.sourceCrossMm-(dot(d.frame.origin,d.frame.u)*d.frame.mmPerSceneUnit+d.origin.x))>.01))continue;
          if(!d||(rotation===180?-o.lap:o.lap)!==d.lap||Math.abs(o.widthMm-d.widthMm)>1e-6)continue;
          const cacheKey=`${o.id}/${d.id}/${rotation}`;
          let fit=fitCache.get(cacheKey);
          if(fit===undefined){
            const stock=rotation===180?rotate180(o.region,o.widthMm):o.region;
            const dy=area(stock)+1e-3>=area(d.required)?fitY(stock,d.required):null;
            fit=dy===null?null:{demandId:d.id,kind:'reuse',offcutId:o.id,rotation,translateY:dy};fitCache.set(cacheKey,fit);
          }
          if(fit)fitted.push(fit);
        }
        addPattern(fitted);
        // Contiguous windows can be combined at a different shift on a second
        // pass through this group. No fractional-width slicing is introduced.
        const runs:Placement[][]=[];
        for(const p of fitted){
          const last=runs[runs.length-1],prev=last?.[last.length-1];
          if(prev&&Math.abs(byDemand.get(p.demandId)!.laneIndex-byDemand.get(prev.demandId)!.laneIndex)===1&&
            Math.abs((sourceById.get(p.offcutId!)!.sourceLaneIndex??0)-(sourceById.get(prev.offcutId!)!.sourceLaneIndex??0))===1)last.push(p);
          else runs.push([p]);
        }
        for(const run of runs){
          addPattern(run);
          // Prefix/suffix windows cover the modular splits without the cubic
          // explosion of all arbitrary subsequences of sheets on a large bank.
          for(let k=1;k<run.length;k++){addPattern(run.slice(0,k));addPattern(run.slice(k));}
        }
      }
    }
    patterns.sort(compare);
    // Include varied source subsets, not only different offsets of the same set.
    const subsets=new Set<string>();
    const options=patterns.filter(p=>{const k=[...p.offcuts].sort().join('|')+'/'+[...p.ids].sort().join('|');if(subsets.has(k))return false;subsets.add(k);return true;}).slice(0,24);
    const combine=(state:Pattern,p:Pattern):Pattern|null=>{
      if([...p.ids].some(id=>state.ids.has(id))||[...p.offcuts].some(id=>state.offcuts.has(id)))return null;
      const placements=[...state.placements,...p.placements];
      // Maximum four contiguous source-set runs on a destination is enough for
      // hip halves and a ridge gap, without quietly reintroducing a mosaic.
      const ordered=[...placements].sort((a,b)=>byDemand.get(a.demandId)!.laneIndex-byDemand.get(b.demandId)!.laneIndex);
      let runs=0,lastLane=-Infinity,lastSet='';
      for(const q of ordered){
        const o=stockById.get(q.offcutId!)!,lane=byDemand.get(q.demandId)!.laneIndex;
        const set=o.cutSetId??o.sourceFaceId;
        if(lane!==lastLane+1||set!==lastSet)runs++;
        lastLane=lane;lastSet=set;
      }
      if(runs>4)return null;
      return{placements,ids:new Set([...state.ids,...p.ids]),offcuts:new Set([...state.offcuts,...p.offcuts]),
        area:state.area+p.area,saving:state.saving+p.saving,sourceArea:state.sourceArea+p.sourceArea,
        key:state.key+';'+p.key,groups:new Set([...state.groups,...p.groups]),runs};
    };
    // Up to two non-overlapping slices of a given set can serve this face.
    for(let pass=0;pass<2;pass++){
      const next=[...states];
      for(const state of states)for(const p of options){check();const joined=combine(state,p);if(joined)next.push(joined);}
      next.sort(compare);
      const unique=new Set<string>();
      states=next.filter(s=>{const k=[...s.ids].sort().join('|')+'#'+[...s.offcuts].sort().join('|');if(unique.has(k))return false;unique.add(k);return true;}).slice(0,24);
    }
  }
  const best=states[0],fitted=new Map(best.placements.map(p=>[p.demandId,p]));let freshArea=0;
  const placements=demands.map((d):Placement=>{
    const p=fitted.get(d.id);if(p)return p;freshArea+=area(d.blank);return{demandId:d.id,kind:'new',rotation:0,translateY:0};
  });
  return{placements,freshArea,used:best.offcuts,sourceCount:new Set(inventory.filter(o=>best.offcuts.has(o.id)).map(o=>o.sourceFaceId)).size,
    reusedArea:best.area,cutArea,cutCount:cuts.length,newCutCount:cuts.filter(d=>!fitted.has(d.id)).length,
    sourceUtilisation:groupArea(best)?best.sourceArea/groupArea(best):0,
    retainedFraction:best.sourceArea?best.area/best.sourceArea:0,groupsUsed:best.groups.size};
}
