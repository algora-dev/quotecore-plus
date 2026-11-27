import { sameScope, parseScope, MAX_SOURCE_BYTES, type JobScope } from '../contracts/evidence';
import { parseBrief } from '../contracts/brief';
import { parseTask } from '../contracts/tasks';
import { parseMemory } from '../contracts/memory';
import { ensure, id, integer } from '../contracts/validation';
import { admit, canReserve, settleReservation } from '../policy/admission';
import { approvalMatches, digest, parseBinding } from '../policy/approval';
import { claim, checkpoint, finish, control, recoverExpired, taskKey, type WorkerToken } from '../orchestration/transitions';
import type { Action } from '../contracts/policy';
import type { Actor, IntelligenceStore, Transaction, Reservation } from './store';

const spend = (rs: Reservation[]) => ({spentMicros: rs.reduce((n,r)=>n+(r.actual??0),0), reservedMicros: rs.reduce((n,r)=>n+(r.state==='held'?r.amount:0),0)});
export class IntelligenceService {
  constructor(private readonly store: IntelligenceStore) {}
  private run<T>(scope: JobScope, actor: Actor, fn: (tx: Transaction)=>T) {
    return this.store.transact(parseScope(scope),actor,tx=>{
      ensure(sameScope(scope,tx.job.scope)&&sameScope(scope,tx.authority.scope)&&tx.company.policy.companyId===scope.companyId&&tx.authority.actorId===actor.id,'scope/actor');
      return fn(tx);
    });
  }
  private audit(tx: Transaction,event:string,target:string) { tx.job.audit.push({actorId:tx.authority.actorId,atMs:tx.nowMs,event,target}); }
  private guard(tx:Transaction,action:Action='analyze_documents') {
    const p=tx.company.policy;
    ensure(tx.company.enabled===true,'feature disabled');
    const a=admit(p,tx.authority,{scope:tx.job.scope,actorId:tx.authority.actorId,action,policyVersion:p.version,jobRevision:tx.job.revision,trigger:'explicit'});
    ensure(a.allowed,'admission denied');
    return {scope:tx.job.scope,policyVersion:p.version,inputHash:tx.job.inputHash,admitted:true};
  }
  enqueue(scope:JobScope,actor:Actor,taskId:string) { return this.run(scope,actor,tx=>{
    ensure(actor.kind==='user','explicit user required');const g=this.guard(tx);const p=tx.company.policy;
    const task=parseTask({id:taskId,scope,stage:'analyze',status:'queued',version:1,policyVersion:g.policyVersion,inputHash:g.inputHash,attempt:0,maxAttempts:p.maxAttempts,deadlineMs:tx.nowMs+p.maxTaskMs,fence:0,notBeforeMs:tx.nowMs});
    const existing=tx.job.tasks.find(t=>taskKey(t)===taskKey(task));if(existing)return existing;
    ensure(!tx.job.tasks.some(t=>t.id===taskId),'duplicate task id');tx.job.tasks.push(task);this.audit(tx,'enqueue',taskId);return task;
  }); }
  private task(tx:Transaction,taskId:string){const i=tx.job.tasks.findIndex(t=>t.id===taskId);ensure(i>=0,'task missing');return {i,t:tx.job.tasks[i]};}
  claim(scope:JobScope,actor:Actor,taskId:string,version:number,leaseMs:number){return this.run(scope,actor,tx=>{
    ensure(actor.kind==='worker','worker required');const g=this.guard(tx);const {i,t}=this.task(tx,taskId);const next=claim(t,g,version,actor.id,tx.nowMs,leaseMs);tx.job.tasks[i]=next;this.audit(tx,'claim',taskId);return next;
  });}
  checkpoint(scope:JobScope,actor:Actor,token:WorkerToken,hash:string,extendMs:number){return this.run(scope,actor,tx=>{
    ensure(actor.kind==='worker'&&token.ownerId===actor.id,'worker required');const {i,t}=this.task(tx,token.taskId);const next=checkpoint(t,token,this.guard(tx),tx.nowMs,hash,extendMs);tx.job.tasks[i]=next;this.audit(tx,'checkpoint',t.id);return next;
  });}
  finish(scope:JobScope,actor:Actor,token:WorkerToken,outcome:Parameters<typeof finish>[4]){return this.run(scope,actor,tx=>{
    ensure(actor.kind==='worker'&&token.ownerId===actor.id,'worker required');const {i,t}=this.task(tx,token.taskId);const next=finish(t,token,this.guard(tx),tx.nowMs,outcome);tx.job.tasks[i]=next;this.audit(tx,'finish',t.id);return next;
  });}
  recover(scope:JobScope,actor:Actor,taskId:string,version:number){return this.run(scope,actor,tx=>{
    ensure(tx.canControl,'control denied');const {i,t}=this.task(tx,taskId);const next=recoverExpired(t,version,tx.nowMs);tx.job.tasks[i]=next;this.audit(tx,'recover',taskId);return next;
  });}
  control(scope:JobScope,actor:Actor,taskId:string,version:number,command:Parameters<typeof control>[4]){return this.run(scope,actor,tx=>{
    const {i,t}=this.task(tx,taskId);ensure(command!=='resume'||t.status==='paused','review-dependent resume not implemented');const next=control(t,{scope,authorizedControl:tx.canControl,resumeGuard:command==='resume'?this.guard(tx):undefined},version,tx.nowMs,command);tx.job.tasks[i]=next;this.audit(tx,command,taskId);return next;
  });}
  reserve(scope:JobScope,actor:Actor,token:WorkerToken,reservationId:string,amount:number){return this.run(scope,actor,tx=>{
    ensure(actor.kind==='worker'&&token.ownerId===actor.id,'worker required');const {t}=this.task(tx,token.taskId);
    // Validate live lease without mutating it.
    checkpoint(t,token,this.guard(tx),tx.nowMs,tx.job.inputHash,1);
    id(reservationId,'reservation');integer(amount,'amount',1);
    const existing=tx.job.reservations.find(r=>r.id===reservationId);
    if(existing){ensure(existing.taskId===t.id&&existing.fence===t.fence&&existing.amount===amount,'reservation collision');return {reservation:existing,created:false};}
    ensure(canReserve(tx.company.policy,spend(tx.job.reservations),spend(tx.company.jobs.reduce<Reservation[]>((all,j)=>all.concat(j.reservations),[])),amount),'budget exceeded');
    const r:Reservation={id:reservationId,taskId:t.id,fence:t.fence,amount,actual:null,state:'held'};tx.job.reservations.push(r);this.audit(tx,'reserve',reservationId);return {reservation:r,created:true};
  });}
  /** Reconciliation only: trusted operator, never client-reported usage. Unknown usage stays held. */
  settle(scope:JobScope,actor:Actor,reservationId:string,actual:number|null){return this.run(scope,actor,tx=>{
    ensure(tx.canControl&&actor.kind==='worker','reconciliation denied');const r=tx.job.reservations.find(x=>x.id===reservationId);ensure(r,'reservation missing');
    if(r.state==='settled'){ensure(r.actual===actual,'settlement conflict');return r;}
    settleReservation(r.amount,actual);if(actual!==null){r.actual=actual;r.state='settled';this.audit(tx,'settle',r.id);}return r;
  });}
  /** Only a trusted review service may supply a fully validated brief. Not an HTTP input parser. */
  saveBrief(scope:JobScope,actor:Actor,expectedRevision:number,raw:unknown){return this.run(scope,actor,tx=>{
    ensure(actor.kind==='user'&&tx.canReview,'review denied');this.guard(tx);const brief=parseBrief(raw);
    ensure(sameScope(scope,brief.manifest.scope)&&tx.job.revision===expectedRevision&&brief.revision===expectedRevision+1,'brief revision/scope');
    tx.job.brief=brief;tx.job.revision=brief.revision;tx.job.inputHash=digest({previous:tx.job.inputHash,revision:brief.revision});this.audit(tx,'brief',String(brief.revision));return brief;
  });}
  proposeMemory(scope:JobScope,actor:Actor,raw:unknown){return this.run(scope,actor,tx=>{
    this.guard(tx,'propose_memory');const m=parseMemory(raw);ensure(m.scope.companyId===scope.companyId&&m.state==='proposed'&&!m.approval&&m.version===1,'memory proposal');
    ensure(m.scope.kind==='company'||(m.scope.kind==='user'?m.scope.userId===actor.id:scope.kind==='quote'&&m.scope.quoteId===scope.quoteId),'memory scope');
    ensure(!tx.company.memory.some(x=>x.id===m.id),'duplicate memory');tx.company.memory.push(m);this.audit(tx,'memory_proposed',m.id);return m;
  });}
  reserveUpload(scope:JobScope,actor:Actor,uploadId:string,bytes:number){return this.run(scope,actor,tx=>{
    ensure(actor.kind==='user','user required');this.guard(tx);id(uploadId,'upload');integer(bytes,'bytes',1,MAX_SOURCE_BYTES);
    // Actual packet/storage quota and signed URL issuance belong to reviewed storage adapter.
    ensure(!tx.job.uploads.some(u=>u.id===uploadId),'duplicate upload');const u={id:uploadId,bytes,state:'reserved' as const,expiresAtMs:tx.nowMs+60000};tx.job.uploads.push(u);this.audit(tx,'upload_reserved',uploadId);return u;
  });}
  /** Records metadata only after a trusted storage verifier has validated bytes, ownership and signature. */
  finalizeUpload(scope:JobScope,actor:Actor,uploadId:string,verified:{bytes:number;revisionId:string}){return this.run(scope,actor,tx=>{
    ensure(actor.kind==='worker','storage verifier required');this.guard(tx);const u=tx.job.uploads.find(x=>x.id===uploadId);ensure(u,'upload missing');id(verified.revisionId,'revision');
    if(u.state==='finalized'){ensure(u.bytes===verified.bytes&&u.revisionId===verified.revisionId,'finalize conflict');return u;}
    ensure(u.state==='reserved'&&u.expiresAtMs>tx.nowMs&&u.bytes===verified.bytes&&!tx.job.uploads.some(x=>x.revisionId===verified.revisionId),'upload verification');u.state='finalized';u.revisionId=verified.revisionId;tx.job.revision++;tx.job.inputHash=digest({previous:tx.job.inputHash,revisionId:verified.revisionId});this.audit(tx,'upload_finalized',uploadId);return u;
  });}
  /** Only queues an internal draft action; no external action or send is executed. */
  consumeApproval(scope:JobScope,actor:Actor,receiptId:string,raw:unknown){return this.run(scope,actor,tx=>{
    const b=parseBinding(raw);ensure(sameScope(scope,b.scope)&&b.actorId===actor.id,'binding scope/actor');this.guard(tx,b.action);
    ensure(b.policyVersion===tx.company.policy.version&&b.jobRevision===tx.job.revision&&b.inputHash===tx.job.inputHash,'stale binding');
    const existing=tx.job.outbox.find(x=>x.idempotencyKey===b.idempotencyKey);if(existing){ensure(digest(existing)===digest(b),'idempotency collision');return {created:false};}
    const r=tx.job.approvals.find(x=>x.id===receiptId);ensure(r&&approvalMatches(r,b,tx.nowMs,tx.approverAuthorized(r.approvedBy)),'approval denied');r.state='consumed';tx.job.outbox.push(b);this.audit(tx,'approval_consumed',receiptId);return {created:true};
  });}
}
