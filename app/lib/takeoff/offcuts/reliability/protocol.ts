import type { AlternativePlanOptions, AlternativePlanResult, Issue, Solution, SolveRequest } from '../core/types';
import type { SalvageResult } from '../core/salvageModel';
import { fingerprint } from '../core/math';
export const WORKER_PROTOCOL = 'qc-offcuts-worker-v221' as const;
export const CALCULATION_LIMIT_MS = 60_000;
export type CalculationKind = 'recommended'|'simpler'|'less-material'|'salvage';
export type CalculationStage = 'saving-input'|'starting-worker'|'layout-search'|'receiver-safety'|'physical-validation'|'reassigning'|'stock-lengths'|'final-validation'|'returning-result';
export const STAGE_LABELS:Record<CalculationStage,string> = {
  'saving-input':'Saving measurements and reviewed faces…', 'starting-worker':'Starting calculation…',
  'layout-search':'Trying sheet-bank layouts…', 'receiver-safety':'Checking valley receiver lengths…',
  'physical-validation':'Checking complete sheets, cuts and laps…', 'reassigning':'Checking better offcut destinations…',
  'stock-lengths':'Checking ordered sheet lengths…', 'final-validation':'Validating the complete plan…',
  'returning-result':'Preparing the checked result…',
};
export interface CalculationJournal {
  schemaVersion:1; runId:string; engineVersion:'2.20'|'2.21'; kind:CalculationKind;
  status:'saving'|'running'|'complete'|'cancelled'|'timed-out'|'failed'; stage:CalculationStage;
  startedAt:string; updatedAt:string; elapsedMs:number; limitMs:number; requestFingerprint:string;
  completed:number; total:number; checkedFallbackAvailable:boolean; message:string;
  events:Array<{at:string;stage:CalculationStage;message:string}>;
}
export interface WorkerRequest { protocol:typeof WORKER_PROTOCOL; id:string; request:SolveRequest; limitMs:number;
  alternative?:AlternativePlanOptions; salvage?:{base:Solution}; }
export interface CheckedPlan { solution:Solution; checks:Issue[]; requestFingerprint:string; solutionFingerprint:string; }
export type WorkerMessage = {protocol:typeof WORKER_PROTOCOL; id:string} & (
  {kind:'stage';stage:CalculationStage} | {kind:'progress';completed:number;total:number;stage:CalculationStage} |
  {kind:'checked-plan';plan:CheckedPlan} | {kind:'result';plan:CheckedPlan} |
  {kind:'alternative-result';result:AlternativePlanResult;plan?:CheckedPlan} |
  {kind:'salvage-result';result:SalvageResult;plan?:CheckedPlan} |
  {kind:'error';message:string;code:'CALCULATION_LIMIT'|'WORKER_ERROR'});
/** Identity only, not a substitute for physical validation. The worker validates
 * the entire draft before issuing a receipt; the UI checks the exact payload. */
export const requestFingerprint=(r:SolveRequest):string=>fingerprint([r.roof,r.faces,r.profile,r.settings]);
export const solutionFingerprint=(s:Solution):string=>fingerprint(s);
export function checkedPlanMatches(plan:CheckedPlan,request:SolveRequest):boolean {
  return !!plan?.solution&&plan.solution.engineVersion==='2.21'&&plan.solution.status!=='invalid'&&
    Array.isArray(plan.checks)&&!plan.checks.some(i=>i.severity==='error')&&
    plan.requestFingerprint===requestFingerprint(request)&&plan.solutionFingerprint===solutionFingerprint(plan.solution);
}
export function isStage(value:unknown):value is CalculationStage {return typeof value==='string'&&Object.prototype.hasOwnProperty.call(STAGE_LABELS,value);}

/** Small persisted journal decoder. It never grants permission to use a plan. */
export function validCalculationJournal(value:unknown):value is CalculationJournal {
  if(!value||typeof value!=='object')return false;
  const j=value as CalculationJournal;
  return j.schemaVersion===1&&['2.20','2.21'].includes(j.engineVersion??'')&&typeof j.runId==='string'&&j.runId.length<200&&
    ['recommended','simpler','less-material','salvage'].includes(j.kind)&&['saving','running','complete','cancelled','timed-out','failed'].includes(j.status)&&
    isStage(j.stage)&&typeof j.requestFingerprint==='string'&&typeof j.message==='string'&&j.message.length<=1000&&typeof j.checkedFallbackAvailable==='boolean'&&
    Number.isFinite(Date.parse(j.startedAt))&&Number.isFinite(Date.parse(j.updatedAt))&&
    [j.elapsedMs,j.limitMs,j.completed,j.total].every(n=>Number.isFinite(n)&&n>=0)&&j.limitMs<=120000&&j.completed<=j.total&&
    Array.isArray(j.events)&&j.events.length<=60&&j.events.every(e=>!!e&&Number.isFinite(Date.parse(e.at))&&isStage(e.stage)&&typeof e.message==='string'&&e.message.length<=1000);
}
