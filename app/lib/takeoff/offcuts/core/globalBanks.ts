/** V2.22 bounded, transactional donor-portfolio search.
 *
 * A candidate is a COMPLETE replacement material tree, not an edit to the
 * accepted tree. Every source portfolio starts with empty inventory. Changing
 * an early donor/destination therefore retires all its hypothetical descendants.
 * Existing exact fitting, canonical demand generation and valley certification
 * stay authoritative. A cheaper unvalidated branch can never be returned.
 */
import type { Issue, MaterialSavingAssessment, RoofFace, Solution, SolveRequest, WorkflowQuality } from './types';
import type { SearchHooks } from './solver';
import { optimiseBankLayouts, type BankSearchVariant } from './banks';
import { buildMaterialBanks } from './materialBanks';
import { bankAnchorFaces, isSelfFillCandidate } from './zones';
import { generateDemands, frameFor, sceneToSurface } from './material';
import { adjacentValleyParents } from './valleyReceivers';
import { receiverFreshOrder, protectValleyReceivers } from './receiverSafety';
import { refinePurchasedStock } from './stockLength';
import { rootSheetLedger } from './purchaseLedger';
import { planSignature, workflowQuality, planQuality } from './diagnostics';
import { evaluateMaterialTradeOff } from './lessMaterialPolicy';
import { bounds, area, fromRing } from './regions';
import { fingerprint } from './math';
import { supplyView } from './supply';
import { reuseDepth } from './reuseDepth';
import { planningBoundary } from './directions';

export const GLOBAL_BANK_POLICY = Object.freeze({
  model:'coordinated-donor-portfolios-v1' as const,
  defaultMilliseconds:8000, maximumMilliseconds:12000, maximumVariants:30,
  minimumSavingM2:1, nearTieM2:.25, maximumFaces:60,
  // Opportunity thresholds govern search effort, never material validity.
  reusableOpportunityM2:8, excessOpportunityFraction:.18,
  partialReceiverMinimumSavingM2:2,
  /** Ordering-only clustering; never rounds a purchased length or alters a cut. */
  orderingToleranceMm:25,
});
export interface GlobalBankTrial {
  id:string; primaryBankIds:string[]; seedFaceId:string; preferredReceiverFaceId?:string;
  registrationVariant:number; reserveValleyReceivers?:boolean; valid:boolean; eligible:boolean; reason:string;
  newSheets?:number; linealM?:number; coverM2?:number; workflowScore?:number;
  layoutId?:string; errors?:string[];
}
export interface GlobalBankReport {
  model:typeof GLOBAL_BANK_POLICY.model; status:'skipped'|'kept-incumbent'|'improved'; reason:string;
  baselineLayoutId:string; selectedLayoutId:string; baselineSheets:number; selectedSheets:number;
  baselineLinealM:number; selectedLinealM:number; savedCoverM2:number;
  variantsPlanned:number; variantsTried:number; candidatesValidated:number; budgetReached:boolean;
  elapsedMs:number; selectedVariantId:string|null; inputGeometryUnchanged:true;
  trials:GlobalBankTrial[];
}
const clone=<T>(x:T):T=>structuredClone(x);

/** Site work, not millimetre-by-millimetre order rows. A slightly skewed ridge
 * can produce many neighbouring measured lengths. Cluster complete-link length
 * ranges <=25 mm for RANKING ONLY. The purchase ledger retains every exact mm.
 * Both reference and candidate are assessed on the same basis and same limits.
 */
export function coherentWorkflow(s:Solution):WorkflowQuality {
  const original=workflowQuality(s),view=supplyView(s),ps=new Map(s.placements.map(p=>[p.demandId,p]));
  const clusters=new Map<string,{min:number;max:number;id:string}[]>(),group=new Map<string,string>();
  const fresh=s.demands.filter(d=>ps.get(d.id)?.kind==='new').sort((a,b)=>{
    const x=bounds(a.blank),y=bounds(b.blank);return x.maxY-x.minY-(y.maxY-y.minY)||a.id.localeCompare(b.id);
  });
  for(const d of fresh){
    const b=bounds(d.blank),length=b.maxY-b.minY,key=view.blockByRootDemand.get(d.id)??d.faceId;
    const rows=clusters.get(key)??[];
    let row=rows.find(x=>length-x.min<=GLOBAL_BANK_POLICY.orderingToleranceMm+1e-7);
    if(!row){row={min:length,max:length,id:key+'/'+rows.length};rows.push(row);clusters.set(key,rows);}
    else row.max=length;
    group.set(d.id,row.id);
  }
  const slope=(a:number,b:number,w:number)=>Math.abs(b-a)/Math.max(w,1)<.02?'0':b>a?'+':'-';
  const pattern=(d:Solution['demands'][number])=>['top','bottom'].map(side=>{
    const out:string[]=[];for(const b of d.required){const v=side==='top'?slope(b.top0,b.top1,b.x1-b.x0):slope(b.bottom0,b.bottom1,b.x1-b.x0);if(v!==out.at(-1))out.push(v);}return out.join('');
  }).join('/');
  let freshCutRuns=0;
  for(const id of new Set(s.demands.map(d=>d.faceId))){
    let last='',lane=-2;
    for(const d of s.demands.filter(d=>d.faceId===id).sort((a,b)=>a.laneIndex-b.laneIndex)){
      const tag=ps.get(d.id)?.kind==='new'&&d.reusableCut?group.get(d.id)+'/'+pattern(d):'';
      if(tag&&(tag!==last||d.laneIndex!==lane+1))freshCutRuns++;
      last=tag;lane=d.laneIndex;
    }
  }
  const stockLengthGroups=[...clusters.values()].reduce((n,x)=>n+x.length,0);
  return {...original,model:'coherent-workflow-v2',stockLengthGroups,freshCutRuns,
    score:original.score-2*original.stockLengthGroups-original.freshCutRuns+2*stockLengthGroups+freshCutRuns};
}
export function coordinatedMaterialAssessment(previous:Solution,proposed:Solution):MaterialSavingAssessment {
  const p=previous.profile,w=p.coverMm+p.leftLapMm+p.rightLapMm;
  return evaluateMaterialTradeOff({baselineLayoutId:planSignature(previous),
    baselineLinealM:previous.metrics.newMaterialMm2/w/1000,proposedLinealM:proposed.metrics.newMaterialMm2/w/1000,
    coverMm:p.coverMm,newSheetDelta:proposed.metrics.newSheetCount-previous.metrics.newSheetCount,
    previousWorkflow:coherentWorkflow(previous),proposedWorkflow:coherentWorkflow(proposed),
    previousReuseDepth:Math.max(0,...reuseDepth(previous).values()),proposedReuseDepth:Math.max(0,...reuseDepth(proposed).values())});
}
/** Recommended remains the balance option. The more permissive material gate
 * alone is insufficient: its grouped workflow must also remain within 16 points
 * of the immutable incumbent, and no additional external transfers are allowed.
 */
export function acceptsGlobalBank(previous:Solution,proposed:Solution,materialMode=false):{accepted:boolean;reason:string;assessment:MaterialSavingAssessment} {
  const assessment=coordinatedMaterialAssessment(previous,proposed);
  if(!assessment.accepted)return{accepted:false,reason:assessment.reason,assessment};
  if(!materialMode&&(assessment.workflowDelta.sourceRelationships>0||assessment.proposedWorkflow.score>assessment.previousWorkflow.score+16))
    return{accepted:false,reason:'recommended-workflow-budget',assessment};
  return{accepted:true,reason:'less-purchased-stock-with-bounded-coherent-work',assessment};
}
interface BankOpportunity {id:string;faces:RoofFace[];leader:RoofFace;length:number;area:number}
/** Geometry-generated portfolios: common-direction anchors, single directions
 * and opposite/adjacent direction pairs. Explicit user locks remain effective.
 * No fixture face IDs, component names, cardinal labels or desired waste target.
 */
export function donorVariants(r:SolveRequest,incumbent:Solution,comparison=false,maximumVariants:number=GLOBAL_BANK_POLICY.maximumVariants,attempt=0):BankSearchVariant[] {
  const banks=buildMaterialBanks(r);
  const length=(f:RoofFace)=>{const frame=frameFor(f,r.roof),ys=f.polygon.map(p=>sceneToSurface(p,frame).y);return Math.max(...ys)-Math.min(...ys);};
  const eligible:BankOpportunity[]=banks.map(b=>{
    const faces=bankAnchorFaces(r.faces.filter(f=>b.faceIds.includes(f.id)),r.roof).filter(f=>!isSelfFillCandidate(f,r.roof));
    const ordered=[...faces].sort((a,b)=>length(b)-length(a)||area(fromRing(b.polygon))-area(fromRing(a.polygon)));
    return{id:b.id,faces,leader:ordered[0],length:Math.max(0,...faces.map(length)),area:faces.reduce((n,f)=>n+area(fromRing(f.polygon)),0)};
  }).filter(b=>b.faces.length&&b.faces.some(f=>planningBoundary(f).filter(e=>['hip','valley','broken_hip'].includes(e.kind)).length>=2))
    .sort((a,b)=>b.length-a.length||b.area-a.area||a.leader.polygon[0].x-b.leader.polygon[0].x).slice(0,6);
  if(!eligible.length)return [];
  const portfolios:BankOpportunity[][]=[],seen=new Set<string>();
  const add=(bs:BankOpportunity[])=>{if(!bs.length)return;const key=bs.map(b=>b.id).sort().join('|');if(!seen.has(key)){seen.add(key);portfolios.push(bs);}};
  const old=new Set(incumbent.bankLayout?.primaryOperations?.map(o=>o.bankId));
  add(eligible.filter(b=>old.has(b.id)));
  add(eligible.slice(0,2));
  for(const b of eligible)add([b]);
  for(let i=0;i<eligible.length;i++)for(let j=i+1;j<eligible.length;j++)add([eligible[i],eligible[j]]);
  const parent=adjacentValleyParents(r.faces,r.roof),out:BankSearchVariant[]=[];
  const make=(bs:BankOpportunity[],phase:number,focus:number,reverse=false)=>{
    const receivers=r.faces.filter(f=>!bs.some(b=>b.faces.includes(f))&&!parent.has(f.id)&&!isSelfFillCandidate(f,r.roof))
      .sort((a,b)=>area(fromRing(b.polygon))-area(fromRing(a.polygon))||a.polygon[0].x-b.polygon[0].x);
    const preferred=focus<0?undefined:receivers[focus]?.id;
    if(focus>=0&&!preferred)return;
    const seed=reverse?bs.at(-1)!:bs[0];
    out.push({id:`portfolio-${out.length+1}`,primaryBankIds:bs.map(b=>b.id),seedFaceId:seed.leader.id,
      registrationVariant:phase,memberAxisContinuation:true,...(preferred?{preferredReceiverFaceId:preferred}:{})});
  };
  // Give the main multi-face portfolio enough receiver-choice diversity before
  // trying a different primary direction. Start/end grids are both considered.
  for(const phase of [0,2])for(const focus of [-1,0,1])make(portfolios[0],phase,focus);
  for(const bs of portfolios.slice(1))make(bs,0,-1);
  for(const bs of portfolios)make(bs,1,0);
  for(const bs of portfolios.slice(0,4))make(bs,0,1,true);
  // The comparison pass explores both decisions: reserve coupled valley arms
  // for their own receivers OR make them available to competing destinations.
  // These are reversible complete-tree candidates, not a global forced rule.
  if(comparison){
    const reserved=out.slice(0,12).map(v=>({...v,reserveValleyReceivers:true}));
    const mixed:BankSearchVariant[]=[];
    for(let i=0;i<out.length;i++){if(reserved[i])mixed.push(reserved[i]);mixed.push(out[i]);}
    // Try the opposite donor seed early, rather than spending the whole budget
    // on receiver tweaks from one seed. This is geometry-driven scheduling, not
    // a fixture face rule. The candidate set is unchanged.
    const swaps=mixed.filter(v=>v.primaryBankIds.length>1&&v.primaryBankIds.join('|')===out[0].primaryBankIds.join('|')&&v.seedFaceId!==out[0].seedFaceId);
    const diverse=[mixed[0],...swaps,...mixed.slice(1).filter(v=>!swaps.includes(v))];
    mixed.splice(0,mixed.length,...diverse);
    // Later attempts rotate the deterministic strategy list, never the geometry.
    const rotate=attempt?Math.min(mixed.length-1,(attempt*7)%mixed.length):0;
    out.splice(0,out.length,...mixed.slice(rotate),...mixed.slice(0,rotate));
  }
  const keys=new Set<string>();return out.filter(v=>{const k=JSON.stringify([v.primaryBankIds,v.seedFaceId,v.registrationVariant,v.preferredReceiverFaceId,!!v.reserveValleyReceivers]);if(keys.has(k))return false;keys.add(k);return true;}).slice(0,maximumVariants).map((v,i)=>({...v,id:`portfolio-${i+1}`}));
}

/** Same contract as the full draft validator, checked before candidate ranking.
 * The worker/UI still validate the full draft independently before publication.
 */
export function validateGlobalInput(r:SolveRequest,s:Solution,validate:(s:Solution)=>Issue[]):Issue[] {
  const errors:Issue[]=[];
  const fail=(message:string)=>errors.push({severity:'error',code:'GLOBAL_CANDIDATE_INPUT',message});
  if(s.sourceRevision!==r.roof.sourceRevision||s.facesRevision!==fingerprint({faces:r.faces,profile:r.profile,settings:r.settings})||
    fingerprint(s.profile)!==fingerprint(r.profile)||fingerprint(s.settings)!==fingerprint(r.settings))fail('Candidate inputs changed.');
  if(Object.keys(s.lapByFace).length!==r.faces.length||r.faces.some(f=>![1,-1].includes(s.lapByFace[f.id])||f.lapLocked&&s.lapByFace[f.id]!==f.lap))fail('Candidate violates an approved lap lock.');
  try{
    const ds=generateDemands(r.roof,r.faces,r.profile,r.settings,s.bankLayout).map(d=>({...d,lap:s.lapByFace[d.faceId]}));
    if(fingerprint(ds)!==fingerprint(s.demands))fail('Candidate is not canonical reviewed geometry.');
  }catch(e){fail(String(e));}
  const expected=[...adjacentValleyParents(r.faces,r.roof)].filter(([id])=>receiverFreshOrder(s.demands.filter(d=>d.faceId===id)))
    .map(([id,parent])=>`${parent}/${id}`).sort();
  const actual=s.receiverSafety?.families.flatMap(f=>f.faceIds.map(id=>`${f.sourceFaceId}/${id}`)).sort()??[];
  if(JSON.stringify(expected)!==JSON.stringify(actual))fail('Candidate does not certify all valley receiver families.');
  errors.push(...validate(s));return errors;
}
class GlobalDeadline extends Error {}
export function searchGlobalBanks(r:SolveRequest,incumbent:Solution,validate:(s:Solution)=>Issue[],hooks:SearchHooks={}):{solutions:Solution[];report:GlobalBankReport} {
  const now=hooks.now??(()=>performance.now()),started=now(),wallStarted=performance.now(),width=r.profile.coverMm+r.profile.leftLapMm+r.profile.rightLapMm;
  const goal=hooks.planSearch?.objective??'recommended';
  const report:GlobalBankReport={model:GLOBAL_BANK_POLICY.model,status:'skipped',reason:'no-strong-donor-opportunity',
    baselineLayoutId:incumbent.layoutId??planSignature(incumbent),selectedLayoutId:incumbent.layoutId??planSignature(incumbent),
    baselineSheets:incumbent.metrics.newSheetCount,selectedSheets:incumbent.metrics.newSheetCount,
    baselineLinealM:incumbent.metrics.newMaterialMm2/width/1000,selectedLinealM:incumbent.metrics.newMaterialMm2/width/1000,
    savedCoverM2:0,variantsPlanned:0,variantsTried:0,candidatesValidated:0,budgetReached:false,elapsedMs:0,selectedVariantId:null,inputGeometryUnchanged:true,trials:[]};
  const finish=(solutions:Solution[]=[])=>{report.elapsedMs=Math.max(0,now()-started,performance.now()-wallStarted);return{solutions,report};};
  if(r.settings.globalBankSearch===false||hooks.bankVariant||goal==='simpler'){report.reason='disabled-or-not-applicable';return finish();}
  if(r.settings.stockMode!=='bank-first'||!incumbent.bankLayout||incumbent.status==='invalid'||r.faces.length>GLOBAL_BANK_POLICY.maximumFaces){report.reason='no-supported-bank-incumbent';return finish();}
  if(incumbent.salvage||incumbent.placements.some(p=>p.manual)){report.reason='manual-or-salvage-plan-protected';return finish();}
  if(validateGlobalInput(r,incumbent,validate).some(i=>i.severity==='error')){report.reason='invalid-or-stale-incumbent';return finish();}
  const ledger=rootSheetLedger(incumbent).totals;
  const banks=buildMaterialBanks(r);
  const fragmented=banks.some(b=>{
    const anchors=bankAnchorFaces(r.faces.filter(f=>b.faceIds.includes(f.id)),r.roof).filter(f=>!isSelfFillCandidate(f,r.roof));
    const operations=incumbent.bankLayout!.primaryOperations?.filter(op=>op.bankId===b.id)??[];
    return anchors.length>1&&operations.length>1;
  });
  const stranded=ledger.terminalReusableAreaM2>=GLOBAL_BANK_POLICY.reusableOpportunityM2&&
    incumbent.metrics.wasteMm2>incumbent.metrics.netRoofMm2*GLOBAL_BANK_POLICY.excessOpportunityFraction;
  if(!fragmented&&!stranded&&goal!=='less-material'&&!hooks.portfolioSearch)return finish();
  const variants=donorVariants(r,incumbent,!!hooks.portfolioSearch,hooks.portfolioSearch?.maximumVariants??GLOBAL_BANK_POLICY.maximumVariants,hooks.portfolioSearch?.attempt??0);report.variantsPlanned=variants.length;
  report.status='kept-incumbent';report.reason='no-valid-worthwhile-portfolio';
  const limit=hooks.portfolioSearch?Math.max(0,Math.min(20_000,hooks.portfolioSearch.milliseconds)):Math.min(GLOBAL_BANK_POLICY.maximumMilliseconds,r.settings.globalBankMaxMilliseconds??GLOBAL_BANK_POLICY.defaultMilliseconds);
  const check=()=>{if(hooks.shouldCancel?.())throw new Error('Offcut search cancelled.');if(now()-started>=limit||performance.now()-wallStarted>=limit)throw new GlobalDeadline();};
  const candidates:Solution[]=[],signatures=new Set<string>();
  for(const variant of variants){
    const trial:GlobalBankTrial={...variant,valid:false,eligible:false,reason:'not-completed'};
    try{
      check();report.variantsTried++;hooks.onStage?.('global-bank-search');hooks.onProgress?.(report.variantsTried-1,variants.length);
      // Never import a partially built predecessor tree into another portfolio.
      const s=optimiseBankLayouts(r,{...hooks,bankVariant:variant,now,
        shouldCancel:()=>{check();return false;},onDecisionTrace:undefined,onCheckedCandidate:undefined,onProgress:undefined,
        planSearch:{objective:'recommended'}})[0];
      if(!s){trial.reason='no-complete-candidate';continue;}
      check();protectValleyReceivers(r,s,()=>{check();return false;});
      const refined=refinePurchasedStock(r,s,validate,{...hooks,now,shouldCancel:()=>{check();return false;}});
      const candidate=refined.solution;candidate.stockLengthRefinement=refined.report;
      check();const errors=validateGlobalInput(r,candidate,validate).filter(i=>i.severity==='error');
      if(errors.length){trial.reason='rejected-full-validation';trial.errors=[...new Set(errors.map(e=>e.code))];continue;}
      report.candidatesValidated++;trial.valid=true;
      const assessment=acceptsGlobalBank(incumbent,candidate,goal==='less-material');
      const q=planQuality(candidate);Object.assign(trial,{newSheets:q.newSheets,linealM:q.suppliedMm2/width/1000,coverM2:q.suppliedMm2/width*r.profile.coverMm/1e6,
        workflowScore:coherentWorkflow(candidate).score,layoutId:planSignature(candidate),eligible:assessment.accepted,reason:assessment.reason});
      candidate.layoutId=trial.layoutId;candidate.objective=goal;candidate.layoutLabel=goal==='less-material'?'Less material':'Recommended';
      // Complete cuts which fail a workflow preference are comparison data, not
      // physically invalid metal. Retain them before the Recommended gate.
      hooks.onPortfolioCandidate?.(candidate);
      if(!assessment.accepted||signatures.has(trial.layoutId!))continue;
      signatures.add(trial.layoutId!);
      candidate.decisionTrace?.events.push({step:candidate.decisionTrace.events.length+1,action:'coordinated-donor-candidate',
        message:'A complete donor portfolio was rebuilt and checked before replacing any purchases. All approved polygons, flow directions and physical profile rules are unchanged.',
        data:{variant,assessment:assessment.assessment,stockLengthRefinement:refined.report}});
      candidates.push(candidate);
    }catch(e){
      if(e instanceof GlobalDeadline){report.budgetReached=true;trial.reason='bounded-global-search-deadline';break;}
      if(e instanceof Error&&(e.name==='PortfolioDeadline'||/cancelled|limit reached/i.test(e.message)))throw e;
      // An infeasible source portfolio (for example a maximum-length violation)
      // is a rejected candidate. Never turn it into an unvalidated result.
      trial.reason='candidate-rejected';trial.errors=[e instanceof Error?e.message:String(e)];
    }finally{report.trials.push(trial);}
  }
  if(!candidates.length)return finish();
  const minimum=Math.min(...candidates.map(s=>s.metrics.newMaterialMm2));
  const near=candidates.filter(s=>s.metrics.newMaterialMm2<=minimum+GLOBAL_BANK_POLICY.nearTieM2*1e6*width/r.profile.coverMm+1e-6)
    .sort((a,b)=>coherentWorkflow(a).score-coherentWorkflow(b).score||a.metrics.newMaterialMm2-b.metrics.newMaterialMm2);
  const best=near[0],rest=candidates.filter(s=>s!==best).sort((a,b)=>a.metrics.newMaterialMm2-b.metrics.newMaterialMm2);
  report.status='improved';report.reason='complete-checked-donor-portfolio';report.selectedLayoutId=best.layoutId!;
  report.selectedVariantId=report.trials.find(t=>t.layoutId===best.layoutId)?.id??null;
  report.selectedSheets=best.metrics.newSheetCount;report.selectedLinealM=best.metrics.newMaterialMm2/width/1000;
  report.savedCoverM2=(report.baselineLinealM-report.selectedLinealM)*r.profile.coverMm/1000;
  const result=finish([best,...rest].slice(0,8));
  for(const s of result.solutions){
    s.globalDonorSearch=clone(report);s.search.elapsedMs+=report.elapsedMs;
    s.decisionTrace?.events.push({step:s.decisionTrace.events.length+1,action:'global-donor-search',
      message:'Compared complete donor portfolios and provisional receiver choices against the unchanged incumbent; only full validations can win.',data:{report}});
  }
  return result;
}
