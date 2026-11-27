import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IntelligenceService } from '../../app/lib/intelligence/persistence/service';
import type { Actor, CompanyState, IntelligenceStore, Transaction } from '../../app/lib/intelligence/persistence/store';
import { sameScope, type JobScope } from '../../app/lib/intelligence/contracts/evidence';
import { digest } from '../../app/lib/intelligence/policy/approval';
import type { Task } from '../../app/lib/intelligence/contracts/tasks';
const scope:JobScope={kind:'quote',companyId:'co',quoteId:'q'};
const user:Actor={kind:'user',id:'user'},worker:Actor={kind:'worker',id:'worker'};
const token=(t:Task)=>({taskId:t.id,ownerId:worker.id,version:t.version,fence:t.fence});
/** Test-only serial transaction fixture; no durable storage or real authentication. */
class Fixture implements IntelligenceStore {
  now=1000; revoked=false; approver=true;
  state:CompanyState={enabled:true,policy:{companyId:'co',version:1,mode:'on_demand',enabledActions:['analyze_documents','prepare_quote','propose_memory'],modelIds:[],jobBudgetMicros:100,companyBudgetMicros:100,maxAttempts:3,maxTaskMs:10000},memory:[],jobs:[{scope,revision:1,inputHash:'a'.repeat(64),tasks:[],reservations:[],uploads:[],approvals:[],outbox:[],audit:[]}]};
  async transact<T>(s:JobScope,a:Actor,fn:(tx:Transaction)=>T):Promise<T>{
    const company=structuredClone(this.state);const job=company.jobs.find(j=>sameScope(j.scope,s));if(!job)throw Error('denied');
    const result=fn({company,job,authority:{scope:s,actorId:a.id,entitled:true,revoked:this.revoked,demo:false,permittedActions:company.policy.enabledActions,policyVersion:company.policy.version,jobRevision:job.revision},canControl:true,canReview:true,nowMs:this.now,approverAuthorized:()=>this.approver});this.state=company;return structuredClone(result);
  }
}
const setup=()=>{const f=new Fixture();return {f,s:new IntelligenceService(f)};};
async function running(s:IntelligenceService){const t=await s.enqueue(scope,user,'t');return token(await s.claim(scope,worker,t.id,t.version,100));}
test('disabled and revoked deny execution, cross-tenant denied',async()=>{const {f,s}=setup();f.state.enabled=false;await assert.rejects(s.enqueue(scope,user,'t'));f.state.enabled=true;f.revoked=true;await assert.rejects(s.enqueue(scope,user,'t'));await assert.rejects(s.enqueue({...scope,companyId:'other'},user,'t'));assert.equal(f.state.jobs[0].tasks.length,0);});
test('duplicate enqueue and competing claims',async()=>{const {s}=setup();const t=await s.enqueue(scope,user,'t');assert.equal((await s.enqueue(scope,user,'other')).id,t.id);const results=await Promise.allSettled([s.claim(scope,worker,t.id,1,100),s.claim(scope,worker,t.id,1,100)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);});
test('expired lease recovery fences old worker',async()=>{const {f,s}=setup();const k=await running(s);f.now+=101;await s.recover(scope,user,k.taskId,k.version);await assert.rejects(s.finish(scope,worker,k,'completed'));});
test('cancellation remains available when disabled',async()=>{const {f,s}=setup();const k=await running(s);f.state.enabled=false;assert.equal((await s.control(scope,user,k.taskId,k.version,'cancel')).status,'cancelled');await assert.rejects(s.finish(scope,worker,k,'completed'));});
test('reservation atomic cap, replay and unknown usage',async()=>{const {f,s}=setup();const k=await running(s);assert.equal((await s.reserve(scope,worker,k,'r',70)).created,true);assert.equal((await s.reserve(scope,worker,k,'r',70)).created,false);await assert.rejects(s.reserve(scope,worker,k,'r2',31));await s.settle(scope,worker,'r',null);await assert.rejects(s.reserve(scope,worker,k,'r2',31));await s.settle(scope,worker,'r',20);await s.reserve(scope,worker,k,'r2',80);assert.equal(f.state.jobs[0].reservations.length,2);await assert.rejects(s.settle(scope,worker,'r',21));});
test('company budget shared across jobs',async()=>{const {f,s}=setup();const k=await running(s);await s.reserve(scope,worker,k,'r',90);const q:JobScope={kind:'quote',companyId:'co',quoteId:'q2'};f.state.jobs.push({...structuredClone(f.state.jobs[0]),scope:q,tasks:[],reservations:[],audit:[]});const t=await s.enqueue(q,user,'t2');const k2=token(await s.claim(q,worker,t.id,1,100));await assert.rejects(s.reserve(q,worker,k2,'r2',11));});
test('upload cap, verification and revision invalidation',async()=>{const {s}=setup();const k=await running(s);await assert.rejects(s.reserveUpload(scope,user,'u',52428801));await s.reserveUpload(scope,user,'u',52428800);await assert.rejects(s.finalizeUpload(scope,worker,'u',{bytes:1,revisionId:'rev'}));await s.finalizeUpload(scope,worker,'u',{bytes:52428800,revisionId:'rev'});await s.finalizeUpload(scope,worker,'u',{bytes:52428800,revisionId:'rev'});await assert.rejects(s.finish(scope,worker,k,'completed'));});
test('approval consumes once; revocation and send denied',async()=>{const {f,s}=setup();const b={scope,actorId:user.id,action:'prepare_quote',policyVersion:1,jobRevision:1,inputHash:f.state.jobs[0].inputHash,payloadHash:'b'.repeat(64),idempotencyKey:'act'};f.state.jobs[0].approvals.push({id:'a',scope,bindingHash:digest(b),approvedBy:'owner',approvedAtMs:900,expiresAtMs:2000,state:'active'});f.approver=false;await assert.rejects(s.consumeApproval(scope,user,'a',b));f.approver=true;assert.equal((await s.consumeApproval(scope,user,'a',b)).created,true);assert.equal((await s.consumeApproval(scope,user,'a',b)).created,false);await assert.rejects(s.consumeApproval(scope,user,'a',{...b,action:'send_quote'}));assert.equal(f.state.jobs[0].outbox.length,1);});
