import { parseScope, sameScope, type JobScope } from '../contracts/evidence';
import { ensure, id, integer, text } from '../contracts/validation';
import { createManifest } from '../documents/pages';
import { admit, canReserve, type AuthoritySnapshot, type Spend } from '../policy/admission';
import { digest } from '../policy/approval';
import type { AgentPolicy } from '../contracts/policy';
import { parseTask,type Task } from '../contracts/tasks';
import { taskKey } from '../orchestration/transitions';
import { attachmentHashes,envelopeDigest,mailbox,parseEnvelope,parseScan,type AnalysisIntent,type Intake,type MailRoute,type Scan } from './contracts';

export type IntakeActor={id:string;kind:'receiver'|'scanner'|'reviewer'|'worker'};
export type Grant={id:string;version:number;companyId:string;routeId:string;workerId:string;active:boolean;expiresAtMs:number};
export type JobProjection={scope:JobScope;revision:number;inputHash:string;manifestHash:string;policy:AgentPolicy;enabled:boolean;authority:AuthoritySnapshot;grant:Grant;jobSpend:Spend;companySpend:Spend;minimumReservationMicros:number;tasks:Task[]};
export type IntakeTransaction={route:MailRoute;actorId:string;nowMs:number;canReceive:boolean;canScan:boolean;canReview:boolean;canSchedule:boolean;messages:Intake[];audit:{atMs:number;actorId:string;event:string;target:string}[];
 /** Trusted server-side lookups under the same transaction/locks; never from mail or browser. */
 job(scope:JobScope):JobProjection|undefined; canLink(scope:JobScope):boolean};
/** Unregistered server port. Authenticate actor; lock route + company-scoped job/stage dedupe index and any
 * referenced job, grant and budget; verify route ownership, fresh permissions and trusted time.
 * Persist synchronously/atomically; roll back callback failures; no external IO in callback.
 * messages are scoped to this exact route; jobs are canonical mutable task rows under lock.
 * For event tasks, every Phase 1B/2A transaction must re-check live grant, route, task
 * binding and event admission (not explicit-user admission alone). No live dispatch until proven.
 * Receiver permission requires verified provider signature, timestamp/replay protection and
 * canonical mailbox routing BEFORE this call. Scanner permission requires immutable byte/hash,
 * malware and sandboxed parser verification, scoped storage, no remote fetches. Never expose port to clients. */
export interface IntakeStore {transactIntake<T>(routeId:string,actor:IntakeActor,fn:(tx:IntakeTransaction)=>T):Promise<T>}
export class IntakeService {
 constructor(private readonly store:IntakeStore){}
 private run<T>(routeId:string,actor:IntakeActor,fn:(t:IntakeTransaction)=>T){id(routeId,'route');id(actor.id,'actor');return this.store.transactIntake(routeId,actor,t=>{ensure(t.route.id===routeId&&t.actorId===actor.id&&t.route.enabled===true&&t.route.verified===true,'route/actor denied');integer(t.nowMs,'trusted time',1);return fn(t);});}
 private audit(t:IntakeTransaction,event:string,target:string){t.audit.push({actorId:t.actorId,atMs:t.nowMs,event,target});}
 private current(t:IntakeTransaction,intakeId:string,version:number){const m=t.messages.find(x=>x.id===intakeId);ensure(m&&m.routeVersion===t.route.version&&m.version===integer(version,'intake version',1),'stale intake');return m;}
 receive(routeId:string,actor:IntakeActor,verifiedMailboxId:string,raw:unknown){return this.run(routeId,actor,t=>{
  ensure(actor.kind==='receiver'&&t.canReceive&&verifiedMailboxId===t.route.mailboxId,'receiver/mailbox denied');const e=parseEnvelope(raw);ensure(e.receivedAtMs<=t.nowMs,'future message');const h=envelopeDigest(e);
  const existing=t.messages.filter(x=>x.envelope.providerMessageId===e.providerMessageId||(e.messageId!==null&&x.envelope.messageId===e.messageId));
  if(existing.length){ensure(existing.length===1&&existing[0].envelopeHash===h,'message identity collision');return {id:existing[0].id,created:false};}
  const flags:string[]=[];if(!e.senderAuthenticated||!t.route.allowedSenders.map(s=>mailbox(s,'allowed sender')).includes(e.sender))flags.push('sender_review');if(e.forwarded)flags.push('forwarded_review');if(!e.attachments.length)flags.push('no_attachments');
  const hashes=attachmentHashes(e);if(hashes.length<e.attachments.length)flags.push('duplicate_in_message');
  if(hashes.some(h=>t.messages.some(x=>attachmentHashes(x.envelope).includes(h))))flags.push('repeated_attachment_review');
  if(e.threadId&&t.messages.some(x=>x.envelope.threadId===e.threadId))flags.push('thread_revision_review');
  if(e.attachments.some(a=>!['application/pdf','image/png','image/jpeg'].includes(a.mediaType)))flags.push('unsupported_attachment');
  const m:Intake={id:'in-'+digest({routeId,providerMessageId:e.providerMessageId}),envelope:e,envelopeHash:h,routeVersion:t.route.version,version:1,flags,scans:[]};t.messages.push(m);this.audit(t,'received',m.id);return {id:m.id,created:true};
 });}
 /** Each attachment stays quarantined until a trusted scan bound to its original bytes. */
 scan(routeId:string,actor:IntakeActor,intakeId:string,version:number,raw:unknown){return this.run(routeId,actor,t=>{
  ensure(actor.kind==='scanner'&&t.canScan,'scanner denied');const m=this.current(t,intakeId,version);ensure(!m.review&&!m.intent,'already reviewed');
  const attachmentId=(raw as {attachmentId?:unknown}|null)?.attachmentId;const a=m.envelope.attachments.find(a=>a.id===attachmentId);ensure(a,'attachment missing');const s=parseScan(raw,a);const previous=m.scans.find(x=>x.attachmentId===a.id);
  if(previous){ensure(digest(previous)===digest(s),'scan conflict');return {version:m.version};}m.scans.push(s);m.version++;this.audit(t,'scan_'+s.result,m.id);return {version:m.version};
 });}
 private verified(m:Intake){ensure(m.envelope.attachments.length>0&&m.scans.length===m.envelope.attachments.length&&m.scans.every(s=>s.result==='clean'&&s.document),'attachment quarantine');const docs=m.envelope.attachments.map(a=>m.scans.find(s=>s.attachmentId===a.id)!.document!);ensure(new Set(docs.map(d=>d.contentHash)).size===docs.length,'duplicate attachment requires restaging');return docs;}
 /** Human explicitly links the message to an existing canonical intake/quote. No automatic
  * job creation, customer matching, revision replacement, or approval of email instructions. */
 review(routeId:string,actor:IntakeActor,intakeId:string,version:number,rawScope:unknown,note:string,deadlineMs:number|null){return this.run(routeId,actor,t=>{
  ensure(actor.kind==='reviewer'&&t.canReview,'review denied');const m=this.current(t,intakeId,version);ensure(!m.intent,'intent already created');const scope=parseScope(rawScope);ensure(scope.companyId===t.route.companyId&&t.canLink(scope)&&t.job(scope),'job link denied');this.verified(m);
  const prior=t.messages.filter(x=>x.id!==m.id&&x.envelope.threadId!==null&&x.envelope.threadId===m.envelope.threadId&&x.review);
  ensure(prior.every(x=>sameScope(x.review!.scope,scope)),'thread job conflict');
  if(m.review)ensure(sameScope(m.review.scope,scope),'review scope immutable');
  m.review={actorId:actor.id,atMs:t.nowMs,scope,note:text(note,'review note',2000),deadlineMs:deadlineMs===null?null:integer(deadlineMs,'requested deadline',1)};m.version++;this.audit(t,'reviewed',m.id);return {version:m.version};
 });}
 private eligible(t:IntakeTransaction,m:Intake,workerId:string){
  ensure(m.review,'human link required');const scope=m.review.scope,j=t.job(scope);ensure(j&&sameScope(j.scope,scope)&&scope.companyId===t.route.companyId&&j.enabled&&j.policy.mode==='intelligent','job/pilot disabled');
  const g=j.grant;ensure(g.active&&g.companyId===scope.companyId&&g.routeId===t.route.id&&g.workerId===workerId&&g.expiresAtMs>t.nowMs,'grant denied');
  ensure(admit(j.policy,j.authority,{scope,actorId:workerId,action:'analyze_documents',policyVersion:j.policy.version,jobRevision:j.revision,trigger:'event'}).allowed,'event admission denied');
  const manifest=createManifest(scope,j.revision,this.verified(m));ensure(digest(manifest)===j.manifestHash,'canonical staged manifest mismatch');
  ensure(canReserve(j.policy,j.jobSpend,j.companySpend,j.minimumReservationMicros),'budget denied');return j;
 }
 /** Durable intent only. Adapter must atomically dispatch through a reviewed event admission
  * bridge to Phase 1B/2A. Existing enqueue is user-only; never impersonate a user. */
 schedule(routeId:string,actor:IntakeActor,intakeId:string,version:number){return this.run(routeId,actor,t=>{
  ensure(actor.kind==='worker'&&t.canSchedule,'scheduler denied');const m=this.current(t,intakeId,version);const j=this.eligible(t,m,actor.id);
  if(m.intent){this.checkIntent(t,m,j,actor.id);return {intent:structuredClone(m.intent),created:false};}
  ensure(!j.tasks.some(x=>x.stage==='analyze'&&x.inputHash===j.inputHash&&x.policyVersion===j.policy.version),'analysis already scheduled');
  const g=j.grant;const intent:AnalysisIntent={id:'ai-'+digest({scope:j.scope,stage:'analyze',inputHash:j.inputHash,policyVersion:j.policy.version}),intakeId:m.id,intakeVersion:m.version+1,routeVersion:t.route.version,scope:j.scope,jobRevision:j.revision,inputHash:j.inputHash,manifestHash:j.manifestHash,policyVersion:j.policy.version,grantId:g.id,grantVersion:g.version,workerId:actor.id,createdAtMs:t.nowMs,deadlineMs:Math.min(g.expiresAtMs,t.nowMs+j.policy.maxTaskMs)};
  ensure(!t.messages.some(x=>x.intent?.id===intent.id),'duplicate analysis intent');m.version++;m.intent=intent;this.audit(t,'analysis_intent',m.id);return {intent:structuredClone(intent),created:true};
 });}
 private checkIntent(t:IntakeTransaction,m:Intake,j:JobProjection,workerId:string){const a=m.intent;ensure(a&&a.intakeVersion===m.version&&a.routeVersion===t.route.version&&a.workerId===workerId&&sameScope(a.scope,j.scope)&&a.jobRevision===j.revision&&a.inputHash===j.inputHash&&a.manifestHash===j.manifestHash&&a.policyVersion===j.policy.version&&a.grantId===j.grant.id&&a.grantVersion===j.grant.version&&a.deadlineMs>t.nowMs,'stale analysis intent');return a;}
 /** Atomic internal task enqueue, not execution. No user impersonation. The adapter must
  * persist the canonical task and its grant/intent linkage together, and enforce that linkage
  * on every existing worker transaction before enabling unattended operation. */
 dispatch(routeId:string,actor:IntakeActor,intakeId:string,version:number){return this.run(routeId,actor,t=>{
  ensure(actor.kind==='worker'&&t.canSchedule,'dispatcher denied');const m=this.current(t,intakeId,version),j=this.eligible(t,m,actor.id),a=this.checkIntent(t,m,j,actor.id);
  const task=parseTask({id:a.id,scope:a.scope,stage:'analyze',status:'queued',version:1,policyVersion:a.policyVersion,inputHash:a.inputHash,attempt:0,maxAttempts:j.policy.maxAttempts,deadlineMs:a.deadlineMs,fence:0,notBeforeMs:t.nowMs});
  const existing=j.tasks.find(x=>taskKey(x)===taskKey(task));if(existing){ensure(existing.id===a.id&&existing.deadlineMs===a.deadlineMs,'analysis task collision');return {task:structuredClone(existing),created:false};}
  ensure(!j.tasks.some(x=>x.id===a.id),'task id collision');j.tasks.push(task);this.audit(t,'analysis_enqueued',m.id);return {task:structuredClone(task),created:true};
 });}
 /** Read-only preflight, not authority to dispatch outside transaction. No provider call. */
 preflight(routeId:string,actor:IntakeActor,intakeId:string,version:number){return this.run(routeId,actor,t=>{ensure(actor.kind==='worker'&&t.canSchedule,'scheduler denied');const m=this.current(t,intakeId,version),j=this.eligible(t,m,actor.id);return {intent:structuredClone(this.checkIntent(t,m,j,actor.id)),dispatchAuthorized:false as const,sendAuthorized:false as const};});}
 /** Reviewer-only source detail; render plain text, never HTML, links or remote images.
  * Sender and subject are candidates, not verified customer identity or job scope. */
 detail(routeId:string,actor:IntakeActor,intakeId:string,version:number){return this.run(routeId,actor,t=>{
  ensure(actor.kind==='reviewer'&&t.canReview,'detail denied');const m=this.current(t,intakeId,version);return {message:structuredClone(m),customerCandidate:m.envelope.sender,scopeCandidate:m.envelope.subject,threadCandidates:t.messages.filter(x=>x.id!==m.id&&m.envelope.threadId!==null&&x.envelope.threadId===m.envelope.threadId&&x.review&&t.canLink(x.review.scope)).map(x=>structuredClone(x.review!.scope)),sendAuthorized:false as const};
 });}
 /** Internal daily queue; omit body, address, filenames and attachment content. */
 queue(routeId:string,actor:IntakeActor){return this.run(routeId,actor,t=>{ensure(actor.kind==='reviewer'&&t.canReview,'queue denied');return t.messages.filter(m=>m.routeVersion===t.route.version).map(m=>{
  const blocked=m.scans.some(s=>s.result==='blocked')||m.flags.includes('unsupported_attachment')||m.flags.includes('duplicate_in_message');const waiting=m.scans.length!==m.envelope.attachments.length;
  const job=m.review&&t.canLink(m.review.scope)?t.job(m.review.scope):undefined;const task=job?.tasks.find(x=>x.stage==='analyze'&&x.id===m.intent?.id&&x.inputHash===m.intent?.inputHash&&x.policyVersion===m.intent?.policyVersion);
  const status=blocked?'quarantined':waiting?'scan_pending':!m.review?'intake_review':!m.intent?'staging_review':!job||job.revision!==m.intent.jobRevision||job.inputHash!==m.intent.inputHash||job.policy.version!==m.intent.policyVersion||job.manifestHash!==m.intent.manifestHash?'revision_review':!job.enabled||job.policy.mode!=='intelligent'||!job.grant.active||job.grant.id!==m.intent.grantId||job.grant.version!==m.intent.grantVersion||job.grant.expiresAtMs<=t.nowMs?'grant_review':task?task.status:m.intent.deadlineMs<=t.nowMs?'expired_intent':'analysis_intent';
  const deadlineMs=m.review?.deadlineMs??null;return {id:m.id,version:m.version,status,flags:[...m.flags],receivedAtMs:m.envelope.receivedAtMs,deadlineMs,overdue:deadlineMs!==null&&deadlineMs<=t.nowMs,notificationKey:digest({id:m.id,version:m.version,status}),sendAuthorized:false as const};
 }).sort((a,b)=>Number(b.overdue)-Number(a.overdue)||(a.deadlineMs??Number.MAX_SAFE_INTEGER)-(b.deadlineMs??Number.MAX_SAFE_INTEGER)||a.receivedAtMs-b.receivedAtMs||a.id.localeCompare(b.id));});}
}
