/** Small, inspectable comparison portfolios. Physical validation and product
 * preference are deliberately separate. No geometry or purchased length is
 * rounded here; tolerances below only remove near-identical menu options. */
import type { Issue, Solution, SolveRequest, WorkflowMetric, WorkflowQuality } from './types';
import { coherentWorkflow, coordinatedMaterialAssessment } from './globalBanks';
import { planSignature, comparePlans } from './diagnostics';
import { supplyView } from './supply';
import { reuseDepth } from './reuseDepth';
import { fingerprint } from './math';

export const PORTFOLIO_POLICY = Object.freeze({
  model: 'validated-plan-portfolio-v1' as const,
  defaultSearchMilliseconds: 20_000,
  maximumSearchMilliseconds: 25_000,
  maximumVariants: 60,
  candidateCapacity: 24,
  maximumPlans: 5,
  visiblePlans: 3,
  minimumDistinctSavingM2: .25,
  simplerMaxExtraPercent: 3,
  simplerMaxExtraM2: 10,
});
export type PortfolioRole = 'recommended'|'least-material'|'simplest'|'fewer-sheets'|'alternative';
export interface PortfolioChoice {
  layoutId: string;
  roles: PortfolioRole[];
  newSheets: number;
  linealM: number;
  coverM2: number;
  netRoofM2: number;
  savedLinealM: number;
  savedCoverM2: number;
  sheetDelta: number;
  workflow: WorkflowQuality;
  workflowDelta: Record<WorkflowMetric,number>;
  reuseDepth: number;
  changedFaceIds: string[];
  warnings: string[];
  /** A preference rejection is not a physical rejection. */
  previousPreferenceReason: string|null;
  arrangementId: string;
  sourceRoutes: Array<{fromFaceIds:string[];cutOnFaceId:string;toFaceId:string;count:number;recut:boolean}>;
}
export interface PortfolioReport {
  model: typeof PORTFOLIO_POLICY.model;
  inputFingerprint: string;
  referenceLayoutId: string;
  choices: PortfolioChoice[];
  candidateCount: number;
  validatedCount: number;
  validationRejected: number;
  budgetReached: boolean;
  elapsedMs: number;
  searchMilliseconds: number;
  variantsTried: number;
  variantsPlanned: number;
  status: 'cached'|'complete'|'bounded';
  note: string;
}
export interface PortfolioResult { plans: Solution[]; report: PortfolioReport }
export interface PortfolioSearchOptions {
  previous: Solution;
  saved?: Solution[];
  attempt?: number;
  maxMilliseconds?: number;
  maxPlans?: number;
}
export const portfolioInputFingerprint=(r:SolveRequest):string=>fingerprint([r.roof.sourceRevision,r.faces,r.profile,r.settings]);
const workKeys:WorkflowMetric[]=['sourceRelationships','splitSets','reuseRuns','recutRuns','freshCutRuns','fillerSeparators','primaryOperations','stockLengthGroups'];
const clone=<T>(x:T):T=>structuredClone(x);
interface Candidate { solution:Solution; id:string; arrangement:string; lineal:number; cover:number; workflow:WorkflowQuality; depth:number }
function candidate(s:Solution):Candidate {
  const w=s.profile.coverMm+s.profile.leftLapMm+s.profile.rightLapMm;
  if(!Number.isFinite(w)||w<=0||!Number.isFinite(s.metrics.newMaterialMm2))throw new Error('Invalid candidate material quantities.');
  return {solution:s,id:planSignature(s),arrangement:arrangementSignature(s),lineal:s.metrics.newMaterialMm2/w/1000,
    cover:s.metrics.newMaterialMm2/w*s.profile.coverMm/1e6,workflow:coherentWorkflow(s),depth:Math.max(0,...reuseDepth(s).values())};
}
/** Ignore small length and grid shifts, but retain genuinely different source
 * sequences, cutting sites, lap/orientation and donor operations. This signature
 * controls only menu diversity; the exact plan signature/validation is separate. */
export function arrangementSignature(s:Solution):string {
  const view=supplyView(s),placements=new Map(s.placements.map(p=>[p.demandId,p])),cuts=new Map(s.offcuts.map(o=>[o.id,o]));
  const rows=[...new Set(s.demands.map(d=>d.faceId))].sort().map(id=>{
    const runs:string[]=[];
    for(const d of s.demands.filter(d=>d.faceId===id).sort((a,b)=>a.laneIndex-b.laneIndex)){
      const p=placements.get(d.id),o=cuts.get(p?.offcutId??'');
      const block=view.blocks.find(b=>b.id===view.blockByPlacement.get(d.id));
      const source=block?[...block.faceIds].sort().join('+'):o?.rootDemandId?.split(':sheet:')[0]??'';
      const tag=p?.kind==='reuse'?`r:${source}:${o?.sourceFaceId}:${o?.cutKind}:${o?.cutArm}:${o?.generation??0}:${p.rotation}:${d.lap}`:`n:${d.lap}`;
      if(tag!==runs.at(-1))runs.push(tag);
    }
    return[id,runs];
  });
  return fingerprint([rows,s.bankLayout?.primaryOperations?.map(o=>[...o.faceIds].sort()).sort()]);
}
/** Retain a bounded pool without keeping every trial tree in memory. Both cost
 * and workflow extremes plus different donor structures survive the shortlist. */
export class PortfolioCandidates {
  private rows=new Map<string,Candidate>();
  count=0;
  add(s:Solution):void {
    if(s.status==='invalid'||s.salvage||s.placements.some(p=>p.manual))return;
    this.count++;
    const row=candidate(s),previous=this.rows.get(row.arrangement);
    if(previous&&(previous.cover<row.cover-1e-7||Math.abs(previous.cover-row.cover)<1e-7&&previous.workflow.score<=row.workflow.score))return;
    row.solution=clone(s);this.rows.set(row.arrangement,row);
    if(this.rows.size<=PORTFOLIO_POLICY.candidateCapacity)return;
    const all=[...this.rows.values()],cost=[...all].sort((a,b)=>a.cover-b.cover||a.workflow.score-b.workflow.score),work=[...all].sort((a,b)=>a.workflow.score-b.workflow.score||a.cover-b.cover);
    const keep=new Set([...cost.slice(0,12),...work.slice(0,8)]);
    // Preserve low-sheet-count alternatives with different donor sequences too.
    for(const r of [...all].sort((a,b)=>a.solution.metrics.newSheetCount-b.solution.metrics.newSheetCount||a.cover-b.cover)){
      if(keep.size>=PORTFOLIO_POLICY.candidateCapacity)break;keep.add(r);
    }
    this.rows=new Map([...keep].map(r=>[r.arrangement,r]));
  }
  solutions():Solution[]{return [...this.rows.values()].map(r=>r.solution);}
}
function presentable(base:Candidate,row:Candidate):boolean {
  if(row.cover>base.cover+Math.min(PORTFOLIO_POLICY.simplerMaxExtraM2,base.cover*PORTFOLIO_POLICY.simplerMaxExtraPercent/100)+1e-6)return false;
  // Broad usability ceilings, not permission to relax fitting/receiver rules.
  // Ordinary workflow deltas are explained, not used as hard rejection gates.
  if(row.depth>Math.max(base.depth,3))return false;
  if(row.workflow.score>Math.max(base.workflow.score*1.75,base.workflow.score+100))return false;
  if(row.workflow.sourceRelationships>base.workflow.sourceRelationships+6||row.workflow.reuseRuns>base.workflow.reuseRuns+16)return false;
  return base.cover-row.cover>=PORTFOLIO_POLICY.minimumDistinctSavingM2-1e-6||row.workflow.score<=base.workflow.score-4;
}
function description(base:Candidate,row:Candidate,roles:PortfolioRole[]):PortfolioChoice {
  const delta={} as Record<WorkflowMetric,number>;
  for(const k of workKeys)delta[k]=row.workflow[k]-base.workflow[k];
  const view=supplyView(row.solution),demands=new Map(row.solution.demands.map(d=>[d.id,d])),cuts=new Map(row.solution.offcuts.map(o=>[o.id,o]));
  const routes=new Map<string,PortfolioChoice['sourceRoutes'][number]>();
  for(const p of row.solution.placements){
    if(p.kind!=='reuse')continue;const d=demands.get(p.demandId),o=cuts.get(p.offcutId??'');if(!d||!o)continue;
    const block=view.blocks.find(b=>b.id===view.blockByPlacement.get(p.demandId));
    if(block?.faceIds.includes(d.faceId))continue;
    const fromFaceIds=block?.faceIds??[o.sourceFaceId],key=JSON.stringify([fromFaceIds,o.sourceFaceId,d.faceId]);
    const route=routes.get(key)??{fromFaceIds:[...fromFaceIds],cutOnFaceId:o.sourceFaceId,toFaceId:d.faceId,count:0,recut:(o.generation??0)>=2};route.count++;routes.set(key,route);
  }
  const warnings:string[]=[];
  if(row.depth>base.depth)warnings.push('More generations of offcuts: follow the source-first cutting sequence.');
  if(delta.sourceRelationships>0)warnings.push(`${delta.sourceRelationships} additional material transfer${delta.sourceRelationships===1?'':'s'} between cutting operations.`);
  if(delta.splitSets>0)warnings.push(`${delta.splitSets} additional split cut set${delta.splitSets===1?'':'s'}.`);
  if(delta.reuseRuns>0)warnings.push(`${delta.reuseRuns} additional separate reuse run${delta.reuseRuns===1?'':'s'}.`);
  if(!row.solution.profile.rulesConfirmed)warnings.push('Profile/lap rules are not confirmed; this remains a draft, not an order-ready schedule.');
  let previousPreferenceReason:string|null=null;
  if(row.id!==base.id){try{const assessment=coordinatedMaterialAssessment(base.solution,row.solution);if(!assessment.accepted)previousPreferenceReason=assessment.reason;}catch{/* Report only, not validation authority. */}}
  return {layoutId:row.id,roles,newSheets:row.solution.metrics.newSheetCount,linealM:row.lineal,coverM2:row.cover,
    netRoofM2:row.solution.metrics.netRoofMm2/1e6,savedLinealM:base.lineal-row.lineal,savedCoverM2:base.cover-row.cover,
    sheetDelta:row.solution.metrics.newSheetCount-base.solution.metrics.newSheetCount,
    workflow:row.workflow,workflowDelta:delta,reuseDepth:row.depth,
    changedFaceIds:row.id===base.id?[]:comparePlans(base.solution,row.solution,'less-material').changedFaceIds,warnings,
    previousPreferenceReason,arrangementId:row.arrangement,sourceRoutes:[...routes.values()]};
}
export interface PortfolioEvidence {candidateCount?:number;budgetReached?:boolean;elapsedMs?:number;searchMilliseconds?:number;variantsTried?:number;variantsPlanned?:number;status?:PortfolioReport['status']}
/** Caller supplies the full draft validator. No failed or partly validated tree
 * may be published, even when its material total is attractive. Original stays
 * first and byte-identical; selection never silently changes the active plan. */
export function selectPlanPortfolio(request:SolveRequest,reference:Solution,solutions:Solution[],validate:(s:Solution)=>Issue[],evidence:PortfolioEvidence={},maximumPlans:number=PORTFOLIO_POLICY.maximumPlans):PortfolioResult {
  if(!Number.isInteger(maximumPlans)||maximumPlans<1||maximumPlans>PORTFOLIO_POLICY.maximumPlans)throw new Error('Compare between one and five plans.');
  if(reference.status==='invalid'||validate(reference).some(i=>i.severity==='error'))throw new Error('The comparison reference no longer passes physical checks.');
  const base=candidate(reference),seen=new Set([base.id]),rows:Candidate[]=[];
  let validationRejected=0,validatedCount=1;
  for(const s of solutions){
    const id=planSignature(s);if(seen.has(id)||s.salvage||s.placements.some(p=>p.manual))continue;seen.add(id);
    try{if(s.status==='invalid'||validate(s).some(i=>i.severity==='error')){validationRejected++;continue;}
      validatedCount++;const row=candidate(s);if(presentable(base,row)&&(row.arrangement!==base.arrangement||base.cover-row.cover>=PORTFOLIO_POLICY.minimumDistinctSavingM2))rows.push(row);
    }catch{validationRejected++;}
  }
  // Stable grouping, not a non-transitive fuzzy comparator.
  const byArrangement=new Map<string,Candidate>();
  for(const row of rows.sort((a,b)=>a.cover-b.cover||a.workflow.score-b.workflow.score||a.id.localeCompare(b.id)))if(!byArrangement.has(row.arrangement))byArrangement.set(row.arrangement,row);
  const distinct=[...byArrangement.values()],chosen:Candidate[]=[base],roles=new Map<string,PortfolioRole[]>([[base.id,['recommended']]]);
  const add=(row:Candidate|undefined,role:PortfolioRole):void=>{
    if(!row)return;
    if(!chosen.includes(row)){if(chosen.length>=maximumPlans)return;chosen.push(row);}
    const rs=roles.get(row.id)??[];if(!rs.includes(role))rs.push(role);roles.set(row.id,rs);
  };
  const least=[base,...distinct].sort((a,b)=>a.cover-b.cover||a.workflow.score-b.workflow.score||a.id.localeCompare(b.id))[0];
  add(least,'least-material');
  const simplest=[base,...distinct].sort((a,b)=>a.workflow.score-b.workflow.score||a.cover-b.cover||a.id.localeCompare(b.id))[0];
  add(simplest,'simplest');
  // A different source pattern with fewer whole purchased sheets can be useful
  // even if it is not best on either scalar score. Do not hide it by a 2D Pareto gate.
  const fewer=distinct.filter(r=>r.cover<base.cover&&r.solution.metrics.newSheetCount<Math.min(...chosen.map(c=>c.solution.metrics.newSheetCount)))
    .sort((a,b)=>a.solution.metrics.newSheetCount-b.solution.metrics.newSheetCount||a.cover-b.cover||a.workflow.score-b.workflow.score)[0];
  add(fewer,'fewer-sheets');
  const compromise=distinct.filter(r=>!chosen.includes(r)&&r.cover<base.cover-PORTFOLIO_POLICY.minimumDistinctSavingM2)
    .sort((a,b)=>a.workflow.score-b.workflow.score||a.cover-b.cover)[0];
  add(compromise,'alternative');
  // Additional meaningful trade-offs only. Strictly worse on material, grouped work, depth and sheet
  // count is not a valuable fifth option just because its hash differs.
  for(const row of distinct.sort((a,b)=>a.cover-b.cover||a.workflow.score-b.workflow.score)){
    if(chosen.length>=maximumPlans)break;
    if(chosen.includes(row))continue;
    const dominated=chosen.some(c=>c.cover<=row.cover&&c.depth<=row.depth&&c.workflow.score<=row.workflow.score&&c.solution.metrics.newSheetCount<=row.solution.metrics.newSheetCount);
    if(!dominated)add(row,'alternative');
  }
  const report:PortfolioReport={model:PORTFOLIO_POLICY.model,inputFingerprint:portfolioInputFingerprint(request),referenceLayoutId:base.id,
    choices:chosen.map(r=>description(base,r,roles.get(r.id)!)),candidateCount:evidence.candidateCount??solutions.length+1,validatedCount,validationRejected,
    budgetReached:evidence.budgetReached??false,elapsedMs:evidence.elapsedMs??0,searchMilliseconds:evidence.searchMilliseconds??0,
    variantsTried:evidence.variantsTried??0,variantsPlanned:evidence.variantsPlanned??0,status:evidence.status??'cached',
    note:'These are distinct fully checked plans found in a bounded search, not a proven minimum or a labour-time estimate. Selecting a plan changes the preview; quoting and PDF saving still require their explicit actions.'};
  return {plans:chosen.map(r=>{
    if(r.id===base.id)return clone(reference);
    const s=clone(r.solution),rs=roles.get(r.id)!;s.layoutId=r.id;
    s.objective=r.cover<base.cover?'less-material':'simpler';
    s.layoutLabel=rs.includes('least-material')?'Least material found':rs.includes('simplest')?'Simplest found':rs.includes('fewer-sheets')?'Fewer new sheets':'Different cutting plan';
    s.comparison=comparePlans(reference,s,s.objective);
    return s;
  }),report};
}
/** Restore display metadata only AFTER every stored plan has been revalidated.
 * Recompute all quantities/work deltas; never trust cached comparison figures. */
export function restorePortfolioReport(value:unknown,plans:Solution[],request:SolveRequest):PortfolioReport|null {
  if(!value||typeof value!=='object')return null;
  const report=value as PortfolioReport;
  if(report.model!==PORTFOLIO_POLICY.model||report.inputFingerprint!==portfolioInputFingerprint(request)||!Array.isArray(report.choices)||report.choices.length>5||!report.choices.length)return null;
  const reference=plans.find(s=>planSignature(s)===report.referenceLayoutId);if(!reference)return null;
  try{
    const base=candidate(reference),choices:PortfolioChoice[]=[],seen=new Set<string>();
    const validRoles:PortfolioRole[]=['recommended','least-material','simplest','fewer-sheets','alternative'];
    for(const old of report.choices){
      const s=plans.find(p=>planSignature(p)===old?.layoutId);
      if(!s||seen.has(old.layoutId)||!Array.isArray(old.roles)||!old.roles.length||old.roles.some(role=>!validRoles.includes(role)))return null;
      if(old.roles.includes('recommended')&&old.layoutId!==base.id)return null;
      seen.add(old.layoutId);choices.push(description(base,candidate(s),old.roles));
    }
    if(choices[0]?.layoutId!==base.id||!choices[0]?.roles.includes('recommended'))return null;
    // Badges are derived data too. A forged stored role must not label a more
    // expensive plan 'least material' after its arithmetic was corrected.
    for(const c of choices)c.roles=c.roles.filter(role=>role!=='least-material'&&role!=='simplest');
    const least=[...choices].sort((a,b)=>a.coverM2-b.coverM2||a.workflow.score-b.workflow.score||a.layoutId.localeCompare(b.layoutId))[0];least.roles.push('least-material');
    const simple=[...choices].sort((a,b)=>a.workflow.score-b.workflow.score||a.coverM2-b.coverM2||a.layoutId.localeCompare(b.layoutId))[0];simple.roles.push('simplest');
    for(const c of choices){if(c.roles.includes('fewer-sheets')&&choices.some(x=>x.newSheets<c.newSheets))c.roles=c.roles.filter(r=>r!=='fewer-sheets');if(!c.roles.length)c.roles=['alternative'];}
    const count=(n:unknown,max:number)=>typeof n==='number'&&Number.isFinite(n)?Math.min(max,Math.max(0,n)):0;
    return {...report,choices,candidateCount:count(report.candidateCount,10000),validatedCount:count(report.validatedCount,10000),validationRejected:count(report.validationRejected,10000),
      budgetReached:report.budgetReached===true,elapsedMs:count(report.elapsedMs,120000),searchMilliseconds:count(report.searchMilliseconds,25000),variantsTried:count(report.variantsTried,10000),variantsPlanned:count(report.variantsPlanned,10000),
      status:['cached','complete','bounded'].includes(report.status)?report.status:'cached',note:'Saved checked options. Quantities and workflow comparisons were recalculated from the restored plans.'};
  }catch{return null;}
}
