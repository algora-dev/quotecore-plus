/* Real scope/orchestrator/store contracts with explicit transports. This is not
 * the Supabase security battery, a production build or a real model evaluation. */
const {root,mocks}=require('./sa-speed-test-loader.cjs');
const path=require('node:path'),test=require('node:test'),assert=require('node:assert/strict');
const load=p=>require(path.join(root,p)),uuid=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const {DEFAULT_SECTION_PERMISSIONS:DEFAULT}=load('app/lib/smart-assistant/section-permissions.ts');
const {RETRIEVAL_SCHEMA_HASH:hash}=load('app/lib/smart-assistant/retrieval/schema-version.ts');
let s;
class AccessError extends Error{constructor(code,message,status=403){super(message);this.code=code;this.status=status;}}
const runtime={AssistantV2Error:AccessError,v2SwitchOn:()=>s.master,loadAccess:async()=>s.access,freshAccess:async()=>{if(s.revoked)throw new AccessError('permissions_changed','revoked');return s.access;},rpcError:e=>new AccessError(e?.code==='42501'?'permissions_changed':'read_failed','failed')};
for(const name of ['../v2/runtime.server','./runtime.server'])mocks.set(name,runtime);
for(const name of ['../v2/database','./database'])mocks.set(name,{batchClient:c=>c,toJson:v=>JSON.parse(JSON.stringify(v))});
mocks.set('./session.server',{bindRunScope:async()=>{s.events.push('bind_run');},readSession:async()=>{s.events.push('session');return s.session;},addCard:async(_r,_a,_k,sections,content)=>{s.cards.push({sections,content});return uuid(90);}});
mocks.set('./attention.server',{attention:async()=>({ok:true})});
mocks.set('@/app/lib/supabase/admin',{createAdminClient:()=>admin});
mocks.set('@/app/lib/assistant/llmClient',{runChatStep:async()=>{throw Error('No real model in offline tests');}});
mocks.set('@/app/lib/assistant/config',{MODEL_CONFIG:{chatModel:'unchanged-fixture-model'}});
mocks.set('./tools',{READONLY_TOOLS:{}});
const {createV2Scope}=load('app/lib/smart-assistant/v2/tools.server.ts');
const {runOrchestratorTurn,OrchestratorExecutionError}=load('app/lib/smart-assistant/orchestrator.ts');
const {createTaskStore,decodeTaskSnapshot,closeTask,taskSnapshot}=load('app/lib/smart-assistant/tasks/store.server.ts');
const {encodeTaskChoice}=load('app/lib/smart-assistant/tasks/wire.ts');
const promise=(data,error=null)=>{const p=Promise.resolve({data,error});p.abortSignal=()=>p;return p;};
const view=(extra={})=>({id:uuid(50),version:1,status:'awaiting_input',label:'Finding: quotes containing Ridge',lastRunId:uuid(9),startedAt:new Date(Date.now()-10000).toISOString(),updatedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+900000).toISOString(),closure:null,boundary:false,...extra});
const resolution=()=>({id:uuid(80),expires_at:new Date(Date.now()+900000).toISOString(),state:{version:1,status:'pending',intent:{version:1,task:'find',domain:'quotes',contains:'Ridge',list:true},candidates:[],rejected:[],clarifications:0,question:{key:'customer',text:'Which customer?'},candidateSetComplete:false}});
function reset(){
 for(const key of ['SMART_ASSISTANT_TASK_CONTEXT_ENABLED','SMART_ASSISTANT_RESOLVER_ENABLED','SMART_ASSISTANT_RETRIEVAL_ENABLED','SMART_ASSISTANT_RETRIEVAL_V17_ENABLED','SMART_ASSISTANT_SPEED_ENABLED'])process.env[key]='true';
 s={calls:[],admin:[],events:[],cards:[],master:true,cap:{version:1,schema_hash:hash,enabled:true,intelligence_version:1,resolver_version:1,knowledge_enabled:false,knowledge_revision:'1',knowledge_history_after:null,catalogues_allowed:true},access:{userId:uuid(1),companyId:uuid(2),permissionRevision:7,workspaceSlug:'demo',permissions:{...DEFAULT,quotes:'edit',draft_quotes:'edit',components:'edit',customers:'read_only'},phases:{p1:true,p2:true,p3:true,p4:false}},session:{cards:[],messages:[],actions:[],page:null},read:{task:null,resolution:null,runIds:[],pendingMessage:null},rows:{quotes:[{id:uuid(1014),_row_id:uuid(1014),_kind:'quote',_target_id:uuid(1014),_section:'quotes',_rank:{tier:4,score:100},job_name:'Maple Roof',customer_name:'John Smith',quote_number:1014,status:'confirmed',created_at:'2026-09-27T12:00:00Z',updated_at:'2026-09-27T12:00:00Z'}]},history:[]};return s;
}
const client={rpc(name,args){s.calls.push({name,args});
 if(name==='sa_v2_retrieval_capabilities')return promise(s.cap,s.capError);
 if(name==='sa_v2_task_read')return promise(s.read,s.taskReadError);
 if(name==='sa_v2_task_snapshot')return promise(s.current??s.read.task,s.snapshotError);
 if(name==='sa_v2_task_close')return promise(view({status:'closed',closure:'solved',version:2}),s.closeError);
 if(name==='sa_v2_resolution_read_v172')return promise(s.scopedPending??null,s.resolutionError);
 if(name.startsWith('sa_v2_retrieval_query')){const p=args.p_plan;const rows=(s.rows[p.source]??[]).map(row=>Object.fromEntries(Object.entries(row).filter(([k])=>k.startsWith('_')||p.fields.includes(k))));return promise({version:1,schema_hash:hash,source:p.source,mode:p.mode,group_by:[],rows,complete:true,truncated:false,as_of:new Date().toISOString(),warnings:[]},s.queryError);}
 throw Error('unexpected caller RPC '+name);
 },from(table){assert.equal(table,'smart_assistant_messages');const query={select(){return query},eq(k,v){s.historyScope=[k,v];return query},order(k,v){s.historyOrder=[k,v];return query},limit(n){s.historyLimit=n;return promise(s.history)}};return query;}};
const admin={rpc(name,args){s.admin.push({name,args});
 if(name==='sa_v2_task_begin'){if(s.beginError)return promise(null,s.beginError);s.current=view({id:args.p_disposition==='new'?uuid(51):s.read.task?.id??uuid(51),version:(s.read.task?.version??0)+1,label:args.p_label,lastRunId:args.p_run_id,status:args.p_disposition==='close'?'closed':args.p_disposition==='ask_boundary'?'awaiting_input':'open',closure:args.p_closure,boundary:args.p_disposition==='ask_boundary'});return promise(s.current);}
 if(name==='sa_v2_task_finish'){if(s.finishError)return promise(null,s.finishError);if(s.current.status!=='closed'&&!s.current.boundary)s.current={...s.current,status:args.p_status,label:args.p_label};return promise(s.current);}
 if(name==='sa_v2_resolution_store'){s.stored=args.p_state;return promise({id:uuid(81),expires_at:new Date(Date.now()+900000).toISOString()});}
 throw Error('unexpected privileged RPC '+name);
}};
const input=message=>({supabase:client,companyId:uuid(2),conversationId:uuid(3),runId:uuid(4),userMessage:message,pageContext:{companyId:uuid(2),pathname:null}});
const config=async()=>({name:'Assistant',greeting:'',ruleToggles:{},customRules:[],membersCanManage:false,configUpdatedAt:null});
const model=async turn=>{s.modelInput=structuredClone(turn.messages);return {text:'A verified fixture reply.',tokensIn:120,tokensOut:20,toolCalls:[]};};
const dependencies={loadConfig:config,modelStep:model,report:()=>{}};
test('actual scope chooses a task BEFORE exact deterministic retrieval and passes fenced writer arguments',async()=>{
 reset();s.read={task:view(),resolution:resolution(),runIds:[uuid(9)],pendingMessage:null};
 const r=await runOrchestratorTurn(input('quote 1014'),dependencies);assert.equal(r.tokensIn,0);assert.match(r.content,/1014/);assert.equal(s.stored.intent.contains,undefined);assert.equal(s.admin[0].name,'sa_v2_task_begin');assert.equal(s.admin[0].args.p_disposition,'new');assert.equal(s.admin[0].args.p_user_id,uuid(1));assert.equal(s.admin[0].args.p_knowledge_revision,'1');assert.equal(s.admin.at(-1).name,'sa_v2_task_finish');assert.equal(s.events.includes('session'),false);assert.equal(s.calls.some(x=>x.name==='sa_v2_resolution_read'),false);
});
test('new task excludes old model history, references and pending actions',async()=>{
 reset();s.read={task:view(),resolution:resolution(),runIds:[uuid(9)],pendingMessage:null};
 const message={id:uuid(20),role:'assistant',content:'OLD TASK PRIVATE LABEL',runId:uuid(9),createdAt:new Date().toISOString()};
 s.session.messages=[message];s.session.cards=[{id:uuid(21),runId:uuid(9),createdAt:new Date().toISOString(),content:{kind:'records',options:[{kind:'quote',id:uuid(22),label:'OLD RECORD',detail:'old'}]}},{id:uuid(23),runId:uuid(9),createdAt:new Date().toISOString(),content:{kind:'proposal',actionId:uuid(24)}}];s.session.actions=[{id:uuid(24),title:'OLD ACTION',status:'proposed'}];
 s.history=[{id:uuid(5),role:'user',content:'Why do prices vary?',run_id:uuid(4),created_at:new Date().toISOString()},{...message,run_id:message.runId,created_at:message.createdAt}];
 await runOrchestratorTurn(input('Why do prices vary?'),dependencies);
 const text=JSON.stringify(s.modelInput);assert.match(text,/TASK BOUNDARY: NEW/);assert.doesNotMatch(text,/OLD TASK|OLD RECORD|OLD ACTION|PENDING_ENTITY_RESOLUTION_DATA \(UNTRUSTED/);assert.equal(s.historyLimit,31);assert.deepEqual(s.historyOrder,['created_at',{ascending:false}]);assert.equal(s.modelInput.filter(m=>m.role==='user'&&m.content==='Why do prices vary?').length,1);
});
test('dependent follow-up carries ONLY current-task history and still reads current facts',async()=>{
 reset();s.read={task:view({status:'answered'}),resolution:null,runIds:[uuid(9)],pendingMessage:null};
 const own={id:uuid(20),role:'assistant',content:'CURRENT TASK REFERENCE',runId:uuid(9),createdAt:new Date().toISOString()},other={...own,id:uuid(21),runId:uuid(8),content:'UNRELATED REFERENCE'};
 s.session.messages=[own,other];s.history=[{id:uuid(5),role:'user',content:'What about its labour?',run_id:uuid(4),created_at:new Date().toISOString()},...s.session.messages.map(m=>({...m,run_id:m.runId,created_at:m.createdAt}))];
 await runOrchestratorTurn(input('What about its labour?'),dependencies);const text=JSON.stringify(s.modelInput);assert.match(text,/CURRENT TASK REFERENCE/);assert.doesNotMatch(text,/UNRELATED REFERENCE/);assert.match(text,/TASK BOUNDARY: CONTINUE/);
});
test('boundary choice resumes stored input exactly once without opaque marker',async()=>{
 reset();s.read={task:view({boundary:true}),resolution:null,runIds:[uuid(9),uuid(8)],pendingMessage:'Explain its labour allowance'};
 s.history=[{id:uuid(20),role:'user',content:encodeTaskChoice({taskId:uuid(50),version:1,choice:'continue'}),run_id:uuid(4),created_at:new Date().toISOString()},{id:uuid(21),role:'user',content:s.read.pendingMessage,run_id:uuid(9),created_at:new Date().toISOString()}];s.session.messages=s.history.map(m=>({...m,runId:m.run_id,createdAt:m.created_at}));
 await runOrchestratorTurn(input(s.history[0].content),dependencies);assert.equal(s.modelInput.filter(m=>m.role==='user'&&m.content==='Explain its labour allowance').length,1);assert.doesNotMatch(JSON.stringify(s.modelInput),/\[\[sa-task:/);
});
test('Done wire is never interpreted by a model when feature disabled',async()=>{
 reset();process.env.SMART_ASSISTANT_TASK_CONTEXT_ENABLED='false';let models=0;const r=await runOrchestratorTurn(input(encodeTaskChoice({taskId:uuid(50),version:1,choice:'new'})),{...dependencies,modelStep:async()=>{models++;throw Error('must not run')}});assert.equal(models,0);assert.equal(r.tokensIn,0);assert.match(r.content,/no longer available/);assert.equal(s.calls.some(x=>x.name==='sa_v2_task_read'),false);
});
test('master rollback also does not send task wire to model',async()=>{reset();s.master=false;const r=await runOrchestratorTurn(input('[[SA-TASK:invalid'),dependencies);assert.equal(r.tokensOut,0);assert.equal(s.modelInput,undefined);});
test('missing task migration is explicit setup failure before model or business read',async()=>{
 reset();s.taskReadError={code:'PGRST202'};await assert.rejects(runOrchestratorTurn(input('quote 1014'),dependencies),e=>e.code==='migration_required');assert.equal(s.modelInput,undefined);assert.equal(s.calls.some(x=>x.name.startsWith('sa_v2_retrieval_query')),false);
});
test('task flag cannot silently fall back to aggressive P171 on missing capability',async()=>{
 reset();s.cap.resolver_version=0;await assert.rejects(createV2Scope(input('quote 1014')),e=>e.code==='migration_required');assert.equal(s.admin.length,0);
});
test('disabling task flag keeps the baseline reader path',async()=>{
 reset();process.env.SMART_ASSISTANT_TASK_CONTEXT_ENABLED='false';const scope=await createV2Scope(input('Why do prices vary?'));assert.equal(scope.task,undefined);assert.equal(s.calls.some(x=>x.name==='sa_v2_task_read'),false);
});
test('late metadata failure preserves model token usage for canonical finish',async()=>{
 reset();s.finishError={code:'42501'};await assert.rejects(runOrchestratorTurn(input('Why do prices vary?'),dependencies),e=>e instanceof OrchestratorExecutionError&&e.errorCode==='access_changed'&&e.tokensIn===120&&e.tokensOut===20);
});
test('metadata finish failure is reported as failed, not completed, in telemetry',async()=>{
 reset();s.finishError={code:'P1721'};let report;await assert.rejects(runOrchestratorTurn(input('Why do prices vary?'),{...dependencies,report:value=>report=value}));assert.notEqual(report.outcome,'completed');assert.equal(s.modelInput.filter(m=>m.role==='user').length,1);
});
test('task decision CAS failure prevents model and retrieval',async()=>{
 reset();s.beginError={code:'P1721'};await assert.rejects(runOrchestratorTurn(input('quote 1014'),dependencies),e=>e.code==='task_changed');assert.equal(s.modelInput,undefined);assert.equal(s.stored,undefined);
});
test('another running request prevents closing or resetting metadata',async()=>{
 reset();s.beginError={code:'P1722'};await assert.rejects(runOrchestratorTurn(input('done'),dependencies),e=>e.code==='run_in_progress');assert.equal(s.admin.some(x=>x.name==='sa_v2_resolution_store'),false);
});
test('caller has no privileged metadata writer in the task store',async()=>{
 reset();const store=createTaskStore(client,s.access,uuid(4),'1');const before=await store.read();await store.begin(before,{disposition:'new',reason:'self_contained_request',message:'quote 1014'},'Finding quote');await store.finish('answered','Found quote');assert.deepEqual(s.calls.map(x=>x.name),['sa_v2_task_read']);assert.deepEqual(s.admin.map(x=>x.name),['sa_v2_task_begin','sa_v2_task_finish']);
});
test('metadata-only close calls no model, pricing, admission, finish or proposal RPC',async()=>{
 reset();const t=await closeTask(client,uuid(3),uuid(50),1,'solved');assert.equal(t.status,'closed');assert.deepEqual(s.calls.map(x=>x.name),['sa_v2_task_close']);assert.equal(s.admin.length,0);
});
for(const [code,expected]of [['42501','access_changed'],['P1721','task_changed'],['P1722','run_in_progress'],['PGRST202','migration_required']])test('close error stays distinct: '+code,async()=>{
 reset();s.closeError={code};await assert.rejects(closeTask(client,uuid(3),uuid(50),1,'solved'),e=>e.code===expected);
});
test('malformed checkpoint cannot become trusted state',()=>{
 reset();for(const invalid of [{...s.read,runIds:['foreign']},{...s.read,task:{...view(),version:-1}},{...s.read,pendingMessage:42},{...s.read,resolution:{id:uuid(1),state:{},expires_at:'tomorrow'}}])assert.throws(()=>decodeTaskSnapshot(invalid));
});
test('revoked or withheld snapshot may be null, not a fabricated active task',async()=>{reset();assert.equal(await taskSnapshot(client,uuid(3)),null);});

test('diagnostic logger failure does not change metadata or run outcome',async()=>{reset();const original=console.info;try{console.info=()=>{throw new Error('diagnostic sink offline');};const r=await runOrchestratorTurn(input('quote 1014'),dependencies);assert.equal(r.tokensIn,0);assert.match(r.content,/1014/);}finally{console.info=original;}});
