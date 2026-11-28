import { parseScope,sameScope,MAX_SOURCE_BYTES,type JobScope } from '../contracts/evidence';
import { choice,ensure,finite,hash,id,integer,list,record,text,unique } from '../contracts/validation';
import { parsePolicy,type Action } from '../contracts/policy';
import { approvalMatches,digest,parseBinding,type ActionBinding } from '../policy/approval';
import type { Actor,Transaction } from '../persistence/store';
import type {QuotationTrackingView,QuotationReleaseView} from '../hub/quotation-model';
import { parseCommunication,parseFollowupPolicy,type FollowupTransaction } from '../learning/followups';

/** R3 is an unregistered server-only boundary, never an alternative quote or mail engine. */
export type ReleaseKind='initial_quote'|'followup';
export type FileIdentity={id:string;revision:string;contentHash:string;bytes:number;filename:string;mediaType:string};
export type ReleaseDocument={scope:JobScope;version:number;editorRevision:string;estimateApprovalDigest:string;draftApprovalDigest:string;editorRoundTripHash:string;renderHash:string;termsHash:string;brandingHash:string;publicSnapshotHash:string;quoteNumber:string;currency:string;total:number;customerId:string;contactId:string;recipientEmail:string;recipientName:string;senderId:string;senderEmail:string;emailTemplate:{id:string;version:number;contentHash:string}|null;subject:string;body:string;messageRenderHash:string;attachments:FileIdentity[]};
const email=(v:unknown,f:string)=>{const s=text(v,f,254);ensure(/^[^\s@<>;,]+@[^\s@<>;,]+\.[^\s@<>;,]+$/.test(s),f);return s;};
export function parseReleaseDocument(raw:unknown,scope:JobScope):ReleaseDocument{
 const r=record(raw,'release document',['scope','version','editorRevision','estimateApprovalDigest','draftApprovalDigest','editorRoundTripHash','renderHash','termsHash','brandingHash','publicSnapshotHash','quoteNumber','currency','total','customerId','contactId','recipientEmail','recipientName','senderId','senderEmail','emailTemplate','subject','body','messageRenderHash','attachments']);
 ensure(sameScope(parseScope(r.scope),scope)&&scope.kind==='quote','release scope');
 const currency=text(r.currency,'currency',3);ensure(/^[A-Z]{3}$/.test(currency),'currency');
 const template=r.emailTemplate===null?null:record(r.emailTemplate,'email template',['id','version','contentHash']);
 const emailTemplate=template?{id:id(template.id,'email template'),version:integer(template.version,'email template version',1),contentHash:hash(template.contentHash,'email template digest')}:null;
 const subject=text(r.subject,'subject',500);ensure(!/[\r\n]/.test(subject),'subject newline');
 const attachments=list(r.attachments,'attachments',(v,f)=>{const a=record(v,f,['id','revision','contentHash','bytes','filename','mediaType']);const filename=text(a.filename,f,255),mediaType=text(a.mediaType,f,100);ensure(!/[\r\n/\\]/.test(filename)&&/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/i.test(mediaType),'attachment name or type');return {id:id(a.id,f),revision:hash(a.revision,f),contentHash:hash(a.contentHash,f),bytes:integer(a.bytes,f,1,MAX_SOURCE_BYTES),filename,mediaType};},100);
 unique(attachments,a=>a.id,'duplicate attachment');
 return {scope,version:integer(r.version,'version',1),editorRevision:hash(r.editorRevision,'editor revision'),estimateApprovalDigest:hash(r.estimateApprovalDigest,'estimate approval'),draftApprovalDigest:hash(r.draftApprovalDigest,'draft approval'),editorRoundTripHash:hash(r.editorRoundTripHash,'editor round trip'),renderHash:hash(r.renderHash,'render'),termsHash:hash(r.termsHash,'terms'),brandingHash:hash(r.brandingHash,'branding'),publicSnapshotHash:hash(r.publicSnapshotHash,'public snapshot'),quoteNumber:text(r.quoteNumber,'quote number',100),currency,total:finite(r.total,'total',0,1e12),customerId:id(r.customerId,'customer'),contactId:id(r.contactId,'contact'),recipientEmail:email(r.recipientEmail,'recipient'),recipientName:text(r.recipientName,'recipient name',200),senderId:id(r.senderId,'sender'),senderEmail:email(r.senderEmail,'sender email'),emailTemplate,subject,body:text(r.body,'body',20000),messageRenderHash:hash(r.messageRenderHash,'message render'),attachments};
}
export type CanonicalEvent={id:string;scope:JobScope;version:number;documentHash:string;kind:'sent'|'viewed'|'accepted'|'declined'|'revision_requested'|'withdrawn'|'expired';atMs:number;referenceId:string};
export type DeliveryEvidence={scope:JobScope;key:string;payloadHash:string;kind:ReleaseKind;status:'sent'|'suppressed'|'not_sent'|'unknown';messageId:string|null;atMs:number};
export type ReleaseIntent={binding:ActionBinding;kind:ReleaseKind;receiptId:string;approvedBy:string;expiresAtMs:number;documentHash:string;version:number;state:'queued'|'claimed'|'uncertain'|'sent'|'suppressed'|'not_sent'|'cancelled';claimedAtMs:number|null;claimedBy:string|null;delivery:DeliveryEvidence|null};
export type LifecycleTransaction=FollowupTransaction & {
 /** Trusted canonical projections, loaded and checked under the SAME lock as intent/receipt. */
 document:unknown; currentVersion:number; currentDocumentHash:string|null; canonicalStatus:'draft'|'unsent'|'sent'|'accepted'|'declined'|'revision_requested'|'withdrawn'|'expired'|'unknown';
 persistedAndRendered:boolean; editorRoundTripVerified:boolean; upstreamApprovalsCurrent:boolean; recipientVerified:boolean; canonicalTotalsReconciled:boolean; immutablePublicSnapshot:boolean; assetsVerified:boolean; noUnresolvedWork:boolean; followupRenderVerified:boolean;
 canRelease:boolean; releaseApproverAuthorized(id:string):boolean; requesterStillAuthorized(id:string,kind:ReleaseKind):boolean;
 /** Must be false until reviewed sandbox dispatcher supports atomic release, provider idempotency and immutable content. */
 sandboxReleaseEnabled:boolean; canDispatch:boolean; canReconcile:boolean;
 events:CanonicalEvent[]; intents:ReleaseIntent[]; deliveryEvidence:DeliveryEvidence[];
};
/** No network or provider calls in callback. Store must atomically lock canonical quote,
 * ACL/policy, approval, existing manual outbound activity, events and intent, roll back
 * on error, enforce unique keys across processes, and use trusted clock. No client input
 * may populate canonical projections, flags, events or receipts. Separate sandbox only. */
export interface LifecycleStore{transactLifecycle<T>(scope:JobScope,actor:Actor,fn:(tx:LifecycleTransaction)=>T):Promise<T>}
// A follow-up is an outbound send, not merely a scheduling/configuration change.
const action:Action='send_quote';
const active=(i:ReleaseIntent)=>['queued','claimed','uncertain'].includes(i.state);
export const releaseDocumentHash=(d:ReleaseDocument)=>digest({scope:d.scope,version:d.version,editorRevision:d.editorRevision,estimateApprovalDigest:d.estimateApprovalDigest,draftApprovalDigest:d.draftApprovalDigest,editorRoundTripHash:d.editorRoundTripHash,renderHash:d.renderHash,termsHash:d.termsHash,brandingHash:d.brandingHash,publicSnapshotHash:d.publicSnapshotHash,quoteNumber:d.quoteNumber,currency:d.currency,total:d.total,customerId:d.customerId,contactId:d.contactId,recipientEmail:d.recipientEmail,recipientName:d.recipientName});
function timeline(tx:LifecycleTransaction){
 const events=list(tx.events,'events',(v,f):CanonicalEvent=>{const e=record(v,f,['id','scope','version','documentHash','kind','atMs','referenceId']);const scope=parseScope(e.scope);ensure(sameScope(scope,tx.job.scope),f);return {id:id(e.id,f),scope,version:integer(e.version,f,1),documentHash:hash(e.documentHash,f),kind:choice(e.kind,f,['sent','viewed','accepted','declined','revision_requested','withdrawn','expired'] as const),atMs:integer(e.atMs,f,1,tx.nowMs),referenceId:id(e.referenceId,f)};},10000);
 unique(events,e=>e.id,'duplicate event');return events.sort((a,b)=>a.atMs-b.atMs||a.id.localeCompare(b.id));
}
function allowed(tx:LifecycleTransaction,kind:ReleaseKind){const p=tx.company.policy,a=tx.authority;return tx.company.enabled===true&&p.mode!=='manual'&&a.entitled===true&&p.enabledActions.includes(action)&&a.permittedActions.includes(action)&&(kind==='initial_quote'||(p.enabledActions.includes('configure_followups')&&a.permittedActions.includes('configure_followups')));}
function project(tx:LifecycleTransaction,kind:ReleaseKind,ignoreKey?:string){
 const d=parseReleaseDocument(tx.document,tx.job.scope),documentHash=releaseDocumentHash(d),events=timeline(tx),current=events.filter(e=>e.version===d.version&&e.documentHash===documentHash),blockers:string[]=[];
 const add=(condition:unknown,code:string)=>{if(!condition)blockers.push(code);};
 add(allowed(tx,kind),'release_not_permitted');
 add(d.version===tx.currentVersion&&documentHash===tx.currentDocumentHash,'canonical_version_changed');
 add(!events.some(e=>e.version===d.version&&e.documentHash!==documentHash),'event_version_conflict');
 add(tx.persistedAndRendered===true&&tx.editorRoundTripVerified===true&&tx.upstreamApprovalsCurrent===true&&tx.canonicalTotalsReconciled===true&&tx.noUnresolvedWork===true,'canonical_review_incomplete');
 add(tx.recipientVerified===true&&tx.assetsVerified===true&&tx.immutablePublicSnapshot===true,'recipient_assets_or_snapshot_unverified');
 add(!tx.intents.some(i=>active(i)&&i.binding.idempotencyKey!==ignoreKey),'delivery_pending_or_uncertain');
 let sequence=0,followup:unknown=null;
 if(kind==='initial_quote'){
  add(tx.canonicalStatus==='unsent','not_unsent');
  add(!current.some(e=>e.kind==='sent'||e.kind==='accepted'||e.kind==='declined'||e.kind==='revision_requested'||e.kind==='withdrawn'||e.kind==='expired'),'already_released_or_responded');
  add(!tx.intents.some(i=>i.kind===kind&&i.version===d.version&&i.state==='sent'),'already_sent_version');
 }else{
  const q=parseCommunication(tx.communication),p=parseFollowupPolicy(tx.followupPolicy),t=tx.template;
  ensure(sameScope(q.scope,d.scope)&&p.companyId===d.scope.companyId&&t.companyId===p.companyId,'followup scope');
  sequence=q.followupCount+1;
  add(tx.followupsEntitled===true&&tx.canViewCommunications===true&&p.enabled&&tx.policyApprovalCurrent(p)===true,'followup_policy');
  add(t.id===p.templateId&&t.version===p.templateVersion&&digest(t)===p.templateDigest&&d.emailTemplate?.id===t.id&&d.emailTemplate.version===t.version&&d.emailTemplate.contentHash===p.templateDigest&&tx.followupRenderVerified===true,'followup_template_or_render_changed');
  add(q.quoteVersion===d.version&&q.sentVersion===d.version&&q.quoteDigest===documentHash&&q.sentDigest===documentHash&&q.recipientEmail===d.recipientEmail&&q.sentRecipientEmail===d.recipientEmail&&tx.sendReceiptCurrent(q)===true&&q.sentAtMs<=tx.nowMs&&current.some(e=>e.kind==='sent'&&e.referenceId===q.sendReceiptId&&e.atMs===q.sentAtMs),'sent_version_or_recipient_changed');
  add(tx.canonicalStatus==='sent'&&q.status==='awaiting_response'&&!current.some(e=>!['sent','viewed'].includes(e.kind)),'customer_responded_or_closed');
  add(q.consent==='allowed'&&!q.cancelled&&!q.pendingFollowup&&q.followupCount<p.maxFollowups,'consent_or_frequency');
  const dueAtMs=Math.max(q.sentAtMs+p.delayDays*86400000,(q.lastFollowupAtMs??0)+p.minimumGapDays*86400000);
  add(tx.nowMs>=dueAtMs,'not_due');
  const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:p.timezone,hour:'2-digit',hourCycle:'h23'}).format(new Date(tx.nowMs)));
  add(!(p.quietStartHour<p.quietEndHour?hour>=p.quietStartHour&&hour<p.quietEndHour:hour>=p.quietStartHour||hour<p.quietEndHour),'quiet_hours');
  followup={q,p,t,dueAtMs};
 }
 // Same commercial version + sequence is one release identity, not one per approval.
 const key=digest({scope:d.scope,kind,version:d.version,sequence});
 add(!tx.intents.some(i=>i.binding.idempotencyKey===key&&i.binding.idempotencyKey!==ignoreKey),'release_identity_already_used');
 const payloadHash=digest({kind,document:d,documentHash,followup,events:current,canonicalStatus:tx.canonicalStatus,policyVersion:tx.company.policy.version,jobRevision:tx.job.revision,inputHash:tx.job.inputHash});
 return {document:d,documentHash,kind,sequence,key,payloadHash,blockers,readyForApproval:blockers.length===0,sandboxReleaseEnabled:tx.sandboxReleaseEnabled===true};
}
export class QuotationLifecycleService{
 constructor(private readonly store:LifecycleStore){}
 private run<T>(scope:JobScope,actor:Actor,fn:(tx:LifecycleTransaction)=>T){const s=parseScope(scope);id(actor.id,'actor');return this.store.transactLifecycle(s,actor,tx=>{
  const p=parsePolicy(tx.company.policy),a=tx.authority;integer(tx.nowMs,'now',1);
  ensure(s.kind==='quote'&&sameScope(s,tx.job.scope)&&sameScope(s,a.scope)&&p.companyId===s.companyId&&a.actorId===actor.id&&a.revoked===false&&a.demo===false&&a.policyVersion===p.version&&a.jobRevision===tx.job.revision,'lifecycle access');
  ensure(tx.intents.every(i=>sameScope(i.binding.scope,s)),'intent scope');unique(tx.intents,i=>i.binding.idempotencyKey,'duplicate intent key');
  return fn(tx);
 });}
 private human(tx:LifecycleTransaction,actor:Actor){ensure(actor.kind==='user'&&tx.canReview===true&&tx.canRelease===true,'human release authority');}
 private audit(tx:LifecycleTransaction,actor:Actor,event:string,target:string){tx.job.audit.push({actorId:actor.id,atMs:tx.nowMs,event,target});}
 /** Private editor candidate has no send permission. Only a verified canonical save/render can create this preview. */
 preview(scope:JobScope,actor:Actor,kind:ReleaseKind){choice(kind,'kind',['initial_quote','followup'] as const);return this.run(scope,actor,tx=>{this.human(tx,actor);return project(tx,kind);});}
 /** For the authorized hub only; actual exact rendering must be opened via
  * a scoped canonical viewer before the human approves. No public-link token. */
 releaseView(scope:JobScope,actor:Actor,kind:ReleaseKind){choice(kind,'kind',['initial_quote','followup'] as const);return this.run(scope,actor,tx=>{
  this.human(tx,actor);const p=project(tx,kind),d=p.document;ensure(d.scope.kind==='quote','quote scope');
  const view:QuotationReleaseView={quoteId:d.scope.quoteId,version:d.version,kind,quoteNumber:d.quoteNumber,currency:d.currency,total:d.total,recipientName:d.recipientName,recipientEmail:d.recipientEmail,senderEmail:d.senderEmail,subject:d.subject,attachmentNames:d.attachments.map(a=>a.filename),readyForApproval:p.readyForApproval,blockers:p.blockers,sandboxReleaseEnabled:p.sandboxReleaseEnabled,previewDigest:p.payloadHash};return view;
 });}
 prepareApproval(scope:JobScope,actor:Actor,kind:ReleaseKind,expectedHash:string){choice(kind,'kind',['initial_quote','followup'] as const);return this.run(scope,actor,tx=>{
  this.human(tx,actor);const p=project(tx,kind);ensure(p.readyForApproval&&p.payloadHash===hash(expectedHash,'preview hash'),'stale or blocked release');
  const binding:ActionBinding={scope:tx.job.scope,action:action,actorId:actor.id,policyVersion:tx.company.policy.version,jobRevision:tx.job.revision,inputHash:tx.job.inputHash,payloadHash:p.payloadHash,idempotencyKey:p.key};return binding;
 });}
 /** Separate explicit human-only path; does NOT alter Phase 1A admit() or grant generic outbound tools. */
 enqueue(scope:JobScope,actor:Actor,kind:ReleaseKind,rawBinding:unknown,receiptId:string){choice(kind,'kind',['initial_quote','followup'] as const);const b=parseBinding(rawBinding);id(receiptId,'receipt');return this.run(scope,actor,tx=>{
  this.human(tx,actor);ensure(sameScope(b.scope,tx.job.scope)&&b.actorId===actor.id&&b.action===action&&allowed(tx,kind)&&tx.sandboxReleaseEnabled===true,'release unavailable');
  const old=tx.intents.find(i=>i.binding.idempotencyKey===b.idempotencyKey);
  if(old){ensure(old.kind===kind&&old.receiptId===receiptId&&digest(old.binding)===digest(b),'release identity collision');return {created:false,state:old.state};}
  const p=project(tx,kind);ensure(p.readyForApproval&&b.idempotencyKey===p.key&&b.payloadHash===p.payloadHash&&b.policyVersion===tx.company.policy.version&&b.jobRevision===tx.job.revision&&b.inputHash===tx.job.inputHash,'stale release');
  const r=tx.job.approvals.find(r=>r.id===receiptId);ensure(r&&approvalMatches(r,b,tx.nowMs,tx.approverAuthorized(r.approvedBy)&&tx.releaseApproverAuthorized(r.approvedBy)),'release approval denied');
  r.state='consumed';tx.intents.push({binding:b,kind,receiptId,approvedBy:r.approvedBy,expiresAtMs:r.expiresAtMs,documentHash:p.documentHash,version:p.document.version,state:'queued',claimedAtMs:null,claimedBy:null,delivery:null});this.audit(tx,actor,'quotation_release_queued',b.idempotencyKey);return {created:true,state:'queued' as const};
 });}
 private releaseCurrent(tx:LifecycleTransaction,i:ReleaseIntent,p:ReturnType<typeof project>){
  const b=i.binding,r=tx.job.approvals.find(x=>x.id===i.receiptId);
  return tx.sandboxReleaseEnabled===true&&p.readyForApproval&&p.payloadHash===b.payloadHash&&p.key===b.idempotencyKey&&p.documentHash===i.documentHash&&b.action===action&&b.policyVersion===tx.company.policy.version&&b.jobRevision===tx.job.revision&&b.inputHash===tx.job.inputHash&&i.expiresAtMs>tx.nowMs&&!!r&&r.state==='consumed'&&sameScope(r.scope,tx.job.scope)&&r.bindingHash===digest(b)&&r.approvedBy===i.approvedBy&&r.expiresAtMs===i.expiresAtMs&&tx.approverAuthorized(i.approvedBy)===true&&tx.releaseApproverAuthorized(i.approvedBy)===true&&tx.requesterStillAuthorized(b.actorId,i.kind)===true;
 }
 /** Claim exactly once. Caller must be a scoped server worker. No actual send here;
  * dispatcher MUST use immutable bytes and atomic final fence/consent checks with
  * existing provider idempotency; do not call current mutable send action directly. */
 claim(scope:JobScope,actor:Actor,key:string){return this.run(scope,actor,tx=>{
  ensure(actor.kind==='worker'&&tx.canDispatch===true,'dispatch authority');const i=tx.intents.find(x=>x.binding.idempotencyKey===hash(key,'key'));ensure(i,'intent missing');
  if(i.state!=='queued')return {kind:'not_claimed' as const,state:i.state};
  const b=i.binding,p=project(tx,i.kind,key);
  if(!this.releaseCurrent(tx,i,p)){
   i.state='cancelled';this.audit(tx,actor,'quotation_release_cancelled',key);return {kind:'not_claimed' as const,state:i.state};
  }
  i.state='claimed';i.claimedAtMs=tx.nowMs;i.claimedBy=actor.id;this.audit(tx,actor,'quotation_release_claimed',key);return {kind:'claimed' as const,key,payloadHash:b.payloadHash,document:p.document,releaseKind:i.kind,expiresAtMs:i.expiresAtMs};
 });}
 /** A last fresh check, not an external-side-effect authorization in isolation.
  * The real dispatcher must fence manual saves and responses up to provider handoff;
  * any failed check after claim is uncertain until proven no send occurred. */
 revalidateClaim(scope:JobScope,actor:Actor,key:string){return this.run(scope,actor,tx=>{
  ensure(actor.kind==='worker'&&tx.canDispatch===true,'dispatch authority');const i=tx.intents.find(x=>x.binding.idempotencyKey===hash(key,'key'));ensure(i&&i.state==='claimed'&&i.claimedBy===actor.id,'not claimed by worker');
  const p=project(tx,i.kind,key);if(!this.releaseCurrent(tx,i,p)){i.state='uncertain';this.audit(tx,actor,'quotation_delivery_uncertain',key);return {current:false as const};}
  return {current:true as const};
 });}
 /** User can cancel a queued intent even after feature is disabled. Claimed sends need reconciliation. */
 cancel(scope:JobScope,actor:Actor,key:string){return this.run(scope,actor,tx=>{
  this.human(tx,actor);const i=tx.intents.find(x=>x.binding.idempotencyKey===hash(key,'key'));ensure(i&&(i.state==='queued'||i.state==='cancelled'),'cannot cancel in-flight delivery');
  if(i.state==='queued'){i.state='cancelled';this.audit(tx,actor,'quotation_release_cancelled',key);}return i.state;
 });}
 /** Never automatically retry a claimed send. Recovery marks ambiguity, not failure. */
 markUncertain(scope:JobScope,actor:Actor,key:string){return this.run(scope,actor,tx=>{
  ensure(actor.kind==='worker'&&tx.canReconcile===true,'reconcile authority');const i=tx.intents.find(x=>x.binding.idempotencyKey===hash(key,'key'));ensure(i&&(i.state==='claimed'||i.state==='uncertain'),'not in flight');if(i.state==='claimed'){i.state='uncertain';this.audit(tx,actor,'quotation_delivery_uncertain',key);}return i.state;
 });}
 /** Receipt is looked up from trusted existing message/provider reconciliation, never supplied by browser. */
 reconcile(scope:JobScope,actor:Actor,key:string){return this.run(scope,actor,tx=>{
  ensure(actor.kind==='worker'&&tx.canReconcile===true,'reconcile authority');const i=tx.intents.find(x=>x.binding.idempotencyKey===hash(key,'key'));ensure(i&&i.claimedAtMs!==null,'not dispatched');
  const matches=tx.deliveryEvidence.filter(e=>e.key===key);ensure(matches.length===1,'delivery evidence missing or conflicting');const e=matches[0];
  ensure(sameScope(parseScope(e.scope),tx.job.scope)&&e.kind===i.kind&&e.payloadHash===i.binding.payloadHash,'receipt binding');integer(e.atMs,'receipt time',i.claimedAtMs,tx.nowMs);
  const status=choice(e.status,'receipt status',['sent','suppressed','not_sent','unknown'] as const);if(status==='sent'||status==='suppressed'){id(e.messageId,'message');ensure(!tx.intents.some(other=>other!==i&&other.delivery?.messageId===e.messageId),'message receipt reused');}else ensure(e.messageId===null,'unexpected message ID');
  if(i.delivery&&i.delivery.status!=='unknown'){ensure(digest(i.delivery)===digest(e),'conflicting terminal receipt');return i.state;}
  ensure(i.state==='claimed'||i.state==='uncertain','not in flight');i.delivery={...e};i.state=status==='unknown'?'uncertain':status;this.audit(tx,actor,'quotation_delivery_'+i.state,key);return i.state;
 });}
 /** No canonical status writes: existing customer response and revision services own them. */
 tracking(scope:JobScope,actor:Actor){return this.run(scope,actor,tx=>{
  ensure(actor.kind==='user'&&tx.canViewCommunications===true&&tx.canReview===true,'tracking authority');const version=integer(tx.currentVersion,'current version',1),h=tx.currentDocumentHash===null?null:hash(tx.currentDocumentHash,'current document hash'),events=timeline(tx),current=events.filter(e=>e.version===version&&e.documentHash===h);
  const status=choice(tx.canonicalStatus,'canonical status',['draft','unsent','sent','accepted','declined','revision_requested','withdrawn','expired','unknown'] as const);
  ensure(tx.job.scope.kind==='quote','quote scope');const view:QuotationTrackingView={quoteId:tx.job.scope.quoteId,version,status,viewed:current.some(e=>e.kind==='viewed'),timeline:events.map(e=>({id:e.id,version:e.version,kind:e.kind,atMs:e.atMs,current:e.version===version&&e.documentHash===h})),delivery:tx.intents.map(i=>({version:i.version,kind:i.kind,state:i.state})),nextAction:tx.intents.some(i=>i.state==='uncertain')?'reconcile_delivery':status==='revision_requested'?'review_existing_revision_request':status==='accepted'?(current.some(e=>e.kind==='accepted')?'prepare_commercial_baseline':'verify_accepted_version'):status==='sent'?'track_response':status==='unsent'?'review_canonical_quote':'open_manual_quote',manualAvailable:true as const};return view;
 });}
}
