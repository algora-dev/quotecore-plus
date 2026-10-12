/** Optional transfer constraint for the connected reverse search only.
 * A consecutive first-generation hip run is set out as one family. Its strips
 * may not independently slide along the roof merely to pass containment. */
import type { Demand, Offcut, Placement } from './types';
import { fitY, rotate180 } from './regions';
import { factoryEdgeY } from './pairedReceiverFamilies';

export function firstGenerationHip(o: Offcut): boolean {
  return !o.parentOffcutId && (o.generation ?? 0) === 0 &&
    ['hip', 'broken_hip'].includes(o.cutKind ?? '');
}
export function transferRuns(ps: Placement[], dm: Map<string,Demand>, om: Map<string,Offcut>): Placement[][] {
  const runs: Placement[][] = [];
  const ordered = ps.filter(p => p.kind === 'reuse' && om.has(p.offcutId ?? '') &&
    firstGenerationHip(om.get(p.offcutId!)!)).sort((a,b) =>
      dm.get(a.demandId)!.faceId.localeCompare(dm.get(b.demandId)!.faceId) ||
      dm.get(a.demandId)!.laneIndex-dm.get(b.demandId)!.laneIndex);
  for(const p of ordered){
    const last=runs.at(-1), prev=last?.at(-1), o=om.get(p.offcutId!)!, d=dm.get(p.demandId)!;
    const po=prev?om.get(prev.offcutId!)!:null, pd=prev?dm.get(prev.demandId)!:null;
    const sign=p.rotation===180?-1:1;
    if(prev && po && pd && d.faceId===pd.faceId && d.laneIndex===pd.laneIndex+1 &&
      o.sourceFaceId===po.sourceFaceId && !!o.cutSetId && o.cutSetId===po.cutSetId &&
      p.rotation===prev.rotation && o.sourceLaneIndex===po.sourceLaneIndex!+sign) last!.push(p);
    else runs.push([p]);
  }
  return runs;
}
export type TransferInterval = {base:number;lo:number;hi:number};
export function alignTransferredRuns(ps: Placement[], dm: Map<string,Demand>, om: Map<string,Offcut>,
  preference:'centre'|'lower'|'upper'='centre', cache=new Map<string,TransferInterval|null>()): Placement[] | null {
  const changed=new Map<string,Placement>();
  for(const run of transferRuns(ps,dm,om)){
    const intervals:Array<{p:Placement;base:number;lo:number;hi:number}>=[];
    for(const p of run){
      const o=om.get(p.offcutId!)!,d=dm.get(p.demandId)!;
      const key=o.id+'|'+d.id+'|'+p.rotation;
      let interval=cache.get(key);
      if(interval===undefined){
        const stock=p.rotation===180?rotate180(o.region,o.widthMm):o.region;
        const edge=factoryEdgeY(stock,p.rotation,o.widthMm);
        const lo=fitY(stock,d.required,'upper'),hi=fitY(stock,d.required,'lower');
        const base=(edge??0)+d.origin.y;
        interval=edge===null||lo===null||hi===null?null:{base,lo:lo+base,hi:hi+base};
        cache.set(key,interval);
      }
      if(!interval)return null;
      intervals.push({p,...interval});
    }
    const lo=Math.max(...intervals.map(i=>i.lo)),hi=Math.min(...intervals.map(i=>i.hi));
    if(lo>hi+1e-7)return null;
    const y=preference==='lower'?hi:preference==='upper'?lo:(lo+hi)/2;
    for(const i of intervals)changed.set(i.p.demandId,{...i.p,translateY:y-i.base});
  }
  return ps.map(p=>changed.get(p.demandId)??p);
}
