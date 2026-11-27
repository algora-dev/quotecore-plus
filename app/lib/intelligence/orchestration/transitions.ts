import { parseTask,type Task,type Status } from '../contracts/tasks';
import { ensure,hash,id,integer } from '../contracts/validation';
import { digest } from '../policy/approval';
import { sameScope,type JobScope } from '../contracts/evidence';
export const terminal=(s:Status)=>s==='completed'||s==='cancelled'||s==='permanent_failure'||s==='superseded';
export type TaskGuard={scope:JobScope;policyVersion:number;inputHash:string;admitted:boolean};
export type WorkerToken={taskId:string;ownerId:string;fence:number;version:number};
function current(t:Task,g:TaskGuard):boolean {return g.admitted===true&&sameScope(t.scope,g.scope)&&t.policyVersion===g.policyVersion&&t.inputHash===g.inputHash;}
export function taskKey(t:Task):string {return digest({scope:t.scope,stage:t.stage,policyVersion:t.policyVersion,inputHash:t.inputHash});}
/** All functions produce proposals for an atomic compare-and-swap in a future persistence adapter. */
export function claim(raw:unknown,guard:TaskGuard,expectedVersion:number,ownerId:string,nowMs:number,leaseMs:number):Task {
  const t=parseTask(raw);integer(nowMs,'nowMs',1);integer(leaseMs,'leaseMs',1,3600000);id(ownerId,'ownerId');
  ensure(t.version===expectedVersion&&current(t,guard),'task claim authority/version');
  ensure((t.status==='queued'||t.status==='retryable_failure')&&t.notBeforeMs<=nowMs&&t.attempt<t.maxAttempts&&nowMs<t.deadlineMs,'task claim state');
  return parseTask({...t,status:'running',version:t.version+1,attempt:t.attempt+1,fence:t.fence+1,lease:{ownerId,expiresAtMs:Math.min(t.deadlineMs,nowMs+leaseMs)}});
}
function assertWorker(t:Task,token:WorkerToken,guard:TaskGuard,nowMs:number):void {
  integer(nowMs,'nowMs',1);
  ensure(current(t,guard)&&t.status==='running'&&t.id===token.taskId&&t.version===token.version&&t.fence===token.fence&&t.lease?.ownerId===token.ownerId&&t.lease.expiresAtMs>nowMs&&t.deadlineMs>nowMs,'stale/unauthorized worker');
}
export function checkpoint(raw:unknown,token:WorkerToken,guard:TaskGuard,nowMs:number,checkpointHash:string,extendMs:number):Task {
  const t=parseTask(raw);assertWorker(t,token,guard,nowMs);hash(checkpointHash,'checkpointHash');integer(extendMs,'extendMs',1,3600000);
  return parseTask({...t,version:t.version+1,checkpointHash,lease:{ownerId:token.ownerId,expiresAtMs:Math.min(t.deadlineMs,Math.max(t.lease!.expiresAtMs,nowMs+extendMs))}});
}
export function finish(raw:unknown,token:WorkerToken,guard:TaskGuard,nowMs:number,outcome:'completed'|'waiting_for_input'|'waiting_for_approval'|'retryable_failure'|'permanent_failure'):Task {
  const t=parseTask(raw);assertWorker(t,token,guard,nowMs);
  ensure(['completed','waiting_for_input','waiting_for_approval','retryable_failure','permanent_failure'].includes(outcome),'worker outcome');
  const delay=Math.min(60000,1000*2**(t.attempt-1));
  const status=outcome==='retryable_failure'&&(t.attempt>=t.maxAttempts||nowMs+delay>=t.deadlineMs)?'permanent_failure':outcome;
  return parseTask({...t,version:t.version+1,status,lease:undefined,notBeforeMs:status==='retryable_failure'?nowMs+delay:nowMs});
}
export function recoverExpired(raw:unknown,expectedVersion:number,nowMs:number):Task {
  const t=parseTask(raw);integer(nowMs,'nowMs',1);ensure(t.version===expectedVersion&&t.status==='running'&&t.lease!.expiresAtMs<=nowMs,'not expired');
  const delay=Math.min(60000,1000*2**(t.attempt-1));const retry=t.attempt<t.maxAttempts&&nowMs+delay<t.deadlineMs;
  return parseTask({...t,version:t.version+1,fence:t.fence+1,lease:undefined,status:retry?'retryable_failure':'permanent_failure',notBeforeMs:retry?nowMs+delay:nowMs});
}
export type ControlGuard={scope:JobScope;authorizedControl:boolean;resumeGuard?:TaskGuard};
/** Control permission is separate from execution permission: a disabled agent must still be cancellable. */
export function control(raw:unknown,guard:ControlGuard,expectedVersion:number,nowMs:number,command:'pause'|'cancel'|'supersede'|'resume'):Task {
  const t=parseTask(raw);integer(nowMs,'nowMs',1);
  ensure(t.version===expectedVersion&&!terminal(t.status)&&sameScope(t.scope,guard.scope)&&guard.authorizedControl===true,'control authority/version');
  ensure(['pause','cancel','supersede','resume'].includes(command),'command');
  if(command==='resume')ensure(guard.resumeGuard&&current(t,guard.resumeGuard)&&['paused','waiting_for_input','waiting_for_approval'].includes(t.status)&&t.attempt<t.maxAttempts&&nowMs<t.deadlineMs,'resume state');
  const status=command==='pause'?'paused':command==='cancel'?'cancelled':command==='supersede'?'superseded':'queued';
  return parseTask({...t,version:t.version+1,fence:t.fence+1,lease:undefined,status,notBeforeMs:nowMs});
}
