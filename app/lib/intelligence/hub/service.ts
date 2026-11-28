import {parseScope,sameScope,type JobScope} from '../contracts/evidence';
import {ensure,id,integer,hash,choice,record,text,unique} from '../contracts/validation';
import {parsePolicy} from '../contracts/policy';
import {digest} from '../policy/approval';
import type {Actor} from '../persistence/store';
import * as flow from '../coordination/workflow';
import type {CoordinationTransaction} from '../coordination/service';
import {taskLabel,summarizeJobs,type EvidenceView,type JobView,type TaskView,type HubCommand,type HubResult,type InstructionRequest} from './model';

/** Host adapter must enforce company membership AND quote access, current
 * entitlement, policy, locking, trusted time and transactional audit. Do not
 * export these methods directly as unauthenticated server actions. */
export interface HubTransaction extends CoordinationTransaction {
 title:string;
 /** Returns only authorized, current, source-version-checked evidence. */
 evidence(task:flow.Node,evidenceId:string):EvidenceView|null;
}
export interface HubStore {
 /** Must return only the actor's authorized quote scopes, never all company jobs by default. */
 list(companyId:string,actor:Actor):Promise<JobScope[]>;
 transact<T>(scope:JobScope,actor:Actor,fn:(tx:HubTransaction)=>T):Promise<T>;
}
function guard(tx:HubTransaction,scope:JobScope,actor:Actor){const c=tx.context,a=c.authority;parsePolicy(c.policy);ensure(actor.kind==='user'&&c.actorKind==='user'&&actor.id===a.actorId&&sameScope(scope,tx.workflow.scope)&&sameScope(scope,a.scope)&&scope.kind==='quote'&&c.policy.companyId===scope.companyId&&c.policy.version===a.policyVersion&&c.enabled&&a.entitled&&!a.revoked&&!a.demo,'hub access');integer(c.nowMs,'trusted time',1);}
function revision(tx:HubTransaction){return digest({scope:tx.workflow.scope,paused:tx.workflow.paused,jobRevision:tx.context.authority.jobRevision,policyVersion:tx.context.policy.version,nodes:tx.workflow.nodes.map(n=>[n.id,n.version,n.status,n.checkpoint?.version??null])});}
function project(tx:HubTransaction):JobView {
 const w=tx.workflow,c=tx.context;ensure(w.scope.kind==='quote','canonical quote');
 const current=new Map<string,boolean>();
 function valid(n:flow.Node):boolean {if(current.has(n.id))return current.get(n.id)!;current.set(n.id,false);const ok=n.status==='complete'&&!!n.output&&tx.artifactCurrent(n,n.output)&&n.dependencies.every(key=>{const dep=w.nodes.find(x=>x.id===key);return !!dep&&valid(dep);});current.set(n.id,ok);return ok;}
 const tasks:TaskView[]=flow.queue(w).map(q=>{const n=w.nodes.find(n=>n.id===q.id)!;
  const blockedBy=n.dependencies.filter(key=>{const dep=w.nodes.find(x=>x.id===key);return !dep||!valid(dep);});
  const state:TaskView['state']=n.status==='complete'?(valid(n)?'complete':'interrupted'):n.status==='waiting'?'decision':n.status==='running'?(n.lease&&n.lease.expiresAtMs>c.nowMs&&n.lease.jobRevision===c.authority.jobRevision&&n.lease.policyVersion===c.policy.version&&!w.paused&&!blockedBy.length?'running':'interrupted'):n.owner==='human'?(blockedBy.length?'blocked':'manual'):w.paused?'paused':q.ready&&!blockedBy.length?'queued':'blocked';
  const task:TaskView={id:n.id,label:taskLabel(n),areaId:n.areaId??null,owner:n.owner,version:n.version,state,blockedBy,canAssign:c.canControl&&n.status!=='complete',canResume:c.canReview&&n.owner==='human'&&!!n.checkpoint&&tx.checkpointCurrent(n,n.checkpoint),canTakeoverResume:c.canControl&&c.canReview&&n.owner==='intelligence'&&n.status!=='complete'&&!!n.checkpoint&&tx.checkpointCurrent(n,n.checkpoint)};
  if(n.decision&&c.canReview&&n.status==='waiting'&&!blockedBy.length){const p=flow.decisionPreview(w,c,n.id);const evidence=n.decision.evidenceIds.map(key=>{const e=tx.evidence(n,key);return e&&e.id===key?{id:key,filename:text(e.filename,'source filename',512),pageNumber:integer(e.pageNumber,'page number',1),excerpt:text(e.excerpt,'source excerpt')}:null;});const missingEvidence=evidence.some(e=>!e);task.decision={question:p.decision.question,options:p.decision.options.map(({id,label,effect,action})=>({id,label,effect,action})),recommendedId:p.decision.recommendedId,evidence:evidence.filter((e):e is EvidenceView=>e!==null),missingEvidence,previewDigest:p.previewDigest,canSelect:!missingEvidence&&p.decision.options.every(o=>tx.optionCurrent(n,p.decision,o))};}
  return task;
 });
 const final= w.nodes.find(n=>n.tool==='quote_draft');const prepared=!!final&&tasks.every(t=>t.state==='complete')&&w.nodes.every(n=>!!n.output&&tx.artifactCurrent(n,n.output));
 return {quoteId:w.scope.quoteId,title:text(tx.title,'job title',512),paused:w.paused,canControl:c.canControl,canInstruct:c.canReview,revision:revision(tx),tasks,state:prepared?'prepared':tasks.some(t=>['decision','manual','interrupted'].includes(t.state))?'attention':tasks.some(t=>t.state==='running')?'working':'waiting'};
}
export function parseHubCommand(raw:unknown):HubCommand {
 const base=record(raw,'command',['kind','taskId','version','owner','previewDigest','optionId','revision','paused']);
 const kind=choice(base.kind,'command kind',['assign','select','resume','takeover_resume','pause'] as const);
 if(kind==='pause'){const r=record(raw,'pause',['kind','revision','paused']);ensure(typeof r.paused==='boolean','paused');return {kind,revision:hash(r.revision,'revision'),paused:r.paused};}
 const taskId=id(base.taskId,'task'),version=integer(base.version,'version',1);
 if(kind==='assign'){record(raw,'assign',['kind','taskId','version','owner']);return {kind,taskId,version,owner:choice(base.owner,'owner',['human','intelligence'] as const)};}
 if(kind==='resume'||kind==='takeover_resume'){record(raw,'resume',['kind','taskId','version']);return {kind,taskId,version};}
 record(raw,'select',['kind','taskId','version','previewDigest','optionId']);return {kind,taskId,version,previewDigest:hash(base.previewDigest,'preview'),optionId:id(base.optionId,'option')};
}
export class IntelligenceHubService {
 constructor(private readonly store:HubStore){}
 private run<T>(scope:JobScope,actor:Actor,fn:(tx:HubTransaction)=>T){const s=parseScope(scope);ensure(s.kind==='quote'&&actor.kind==='user','human quote access');return this.store.transact(s,actor,tx=>{guard(tx,s,actor);return fn(tx);});}
 async view(companyId:string,actor:Actor){id(companyId,'company');ensure(actor.kind==='user','human hub');const scopes=(await this.store.list(companyId,actor)).map(parseScope);ensure(scopes.length<=500&&scopes.every(s=>s.kind==='quote'&&s.companyId===companyId),'hub scope list');unique(scopes,s=>s.kind==='quote'?s.quoteId:'','quote IDs');const jobs=[];for(const s of scopes)jobs.push(await this.run(s,actor,project));return summarizeJobs(jobs);}
 execute(scope:JobScope,actor:Actor,raw:unknown):Promise<HubResult>{const cmd=parseHubCommand(raw);return this.run(scope,actor,tx=>{
  const w=tx.workflow,c=tx.context;if(cmd.kind==='pause'){ensure(cmd.revision===revision(tx),'stale job view');tx.workflow=flow.pause(w,c,cmd.paused);}
  else{const n=w.nodes.find(n=>n.id===cmd.taskId);ensure(n&&n.version===cmd.version,'stale task view');
   if(cmd.kind==='assign')tx.workflow=flow.assign(w,c,n.id,cmd.version,cmd.owner);
   else if(cmd.kind==='resume'||cmd.kind==='takeover_resume'){const next=cmd.kind==='takeover_resume'?flow.assign(w,c,n.id,cmd.version,'human'):w;const r=flow.manualResume(next,c,n.id);ensure(tx.checkpointCurrent(n,r.checkpoint),'stale checkpoint');tx.workflow=next;return {kind:'resume',...r};}
   else{ensure(project(tx).tasks.find(t=>t.id===n.id)?.decision?.canSelect,'decision is not current');const p=flow.decisionPreview(w,c,n.id);ensure(p.decision.evidenceIds.every(key=>tx.evidence(n,key)?.id===key),'stale evidence');const option=p.decision.options.find(o=>o.id===cmd.optionId);ensure(option&&tx.optionCurrent(n,p.decision,option),'stale option');tx.workflow=flow.selectOption(w,c,n.id,cmd.version,cmd.previewDigest,cmd.optionId);}
  }return {kind:'updated',job:project(tx)};
 });}
 /** Text and voice are only requests for a prepared proposal. No execution,
  * raw tool args, prompt-to-write or auto-approval. Host may pass validated
  * request to a budgeted planner, then return a new server-owned decision. */
 validateInstruction(scope:JobScope,actor:Actor,raw:unknown):Promise<InstructionRequest>{const r=record(raw,'instruction',['quoteId','revision','taskId','taskVersion','text','source']);return this.run(scope,actor,tx=>{const c=tx.context;ensure(c.canReview&&tx.workflow.scope.kind==='quote'&&r.quoteId===tx.workflow.scope.quoteId&&r.revision===revision(tx),'stale instruction context');const taskId=r.taskId===undefined?undefined:id(r.taskId,'task');const taskVersion=r.taskVersion===undefined?undefined:integer(r.taskVersion,'task version',1);ensure(taskId===undefined?taskVersion===undefined:tx.workflow.nodes.some(n=>n.id===taskId&&n.version===taskVersion),'stale instruction task');return {quoteId:tx.workflow.scope.quoteId,revision:revision(tx),taskId,taskVersion,text:text(r.text,'instruction',4000),source:choice(r.source,'source',['text','voice'] as const)};});}
}
