import type { Profile, SimplerAssessment, Solution, WorkflowQuality } from './types';
import { planQuality, planSignature, workflowQuality } from './diagnostics';

type Plan = Pick<Solution,'demands'|'placements'|'offcuts'|'bankLayout'>;
/** Product policy, not roofing dimensions. No cut-fit, lap or receiver tolerance
 * is weakened to achieve these limits. Callers may tighten, never widen them. */
export const SIMPLER_POLICY = Object.freeze({
  maxExtraPercent: 3,
  maxExtraCoverAreaM2: 10,
  maxExtraSheetsFraction: .05,
  minExtraSheetLimit: 2,
  maxExtraSheetLimit: 6,
  minWorkflowReductionFraction: .05,
  minWorkflowReductionPoints: 8,
  finalCandidateLimit: 12,
});
export function simplerPercent(value:number = SIMPLER_POLICY.maxExtraPercent):number {
  if(!Number.isFinite(value)||value<0||value>SIMPLER_POLICY.maxExtraPercent)
    throw new Error('Simpler extra-material limit must be between 0% and 3%.');
  return value;
}
export function simplerAssessment(previous:Plan,proposed:Plan,profile:Profile,maxExtraPercent?:number):SimplerAssessment {
  const percent=simplerPercent(maxExtraPercent),a=planQuality(previous),b=planQuality(proposed);
  const width=profile.coverMm+profile.leftLapMm+profile.rightLapMm;
  if(!Number.isFinite(width)||width<=0||!Number.isFinite(profile.coverMm)||profile.coverMm<=0)
    throw new Error('A valid effective cover is required for the simpler material limit.');
  const baselineLinealM=a.suppliedMm2/width/1000,proposedLinealM=b.suppliedMm2/width/1000;
  // The absolute limit is EFFECTIVE COVER area, not developed coil/profile area.
  // This also bounds purchased lineals correctly when side laps are configured.
  const maxExtraCoverAreaM2=Math.min(SIMPLER_POLICY.maxExtraCoverAreaM2,baselineLinealM*profile.coverMm/1000*percent/100);
  const extraLinealM=proposedLinealM-baselineLinealM,extraCoverAreaM2=extraLinealM*profile.coverMm/1000;
  const maxExtraNewSheets=Math.min(SIMPLER_POLICY.maxExtraSheetLimit,
    Math.max(SIMPLER_POLICY.minExtraSheetLimit,Math.ceil(a.newSheets*SIMPLER_POLICY.maxExtraSheetsFraction)));
  const previousWorkflow=workflowQuality(previous,a),proposedWorkflow=workflowQuality(proposed,b);
  const scoreReduction=previousWorkflow.score-proposedWorkflow.score;
  const minimumScoreReduction=Math.max(SIMPLER_POLICY.minWorkflowReductionPoints,
    Math.ceil(previousWorkflow.score*SIMPLER_POLICY.minWorkflowReductionFraction));
  const benefits:string[]=[];
  const labels:[keyof WorkflowQuality,string][]=[['sourceRelationships','source transfer'],['splitSets','split cut set'],
    ['reuseRuns','separate reuse run'],['fillerSeparators','filler group'],['recutRuns','recut run']];
  for(const [key,label] of labels){const reduction=Number(previousWorkflow[key])-Number(proposedWorkflow[key]);
    if(reduction>0)benefits.push(`${reduction} fewer ${label}${reduction===1?'':'s'}`);
  }
  let reason:SimplerAssessment['reason']='within-policy';
  if(extraCoverAreaM2>maxExtraCoverAreaM2+1e-6)reason='material-limit';
  else if(b.newSheets-a.newSheets>maxExtraNewSheets)reason='extra-sheet-limit';
  else if(!benefits.length)reason='no-workflow-benefit';
  else if(scoreReduction<minimumScoreReduction)reason='insufficient-workflow-improvement';
  return {accepted:reason==='within-policy',reason,baselineLayoutId:planSignature(previous),
    maxExtraPercent:percent,maxExtraCoverAreaM2,maxExtraNewSheets,baselineLinealM,proposedLinealM,extraLinealM,
    extraCoverAreaM2,extraNewSheets:b.newSheets-a.newSheets,previousWorkflow,proposedWorkflow,
    minimumScoreReduction,scoreReduction,benefits};
}
