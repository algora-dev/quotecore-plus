import { sameScope,type JobScope } from '../contracts/evidence';
import { ensure,id } from '../contracts/validation';
import { admit } from '../policy/admission';
import { digest } from '../policy/approval';
import type { Actor,IntelligenceStore,Transaction } from '../persistence/store';
import type { AnalysisIntent,MailRoute } from './contracts';
import type { Grant } from './service';

export type EventTransaction=Transaction & {intent:AnalysisIntent;route:MailRoute;grant:Grant;stagedManifestHash:string;intakeVersion:number};
/** Resolve opaque task ID to immutable intent + canonical job, route, grant and authority.
 * Lock all together, re-read on EACH call, roll back on failure. This is a separate worker-only
 * entry point, not a browser API. No unguarded store may execute an event-origin task. */
export interface EventJobPort {transactEvent<T>(taskId:string,actor:Actor,fn:(tx:EventTransaction)=>T):Promise<T>}
/** Instantiate once per opaque task ID; existing IntelligenceService/DocumentWorker can use
 * this wrapper for claim, initialize, page reservation and result transactions. Never use as
 * a general client-facing store. Revocation denies new work/results; any uncertain usage must
 * be reconciled separately by authorized control path (not this revoked worker). */
export class EventWorkerStore implements IntelligenceStore {
 constructor(private readonly port:EventJobPort,private readonly taskId:string){id(taskId,'event task');}
 transact<T>(scope:JobScope,actor:Actor,fn:(tx:Transaction)=>T):Promise<T>{
  ensure(actor.kind==='worker','event worker required');return this.port.transactEvent(this.taskId,actor,tx=>{
   const a=tx.intent,g=tx.grant,r=tx.route,p=tx.company.policy,j=tx.job;
   const t=j.tasks.find(t=>t.id===this.taskId);
   ensure(t&&a.id===this.taskId&&t.stage==='analyze'&&sameScope(t.scope,scope)&&sameScope(a.scope,scope)&&sameScope(j.scope,scope)&&p.companyId===scope.companyId,'event task scope');
   ensure(r.enabled&&r.verified&&r.companyId===scope.companyId&&r.version===a.routeVersion&&g.active&&g.companyId===scope.companyId&&g.routeId===r.id&&g.id===a.grantId&&g.version===a.grantVersion&&g.workerId===actor.id&&a.workerId===actor.id&&g.expiresAtMs>tx.nowMs&&a.deadlineMs>tx.nowMs,'event grant revoked/stale');
   ensure(tx.company.enabled&&p.mode==='intelligent'&&a.intakeVersion===tx.intakeVersion&&a.jobRevision===j.revision&&a.inputHash===j.inputHash&&a.inputHash===t.inputHash&&a.policyVersion===p.version&&a.policyVersion===t.policyVersion&&a.manifestHash===tx.stagedManifestHash&&t.deadlineMs===a.deadlineMs,'event input stale');
   ensure(admit(p,tx.authority,{scope,actorId:actor.id,action:'analyze_documents',policyVersion:p.version,jobRevision:j.revision,trigger:'event'}).allowed,'event worker admission');
   // The trusted worker callback may change this task only, never an unrelated task.
   const other=digest(j.tasks.filter(x=>x.id!==this.taskId).map(x=>JSON.parse(JSON.stringify(x))));
   const hadRun=!!j.documentRun;const out=fn(tx);if(!hadRun&&j.documentRun)ensure(j.documentRun.taskId===this.taskId&&digest(j.documentRun.manifest)===a.manifestHash,'event initial manifest mismatch');ensure(other===digest(j.tasks.filter(x=>x.id!==this.taskId).map(x=>JSON.parse(JSON.stringify(x)))),'unrelated task mutation');return out;
  });
 }
}
