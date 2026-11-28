import { parseScope,sameScope,type JobScope } from '../contracts/evidence';
import { ensure,id,integer,hash,text,choice,record } from '../contracts/validation';
import { parsePolicy } from '../contracts/policy';
import { digest } from '../policy/approval';
import type { Actor,Transaction } from '../persistence/store';

const DAY=86400000;
export type FollowupPolicy={companyId:string;id:string;version:number;enabled:boolean;delayDays:number;minimumGapDays:number;maxFollowups:number;timezone:string;quietStartHour:number;quietEndHour:number;templateId:string;templateVersion:number;templateDigest:string};
const bool=(v:unknown,f:string)=>{ensure(typeof v==='boolean',f);return v;};
export function parseFollowupPolicy(raw:unknown):FollowupPolicy{
 const r=record(raw,'followup policy',['companyId','id','version','enabled','delayDays','minimumGapDays','maxFollowups','timezone','quietStartHour','quietEndHour','templateId','templateVersion','templateDigest']);
 const timezone=text(r.timezone,'timezone',100);new Intl.DateTimeFormat('en',{timeZone:timezone}).format(0);
 const quietStartHour=integer(r.quietStartHour,'quiet start',0,23),quietEndHour=integer(r.quietEndHour,'quiet end',0,23);ensure(quietStartHour!==quietEndHour,'quiet hours');
 return {companyId:id(r.companyId,'company'),id:id(r.id,'policy'),version:integer(r.version,'version',1),enabled:bool(r.enabled,'enabled'),delayDays:integer(r.delayDays,'delay',1,365),minimumGapDays:integer(r.minimumGapDays,'gap',1,365),maxFollowups:integer(r.maxFollowups,'max followups',1,10),timezone,quietStartHour,quietEndHour,templateId:id(r.templateId,'template'),templateVersion:integer(r.templateVersion,'template version',1),templateDigest:hash(r.templateDigest,'template digest')};
}
export type QuoteCommunication={scope:JobScope;quoteVersion:number;quoteDigest:string;sentVersion:number;sentDigest:string;sendReceiptId:string;sentAtMs:number;status:'awaiting_response'|'accepted'|'declined'|'revision_requested'|'withdrawn'|'expired'|'unknown';recipientEmail:string;recipientName:string;sentRecipientEmail:string;consent:'allowed'|'denied'|'unknown';cancelled:boolean;followupCount:number;lastFollowupAtMs:number|null;pendingFollowup:boolean;eventRevision:number};
export function parseCommunication(raw:unknown):QuoteCommunication{
 const r=record(raw,'communication',['scope','quoteVersion','quoteDigest','sentVersion','sentDigest','sendReceiptId','sentAtMs','status','recipientEmail','recipientName','sentRecipientEmail','consent','cancelled','followupCount','lastFollowupAtMs','pendingFollowup','eventRevision']);
 const email=(v:unknown)=>{const s=text(v,'email',254);ensure(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s),'email');return s;};
 const sentAtMs=integer(r.sentAtMs,'sent time',1),followupCount=integer(r.followupCount,'count',0,10000),lastFollowupAtMs=r.lastFollowupAtMs===null?null:integer(r.lastFollowupAtMs,'last followup',sentAtMs);ensure((followupCount===0)===(lastFollowupAtMs===null),'followup history');
 const scope=parseScope(r.scope);ensure(scope.kind==='quote','quote scope');
 return {scope,quoteVersion:integer(r.quoteVersion,'quote version',1),quoteDigest:hash(r.quoteDigest,'quote digest'),sentVersion:integer(r.sentVersion,'sent version',1),sentDigest:hash(r.sentDigest,'sent digest'),sendReceiptId:id(r.sendReceiptId,'send receipt'),sentAtMs,status:choice(r.status,'status',['awaiting_response','accepted','declined','revision_requested','withdrawn','expired','unknown'] as const),recipientEmail:email(r.recipientEmail),recipientName:r.recipientName===''?'':text(r.recipientName,'recipient',200),sentRecipientEmail:email(r.sentRecipientEmail),consent:choice(r.consent,'consent',['allowed','denied','unknown'] as const),cancelled:bool(r.cancelled,'cancelled'),followupCount,lastFollowupAtMs,pendingFollowup:bool(r.pendingFollowup,'pending'),eventRevision:integer(r.eventRevision,'event revision',1)};
}
export type FollowupTransaction=Transaction & {communication:unknown;followupPolicy:unknown;template:{companyId:string;id:string;version:number;subject:string;body:string};canViewCommunications:boolean;followupsEntitled:boolean;policyApprovalCurrent(policy:FollowupPolicy):boolean;sendReceiptCurrent(communication:QuoteCommunication):boolean};
/** Read-only server port. Load trusted actual quote/send/event status, consent,
 * pending messages including other channels, exact approved template and policy.
 * Never accept these snapshots from caller. Same tenant/quote ACL; no IO in callback.
 * Actual scheduler/dispatcher must recheck these at execution and atomically dedupe. */
export interface FollowupStore{transactFollowup<T>(scope:JobScope,actor:Actor,fn:(tx:FollowupTransaction)=>T):Promise<T>}
export class FollowupPreparationService{
 constructor(private readonly store:FollowupStore){}
 private run<T>(scope:JobScope,actor:Actor,fn:(p:ReturnType<FollowupPreparationService['project']>)=>T){const s=parseScope(scope);return this.store.transactFollowup(s,actor,tx=>{
  const p=parsePolicy(tx.company.policy);integer(tx.nowMs,'now',1);ensure(s.kind==='quote'&&actor.kind==='user'&&tx.canReview===true&&tx.canViewCommunications===true&&sameScope(s,tx.job.scope)&&sameScope(s,tx.authority.scope)&&p.companyId===s.companyId&&tx.authority.actorId===actor.id&&tx.authority.revoked===false&&tx.authority.demo===false&&tx.authority.policyVersion===p.version&&tx.authority.jobRevision===tx.job.revision,'followup access');
  return fn(this.project(tx,actor));
 });}
 private project(tx:FollowupTransaction,actor:Actor){
  const p=parseFollowupPolicy(tx.followupPolicy),q=parseCommunication(tx.communication),t=tx.template,a=tx.company.policy;
  ensure(sameScope(q.scope,tx.job.scope)&&p.companyId===q.scope.companyId&&t.companyId===p.companyId,'followup scope');
  const subject=text(t.subject,'template subject',500),body=text(t.body,'template body',8000);id(t.id,'template');integer(t.version,'template version',1);
  const blockers:string[]=[];
  if(!tx.company.enabled||a.mode==='manual'||tx.authority.entitled!==true||tx.followupsEntitled!==true||!a.enabledActions.includes('configure_followups')||!tx.authority.permittedActions.includes('configure_followups'))blockers.push('disabled_or_not_entitled');
  if(!p.enabled||tx.policyApprovalCurrent(p)!==true)blockers.push('policy_not_approved');
  if(t.id!==p.templateId||t.version!==p.templateVersion||digest(t)!==p.templateDigest)blockers.push('template_changed');
  if(tx.sendReceiptCurrent(q)!==true||q.sentAtMs>tx.nowMs||q.quoteVersion!==q.sentVersion||q.quoteDigest!==q.sentDigest||q.recipientEmail!==q.sentRecipientEmail)blockers.push('send_or_recipient_changed');
  if(q.status!=='awaiting_response')blockers.push('not_awaiting_response');
  if(q.consent!=='allowed'||q.cancelled)blockers.push('consent_or_cancellation');
  if(q.pendingFollowup||q.followupCount>=p.maxFollowups)blockers.push('pending_or_frequency_cap');
  const dueAtMs=Math.max(q.sentAtMs+p.delayDays*DAY,q.lastFollowupAtMs===null?0:q.lastFollowupAtMs+p.minimumGapDays*DAY);integer(dueAtMs,'due',1);
  if(tx.nowMs<dueAtMs)blockers.push('not_due');
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:p.timezone,hour:'2-digit',hourCycle:'h23'}).format(new Date(tx.nowMs)));
  ensure(Number.isInteger(hour)&&hour>=0&&hour<=23,'local hour');
  if(p.quietStartHour<p.quietEndHour?hour>=p.quietStartHour&&hour<p.quietEndHour:hour>=p.quietStartHour||hour<p.quietEndHour)blockers.push('quiet_hours');
  // Template is displayed as inert text. Do not interpolate or render untrusted HTML.
  const draft={subject,body,recipientEmail:q.recipientEmail,recipientName:q.recipientName,templateId:p.templateId,templateVersion:p.templateVersion};
  const key=digest({scope:q.scope,sendReceiptId:q.sendReceiptId,sequence:q.followupCount+1});
  const previewDigest=digest({p,q,t,policyVersion:a.version,jobRevision:tx.job.revision,inputHash:tx.job.inputHash,actorId:actor.id,blockers,key});
  return {draft,dueAtMs,blockers,previewDigest,idempotencyKey:key,readyForReview:blockers.length===0,requiresHumanApproval:true as const,scheduleAuthorized:false as const,sendAuthorized:false as const};
 }
 preview(scope:JobScope,actor:Actor){return this.run(scope,actor,p=>p);}
 /** Revalidate exact draft before returning review handoff; not a schedule or send
  * authorization. Existing scheduler must enforce approved template/trigger, atomic
  * deduplication, quiet hours, no-response and final recipient/consent checks. */
 reviewHandoff(scope:JobScope,actor:Actor,previewDigest:string){return this.run(scope,actor,p=>{ensure(p.readyForReview&&p.previewDigest===hash(previewDigest,'preview digest'),'stale or blocked followup');return {...p,triggerEvent:'quote_sent' as const,requireNoResponse:true as const,respectQuietHours:true as const};});}
}
