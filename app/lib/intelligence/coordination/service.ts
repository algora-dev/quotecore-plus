import { parseScope, sameScope, type JobScope } from '../contracts/evidence';
import { ensure } from '../contracts/validation';
import type { Actor } from '../persistence/store';
import * as flow from './workflow';
/** Integration port, not a live implementation. Authenticate actor and
 * canonical quote; lock workflow and all touched canonical revisions; load
 * current authority/entitlements, persist atomically with audit/outbox. No
 * external side effects inside callback. Use scoped staging and existing
 * approval/budget gates before any real execution. Never trust client refs. */
export interface CoordinationStore {
  transact<T>(scope:JobScope,actor:Actor,fn:(tx:CoordinationTransaction)=>T):Promise<T>;
}
export interface CoordinationTransaction {
  workflow:flow.Workflow;
  context:flow.Context;
  /** Canonical artifact validation includes engine readiness, provenance,
   * source versions, applicable approvals and current record contents. */
  artifactCurrent(task:flow.Node,artifact:flow.Artifact):boolean;
  /** Resolve the exact saved editor state, not a fabricated page/selection. */
  checkpointCurrent(task:flow.Node,checkpoint:flow.Checkpoint):boolean;
  /** Check evidence, target version and server-owned action payload hash. */
  optionCurrent(task:flow.Node,decision:flow.Decision,option:flow.Option):boolean;
}
export class CoordinationService {
  constructor(private readonly store:CoordinationStore){}
  private run<T>(scope:JobScope,actor:Actor,fn:(tx:CoordinationTransaction)=>T){const s=parseScope(scope);return this.store.transact(s,actor,tx=>{ensure(sameScope(s,tx.workflow.scope)&&sameScope(s,tx.context.authority.scope)&&actor.id===tx.context.authority.actorId&&(actor.kind==='user'?'user':'agent')===tx.context.actorKind,'transaction binding');return fn(tx);});}
  private task(tx:CoordinationTransaction,key:string){const t=tx.workflow.nodes.find(n=>n.id===key);ensure(t,'task');return t;}
  assign(scope:JobScope,actor:Actor,key:string,version:number,owner:flow.Owner){return this.run(scope,actor,tx=>{tx.workflow=flow.assign(tx.workflow,tx.context,key,version,owner);return flow.queue(tx.workflow);});}
  start(scope:JobScope,actor:Actor,key:string,version:number){return this.run(scope,actor,tx=>{const t=this.task(tx,key);for(const d of t.dependencies){const p=this.task(tx,d);ensure(p.output&&tx.artifactCurrent(p,p.output),'stale dependency');}if(t.selection){ensure(tx.optionCurrent(t,t.selection.decision,t.selection.option),'stale selected proposal');}const s=flow.start(tx.workflow,tx.context,key,version);tx.workflow=s.workflow;return {token:s.token,task:structuredClone(this.task(tx,key))};});}
  checkpoint(scope:JobScope,actor:Actor,key:string,token:string,checkpoint:flow.Checkpoint){return this.run(scope,actor,tx=>{ensure(tx.checkpointCurrent(this.task(tx,key),checkpoint),'stale checkpoint');tx.workflow=flow.saveCheckpoint(tx.workflow,tx.context,key,token,checkpoint);});}
  resume(scope:JobScope,actor:Actor,key:string){return this.run(scope,actor,tx=>{const resume=flow.manualResume(tx.workflow,tx.context,key);ensure(tx.checkpointCurrent(this.task(tx,key),resume.checkpoint),'stale checkpoint');return resume;});}
  wait(scope:JobScope,actor:Actor,key:string,token:string,decision:flow.Decision){return this.run(scope,actor,tx=>{const t=this.task(tx,key);ensure(decision.options.every(o=>tx.optionCurrent(t,decision,o)),'stale option');tx.workflow=flow.waitForDecision(tx.workflow,tx.context,key,token,decision);});}
  preview(scope:JobScope,actor:Actor,key:string){return this.run(scope,actor,tx=>{const p=flow.decisionPreview(tx.workflow,tx.context,key);ensure(p.decision.options.every(o=>tx.optionCurrent(this.task(tx,key),p.decision,o)),'stale option');return p;});}
  select(scope:JobScope,actor:Actor,key:string,version:number,digest:string,optionId:string){return this.run(scope,actor,tx=>{const p=flow.decisionPreview(tx.workflow,tx.context,key);const o=p.decision.options.find(x=>x.id===optionId);ensure(o&&tx.optionCurrent(this.task(tx,key),p.decision,o),'stale option');tx.workflow=flow.selectOption(tx.workflow,tx.context,key,version,digest,optionId);return flow.queue(tx.workflow);});}
  complete(scope:JobScope,actor:Actor,key:string,token:string,artifact:flow.Artifact,route?:flow.Node['route']){return this.run(scope,actor,tx=>{const t=this.task(tx,key);for(const d of t.dependencies){const p=this.task(tx,d);ensure(p.output&&tx.artifactCurrent(p,p.output),'stale dependency');}if(t.selection)ensure(tx.optionCurrent(t,t.selection.decision,t.selection.option),'stale selected proposal');ensure(tx.artifactCurrent(t,artifact),'stale or unverified artifact');tx.workflow=flow.complete(tx.workflow,tx.context,key,token,artifact,route);return flow.queue(tx.workflow);});}
  manualSave(scope:JobScope,actor:Actor,key:string,version:number,artifact:flow.Artifact,route?:flow.Node['route']){return this.run(scope,actor,tx=>{const t=this.task(tx,key);for(const d of t.dependencies){const p=this.task(tx,d);ensure(p.output&&tx.artifactCurrent(p,p.output),'stale dependency');}ensure(tx.artifactCurrent(t,artifact),'stale or unverified manual save');tx.workflow=flow.manualComplete(tx.workflow,tx.context,key,version,artifact,route);return flow.queue(tx.workflow);});}
}
