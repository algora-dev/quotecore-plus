import type { Solution } from './types';
import { planQuality, planSignature } from './diagnostics';
/** 'Less material' should beat the lowest purchased material ALREADY FOUND,
 * not merely beat the currently displayed (possibly intentionally expensive)
 * simpler plan. Sheet count is never used as a proxy for purchased length. */
export function alternativeReference(current:Solution,saved:Solution[],objective:'simpler'|'less-material'):Solution {
  if(objective==='simpler')return current;
  const compatible=[current,...saved].filter(s=>s.status!=='invalid'&&s.sourceRevision===current.sourceRevision&&s.facesRevision===current.facesRevision);
  return compatible.reduce((best,s)=>{
    const a=planQuality(best),b=planQuality(s);
    return b.suppliedMm2<a.suppliedMm2-1||Math.abs(b.suppliedMm2-a.suppliedMm2)<=1&&b.complexity<a.complexity?s:best;
  },current);
}
export function differentSavedPlan(a:Solution,b:Solution):boolean { return planSignature(a)!==planSignature(b); }
