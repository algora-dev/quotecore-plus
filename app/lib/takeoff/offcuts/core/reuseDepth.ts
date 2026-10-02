import type { Solution } from './types';
import { supplyView } from './supply';
/** Display reuse generation is a cutting-operation transition, not the raw
 * internal split depth. A/J same-column continuation remains the same operation.
 * Physical generation and parent identity are NEVER changed by this view model. */
export function reuseDepth(s:Pick<Solution,'demands'|'placements'|'offcuts'|'bankLayout'>):Map<string,number> {
  const view=supplyView(s), ps=new Map(s.placements.map(p=>[p.demandId,p])),os=new Map(s.offcuts.map(o=>[o.id,o]));
  const result=new Map<string,number>();
  const visit=(id:string,seen=new Set<string>()):number=>{
    if(result.has(id))return result.get(id)!;
    if(seen.has(id))return 0; // Invalid trees are separately blocked by validation.
    seen.add(id); const p=ps.get(id),o=os.get(p?.offcutId??'');
    const depth=p?.kind==='reuse'&&o ? visit(o.sourceDemandId,seen)+(view.continuationDemandIds.has(id)?0:1):0;
    result.set(id,depth);return depth;
  };
  for(const d of s.demands)visit(d.id);
  return result;
}
