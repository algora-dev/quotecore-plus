import type { MaterialSavingAssessment, MaterialSavingTier, Profile, Solution, WorkflowMetric, WorkflowQuality } from './types';
import { planQuality, planSignature, workflowQuality } from './diagnostics';
import { reuseDepth } from './reuseDepth';

type Plan = Pick<Solution,'demands'|'placements'|'offcuts'|'bankLayout'>;
/** Engineering/product starting points for roofer review, NOT roof/manufacturer
 * facts. Recommended and Simpler ranking are not changed by these limits. */
export const LESS_MATERIAL_POLICY = Object.freeze({
  id: 'material-trade-off-v1' as const,
  minimumSavingM2: 1, // Avoid presenting cosmetic sub-square-metre variants.
  strongSavingM2: 10,
  finalCandidateLimit: 12,
  nearTieCoverAreaM2: .25,
  maxAddedDepth: 1,
  maximumNewReuseDepth: 3,
});
/** Same grouped-work weights as V2.14; count only positive changes here so
 * deleting one easy task cannot buy permission for many new fragmented tasks. */
export const MATERIAL_WORK_WEIGHTS: Readonly<Record<WorkflowMetric,number>> = Object.freeze({
  sourceRelationships:12,splitSets:10,reuseRuns:4,recutRuns:1,freshCutRuns:1,
  fillerSeparators:3,primaryOperations:4,stockLengthGroups:2,
});
const ZERO:Record<WorkflowMetric,number>={sourceRelationships:0,splitSets:0,reuseRuns:0,recutRuns:0,
  freshCutRuns:0,fillerSeparators:0,primaryOperations:0,stockLengthGroups:0};
export interface MaterialWorkLimits {tier:MaterialSavingTier; points:number; increases:Record<WorkflowMetric,number>; depth:number}
/** No percentage gate or money conversion. All comparisons share one profile. */
export function materialWorkLimits(savedM2:number):MaterialWorkLimits {
  if(savedM2+1e-6>=10)return {tier:'moderate',points:48,depth:1,increases:{
    sourceRelationships:2,splitSets:1,reuseRuns:4,recutRuns:4,freshCutRuns:2,
    fillerSeparators:2,primaryOperations:1,stockLengthGroups:2}};
  if(savedM2+1e-6>=7.5)return {tier:'small',points:24,depth:0,increases:{
    sourceRelationships:1,splitSets:1,reuseRuns:3,recutRuns:2,freshCutRuns:2,
    fillerSeparators:1,primaryOperations:1,stockLengthGroups:1}};
  if(savedM2+1e-6>=5)return {tier:'very-small',points:12,depth:0,increases:{
    sourceRelationships:1,splitSets:0,reuseRuns:1,recutRuns:1,freshCutRuns:1,
    fillerSeparators:1,primaryOperations:0,stockLengthGroups:1}};
  return {tier:'equivalent',points:0,depth:0,increases:{...ZERO}};
}
/** Pure policy gate, exposed to test boundary cases without manufacturing a roof.
 * Only the final solver may declare physical fit. Passing here alone is NOT proof
 * of complete coverage, valid offcut lineage or a successful receiver certificate. */
export function evaluateMaterialTradeOff(input:{baselineLayoutId:string;baselineLinealM:number;proposedLinealM:number;
  coverMm:number;newSheetDelta:number;previousWorkflow:WorkflowQuality;proposedWorkflow:WorkflowQuality;
  previousReuseDepth:number;proposedReuseDepth:number}):MaterialSavingAssessment {
  const {baselineLinealM,proposedLinealM,coverMm,previousWorkflow,proposedWorkflow,previousReuseDepth,proposedReuseDepth}=input;
  if(![baselineLinealM,proposedLinealM,coverMm].every(Number.isFinite)||baselineLinealM<=0||proposedLinealM<0||coverMm<=0)
    throw new Error('A valid cover and purchased-length totals are required for the material-saving comparison.');
  const keys=Object.keys(MATERIAL_WORK_WEIGHTS) as WorkflowMetric[];
  if(![previousReuseDepth,proposedReuseDepth].every(n=>Number.isInteger(n)&&n>=0)||
    ![previousWorkflow,proposedWorkflow].every(w=>Number.isFinite(w.score)&&w.score>=0&&keys.every(k=>Number.isFinite(w[k])&&w[k]>=0)))
    throw new Error('Invalid workflow counts for the material-saving comparison.');
  const baselineCoverAreaM2=baselineLinealM*coverMm/1000,proposedCoverAreaM2=proposedLinealM*coverMm/1000;
  const savedLinealM=baselineLinealM-proposedLinealM,savedCoverAreaM2=baselineCoverAreaM2-proposedCoverAreaM2;
  const limits=materialWorkLimits(savedCoverAreaM2),workflowDelta={...ZERO};
  for(const key of keys)workflowDelta[key]=proposedWorkflow[key]-previousWorkflow[key];
  const addedDepth=Math.max(0,proposedReuseDepth-previousReuseDepth);
  const addedWorkPoints=keys.reduce((n,k)=>n+Math.max(0,workflowDelta[k])*MATERIAL_WORK_WEIGHTS[k],0)+12*addedDepth;
  const exceededLimits=keys.filter(k=>workflowDelta[k]>limits.increases[k]);
  // Do not newly extend a deep chain that already exists in Recommended.
  const maximumReuseDepth=Math.max(previousReuseDepth,LESS_MATERIAL_POLICY.maximumNewReuseDepth);
  let reason:MaterialSavingAssessment['reason']='within-policy';
  if(savedCoverAreaM2<LESS_MATERIAL_POLICY.minimumSavingM2-1e-6)reason='insufficient-material-saving';
  else if(addedDepth>limits.depth||proposedReuseDepth>maximumReuseDepth)reason='reuse-depth-limit';
  else if(exceededLimits.length)reason='workflow-limit';
  else if(addedWorkPoints>limits.points)reason='workflow-budget';
  return {policy:LESS_MATERIAL_POLICY.id,accepted:reason==='within-policy',reason,
    baselineLayoutId:input.baselineLayoutId,tier:limits.tier,baselineCoverAreaM2,proposedCoverAreaM2,
    baselineLinealM,proposedLinealM,savedLinealM,savedCoverAreaM2,newSheetDelta:input.newSheetDelta,
    minimumSavingM2:LESS_MATERIAL_POLICY.minimumSavingM2,strongSavingM2:LESS_MATERIAL_POLICY.strongSavingM2,
    previousWorkflow,proposedWorkflow,workflowDelta,previousReuseDepth,proposedReuseDepth,addedWorkPoints,
    maxAddedWorkPoints:limits.points,maxIncreases:limits.increases,maxAdditionalReuseDepth:limits.depth,
    maximumReuseDepth,exceededLimits};
}
export function lessMaterialAssessment(previous:Plan,proposed:Plan,profile:Profile):MaterialSavingAssessment {
  const a=planQuality(previous),b=planQuality(proposed),width=profile.coverMm+profile.leftLapMm+profile.rightLapMm;
  if(!Number.isFinite(width)||width<=0)throw new Error('Invalid physical sheet width.');
  const depth=(p:Plan)=>Math.max(0,...reuseDepth(p).values());
  return evaluateMaterialTradeOff({baselineLayoutId:planSignature(previous),
    baselineLinealM:a.suppliedMm2/width/1000,proposedLinealM:b.suppliedMm2/width/1000,coverMm:profile.coverMm,
    newSheetDelta:b.newSheets-a.newSheets,previousWorkflow:workflowQuality(previous,a),proposedWorkflow:workflowQuality(proposed,b),
    previousReuseDepth:depth(previous),proposedReuseDepth:depth(proposed)});
}
/** Stable two-stage near-tie handling; not a non-transitive fuzzy comparator. */
export function rankMaterialCandidates<T>(items:T[],assessment:(item:T)=>MaterialSavingAssessment):T[] {
  const accepted=items.filter(x=>assessment(x).accepted);
  if(!accepted.length)return [...items].sort((a,b)=>assessment(a).proposedCoverAreaM2-assessment(b).proposedCoverAreaM2);
  const minimum=Math.min(...accepted.map(x=>assessment(x).proposedCoverAreaM2));
  const near=accepted.filter(x=>assessment(x).proposedCoverAreaM2<=minimum+LESS_MATERIAL_POLICY.nearTieCoverAreaM2+1e-6)
    .sort((a,b)=>assessment(a).addedWorkPoints-assessment(b).addedWorkPoints||
      assessment(a).proposedWorkflow.score-assessment(b).proposedWorkflow.score||
      assessment(a).proposedCoverAreaM2-assessment(b).proposedCoverAreaM2);
  const chosen=near[0];
  return [chosen,...items.filter(x=>x!==chosen).sort((a,b)=>Number(!assessment(a).accepted)-Number(!assessment(b).accepted)||
    assessment(a).proposedCoverAreaM2-assessment(b).proposedCoverAreaM2||assessment(a).proposedWorkflow.score-assessment(b).proposedWorkflow.score)];
}
