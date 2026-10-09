import type { Demand, Placement, Solution, SolveRequest } from './types';
import type { SearchHooks } from './solver';
import { validateDraft } from './editing';
import { validateSolution } from './solver';
import { findFit } from './fit';
import { extendY } from './regions';
import { rebuildInventory } from './inventory';
import { recalculateMetrics } from './receiverSafety';
import { planSignature, workflowQuality } from './diagnostics';
import { rootSheetLedger } from './purchaseLedger';
import { SALVAGE_POLICY, salvageEligibility, terminalFillerIds, unusedSalvagePieces,
  salvagePhysicalFingerprint, salvageGroup, faceDependencies, hasPath, type SalvageGroup,
  type SalvageResult, type SalvageSearchReport, type SalvageCertificate } from './salvageModel';
export * from './salvageModel';

/** Explicit user request only. Never called by Recommended/Simpler/Less Material.
 * The returned plan is an unaccepted preview; callers keep the original until
 * the user chooses it. There is no automatic fallback to fresh stock mid-trial. */
export function searchSalvage(request:SolveRequest,base:Solution,hooks:SearchHooks={},maxMilliseconds=SALVAGE_POLICY.defaultMilliseconds):SalvageResult {
  if(!Number.isFinite(maxMilliseconds)||maxMilliseconds<0||maxMilliseconds>SALVAGE_POLICY.maxMilliseconds)throw new Error('Invalid more-reuse search budget.');
  const now=hooks.now??(()=>performance.now()),start=now(),deadline=start+maxMilliseconds;
  const report:SalvageSearchReport={model:SALVAGE_POLICY.model,baseLayoutId:planSignature(base),basePhysicalFingerprint:salvagePhysicalFingerprint(base),
    status:'no-worthwhile-reuse',reason:'no-worthwhile-compatible-group',sourcePieceCount:0,fillerPositionCount:0,fitChecks:0,groupsFound:0,finalChecks:0,
    elapsedMs:0,budgetReached:false,rejections:{},policy:SALVAGE_POLICY};
  const reject=(reason:string)=>{report.rejections[reason]=(report.rejections[reason]??0)+1;};
  const stop=()=>{if(hooks.shouldCancel?.())throw new Error('More-reuse search cancelled.');
    if(now()>=deadline){report.budgetReached=true;return true;}return false;};
  const result=(solution:Solution|null):SalvageResult=>{report.elapsedMs=Math.max(0,now()-start);report.status=solution?'found':'no-worthwhile-reuse';
    if(solution)report.reason='verified-terminal-filler-groups';else if(report.budgetReached)report.reason='bounded-search-no-verified-opportunity';
    return{status:report.status,solution,report};};
  if(hooks.shouldCancel?.())throw new Error('More-reuse search cancelled.');
  if(base.salvage)throw new Error('Select an original plan before checking more reuse. Reuse previews are not search baselines.');
  const validation=validateDraft({schemaVersion:1,...request,solution:base});
  if(base.status==='invalid'||validation.some(i=>i.severity==='error'))throw new Error('The selected plan is stale or invalid. Regenerate it before checking more reuse.');
  if(base.placements.some(p=>p.manual)||base.decisionTrace?.historic)throw new Error('Use an unedited base plan for this conservative reuse check.');
  const eligible=salvageEligibility(base);report.sourcePieceCount=eligible.sourcePieceCount;report.fillerPositionCount=eligible.fillerPositionCount;
  if(!eligible.eligible){report.reason=eligible.reason;return result(null);}if(stop())return result(null);
  const ids=terminalFillerIds(base),sources=unusedSalvagePieces(base),graph=faceDependencies(base);
  const byFace=new Map<string,Demand[]>();
  for(const d of base.demands.filter(d=>ids.has(d.id))){const rows=byFace.get(d.faceId)??[];rows.push(d);byFace.set(d.faceId,rows);}
  const byBatch=new Map<string,typeof sources>();
  for(const o of sources){const key=JSON.stringify([o.sourceFaceId,o.cutSetId,o.generation,o.lap]);const rows=byBatch.get(key)??[];rows.push(o);byBatch.set(key,rows);}
  const fits=new Map<string,Placement|null>(),groups=new Map<string,SalvageGroup>();
  outer:for(const target of byFace.values()){
    target.sort((a,b)=>a.laneIndex-b.laneIndex);
    for(const batch of byBatch.values()){
      if(stop())break outer;
      if(hasPath(graph,target[0].faceId,batch[0].sourceFaceId)){reject('cut-first-cycle-or-same-face');continue;}
      const forward=[...batch].sort((a,b)=>a.sourceLaneIndex!-b.sourceLaneIndex!||a.id.localeCompare(b.id));
      for(const stock of [forward,[...forward].reverse()])for(let ti=0;ti<target.length-1;ti++)for(let si=0;si<stock.length-1;si++){
        if(stop())break outer;const ps:Placement[]=[];
        for(let k=0;k<SALVAGE_POLICY.maxGroupSheets&&ti+k<target.length&&si+k<stock.length;k++){
          const d=target[ti+k],o=stock[si+k];
          if(k&&(d.laneIndex!==target[ti+k-1].laneIndex+1||Math.abs(o.sourceLaneIndex!-stock[si+k-1].sourceLaneIndex!)!==1))break;
          const key=o.id+'\0'+d.id;
          if(!fits.has(key)){
            if(report.fitChecks>=SALVAGE_POLICY.maxFitChecks){report.budgetReached=true;break outer;}
            report.fitChecks++;
            // Match the complete physical-width rectangle, never its longest edge
            // or area alone. Extra clearance reserves metal for both new end cuts.
            const p=findFit(o,{...d,required:extendY(d.required,base.profile.cutGapMm)},base.profile);
            fits.set(key,p);if(!p)reject('length-width-lap-or-trim-clearance');
          }
          const p=fits.get(key);if(!p||ps.length&&p.rotation!==ps[0].rotation)break;ps.push(p);
          if(ps.length<SALVAGE_POLICY.minGroupSheets)continue;
          try{
            const group=salvageGroup(base,ps);
            if(group.savedCoverAreaM2+1e-8>=SALVAGE_POLICY.minGroupSavingM2){
              if(!groups.has(group.id))report.groupsFound++;
              groups.set(group.id,group);
              // Retain a bounded shortlist while enumerating, not an unbounded
              // collection of every overlapping source/target window.
              if(groups.size>SALVAGE_POLICY.maxCandidates){const worst=[...groups.values()].sort((a,b)=>a.savedCoverAreaM2-b.savedCoverAreaM2||b.id.localeCompare(a.id))[0];groups.delete(worst.id);}
            }else reject('small-saving');
          }catch{reject('source-sequence-not-simple');}
        }
      }
    }
  }
  const ranked=[...groups.values()].sort((a,b)=>b.savedCoverAreaM2-a.savedCoverAreaM2||a.prerequisiteFaceIds.length-b.prerequisiteFaceIds.length||a.id.localeCompare(b.id)).slice(0,SALVAGE_POLICY.maxCandidates);
  // groupsFound counts offers considered; retained candidates are bounded above.
  const proposals:SalvageGroup[][]=ranked.map(g=>[g]);
  for(let i=0;i<ranked.length;i++)for(let j=i+1;j<ranked.length;j++){
    const a=ranked[i],b=ranked[j];
    // At most one contiguous run per destination, no material double-use.
    if(a.destinationFaceId===b.destinationFaceId)continue;
    const used=new Set(a.replacements.map(r=>r.offcutId));if(b.replacements.some(r=>used.has(r.offcutId)))continue;
    const extra=[a,b].flatMap(g=>g.replacements.map(r=>({demandId:r.demandId,kind:'reuse' as const,offcutId:r.offcutId,rotation:r.rotation,translateY:r.translateY})));
    const g=faceDependencies(base,extra);if([a,b].some(x=>hasPath(g,x.destinationFaceId,x.sourceFaceId)))continue;
    proposals.push([a,b]);
  }
  proposals.sort((a,b)=>b.reduce((n,g)=>n+g.savedCoverAreaM2,0)-a.reduce((n,g)=>n+g.savedCoverAreaM2,0)||a.length-b.length);
  let best:Solution|null=null;
  const previousWork=workflowQuality(base);
  for(const plan of proposals){
    if(stop()||report.finalChecks>=SALVAGE_POLICY.maxFinalChecks)break;
    if(best&&plan.reduce((n,g)=>n+g.savedCoverAreaM2,0)<=best.salvage!.savedCoverAreaM2+1e-8)break;
    report.finalChecks++;hooks.onProgress?.(report.finalChecks,Math.min(proposals.length,SALVAGE_POLICY.maxFinalChecks));
    const next=structuredClone(base),map=new Map(plan.flatMap(g=>g.replacements.map(r=>[r.demandId,r] as const)));
    next.placements=next.placements.map(p=>{const r=map.get(p.demandId);return r?{demandId:p.demandId,kind:'reuse',offcutId:r.offcutId,rotation:r.rotation,translateY:r.translateY}:p;});
    const stock=rebuildInventory(next.demands,next.placements,next.profile);
    if(stock.unresolved.length){reject('dependency-rebuild');continue;}next.offcuts=stock.offcuts;recalculateMetrics(next);
    const cert:SalvageCertificate={model:SALVAGE_POLICY.model,baseLayoutId:report.baseLayoutId,basePhysicalFingerprint:report.basePhysicalFingerprint,
      baseObjective:base.objective,baseLabel:base.layoutLabel??'Recommended',baseEngineVersion:base.engineVersion,groups:structuredClone(plan),
      savedSheets:plan.reduce((n,g)=>n+g.savedSheets,0),savedLinealM:plan.reduce((n,g)=>n+g.savedLinealM,0),
      savedCoverAreaM2:plan.reduce((n,g)=>n+g.savedCoverAreaM2,0),setoutBasis:'preserve-base-source-cuts-and-laps'};
    next.salvage=cert;next.engineVersion='2.21';next.layoutId=planSignature(next);
    next.layoutLabel=(base.objective==='simpler'?'Simpler cuts':base.objective==='less-material'?'Less material':'Recommended')+' + more reuse';
    delete next.comparison; // Base strategy comparison is not this explicit salvage comparison.
    const errors=validateSolution(next).filter(i=>i.severity==='error');
    if(errors.length){errors.forEach(i=>reject(i.code));continue;}
    const work=workflowQuality(next);
    if(work.sourceRelationships>previousWork.sourceRelationships+plan.length||work.reuseRuns>previousWork.reuseRuns+plan.length*2){reject('too-many-new-transfers-or-runs');continue;}
    const ledger=rootSheetLedger(next);if(!ledger.valid){reject('ledger');continue;}
    next.issues=base.issues.filter(i=>i.severity!=='error');next.status='prototype-review';next.orderReady=false;
    if(next.decisionTrace){
      next.decisionTrace.engineVersion='2.21';next.decisionTrace.historic=true;
      next.decisionTrace.events.push({step:next.decisionTrace.events.length+1,action:'optional-terminal-filler-salvage',message:'Explicit preview: original plan is preserved. Only unused cuts replace non-donor rectangular filler runs.',
        faceIds:plan.map(g=>g.destinationFaceId),data:{certificate:cert,sourcePlanKept:true,searchScope:'terminal-straight-fillers-only'}});
      next.decisionTrace.events.push({step:next.decisionTrace.events.length+1,action:'final-purchase-ledger',message:'Current quantities after the optional filler substitutions; all parent purchases count once.',data:{quantities:ledger.totals}});
    }
    best=next;
  }
  return result(best);
}
