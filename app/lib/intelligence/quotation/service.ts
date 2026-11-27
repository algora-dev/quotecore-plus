import { parseScope,sameScope,type JobScope } from '../contracts/evidence';
import { ensure,hash,id,integer } from '../contracts/validation';
import { admit } from '../policy/admission';
import { approvalMatches,digest,parseBinding,type ActionBinding } from '../policy/approval';
import type { Actor } from '../persistence/store';
import type { EstimateTransaction } from '../estimating/service';
import { parseEstimateSnapshot } from '../estimating/snapshot';
import { reconcileEstimate } from '../estimating/reconcile';
import { parseCustomerSnapshot,buildDraft } from './draft';
import { profileApproved } from './profile';
export type QuoteTransaction=EstimateTransaction & {customerSnapshot:unknown;canPrepareCustomerQuote:boolean;profileApproverAuthorized(id:string):boolean;quoteReviewerAuthorized(id:string):boolean};
/** Server-only, unregistered port. Lock and authorize current job, pricing,
 * customer/contact, canonical customer editor/template, quote status and approval
 * receipts together. Never accept these projections from a browser. Verify all
 * contact, component and template joins within company and quote; reject stale
 * totals, unapproved copy or unsupported editor shapes. Read only; no external IO. */
export interface QuoteStore {transactQuote<T>(scope:JobScope,actor:Actor,fn:(tx:QuoteTransaction)=>T):Promise<T>}
export class QuotationPreparationService {
 constructor(private readonly store:QuoteStore){}
 private run<T>(scope:JobScope,actor:Actor,revision:number,fn:(tx:QuoteTransaction,projection:ReturnType<QuotationPreparationService['project']>)=>T){
  const s=parseScope(scope);return this.store.transactQuote(s,actor,tx=>{
   const p=tx.company.policy;
   ensure(s.kind==='quote'&&actor.kind==='user'&&tx.canReview&&tx.canViewPricing&&tx.canReviewEstimate&&tx.canPrepareCustomerQuote&&tx.company.enabled&&sameScope(s,tx.job.scope),'quotation authorization');
   ensure(integer(revision,'job revision',1)===tx.job.revision,'stale job');
   ensure(admit(p,tx.authority,{scope:s,actorId:actor.id,action:'prepare_quote',policyVersion:p.version,jobRevision:revision,trigger:'explicit'}).allowed,'quotation admission');
   const b=tx.job.brief,r=tx.job.documentRun;
   ensure(b&&b.revision===revision&&sameScope(s,b.manifest.scope),'stale brief');
   ensure(r&&!r.intent&&sameScope(s,r.manifest.scope)&&r.policyVersion===p.version&&digest(r.manifest)===digest(b.manifest),'stale document run');
   const task=tx.job.tasks.find(t=>t.id===r.taskId);
   ensure(task&&sameScope(task.scope,s)&&task.stage==='analyze'&&task.inputHash===r.inputHash&&task.policyVersion===p.version&&['completed','waiting_for_input'].includes(task.status),'document task not reviewable');
   ensure(!tx.job.tasks.some(t=>['running','queued','retryable_failure'].includes(t.status)),'active work');
   return fn(tx,this.project(tx,actor));
  });
 }
 private project(tx:QuoteTransaction,actor:Actor){
  const s=parseEstimateSnapshot(tx.estimate,tx.job.scope),c=parseCustomerSnapshot(tx.customerSnapshot,tx.job.scope),p=tx.company.policy;
  const data=reconcileEstimate(tx.job.brief,s,tx.nowMs,i=>tx.estimateReviewerAuthorized(i));
  const result=buildDraft(s,c),blockers=[...result.blockers];
  if(!data.readyForEstimateReview)blockers.push('estimate_reconciliation_incomplete');
  const a=parseBinding(c.estimateApproval.binding),receipt=tx.job.approvals.find(x=>x.id===c.estimateApproval.receiptId);
  // Reconstruct the exact Phase 4 preview binding, including original actor.
  const expected=digest({snapshotDigest:digest(s),briefDigest:digest(tx.job.brief),policyVersion:p.version,inputHash:tx.job.inputHash,actorId:a.actorId,data});
  if(a.action!=='prepare_estimate'||!sameScope(a.scope,s.scope)||a.policyVersion!==p.version||a.jobRevision!==tx.job.revision||a.inputHash!==tx.job.inputHash||a.payloadHash!==expected||!receipt||!approvalMatches(receipt,a,tx.nowMs,tx.approverAuthorized(receipt.approvedBy)&&tx.estimateReviewerAuthorized(receipt.approvedBy)))blockers.push('estimate_approval_missing_or_stale');
  if(!profileApproved(c.profile,c.profileApproval,tx.nowMs,i=>tx.profileApproverAuthorized(i)))blockers.push('profile_approval_missing_or_stale');
  // All dependencies, current saved draft, approval evidence and exact proposed
  // content are bound. No receipt or privileged action is created by preview.
  const previewDigest=digest({customerDigest:digest(c),estimateDigest:digest(s),estimateReceipt:receipt??null,briefDigest:digest(tx.job.brief),policyVersion:p.version,inputHash:tx.job.inputHash,actorId:actor.id,result,blockers});
  return {...result,blockers,previewDigest,readyForQuotationReview:blockers.length===0,manualAvailable:true as const,writeAuthorized:false as const,sendAuthorized:false as const};
 }
 preview(scope:JobScope,actor:Actor,revision:number){return this.run(scope,actor,revision,(_tx,p)=>p);}
 /** Prepare exact-version draft review. The existing editor is authoritative;
  * never call save/send, create tokens, activate templates or consume receipts here. */
 prepareApproval(scope:JobScope,actor:Actor,revision:number,previewDigest:string,idempotencyKey:string){
  hash(previewDigest,'preview digest');id(idempotencyKey,'idempotency key');
  return this.run(scope,actor,revision,(tx,p)=>{
   ensure(p.previewDigest===previewDigest&&p.readyForQuotationReview,'stale or blocked quotation');
   const binding:ActionBinding={scope:tx.job.scope,action:'prepare_quote',actorId:actor.id,policyVersion:tx.company.policy.version,jobRevision:revision,inputHash:tx.job.inputHash,payloadHash:previewDigest,idempotencyKey};
   return {binding,bindingHash:digest(binding),draftDigest:p.draftDigest,requiresHumanApproval:true as const,writeAuthorized:false as const,sendAuthorized:false as const};
  });
 }
 /** Validate a real server-loaded, fresh receipt for an exact draft review.
  * Returns an editor handoff only; replay cannot cause a write or send. Future
  * editor persistence must atomically consume a distinct action authorization. */
 approvedHandoff(scope:JobScope,actor:Actor,revision:number,rawBinding:unknown,receiptId:string){
  const binding=parseBinding(rawBinding);id(receiptId,'receipt');
  return this.run(scope,actor,revision,(tx,p)=>{
   ensure(p.readyForQuotationReview&&sameScope(binding.scope,tx.job.scope)&&binding.action==='prepare_quote'&&binding.actorId===actor.id&&binding.policyVersion===tx.company.policy.version&&binding.jobRevision===revision&&binding.inputHash===tx.job.inputHash&&binding.payloadHash===p.previewDigest,'stale quotation approval');
   const receipt=tx.job.approvals.find(r=>r.id===receiptId);
   ensure(receipt&&approvalMatches(receipt,binding,tx.nowMs,tx.approverAuthorized(receipt.approvedBy)&&tx.quoteReviewerAuthorized(receipt.approvedBy)),'quotation approval denied');
   return {draft:p.draft,draftDigest:p.draftDigest,approvedForEditorReview:true as const,writeAuthorized:false as const,sendAuthorized:false as const};
  });
 }
}
