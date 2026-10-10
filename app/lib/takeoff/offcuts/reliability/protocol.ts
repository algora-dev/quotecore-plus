import type { InstallationSearchOptions, InstallationSearchResult } from '../core/installationSearch';
import type { PortfolioReport, PortfolioSearchOptions } from '../core/portfolio';
import { PORTFOLIO_POLICY, portfolioInputFingerprint } from '../core/portfolio';
import { planSignature } from '../core/diagnostics';
import type { AlternativePlanOptions, AlternativePlanResult, Issue, Solution, SolveRequest } from '../core/types';
import type { SalvageResult } from '../core/salvageModel';
import { fingerprint } from '../core/math';
export const WORKER_PROTOCOL = 'qc-offcuts-worker-v224' as const;
export const CALCULATION_LIMIT_MS = 60_000;
export type CalculationKind = 'recommended'|'simpler'|'less-material'|'salvage'|'portfolio'|'installation';
export type CalculationStage = 'saving-input'|'starting-worker'|'layout-search'|'receiver-safety'|'physical-validation'|'reassigning'|'stock-lengths'|'final-validation'|'returning-result'|'global-bank-search'|'comparing-plans'|'installation-search';
export const STAGE_LABELS:Record<CalculationStage,string> = {
  'installation-search':'Checking alternative donors and starting positions…',
  'comparing-plans':'Comparing checked cutting plans…',
  'saving-input':'Saving measurements and reviewed faces…', 'starting-worker':'Starting calculation…',
  'global-bank-search':'Comparing coordinated donor banks…',
  'layout-search':'Trying sheet-bank layouts…', 'receiver-safety':'Checking valley receiver lengths…',
  'physical-validation':'Checking complete sheets, cuts and laps…', 'reassigning':'Checking better offcut destinations…',
  'stock-lengths':'Checking ordered sheet lengths…', 'final-validation':'Validating the complete plan…',
  'returning-result':'Preparing the checked result…',
};
export interface CalculationJournal {
  schemaVersion:1; runId:string; engineVersion:'2.20'|'2.21'|'2.22'|'2.24'; kind:CalculationKind;
  status:'saving'|'running'|'complete'|'cancelled'|'timed-out'|'failed'; stage:CalculationStage;
  startedAt:string; updatedAt:string; elapsedMs:number; limitMs:number; requestFingerprint:string;
  completed:number; total:number; checkedFallbackAvailable:boolean; message:string;
  events:Array<{at:string;stage:CalculationStage;message:string}>;
}
export interface WorkerRequest { protocol:typeof WORKER_PROTOCOL; id:string; request:SolveRequest; limitMs:number;
  alternative?:AlternativePlanOptions; salvage?:{base:Solution}; portfolio?:PortfolioSearchOptions; installation?:InstallationSearchOptions; }
export interface CheckedPlan { solution:Solution; checks:Issue[]; requestFingerprint:string; solutionFingerprint:string; }
export interface CheckedPortfolio { report:PortfolioReport; reportFingerprint:string; plans:CheckedPlan[]; }
export type WorkerMessage = {protocol:typeof WORKER_PROTOCOL; id:string} & (
  {kind:'stage';stage:CalculationStage} | {kind:'progress';completed:number;total:number;stage:CalculationStage} |
  {kind:'checked-plan';plan:CheckedPlan} | {kind:'result';plan:CheckedPlan;portfolio?:CheckedPortfolio} |
  {kind:'portfolio-result';portfolio:CheckedPortfolio} |
  {kind:'installation-result';result:InstallationSearchResult;plans:CheckedPlan[];reportFingerprint:string} |
  {kind:'alternative-result';result:AlternativePlanResult;plan?:CheckedPlan} |
  {kind:'salvage-result';result:SalvageResult;plan?:CheckedPlan} |
  {kind:'error';message:string;code:'CALCULATION_LIMIT'|'WORKER_ERROR'});
/** Identity only, not a substitute for physical validation. The worker validates
 * the entire draft before issuing a receipt; the UI checks the exact payload. */
export const requestFingerprint=(r:SolveRequest):string=>fingerprint([r.roof,r.faces,r.profile,r.settings]);
export const solutionFingerprint=(s:Solution):string=>fingerprint(s);
export function checkedPlanMatches(plan:CheckedPlan,request:SolveRequest):boolean {
  return !!plan?.solution&&plan.solution.engineVersion==='2.24'&&plan.solution.status!=='invalid'&&
    Array.isArray(plan.checks)&&!plan.checks.some(i=>i.severity==='error')&&
    plan.requestFingerprint===requestFingerprint(request)&&plan.solutionFingerprint===solutionFingerprint(plan.solution);
}
export function isStage(value:unknown):value is CalculationStage {return typeof value==='string'&&Object.prototype.hasOwnProperty.call(STAGE_LABELS,value);}

/** Small persisted journal decoder. It never grants permission to use a plan. */
export function validCalculationJournal(value:unknown):value is CalculationJournal {
  if(!value||typeof value!=='object')return false;
  const j=value as CalculationJournal;
  return j.schemaVersion===1&&['2.20','2.21','2.22','2.23','2.24'].includes(j.engineVersion??'')&&typeof j.runId==='string'&&j.runId.length<200&&
    ['recommended','simpler','less-material','salvage','portfolio','installation'].includes(j.kind)&&['saving','running','complete','cancelled','timed-out','failed'].includes(j.status)&&
    isStage(j.stage)&&typeof j.requestFingerprint==='string'&&typeof j.message==='string'&&j.message.length<=1000&&typeof j.checkedFallbackAvailable==='boolean'&&
    Number.isFinite(Date.parse(j.startedAt))&&Number.isFinite(Date.parse(j.updatedAt))&&
    [j.elapsedMs,j.limitMs,j.completed,j.total].every(n=>Number.isFinite(n)&&n>=0)&&j.limitMs<=120000&&j.completed<=j.total&&
    Array.isArray(j.events)&&j.events.length<=60&&j.events.every(e=>!!e&&Number.isFinite(Date.parse(e.at))&&isStage(e.stage)&&typeof e.message==='string'&&e.message.length<=1000);
}

/** A historical reference is allowed only when its entire exact payload matches
 * the reference sent with this job. All other results must be the current engine
 * and have full-draft receipts. A number/label alone never authorizes a plan. */
export function checkedPortfolioMatches(value:CheckedPortfolio,request:SolveRequest,reference?:Solution):boolean {
  if(!value||value.reportFingerprint!==fingerprint(value.report)||value.report?.model!==PORTFOLIO_POLICY.model||value.report.inputFingerprint!==portfolioInputFingerprint(request)||
    !Array.isArray(value.plans)||!value.plans.length||value.plans.length>PORTFOLIO_POLICY.maximumPlans||
    !Array.isArray(value.report.choices)||value.report.choices.length!==value.plans.length)return false;
  const seen=new Set<string>();
  for(let i=0;i<value.plans.length;i++){
    const plan=value.plans[i],s=plan?.solution;if(!s)return false;
    const id=planSignature(s);
    if(seen.has(id)||value.report.choices[i]?.layoutId!==id)return false;seen.add(id);
    const historical=i===0&&reference&&solutionFingerprint(s)===solutionFingerprint(reference);
    if(!checkedPlanMatches(plan,request)&&!(historical&&s.status!=='invalid'&&Array.isArray(plan.checks)&&!plan.checks.some(c=>c.severity==='error')&&
      plan.requestFingerprint===requestFingerprint(request)&&plan.solutionFingerprint===solutionFingerprint(s)))return false;
  }
  return value.report.choices[0].roles.includes('recommended')&&value.report.choices.every((c,i)=>Array.isArray(c.roles)&&c.roles.length>0&&c.roles.every(r=>['recommended','least-material','simplest','fewer-sheets','alternative'].includes(r))&&(!c.roles.includes('recommended')||i===0))&&planSignature(value.plans[0].solution)===value.report.referenceLayoutId&&
    (!reference||solutionFingerprint(value.plans[0].solution)===solutionFingerprint(reference));
}

export function checkedInstallationMatches(message:Extract<WorkerMessage,{kind:'installation-result'}>,request:SolveRequest,reference?:Solution):boolean {
  const result=message.result,report=result?.report;
  return !!reference&&!!report&&report.model==='anchored-donor-search-v1'&&report.inputFingerprint===fingerprint([request.roof,request.faces,request.profile,request.settings])&&report.referenceLayoutId===planSignature(reference)&&message.reportFingerprint===fingerprint(report)&&
    ['found','no-distinct-plan'].includes(report.status)&&Array.isArray(result.plans)&&result.plans.length<=3&&message.plans.length===result.plans.length&&
    (report.status==='found')===(result.plans.length>0)&&new Set(result.plans.map(planSignature)).size===result.plans.length&&
    result.plans.every((s,i)=>checkedPlanMatches(message.plans[i],request)&&solutionFingerprint(s)===message.plans[i].solutionFingerprint&&s.installationPlan?.referenceLayoutId===report.referenceLayoutId);
}
