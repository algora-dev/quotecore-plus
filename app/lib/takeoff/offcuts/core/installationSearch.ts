/** Optional anchored reversal. Every trial starts from a clean material tree;
 * changing a donor invalidates its old descendants rather than reusing them twice.
 * The existing selected plan is immutable and does not compete in this search. */
import type { Solution, SolveRequest } from './types';
import type { SearchHooks } from './solver';
import { validateDraft } from './editing';
import { optimiseBankLayouts, type BankSearchVariant } from './banks';
import { buildMaterialBanks } from './materialBanks';
import { planningBoundary } from './directions';
import { isSelfFillCandidate } from './zones';
import { installationAnchors, type InstallationAnchor, type InstallationSetout } from './installationAnchors';
import { INSTALLATION_PLAN_MODEL } from './installationPlan';
import { generateDemands } from './material';
import { adjacentValleyParents } from './valleyReceivers';
import { rebuildInventory } from './inventory';
import { protectValleyReceivers, recalculateMetrics } from './receiverSafety';
import { planSignature } from './diagnostics';
import { coherentWorkflow } from './globalBanks';
import { fingerprint } from './math';

export const INSTALLATION_SEARCH_POLICY=Object.freeze({model:'anchored-donor-search-v1' as const,defaultMilliseconds:20000,maximumMilliseconds:25000,maximumTrials:24,maximumPlans:3});
export interface InstallationSearchOptions {previous:Solution;attempt?:number;maxMilliseconds?:number}
export interface InstallationSearchReport {model:typeof INSTALLATION_SEARCH_POLICY.model;referenceLayoutId:string;inputFingerprint:string;status:'found'|'no-distinct-plan';elapsedMs:number;budgetReached:boolean;trialsPlanned:number;trialsTried:number;validatedCount:number;rejectedCount:number;trials:Array<{id:string;valid:boolean;reason:string;linealM?:number;newSheets?:number}>}
export interface InstallationSearchResult {plans:Solution[];report:InstallationSearchReport}
const clone=<T>(x:T):T=>structuredClone(x);
class InstallationDeadline extends Error{constructor(){super('Offcut search cancelled at installation search deadline.');this.name='InstallationDeadline';}}
function rankAnchors(r:SolveRequest,id:string):InstallationAnchor[]{
  const face=r.faces.find(f=>f.id===id)!;
  const boundary=planningBoundary(face),nearOutline=(p:{x:number;y:number})=>r.roof.outlines.some(o=>o.polygon.some(q=>Math.hypot(p.x-q.x,p.y-q.y)*r.roof.mmPerSceneUnit<50));
  const score=(a:InstallationAnchor)=>{
    const hip=boundary.find(e=>a.edgeIds.includes(e.id)&&(e.kind==='hip'||e.kind==='broken_hip'));
    if(!hip)return 0;
    return (!nearOutline(hip.a)&&!nearOutline(hip.b)?1e9:0)+Math.hypot(hip.b.x-hip.a.x,hip.b.y-hip.a.y);
  };
  return installationAnchors(face,r.roof,r.profile).filter(a=>a.kind==='hip-ridge-junction').sort((a,b)=>score(b)-score(a)||a.id.localeCompare(b.id));
}
/** Opportunities follow the selected solution's real material routes. No face
 * letters, orientation to the screen or roof-specific measurements are used. */
export function reversedDonorVariants(r:SolveRequest,previous:Solution,attempt=0):BankSearchVariant[]{
  if(!previous.bankLayout)return [];
  const banks=buildMaterialBanks(r),dm=new Map(previous.demands.map(d=>[d.id,d])),om=new Map(previous.offcuts.map(o=>[o.id,o]));
  const operations=previous.bankLayout.primaryOperations??[],result:BankSearchVariant[]=[];
  const valleyParents=adjacentValleyParents(r.faces,r.roof);
  const barge=([...valleyParents.keys()]).flatMap(id=>installationAnchors(r.faces.find(f=>f.id===id)!,r.roof,r.profile).filter(a=>a.kind==='barge-end').slice(0,1));
  for(const op of operations){
    const recipients=new Set<string>();
    for(const p of previous.placements)if(p.kind==='reuse'){
      const o=om.get(p.offcutId??''),dest=dm.get(p.demandId)?.faceId,root=o?dm.get(o.rootDemandId??o.sourceDemandId)?.faceId:undefined;
      if(root&&dest&&op.faceIds.includes(root)&&!op.faceIds.includes(dest)&&rankAnchors(r,dest).length&&!isSelfFillCandidate(r.faces.find(f=>f.id===dest)!,r.roof))recipients.add(dest);
    }
    const targets=[...recipients].sort((a,b)=>a.localeCompare(b)).slice(0,4);
    if(!targets.length)continue;
    const pairs:string[][]=targets.length>1?targets.flatMap((a,i)=>targets.slice(i+1).map(b=>[a,b])):[targets];
    for(const donors of pairs){
      const newBanks=[...new Set(donors.map(id=>banks.find(b=>b.faceIds.includes(id))!.id))];
      if(newBanks.length!==donors.length)continue;
      const kept=operations.filter(x=>x!==op&&!x.faceIds.some(id=>donors.includes(id))).map(x=>x.bankId);
      const ids=[...new Set([...newBanks,...kept])];
      const primary=new Set(banks.filter(b=>ids.includes(b.id)).flatMap(b=>b.faceIds));
      if(op.faceIds.some(id=>primary.has(id)))continue;
      const receive=r.faces.filter(f=>op.faceIds.includes(f.id));
      const biggest=[...receive].sort((a,b)=>b.polygon.length-a.polygon.length||a.id.localeCompare(b.id))[0];
      let combinations:InstallationAnchor[][]=[[]];
      for(const id of donors)combinations=combinations.flatMap(xs=>rankAnchors(r,id).slice(0,3).map(a=>[...xs,a]));
      // Search good internal shoulders first; spread the budget over anchors and
      // length allowances rather than re-running one arbitrary end of a face.
      for(const anchors of combinations)for(const mode of [0,1,2]){
        const all=[...anchors,...barge.filter(a=>!donors.includes(a.faceId))];
        const setout:InstallationSetout={model:'installation-setout-v1',anchors:all,measuredFillerFaceIds:donors};
        result.push({id:'reverse-'+result.length,primaryBankIds:ids,seedFaceId:donors[mode===2?donors.length-1:0],registrationVariant:mode===2?4:2,memberAxisContinuation:true,reserveValleyReceivers:true,combineDonorSets:true,deferReceiversUntilDonorsReady:true,
          preferredReceiverFaceId:biggest.id,receiverTrimAllowanceMm:mode===0?20:0,commonCutLengthMm:Math.max(...banks.filter(b=>b.id===op.bankId).map(b=>b.cutLengthMm)),
          primaryLapByFace:mode===1?Object.fromEntries(donors.map((id,i)=>[id,i&&r.settings.optimiseLapDirections&&!r.faces.find(f=>f.id===id)!.lapLocked?-r.faces.find(f=>f.id===id)!.lap:r.faces.find(f=>f.id===id)!.lap])) as Record<string,1|-1>:undefined,
          receiverBankFaceIds:receive.filter(f=>planningBoundary(f).some(e=>e.kind==='ridge')).map(f=>f.id),
          receiverSourceFaceIds:Object.fromEntries(op.faceIds.map(id=>[id,donors])),installationSetout:setout});
      }
    }
  }
  const start=result.length?(attempt*7)%result.length:0;
  return [...result.slice(start),...result.slice(0,start)].slice(0,INSTALLATION_SEARCH_POLICY.maximumTrials);
}
function bargeStartCandidate(r:SolveRequest,previous:Solution,cancel:()=>boolean):Solution|null{
  if(!previous.bankLayout)return null;
  const receivers=new Set([...adjacentValleyParents(r.faces,r.roof).keys()]);
  const anchors=r.faces.filter(f=>receivers.has(f.id)).flatMap(f=>installationAnchors(f,r.roof,r.profile).filter(a=>a.kind==='barge-end').slice(0,1));
  if(!anchors.length||anchors.every(a=>Math.abs(a.phaseMm-previous.bankLayout!.laneOffsetByFace[a.faceId])<1e-6))return null;
  const changed=new Set(anchors.map(a=>a.faceId)),dm=new Map(previous.demands.map(d=>[d.id,d])),om=new Map(previous.offcuts.map(o=>[o.id,o]));
  if(previous.placements.some(p=>p.kind==='reuse'&&!changed.has(dm.get(p.demandId)?.faceId??'')&&changed.has(om.get(p.offcutId??'')?.sourceFaceId??'')))return null;
  const s=clone(previous),layout=s.bankLayout!;
  // Don't carry another candidate's stock-shortening proof into newly numbered lanes.
  if(layout.stockEndRefinement?.demandIds.some(id=>changed.has(dm.get(id)?.faceId??'')))return null;
  layout.installationSetout={model:'installation-setout-v1',anchors,measuredFillerFaceIds:[]};
  for(const a of anchors)layout.laneOffsetByFace[a.faceId]=a.phaseMm;
  s.demands=generateDemands(r.roof,r.faces,r.profile,r.settings,layout).map(d=>({...d,lap:s.lapByFace[d.faceId]}));
  const old=new Map(s.placements.map(p=>[p.demandId,p]));
  s.placements=s.demands.map(d=>!changed.has(d.faceId)&&old.has(d.id)?old.get(d.id)!:{demandId:d.id,kind:'new',rotation:0,translateY:0});
  const inv=rebuildInventory(s.demands,s.placements,s.profile);if(inv.unresolved.length)return null;s.offcuts=inv.offcuts;
  s.objective='installation';protectValleyReceivers(r,s,cancel);recalculateMetrics(s);
  s.installationPlan={model:INSTALLATION_PLAN_MODEL,kind:'barge-starts',referenceLayoutId:planSignature(previous),donorFaceIds:[],receiverFaceIds:[...changed],siteSetoutConfirmed:false};
  s.layoutLabel='Fresh barge starts';return s;
}
export function searchInstallationPlans(r:SolveRequest,options:InstallationSearchOptions,hooks:SearchHooks={}):InstallationSearchResult{
  const previous=options.previous,limit=options.maxMilliseconds??INSTALLATION_SEARCH_POLICY.defaultMilliseconds,attempt=options.attempt??0;
  if(!Number.isFinite(limit)||limit<0||limit>INSTALLATION_SEARCH_POLICY.maximumMilliseconds||!Number.isInteger(attempt)||attempt<0||attempt>10000)throw new Error('Invalid installation search budget or attempt.');
  if(previous.salvage||previous.placements.some(p=>p.manual)||!previous.bankLayout||r.settings.stockMode!=='bank-first'||validateDraft({schemaVersion:1,...r,solution:previous}).some(i=>i.severity==='error'))throw new Error('Choose a valid unchanged bank plan before searching alternative donors.');
  const started=performance.now(),clock=hooks.now??(()=>performance.now()),at=clock(),elapsed=()=>Math.max(performance.now()-started,clock()-at);
  const report:InstallationSearchReport={model:INSTALLATION_SEARCH_POLICY.model,referenceLayoutId:planSignature(previous),inputFingerprint:fingerprint([r.roof,r.faces,r.profile,r.settings]),status:'no-distinct-plan',elapsedMs:0,budgetReached:false,trialsPlanned:0,trialsTried:0,validatedCount:0,rejectedCount:0,trials:[]};
  const check=()=>{if(hooks.shouldCancel?.())throw new Error('Offcut search cancelled.');if(elapsed()>=limit)throw new InstallationDeadline();return false;};
  const plans:Solution[]=[],seen=new Set([planSignature(previous)]);
  const accept=(s:Solution,id:string)=>{
    check();s.engineVersion='2.24';s.objective='installation';s.layoutId=planSignature(s);
    const errors=validateDraft({schemaVersion:1,...r,solution:s}).filter(i=>i.severity==='error');
    if(errors.length){report.rejectedCount++;report.trials.push({id,valid:false,reason:errors.map(e=>e.code).join(',')});return;}
    report.validatedCount++;const width=r.profile.coverMm+r.profile.leftLapMm+r.profile.rightLapMm;
    report.trials.push({id,valid:true,reason:seen.has(s.layoutId)?'duplicate-physical-plan':'checked',linealM:s.metrics.newMaterialMm2/width/1000,newSheets:s.metrics.newSheetCount});
    if(seen.has(s.layoutId))return;seen.add(s.layoutId);s.issues=s.issues.filter(i=>i.severity==='warning');s.status='prototype-review';s.orderReady=false;
    plans.push(s);
  };
  const variants=reversedDonorVariants(r,previous,attempt);report.trialsPlanned=variants.length+1;
  try{
    check();hooks.onStage?.('installation-search');
    const barge=bargeStartCandidate(r,previous,check);report.trialsTried++;if(barge)accept(barge,'fresh-barge-starts');
    for(const variant of variants){
      check();report.trialsTried++;hooks.onProgress?.(report.trialsTried-1,report.trialsPlanned);
      try{
        const s=optimiseBankLayouts(r,{...hooks,bankVariant:variant,shouldCancel:check,onPortfolioCandidate:undefined,onCheckedCandidate:undefined,onDecisionTrace:undefined,onProgress:undefined,planSearch:{objective:'recommended'}})[0];
        if(!s)continue;check();s.objective='installation';protectValleyReceivers(r,s,check);
        s.installationPlan={model:INSTALLATION_PLAN_MODEL,kind:'reversed-donors',referenceLayoutId:planSignature(previous),donorFaceIds:variant.installationSetout!.measuredFillerFaceIds,receiverFaceIds:Object.keys(variant.receiverSourceFaceIds??{}),siteSetoutConfirmed:false,reuseEndTrimMm:variant.receiverTrimAllowanceMm??0};
        s.layoutLabel=variant.receiverTrimAllowanceMm?'Reversed donors · trimming room':'Reversed donors · junction start';
        accept(s,variant.id);
      }catch(e){if(e instanceof InstallationDeadline||e instanceof Error&&/cancel|time limit/i.test(e.message))throw e;report.rejectedCount++;report.trials.push({id:variant.id,valid:false,reason:e instanceof Error?e.message:String(e)});}
    }
  }catch(e){if(e instanceof InstallationDeadline)report.budgetReached=true;else throw e;}
  if(hooks.shouldCancel?.())throw new Error('Offcut search cancelled.');
  const starts=plans.filter(s=>s.installationPlan!.kind==='barge-starts'),reversed=plans.filter(s=>s.installationPlan!.kind==='reversed-donors').sort((a,b)=>a.metrics.newMaterialMm2-b.metrics.newMaterialMm2||coherentWorkflow(a).score-coherentWorkflow(b).score);
  // No savings floor: an explicitly requested different donor strategy can cost
  // more. Show at most two genuinely different reversals, never fake five roles.
  const selected:Solution[]=[...starts.slice(0,1)];
  const padded=reversed.find(s=>(s.installationPlan!.reuseEndTrimMm??0)>0&&s.metrics.newMaterialMm2<=reversed[0].metrics.newMaterialMm2+10e6);
  if(padded){reversed.splice(reversed.indexOf(padded),1);reversed.unshift(padded);}
  if(reversed[0])selected.push(reversed[0]);
  const second=reversed.find(s=>s!==reversed[0]&&((reversed[0].installationPlan!.reuseEndTrimMm??0)>(s.installationPlan!.reuseEndTrimMm??0)&&s.metrics.newMaterialMm2<reversed[0].metrics.newMaterialMm2-1e6||s.bankLayout!.installationSetout!.anchors.some(a=>!reversed[0].bankLayout!.installationSetout!.anchors.some(b=>b.id===a.id))&&s.metrics.newMaterialMm2<=reversed[0].metrics.newMaterialMm2*1.05&&coherentWorkflow(s).score<coherentWorkflow(reversed[0]).score));
  if(second)selected.push(second);
  report.status=selected.length?'found':'no-distinct-plan';report.elapsedMs=elapsed();
  return{plans:selected.slice(0,INSTALLATION_SEARCH_POLICY.maximumPlans),report};
}
