import { parseScope, sameScope, type JobScope } from '../contracts/evidence';
import { choice, ensure, hash, id, ids, integer, record, text } from '../contracts/validation';
import { admit } from '../policy/admission';
import { digest, type ActionBinding } from '../policy/approval';
import type { Actor, Transaction } from '../persistence/store';
import { parseEstimateSnapshot, type Disposition, type EstimateSnapshot } from './snapshot';
import { reconcileEstimate } from './reconcile';

export type EstimateTransaction=Transaction & {estimate:EstimateSnapshot;canViewPricing:boolean;canReviewEstimate:boolean;estimateReviewerAuthorized(id:string):boolean};
/** Unregistered server port. Must lock/load current intelligence + canonical
 * quote, measurements, library, price settings and totals in one transaction;
 * authenticate section access and current reviewer rights. Persist only estimate
 * dispositions and audit changes made by callback, atomically. All other fields
 * are read-only authoritative projections. Never accept an estimate from a client.
 * No external IO in callback; rollback all changes on failure. */
export interface EstimateStore {transactEstimate<T>(scope:JobScope,actor:Actor,fn:(tx:EstimateTransaction)=>T):Promise<T>}
export class EstimatePreparationService {
 constructor(private readonly store:EstimateStore){}
 private run<T>(scope:JobScope,actor:Actor,revision:number,fn:(tx:EstimateTransaction,s:EstimateSnapshot)=>T){
   const s=parseScope(scope);return this.store.transactEstimate(s,actor,tx=>{
     const p=tx.company.policy;
     ensure(s.kind==='quote'&&actor.kind==='user'&&tx.canReview&&tx.canViewPricing&&tx.canReviewEstimate&&tx.company.enabled&&sameScope(s,tx.job.scope),'estimate authorization');
     ensure(integer(revision,'job revision',1)===tx.job.revision,'stale job');
     ensure(admit(p,tx.authority,{scope:s,actorId:actor.id,action:'prepare_estimate',policyVersion:p.version,jobRevision:revision,trigger:'explicit'}).allowed,'estimate admission');
     const b=tx.job.brief,r=tx.job.documentRun;
     ensure(b&&b.revision===revision&&sameScope(s,b.manifest.scope),'stale brief');
     ensure(r&&!r.intent&&sameScope(s,r.manifest.scope)&&r.policyVersion===p.version&&digest(r.manifest)===digest(b.manifest),'stale document run');
     const task=tx.job.tasks.find(t=>t.id===r.taskId);
     ensure(task&&sameScope(task.scope,s)&&task.stage==='analyze'&&task.inputHash===r.inputHash&&task.policyVersion===p.version&&['completed','waiting_for_input'].includes(task.status),'document task not reviewable');
     ensure(!tx.job.tasks.some(t=>['running','queued','retryable_failure'].includes(t.status)),'active work');
     const snap=parseEstimateSnapshot(tx.estimate,s);return fn(tx,snap);
   });
 }
 private project(tx:EstimateTransaction,s:EstimateSnapshot,actor:Actor){
   const data=reconcileEstimate(tx.job.brief,s,tx.nowMs,id=>tx.estimateReviewerAuthorized(id));
   // Hash all dependencies, even unselected library items and exclusions. Not
   // a signature or approval. Stale hashes are rejected by fresh server read.
   const previewDigest=digest({snapshotDigest:digest(s),briefDigest:digest(tx.job.brief),policyVersion:tx.company.policy.version,inputHash:tx.job.inputHash,actorId:actor.id,data});
   return {...data,previewDigest};
 }
 preview(scope:JobScope,actor:Actor,revision:number){return this.run(scope,actor,revision,(tx,s)=>this.project(tx,s,actor));}
 /** Record only a review disposition; never add a priced line or alter the brief. */
 review(scope:JobScope,actor:Actor,revision:number,previewDigest:string,raw:unknown){
   hash(previewDigest,'preview digest');
   const c=record(raw,'estimate review',['kind','recordId','recordVersion','outcome','lineIds','reason']);
   const kind=choice(c.kind,'kind',['fact','issue'] as const),recordId=id(c.recordId,'record ID'),recordVersion=integer(c.recordVersion,'record version',1),outcome=choice(c.outcome,'outcome',['included','excluded','not_applicable','resolved'] as const),lineIds=ids(c.lineIds,'line IDs'),reason=text(c.reason,'reason');
   ensure((outcome==='included')===(lineIds.length>0),'disposition links');
   return this.run(scope,actor,revision,(tx,s)=>{
     ensure(this.project(tx,s,actor).previewDigest===previewDigest,'stale estimate preview');
     ensure(s.complete&&s.briefRevision===revision&&tx.estimateReviewerAuthorized(actor.id),'estimate review authorization');
     const b=tx.job.brief!;
     const target=kind==='fact'?b.facts.find(f=>f.id===recordId&&f.state==='confirmed'):b.issues.find(i=>i.id===recordId&&i.state==='closed');
     ensure(target&&target.version===recordVersion,'stale review target');
     ensure(lineIds.every(i=>s.lines.some(l=>l.id===i)),'unknown estimate line');
     const disposition:Disposition={kind,recordId,recordVersion,outcome,lineIds,reason,reviewerId:actor.id,atMs:integer(tx.nowMs,'review time',1),briefRevision:revision,pricingRevision:s.pricingRevision,geometryRevision:s.geometryRevision,libraryRevision:s.libraryRevision,totalsRevision:s.totalsRevision};
     s.dispositions=s.dispositions.filter(d=>d.kind!==kind||d.recordId!==recordId).concat(disposition);
     const next=this.project(tx,s,actor);
     tx.estimate.dispositions=s.dispositions;
     tx.job.audit.push({actorId:actor.id,atMs:tx.nowMs,event:'estimate_disposition_reviewed',target:kind+':'+recordId});
     return next;
   });
 }
 /** Review binding for future approval integration. Never mints or consumes a
  * receipt, creates a quote, writes prices or authorizes a send. */
 prepareApproval(scope:JobScope,actor:Actor,revision:number,previewDigest:string,idempotencyKey:string){
   hash(previewDigest,'preview digest');id(idempotencyKey,'idempotency key');
   return this.run(scope,actor,revision,(tx,s)=>{
     const data=this.project(tx,s,actor);ensure(data.previewDigest===previewDigest,'stale estimate preview');ensure(data.readyForEstimateReview,'estimate reconciliation incomplete');
     const binding:ActionBinding={scope:s.scope,action:'prepare_estimate',actorId:actor.id,policyVersion:tx.company.policy.version,jobRevision:revision,inputHash:tx.job.inputHash,payloadHash:previewDigest,idempotencyKey};
     return {binding,bindingHash:digest(binding),currency:data.currency,canonicalBuilderTotal:data.canonicalBuilderTotal,requiresHumanApproval:true as const,writeAuthorized:false as const};
   });
 }
}
