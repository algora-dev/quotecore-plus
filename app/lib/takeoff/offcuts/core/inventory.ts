import type { Demand, Offcut, Placement, Profile } from './types';
import { rotate180, translate } from './regions';
import { offcutsFrom, offcutsFromMaterial } from './material';

export function materialAtDestination(offcut:Offcut,placement:Placement){
  return translate(placement.rotation===180?rotate180(offcut.region,offcut.widthMm):offcut.region,0,placement.translateY);
}
/** Rebuild, rather than trust, a persisted inventory. Each reuse consumes one
 * parent piece and may generate children. Pending dependencies must resolve;
 * cycles/missing parents cannot mint new metal. */
export function rebuildInventory(demands:Demand[],placements:Placement[],profile:Profile): {offcuts:Offcut[]; unresolved:string[]} {
  const ds=new Map(demands.map(d=>[d.id,d])), stock=new Map<string,Offcut>();
  for(const p of placements)if(p.kind==='new'){
    const d=ds.get(p.demandId);if(d)for(const o of offcutsFrom(d,profile))stock.set(o.id,o);
  }
  let pending=placements.filter(p=>p.kind==='reuse');
  for(let pass=0;pending.length && pass<=placements.length;pass++){
    const next:Placement[]=[];let progress=false;
    for(const p of pending){
      const d=ds.get(p.demandId),o=stock.get(p.offcutId??'');
      if(!d||!o||!Number.isFinite(p.translateY)||(p.rotation!==0&&p.rotation!==180)){next.push(p);continue;}
      for(const child of offcutsFromMaterial(d,profile,materialAtDestination(o,p),o))stock.set(child.id,child);
      progress=true;
    }
    pending=next;if(!progress)break;
  }
  return{offcuts:[...stock.values()],unresolved:pending.map(p=>p.demandId)};
}
