const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {conversation,quote,component,library,uuid,load,RetrievalError}=require('./sa-p172/fixture.cjs');
const {encodeTaskChoice}=load('tasks/wire.ts');
const {encodeResolutionChoice}=load('resolver/wire.ts');
const q=(id,extra={})=>quote(id,{status:'confirmed',_kind:'quote',_section:'quotes',quote_number:1013+id,...extra});
const c=(id,parent,extra={})=>component(id,{quote_id:uuid(parent),quote_status:'confirmed',_kind:'quote',_target_id:uuid(parent),...extra});
function ownerData(){return {quotes:[q(1,{created_at:'2026-09-18T00:00:00Z'}),q(2,{created_at:'2026-09-26T00:00:00Z',updated_at:'2026-09-28T00:00:00Z'}),q(3,{created_at:'2026-09-27T00:00:00Z',updated_at:'2026-09-27T00:00:00Z'}),q(4,{created_at:'2026-09-28T00:00:00Z',job_name:'John Smith roof',customer_name:'Jack Brown'}),quote(5,{quote_number:null,created_at:'2026-09-28T01:00:00Z'})],quote_components:[c(10,2,{name:'Ridge (Soft Edge, Standard)'}),c(11,1,{name:'Eaves'}),component(12,{name:'Ridge',quote_id:uuid(5),_target_id:uuid(5)})]};}
test('owner verbatim sequence in ONE conversation: list, restatement, exact number, latest customer',async()=>{
 const s=conversation(ownerData());
 for(const message of ['show me my quotes with ridges','I just want to see the quotes that contain ridge components','quote 1014','whats the most recent john smith quote'])assert.equal((await s.ask(message)).state,'resolved');
 assert.deepEqual(s.trace.map(t=>t.disposition),['new','new','new','new']);
 assert.deepEqual(s.trace[0].cards[0].options.map(o=>o.id),[uuid(2)]);
 assert.deepEqual(s.trace[1].cards[0].options.map(o=>o.id),[uuid(2)]);
 assert.deepEqual(s.trace[2].cards[0].options.map(o=>o.id),[uuid(1)]);
 assert.equal(s.trace[2].plans[0].related.length,0);assert.equal(s.trace[2].plans[0].filters.find(f=>f.field==='quote_number').value,1014);
 assert.deepEqual(s.trace[3].cards[0].options.map(o=>o.id),[uuid(3)]);
 assert.equal(s.trace[3].plans[0].filters.find(f=>f.field==='customer_name').value,'john smith');
 assert.deepEqual(s.trace[3].plans[0].orderBy,[{field:'created_at',direction:'desc'},{field:'id',direction:'asc'}]);
 assert.match(s.trace[3].answer,/2026-09-27/);assert.ok(s.trace.every(t=>t.plans.length>0));
 if(process.env.SA_P172_EVIDENCE_DIR){fs.mkdirSync(process.env.SA_P172_EVIDENCE_DIR,{recursive:true});fs.writeFileSync(path.join(process.env.SA_P172_EVIDENCE_DIR,'owner-sequence-offline.json'),JSON.stringify({kind:'Real router/resolver/compiler; in-memory transport, no Luna/PostgreSQL',trace:s.trace},null,2));}
});
test('empty component list does not repeat identical discovery as broadening',async()=>{
 const s=conversation({quotes:[q(1)]});await s.ask('show me my quotes with ridges');assert.equal(s.reads.length,1);assert.equal(s.reports.at(-1).broadened,false);assert.ok(s.saved.at(-1).state.question.key!=='name');
 await s.ask('quote 1014');assert.deepEqual(s.cards[0].content.options.map(o=>o.id),[uuid(1)]);assert.equal(s.reads[0].plan.related.length,0);
});
test('a cost clarification preserves Ridge when user supplies quote 1014',async()=>{
 const s=conversation({quotes:[q(1)],quote_components:[c(10,1),c(11,1,{name:'Ridge',material_rate:40})]});
 const first=await s.ask('How much does Ridge cost?');assert.equal(first.state,'candidates');
 const next=await s.ask('quote 1014');assert.equal(s.trace.at(-1).disposition,'continue');assert.equal(next.state,'candidates');assert.equal(s.saved.at(-1).state.intent.task,'cost');assert.equal(s.saved.at(-1).state.intent.parent.number,'1014');
});
test('short customer clarification adds a constraint, does not drop component membership',async()=>{
 const s=conversation({quotes:[q(1),q(2,{customer_name:'James Jones'})],quote_components:[c(10,1),c(11,2)]});
 // A precise list is completed, then a correction intentionally scopes it.
 await s.ask('show quotes with Ridge');await s.ask('No, the John Smith one');
 assert.equal(s.trace.at(-1).disposition,'correct');assert.deepEqual(s.cards[0].content.options.map(o=>o.id),[uuid(1)]);assert.ok(s.reads[0].plan.related.length);assert.equal(s.reads[0].plan.filters.find(f=>f.field==='customer_name').value,'John Smith');
});
test('Done closes task without deleting history or doing a business read',async()=>{
 const s=conversation(ownerData());await s.ask('show quotes with Ridge');const messages=s.transcript.length,reads=s.reads.length,old=s.snapshot().task;
 s.close();assert.equal(s.transcript.length,messages);assert.equal(s.reads.length,reads);assert.equal(s.proposals.length,0);assert.equal(s.snapshot().task.status,'closed');
 await s.ask('quote 1014');assert.notEqual(s.snapshot().task.id,old.id);assert.equal(s.trace.at(-1).disposition,'new');assert.equal(s.reads[0].plan.related.length,0);
});
test('Move on closes an unsuccessful question and does not require successful resolution',async()=>{
 const s=conversation({quotes:[q(1)]});await s.ask('show quotes with ridges');assert.equal(s.snapshot().task.status,'awaiting_input');s.close('abandoned');await s.ask('quote 1014');assert.equal(s.trace.at(-1).state,'resolved');
});
test('typed thanks also closes without a model and next request is independent',async()=>{
 const s=conversation(ownerData());await s.ask('show quotes with Ridge');const r=await s.ask('thanks');assert.equal(r.state,'task_control');assert.equal(s.reads.length,0);assert.equal(s.snapshot().task.status,'closed');await s.ask('quote 1014');assert.equal(s.trace.at(-1).state,'resolved');
});
test('forgotten Done does not make unrelated short explicit numbers inherit filters',async()=>{
 const s=conversation(ownerData());await s.ask('show quotes with Ridge');await s.ask('quote 1014');assert.equal(s.trace.at(-1).disposition,'new');assert.equal(s.reads[0].plan.related.length,0);
});
test('unclear fragment after pause asks task boundary, not a fake data search',async()=>{
 const s=conversation({quotes:[q(1)]});await s.ask('show quotes with Ridge');s.clock=new Date(s.clock.getTime()+301000);await s.ask('Smith');
 assert.equal(s.trace.at(-1).disposition,'ask_boundary');assert.equal(s.reads.length,0);assert.equal(s.snapshot().pendingMessage,'Smith');assert.equal(s.cards[0].content.options.length,2);
});
test('boundary Continue reuses the saved message without asking user to repeat it',async()=>{
 const s=conversation({quotes:[q(1)]});await s.ask('show quotes with Ridge');s.clock=new Date(s.clock.getTime()+301000);await s.ask('Smith');const pending=s.snapshot();
 await s.ask(encodeTaskChoice({taskId:pending.task.id,version:pending.task.version,choice:'continue'}));
 assert.equal(s.prepared.message,'Smith');assert.equal(s.trace.at(-1).disposition,'continue');assert.equal(s.saved.at(-1).state.intent.customer,'Smith');assert.equal(s.saved.at(-1).state.intent.contains,'Ridge');
});
test('boundary New excludes previous task history and constraints',async()=>{
 const s=conversation({quotes:[q(1)]});await s.ask('show quotes with Ridge');const priorRun=s.trace[0].runId;s.clock=new Date(s.clock.getTime()+301000);await s.ask('Smith');const pending=s.snapshot();
 await s.ask(encodeTaskChoice({taskId:pending.task.id,version:pending.task.version,choice:'new'}));assert.equal(s.prepared.message,'Smith');assert.equal(s.prepared.previous,null);assert.equal(s.prepared.visibleRun(priorRun),false);assert.equal(s.trace.at(-1).state,'model_required');
});
test('stale boundary buttons cannot reopen a closed task',async()=>{
 const s=conversation({quotes:[q(1)]});await s.ask('show quotes with Ridge');s.clock=new Date(s.clock.getTime()+301000);await s.ask('Smith');const pending=s.snapshot();s.close('abandoned');
 await s.ask(encodeTaskChoice({taskId:pending.task.id,version:pending.task.version,choice:'continue'}));assert.match(s.trace.at(-1).answer,/no longer current/);assert.equal(s.snapshot().task.status,'closed');assert.equal(s.reads.length,0);
});
test('stale candidate buttons cannot reopen a closed task or propose',async()=>{
 const s=conversation({component_library:[library(20),library(21)]});const first=await s.ask('How much does Ridge cost?');assert.equal(first.state,'candidates');const saved=s.saved.at(-1);s.close();
 await s.ask(encodeResolutionChoice({version:1,stateId:saved.id,choice:saved.state.candidates[0].choiceId}));assert.match(s.trace.at(-1).answer,/no longer active/);assert.equal(s.reads.length,0);assert.equal(s.proposals.length,0);
});
test('candidate selection in active task rereads price rather than cached label',async()=>{
 const s=conversation({component_library:[library(20),library(21)]});await s.ask('How much does Ridge cost?');const saved=s.saved.at(-1),choice=saved.state.candidates.find(c=>c.id===uuid(20));s.db.component_library[0].default_material_rate=99;
 const r=await s.ask(encodeResolutionChoice({version:1,stateId:saved.id,choice:choice.choiceId}));assert.equal(r.state,'resolved');assert.match(r.answer,/99/);assert.equal(s.proposals.length,0);
});
test('deleted selected candidate never becomes the other same-name record',async()=>{
 const s=conversation({component_library:[library(20),library(21)]});await s.ask('How much does Ridge cost?');const saved=s.saved.at(-1),choice=saved.state.candidates.find(c=>c.id===uuid(20));s.db.component_library.shift();
 const r=await s.ask(encodeResolutionChoice({version:1,stateId:saved.id,choice:choice.choiceId}));assert.equal(r.state,'expired');assert.ok(!s.cards.some(c=>c.content.kind==='records'));
});
test('complex correction delegates interpretation, not literal-name search',async()=>{
 const s=conversation(ownerData());await s.ask('show quotes with Ridge');const r=await s.ask("No, that's not what I meant. It was the quote with 200 ridges in it.");assert.equal(r,null);assert.equal(s.trace.at(-1).disposition,'correct');assert.equal(s.reads.length,0);assert.ok(s.prepared.prompt().includes('CURRENT_TASK_CLUES'));
});
test('latest explicit customer filter never falls back to matching job name',async()=>{
 const s=conversation({quotes:[q(1,{customer_name:'Jones',job_name:'Smith'})]});const r=await s.ask('Show latest quote for Smith');assert.notEqual(r.state,'resolved');assert.ok(s.reads.every(x=>x.plan.filters.some(f=>f.field==='customer_name'&&f.value==='Smith')));
});
test('ambiguous colloquial latest NAME quote can try name after complete empty customer set',async()=>{
 const s=conversation({quotes:[q(1,{customer_name:'Jones',job_name:'Smith'})]});const r=await s.ask("whats the most recent Smith quote");assert.equal(r.state,'resolved');assert.ok(s.trace.at(-1).plans.some(p=>p.search?.text==='Smith'));assert.equal(s.reports.at(-1).broadened,true);
});
test('latest fallback never runs after incomplete customer read',async()=>{
 const s=conversation({quotes:[q(1)]},{override:async p=>p.filters.some(f=>f.field==='customer_name')?{state:'too_broad',source:'quotes',rows:[],complete:false,truncated:false,answer:'fixture timeout'}:undefined});
 const r=await s.ask("whats the most recent Smith quote");assert.notEqual(r.state,'resolved');assert.ok(s.reads.every(x=>!x.plan.search));
});
test('component-specific qualifier is preserved after plural normalization',async()=>{
 const s=conversation({quotes:[q(1),q(2)],quote_components:[c(10,1,{name:'Ridge flashing'}),c(11,2,{name:'Ridge'})]});await s.ask('show quotes with ridges flashing');assert.deepEqual(s.cards[0].content.options.map(o=>o.id),[uuid(1)]);assert.equal(s.reads[0].plan.related[0].filters[0].value,'ridge flashing');
});
test('empty read is not exposed as permission denial; hidden source is not exposed as absent',async()=>{
 const s=conversation({quotes:[q(1)]});const missing=await s.ask('show quotes with Ridge');assert.equal(missing.state,'no_meaningful_match');s.permissions.components='hidden';const denied=await s.ask('show quotes with Ridge');assert.ok(['permission_denied','needs_discriminator'].includes(denied.state));assert.equal(s.cards.length,0);
});
test('permission revocation terminates before a proposal or data release',async()=>{
 const s=conversation({quotes:[q(1)],quote_components:[c(10,1)]});s.revoked=true;await assert.rejects(s.ask('Set Ridge material rate to 30 per m on quote 1014'),e=>e.code==='permissions_changed');assert.equal(s.proposals.length,0);assert.equal(s.cards.length,0);
});
test('closing while a run is unresolved is refused by fixture contract',()=>{const s=conversation();s.inFlight=true;assert.throws(()=>s.close(),/run_in_progress/);});

test('canonical latest bypasses old updated-at shortcut and uses creation order',async()=>{const s=conversation({quotes:[q(1,{created_at:'2026-09-01T00:00:00Z',updated_at:'2026-09-28T00:00:00Z'}),q(2,{created_at:'2026-09-27T00:00:00Z',updated_at:'2026-09-27T00:00:00Z'})]});await s.ask('Open my latest quote');assert.equal(s.prepared.allowFast,false);assert.equal(s.reads[0].plan.orderBy[0].field,'created_at');assert.equal(s.cards[0].content.options[0].id,uuid(2));});
