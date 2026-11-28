import { parseMemory, activeMemory, type MemoryRecord, type MemoryScope } from '../contracts/memory';
import { parseScope, sameScope, type JobScope } from '../contracts/evidence';
import { ensure, id, integer, hash, text, unique, ids } from '../contracts/validation';
import { parsePolicy } from '../contracts/policy';
import { admit } from '../policy/admission';
import { digest } from '../policy/approval';
import type { Actor, Transaction } from '../persistence/store';

export type MemoryOrigin = {memoryId:string; actorId:string; job:JobScope; atMs:number; reason:string};
export type MemoryUse = {draftId:string; job:JobScope; actorId:string; selectionDigest:string; records:{id:string;version:number;digest:string}[]};
export type MemoryJournal = {revision:number; origins:MemoryOrigin[]; uses:MemoryUse[]; changes:{memoryId:string;actorId:string;atMs:number;reason:string;from:MemoryRecord;toVersion:number}[]};
export type MemoryTransaction = Transaction & {
 journal:MemoryJournal;
 canInspectMemory(scope:MemoryScope):boolean;
 canManageMemory(scope:MemoryScope):boolean;
 /** Must verify current evidence/version, provenance and explicit promotion permission.
  * For company scope, private conversation evidence requires separate promotion consent.
  * Never interpret a document or free-form model response as authority. */
 sourceAuthorized(memory:MemoryRecord,origin:MemoryOrigin):boolean;
 memoryApproverAuthorized(actorId:string,scope:MemoryScope):boolean;
};
/** Server-only, unregistered. Same company lock as Phase 1B plus journal and
 * scoped source ACLs. Callbacks atomic, synchronous, rollback on throw.
 * Authenticate actual human commands; never expose raw state to browser/agent.
 * Existing legacy proposals without an origin must be re-proposed with evidence. */
export interface MemoryStore { transactMemory<T>(job:JobScope,actor:Actor,fn:(tx:MemoryTransaction)=>T):Promise<T> }
const subjectKey=(m:MemoryRecord)=>`${m.kind}:${m.subject.trim().normalize('NFKC').toLowerCase()}`;
const scopeKey=(s:MemoryScope)=>digest(s);
const visible=(m:MemoryRecord,job:JobScope,actor:Actor,tx:MemoryTransaction)=>m.scope.companyId===job.companyId&&
 (m.scope.kind==='company'||(m.scope.kind==='user'?m.scope.userId===actor.id:job.kind==='quote'&&m.scope.quoteId===job.quoteId))&&tx.canInspectMemory(m.scope)===true;
const origin=(tx:MemoryTransaction,m:MemoryRecord)=>tx.journal.origins.find(o=>o.memoryId===m.id);
const usable=(m:MemoryRecord,job:JobScope,actor:Actor,tx:MemoryTransaction)=>{
 const o=origin(tx,m);return visible(m,job,actor,tx)&&!!o&&!!m.approval&&
 activeMemory(m,{companyId:job.companyId,userId:actor.id,...(job.kind==='quote'?{quoteId:job.quoteId}:{}),nowMs:tx.nowMs})&&
 tx.sourceAuthorized(m,o)===true&&tx.memoryApproverAuthorized(m.approval.actorId,m.scope)===true;
};
export class LearningService {
 constructor(private readonly store:MemoryStore){}
 private run<T>(job:JobScope,actor:Actor,fn:(tx:MemoryTransaction)=>T){
  const s=parseScope(job);id(actor.id,'actor');return this.store.transactMemory(s,actor,tx=>{
   const p=parsePolicy(tx.company.policy);integer(tx.nowMs,'time',1);integer(tx.journal.revision,'memory revision',1);
   ensure(actor.kind==='user'&&tx.canReview===true&&sameScope(s,tx.job.scope)&&sameScope(s,tx.authority.scope)&&p.companyId===s.companyId&&tx.authority.actorId===actor.id&&tx.authority.revoked===false&&tx.authority.demo===false&&tx.authority.policyVersion===p.version&&tx.authority.jobRevision===tx.job.revision,'memory access');
   unique(tx.company.memory,m=>m.id,'memory ids');unique(tx.journal.origins,o=>o.memoryId,'origin ids');return fn(tx);
  });
 }
 private get(tx:MemoryTransaction,job:JobScope,actor:Actor,memoryId:string){
  const m=tx.company.memory.find(x=>x.id===id(memoryId,'memory id'));ensure(m,'memory unavailable');const parsed=parseMemory(m);ensure(visible(parsed,job,actor,tx),'memory unavailable');return parsed;
 }
 private canActivate(tx:MemoryTransaction,actor:Actor,m:MemoryRecord){
  const p=tx.company.policy;ensure(tx.company.enabled===true&&p.mode!=='manual'&&tx.authority.entitled===true&&p.enabledActions.includes('activate_memory')&&tx.authority.permittedActions.includes('activate_memory')&&tx.canManageMemory(m.scope)===true&&tx.memoryApproverAuthorized(actor.id,m.scope)===true,'activation denied');
 }
 private change(tx:MemoryTransaction,actor:Actor,m:MemoryRecord,state:'active'|'rejected'|'revoked'|'superseded',reason:string){
  const version=integer(m.version+1,'next version',2);const {approval:_old,...rest}=m;
  const next=parseMemory({...rest,version,state,...(state==='active'?{approval:{actorId:actor.id,version,atMs:tx.nowMs}}:{})});
  tx.company.memory[tx.company.memory.findIndex(x=>x.id===m.id)]=next;
  tx.journal.changes.push({memoryId:m.id,actorId:actor.id,atMs:tx.nowMs,reason,from:m,toVersion:version});
  tx.job.audit.push({actorId:actor.id,atMs:tx.nowMs,event:`memory_${state}`,target:m.id});return next;
 }
 private bump(tx:MemoryTransaction){tx.journal.revision=integer(tx.journal.revision+1,'next revision',2);}
 propose(job:JobScope,actor:Actor,raw:unknown,reason:string){return this.run(job,actor,tx=>{
  const m=parseMemory(raw);const p=tx.company.policy;
  ensure(tx.company.enabled===true&&admit(p,tx.authority,{scope:job,actorId:actor.id,action:'propose_memory',policyVersion:p.version,jobRevision:tx.job.revision,trigger:'explicit'}).allowed,'proposal denied');
  ensure(m.state==='proposed'&&m.version===1&&!m.approval&&visible(m,job,actor,tx)&&tx.canManageMemory(m.scope)===true&&(!m.expiresAtMs||m.expiresAtMs>tx.nowMs),'proposal scope/state');
  ensure(!tx.company.memory.some(x=>x.id===m.id),'duplicate memory');
  const o:MemoryOrigin={memoryId:m.id,actorId:actor.id,job:parseScope(job),atMs:tx.nowMs,reason:text(reason,'reason',1000)};
  ensure(tx.sourceAuthorized(m,o)===true,'unverified source or promotion');tx.company.memory.push(m);tx.journal.origins.push(o);this.bump(tx);tx.job.audit.push({actorId:actor.id,atMs:tx.nowMs,event:'memory_proposed',target:m.id});return m;
 });}
 /** Inspect/export only records in the caller's own authorized scopes. No raw private source text. */
 inspect(job:JobScope,actor:Actor){return this.run(job,actor,tx=>({records:tx.company.memory.map(parseMemory).filter(m=>visible(m,job,actor,tx)).map(m=>({record:m,origin:origin(tx,m)??null,usable:usable(m,job,actor,tx)})),manualAvailable:true as const}));}
 private reviewToken(tx:MemoryTransaction,actor:Actor,m:MemoryRecord){return digest({record:m,origin:origin(tx,m)??null,actorId:actor.id,job:tx.job.scope,jobRevision:tx.job.revision,inputHash:tx.job.inputHash,policyVersion:tx.company.policy.version,memoryRevision:tx.journal.revision});}
 preview(job:JobScope,actor:Actor,memoryId:string){return this.run(job,actor,tx=>{const m=this.get(tx,job,actor,memoryId);return {record:m,reviewDigest:this.reviewToken(tx,actor,m)};});}
 /** Explicit authenticated human command, not an agent action/receipt. A reviewed
  * replacement is a new proposal. Never change canonical pricing or policy here. */
 decide(job:JobScope,actor:Actor,memoryId:string,reviewDigest:string,decision:'approve'|'reject'|'revoke',reason:string,replaceIds:string[]=[]){return this.run(job,actor,tx=>{
  const m=this.get(tx,job,actor,memoryId);const why=text(reason,'reason',1000);ensure(hash(reviewDigest,'review digest')===this.reviewToken(tx,actor,m),'stale memory review');
  ensure(tx.canManageMemory(m.scope)===true,'memory management denied');const replacements=ids(replaceIds,'replacements');
  if(decision==='approve'){
   this.canActivate(tx,actor,m);const o=origin(tx,m);ensure(m.state==='proposed'&&o&&tx.sourceAuthorized(m,o)===true&&(!m.expiresAtMs||m.expiresAtMs>tx.nowMs),'proposal unavailable');
   const prior=tx.company.memory.map(parseMemory).filter(x=>x.state==='active'&&scopeKey(x.scope)===scopeKey(m.scope)&&subjectKey(x)===subjectKey(m));
   ensure(prior.length===replacements.length&&prior.every(x=>replacements.includes(x.id)),'explicit replacement required');
   for(const x of prior)this.change(tx,actor,x,'superseded',why);
  }else{ensure(replacements.length===0&&(decision==='reject'?m.state==='proposed':decision==='revoke'&&m.state==='active'),'invalid decision');}
  const next=this.change(tx,actor,m,decision==='approve'?'active':decision==='reject'?'rejected':'revoked',why);this.bump(tx);return next;
 });}
 /** Reset exact scope, including pending proposals, with explicit reviewed digest. */
 previewReset(job:JobScope,actor:Actor,scope:MemoryScope){return this.run(job,actor,tx=>this.resetProjection(job,actor,tx,scope));}
 private resetProjection(job:JobScope,actor:Actor,tx:MemoryTransaction,scope:MemoryScope){
  // Validate scope by using the existing parser; no caller-supplied scope escalation.
  const s=parseMemory({id:'scope-check',scope,kind:'fact',subject:'scope',content:'scope',sourceIds:['scope'],version:1,state:'proposed'}).scope;
  const records=tx.company.memory.map(parseMemory).filter(m=>scopeKey(m.scope)===scopeKey(s)&&['active','proposed'].includes(m.state));
  ensure(s.companyId===job.companyId&&(s.kind==='company'||(s.kind==='user'?s.userId===actor.id:job.kind==='quote'&&s.quoteId===job.quoteId))&&tx.canInspectMemory(s)===true&&tx.canManageMemory(s)===true&&records.every(m=>visible(m,job,actor,tx)),'reset scope');
  return {records,resetDigest:digest({scope:s,actorId:actor.id,job,policyVersion:tx.company.policy.version,jobRevision:tx.job.revision,inputHash:tx.job.inputHash,memoryRevision:tx.journal.revision,records})};
 }
 reset(job:JobScope,actor:Actor,scope:MemoryScope,resetDigest:string,reason:string){return this.run(job,actor,tx=>{const p=this.resetProjection(job,actor,tx,scope);ensure(hash(resetDigest,'reset digest')===p.resetDigest,'stale reset');const why=text(reason,'reason',1000);for(const m of p.records)this.change(tx,actor,m,m.state==='active'?'revoked':'rejected',why);if(p.records.length)this.bump(tx);return {changed:p.records.length};});}
 private select(job:JobScope,actor:Actor,tx:MemoryTransaction,subjects:string[]){
  ensure(tx.company.enabled===true&&tx.authority.entitled===true&&tx.company.policy.mode!=='manual','retrieval disabled');
  ensure(Array.isArray(subjects)&&subjects.length<=100,'subjects');const keys=subjects.map(s=>text(s,'subject key',220).trim().normalize('NFKC').toLowerCase());unique(keys,x=>x,'subjects');
  const candidates=tx.company.memory.map(parseMemory).filter(m=>keys.includes(subjectKey(m))&&usable(m,job,actor,tx));
  const conflicts:string[]=[];const records:MemoryRecord[]=[];
  for(const key of keys){const matches=candidates.filter(m=>subjectKey(m)===key);if(new Set(matches.map(m=>m.content)).size>1)conflicts.push(key);else records.push(...matches);}
  records.sort((a,b)=>a.id.localeCompare(b.id));const refs=records.map(m=>({id:m.id,version:m.version,digest:digest(m)}));
  return {records,refs,conflicts,selectionDigest:digest({job,actorId:actor.id,subjects:keys.sort(),policyVersion:tx.company.policy.version,jobRevision:tx.job.revision,inputHash:tx.job.inputHash,refs,conflicts:conflicts.sort()}),advisoryOnly:true as const};
 }
 retrieve(job:JobScope,actor:Actor,subjects:string[]){return this.run(job,actor,tx=>this.select(job,actor,tx,subjects));}
 recordUse(job:JobScope,actor:Actor,draftId:string,subjects:string[],selectionDigest:string){return this.run(job,actor,tx=>{
  id(draftId,'draft id');const s=this.select(job,actor,tx,subjects);ensure(s.selectionDigest===hash(selectionDigest,'selection')&&!s.conflicts.length,'stale or conflicting memory');
  const u:MemoryUse={draftId,job:parseScope(job),actorId:actor.id,selectionDigest:s.selectionDigest,records:s.refs};
  const prior=tx.journal.uses.find(x=>x.draftId===draftId&&sameScope(x.job,job));if(prior){ensure(digest(prior)===digest(u),'draft use already bound');return prior;}tx.journal.uses.push(u);return u;
 });}
 checkUse(job:JobScope,actor:Actor,draftId:string,subjects:string[]){return this.run(job,actor,tx=>{const u=tx.journal.uses.find(x=>x.draftId===id(draftId,'draft id')&&sameScope(x.job,job)&&x.actorId===actor.id);ensure(u,'draft use unavailable');const s=this.select(job,actor,tx,subjects);return {current:s.selectionDigest===u.selectionDigest&&!s.conflicts.length,requiresReReview:s.selectionDigest!==u.selectionDigest||!!s.conflicts.length};});}
}
