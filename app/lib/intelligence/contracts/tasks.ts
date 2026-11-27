import { parseScope,type JobScope } from './evidence';
import { choice,ensure,hash,id,integer,record } from './validation';
export const STAGES=['intake','validate','analyze','brief','measurement_preparation','measurement_review','estimate','estimate_review','quote_draft','quote_approval','send','follow_up'] as const;
export type Stage=typeof STAGES[number];
export const STATUSES=['queued','running','waiting_for_input','waiting_for_approval','paused','cancelled','retryable_failure','permanent_failure','completed','superseded'] as const;
export type Status=typeof STATUSES[number];
export type Task={id:string;scope:JobScope;stage:Stage;status:Status;version:number;policyVersion:number;inputHash:string;attempt:number;maxAttempts:number;deadlineMs:number;fence:number;lease?:{ownerId:string;expiresAtMs:number};notBeforeMs:number;checkpointHash?:string};
export function parseTask(v:unknown):Task {
  const r=record(v,'task',['id','scope','stage','status','version','policyVersion','inputHash','attempt','maxAttempts','deadlineMs','fence','lease','notBeforeMs','checkpointHash']);
  const status=choice(r.status,'status',STATUSES);const maxAttempts=integer(r.maxAttempts,'maxAttempts',1,10);const attempt=integer(r.attempt,'attempt',0,maxAttempts);
  const l=r.lease===undefined?undefined:record(r.lease,'lease',['ownerId','expiresAtMs']);const lease=l?{ownerId:id(l.ownerId,'ownerId'),expiresAtMs:integer(l.expiresAtMs,'expiresAtMs',1)}:undefined;
  const deadlineMs=integer(r.deadlineMs,'deadlineMs',1);const fence=integer(r.fence,'fence');const notBeforeMs=integer(r.notBeforeMs,'notBeforeMs');
  ensure((status==='running')===!!lease,'running lease');ensure(!lease||(attempt>0&&fence>0&&lease.expiresAtMs<=deadlineMs),'lease bounds');
  return {id:id(r.id,'task.id'),scope:parseScope(r.scope),stage:choice(r.stage,'stage',STAGES),status,version:integer(r.version,'version',1),policyVersion:integer(r.policyVersion,'policyVersion',1),inputHash:hash(r.inputHash,'inputHash'),attempt,maxAttempts,deadlineMs,fence,notBeforeMs,...(lease?{lease}:{}),...(r.checkpointHash!==undefined?{checkpointHash:hash(r.checkpointHash,'checkpointHash')}:{})};
}
