import type { Solution } from './types';
import { planQuality, planSignature } from './diagnostics';
/** Both trade-offs are anchored to the unchanged Recommended plan. A displayed
 * alternative never provides another material/complexity allowance. */
export function alternativeReference(current:Solution,saved:Solution[],_objective:'simpler'|'less-material'):Solution {
  const compatible=[...saved,current].filter(s=>!s.salvage&&s.status!=='invalid'&&s.sourceRevision===current.sourceRevision&&s.facesRevision===current.facesRevision);
  const recommended=compatible.find(s=>s.objective==='recommended');
  if(recommended)return recommended;
  // Old unlabelled first plans can be rechecked by the solver. Never substitute
  // a known alternative, however cheap it might be, for the fixed reference.
  const original=compatible.find(s=>s.objective===undefined);
  if(original)return original;
  throw new Error('Create a Recommended plan before requesting an alternative.');
}
export function lowestMaterialSavedPlan(current:Solution,saved:Solution[]):Solution {
  return [current,...saved].filter(s=>s.status!=='invalid'&&s.sourceRevision===current.sourceRevision&&s.facesRevision===current.facesRevision)
    .reduce((best,s)=>{const a=planQuality(best),b=planQuality(s);return b.suppliedMm2<a.suppliedMm2-1||
      Math.abs(b.suppliedMm2-a.suppliedMm2)<=1&&b.complexity<a.complexity?s:best;},current);
}
export function differentSavedPlan(a:Solution,b:Solution):boolean { return planSignature(a)!==planSignature(b); }
