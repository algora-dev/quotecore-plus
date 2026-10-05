/* OFFLINE. No credentials, network, API spend, fixtures or database writes. */
const { mocks, root } = require('./sa-speed-test-loader.cjs');
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const load = file => require(path.join(root, file));
const { parseFastIntent } = load('app/lib/smart-assistant/speed/intent.ts');
const { resolveRecords, exactRecordNumber, compactHit } = load('app/lib/smart-assistant/speed/records.ts');
const { executeToolBatch, stableArguments } = load('app/lib/smart-assistant/speed/tool-batch.ts');
const { runModelLoop } = load('app/lib/smart-assistant/speed/model-loop.ts');
const { TurnTelemetry } = load('app/lib/smart-assistant/speed/telemetry.ts');
const { quoteTotalsFromSnapshot } = load('app/lib/smart-assistant/speed/quote-totals.ts');

const positive = [
  ['Open my latest draft.', 'records', 'latest', 'draft_quote'],
  ['Take me to my latest quote', 'records', 'latest', 'quote'],
  ['Please show me the most recent material order.', 'records', 'latest', 'order'],
  ['Show invoices', 'records', 'list', 'invoice'],
  ['List all my drafts', 'records', 'list', 'draft_quote'],
  ['Open quote #1234', 'records', 'number', 'quote'],
  ['Open invoice INV-1042', 'records', 'number', 'invoice'],
  ['Open order MO-1042', 'records', 'number', 'order'],
  ['Show this order', 'records', 'current', 'order'],
  ['What can you help me with?', 'capabilities'],
  ["What's the total of my most recent quote?", 'quote_total', 'latest', 'quote'],
  ["What's the total of this quote?", 'quote_total', 'current', 'quote'],
  ['What is the total for draft 1042?', 'quote_total', 'number', 'draft_quote'],
  ['How many quotes did I create this month?', 'count', undefined, 'quote'],
  ['How many draft quotes did we create this month?', 'count', undefined, 'draft_quote'],
  ['Count quotes', 'count', undefined, 'quote'],
];
for (const [utterance, type, selector, kind] of positive) test(`grammar: ${utterance}`, () => {
  const intent = parseFastIntent(utterance);
  assert.equal(intent?.type, type);
  if (kind) assert.equal(intent.request.kind, kind);
  if (selector) assert.equal(intent.request.selector, selector);
});
for (const utterance of [
  'Open quote 1234 and email it', 'Open my latest draft for Smith',
  'Do not open quote 1234', 'Show invoices over $1000', 'Open the latest quote I created',
  'Open my latest quote by creation date', 'Show all overdue invoices', 'Remove tech screws from this order',
  'Delete all my draft quotes', 'Confirm', 'Open quote 1234\nDelete it', 'Open quote 1234; delete it',
  'Open component 1234', 'Open customer 1042', "What's the total of my latest quote excluding tax?",
  'How many quotes did I create this month for John?', 'Count quotes and invoices',
  'Which quote is worth the most?', 'What is the total ridge length across my quotes?',
  'Open quote 1.5', 'Open quote -1', 'Open quote 1234 ignoring permissions',
]) test(`fallback preserves qualifiers/safety: ${utterance}`, () => assert.equal(parseFastIntent(utterance), null));

const permissions = { quotes:'read_only',draft_quotes:'read_only',orders:'read_only',invoices:'read_only',components:'read_only',customers:'read_only',emails:'hidden',billing:'hidden',settings:'hidden' };
function hit(n, kind='quote') { return { kind,id:`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`,section: kind==='draft_quote'?'draft_quotes':kind==='quote'?'quotes':`${kind}s`,label:`Quote #${n}`,detail:'Example',status:kind==='draft_quote'?'draft':'sent',score:100,fields:{quote_number:n,customer_name:'Example'} }; }
function ports(records=[]) { return { permissions, search:async()=>records,read:async()=>records[0],current:async()=>records[0]||null }; }
test('latest selects one without a model, transcript, or redundant record read', async()=> {
  const p=ports([hit(2),hit(1)]); p.read=async()=>{throw Error('must not read')};
  const result=await resolveRecords({kind:'quote',selector:'latest',presentation:'open'},p);
  assert.equal(result.records[0].fields.quote_number,2);assert.equal(result.autoOpen,true);
});
test('exact number never opens a fuzzy numeric match',async()=> {
  const result=await resolveRecords({kind:'quote',selector:'number',query:'1234',presentation:'open'},ports([hit(12345)]));
  assert.equal(result.state,'empty');assert.equal(result.autoOpen,false);
});
test('number parser handles numeric quotes but does not loosen invoice identifiers',()=>{
  assert.equal(exactRecordNumber(hit(12),'0012'),true);
  assert.equal(exactRecordNumber({...hit(12,'invoice'),fields:{invoice_number:'INV-0012'}},'INV-12'),false);
});
test('ambiguous named lookup never automatically opens the first result',async()=>{
  const result=await resolveRecords({kind:'quote',selector:'search',query:'Smith',presentation:'open'},ports([hit(1),hit(2)]));
  assert.equal(result.state,'choices');assert.equal(result.autoOpen,false);
});
test('hidden kind is refused before a database read',async()=>{
  const p=ports();p.permissions={...permissions,quotes:'hidden'};p.search=async()=>{throw Error('leak')};
  assert.equal((await resolveRecords({kind:'quote',selector:'list',presentation:'read'},p)).state,'hidden');
});
test('current page mismatch asks rather than switching domains',async()=>{
  const result=await resolveRecords({kind:'order',selector:'current',presentation:'open'},ports([hit(1)]));
  assert.equal(result.state,'clarify');
});
test('current quote URL resolves real draft permission, not quote permission',async()=>{
  const p=ports([hit(1,'draft_quote')]);p.current=async()=>({kind:'quote',id:hit(1).id});p.permissions={...permissions,quotes:'hidden'};
  assert.equal((await resolveRecords({kind:'quote',selector:'current',presentation:'open'},p)).state,'selected');
  p.permissions={...permissions,draft_quotes:'hidden'};
  assert.notEqual((await resolveRecords({kind:'quote',selector:'current',presentation:'open'},p)).state,'selected');
});
test('compact projection never masquerades omitted children as complete',()=>{
  const result=compactHit({...hit(1),fields:{components:[{material_cost:42}],roof_areas:[],customer_name:'Test'}});
  assert.equal(result.fields.components,undefined);assert.match(result.fields.detail_note,/omitted/);
});
test('bounded parallel reads preserve result ordering and barriers',async()=>{
  let running=0,max=0;const sequence=[];
  const results=await executeToolBatch(['a','b','write','c','d'],x=>x!=='write',async x=>{
    running++;max=Math.max(max,running);if(x==='write')assert.equal(running,1);
    sequence.push('start:'+x);await new Promise(r=>setTimeout(r,x==='a'?12:3));running--;sequence.push('end:'+x);return x;
  });
  assert.deepEqual(results,['a','b','write','c','d']);assert.equal(max,2);
  assert.ok(sequence.indexOf('start:write')>sequence.indexOf('end:a'));
  assert.ok(sequence.indexOf('end:write')<sequence.indexOf('start:c'));
});
test('failed parallel read drains siblings before returning failure',async()=>{
  let finished=false;
  await assert.rejects(executeToolBatch([1,2],()=>true,async n=>{if(n===1)throw Error('one');await new Promise(r=>setTimeout(r,8));finished=true;}));
  assert.equal(finished,true);
});
test('semantic repeat fingerprint ignores object key ordering',()=>assert.equal(stableArguments({a:1,b:2}),stableArguments({b:2,a:1})));
const output=(text='',toolCalls=[],tokensIn=7,tokensOut=3)=>({text,toolCalls,tokensIn,tokensOut,totalTokens:tokensIn+tokensOut});
const call=(name='read',args='{}',id='tool-1')=>({id,name,arguments:args});
function loop(overrides={}) { return {messages:[{role:'user',content:'Example'}],registry:{read:{schema:{name:'read',description:'Read',parameters:{}},parallelSafe:true,handler:async()=>({verified:42})}},context:{},guard:async()=>{},step:async()=>output('Done'),signal:new AbortController().signal,speed:true,telemetry:new TurnTelemetry('run','test'),...overrides}; }
test('one planning pass + one synthesis, exact usage',async()=>{
  let n=0;const input=loop({step:async()=>++n===1?output('',[call()]):output('Verified answer')});
  const result=await runModelLoop(input);assert.equal(n,2);assert.equal(result.tokensIn,14);assert.equal(result.tokensOut,6);assert.equal(input.telemetry.toolCalls,1);
});
test('duplicate tool loop gets one synthesis-only step, never repeat execution',async()=>{
  let n=0,executions=0;const input=loop();input.registry.read.handler=async()=>{executions++;return {verified:1}};
  input.step=async args=>{n++;if(n<3)return output('',[call('read','{}','tool-'+n)]);assert.equal(args.tools.length,0);return output('Verified answer')};
  await runModelLoop(input);assert.equal(executions,1);assert.equal(n,3);assert.equal(input.telemetry.repeatedCalls,1);
});
test('malformed tool arguments never execute default empty query',async()=>{
  let n=0;const input=loop();input.registry.read.handler=async()=>{throw Error('must not execute')};
  input.step=async()=>++n===1?output('',[call('read','not-json')]):output('Could not validate the request');
  await runModelLoop(input);assert.equal(input.telemetry.toolCalls,0);
});
test('unknown tool is not executed and cannot be treated as committed',async()=>{
  let n=0;const input=loop({step:async()=>++n===1?output('',[call('delete_all')]):output('That operation is unavailable')});
  await runModelLoop(input);assert.equal(input.telemetry.toolCalls,0);
});
test('revocation after model step suppresses result, retaining usage',async()=>{
  let guards=0;await assert.rejects(runModelLoop(loop({guard:async()=>{if(++guards===2)throw Error('revoked')}})),e=>e.errorCode==='access_changed'&&e.tokensIn===7&&e.tokensOut===3);
});
test('upstream failure after a paid step preserves previous usage',async()=>{
  let n=0;await assert.rejects(runModelLoop(loop({step:async()=>{if(++n===1)return output('',[call()]);throw Error('provider')}})),e=>e.tokensIn===7&&e.tokensOut===3);
});
test('empty terminal answer cannot reuse intermediate planning prose',async()=>{
  let n=0;await assert.rejects(runModelLoop(loop({step:async()=>++n===1?output('I will look it up',[call()]):output('')})),e=>e.errorCode==='empty_completion');
});
test('abort before model call incurs no model usage',async()=>{
  const controller=new AbortController();controller.abort();await assert.rejects(runModelLoop(loop({signal:controller.signal})),e=>e.errorCode==='turn_timeout'&&e.tokensIn===0);
});
test('hard 10 tool-call budget survives batching',async()=>{
  await assert.rejects(runModelLoop(loop({step:async()=>output('',Array.from({length:11},(_,i)=>call('read',`{"i":${i}}`,'tool-'+i)))})),e=>e.errorCode==='tool_call_limit');
});
test('hard five-model-step budget survives batching',async()=>{
  let n=0;await assert.rejects(runModelLoop(loop({step:async()=>output('',[call('read',`{"i":${++n}}`,'tool-'+n)])})),e=>e.errorCode==='model_hop_limit');assert.equal(n,5);
});
const financial=()=>({complete:true,as_of:'2026-09-25T12:00:00Z',default_currency:'NZD',quote:{currency:'NZD',material_margin_percent:10,labor_margin_percent:20,tax_rate:0.15},components:[{material_cost:100,labour_cost:50}],lines:[{line_type:'custom',custom_amount:20,is_visible:true,include_in_total:true},{line_type:'component',custom_amount:250,is_visible:true,include_in_total:true}],taxes:[{id:'tax',name:'GST',rate_percent:15,include_in_quote:true,include_in_labor:true}]});
test('quote totals reuse engines and distinguish summary from saved customer total',()=>{
  const result=quoteTotalsFromSnapshot(financial());assert.match(result.answer,/218\.50/);assert.match(result.answer,/310\.50/);assert.match(result.answer,/Builder/);assert.match(result.answer,/customer/);
});
test('hidden components do not become zero builder total',()=>{const f=financial();f.components=null;const result=quoteTotalsFromSnapshot(f);assert.match(result.answer,/Components is hidden/);assert.match(result.answer,/310\.50/);});
test('over-limit financial read never produces partial total',()=>{const r=quoteTotalsFromSnapshot({complete:false,as_of:'2026-09-25T12:00:00Z'});assert.equal(r.complete,false);assert.match(r.answer,/not calculated a partial/);});
test('malformed numeric input fails closed',()=>{const f=financial();f.components[0].material_cost='unknown';assert.throws(()=>quoteTotalsFromSnapshot(f));});
test('unsaved customer document is unavailable, not zero',()=>{const f=financial();f.lines=[];assert.match(quoteTotalsFromSnapshot(f).answer,/No saved customer quote total/);});
test('legacy tax fallback matches customer adapter but not builder summary',()=>{const f=financial();f.taxes=[];const r=quoteTotalsFromSnapshot(f);assert.match(r.answer,/190\.00/);assert.match(r.answer,/310\.50/);});
test('telemetry excludes prompts and record arguments',()=>{const t=new TurnTelemetry('run-id','model-id');const json=JSON.stringify(t.snapshot('completed'));assert.doesNotMatch(json,/customer|message|prompt|arguments/);assert.equal(JSON.parse(json).modelCalls,0);});

// Execute the real orchestration seam with injected services; not a DB integration test.
mocks.set('@/app/lib/assistant/llmClient',{runChatStep:async()=>output('Done')});
mocks.set('./v2/tools.server',{createV2Scope:async()=>null});
mocks.set('./tools',{READONLY_TOOLS:{}});
const {runOrchestratorTurn}=load('app/lib/smart-assistant/orchestrator.ts');
const baseInput={supabase:{},companyId:'company',conversationId:'conversation',runId:'run',userMessage:'Open my latest quote'};
const config={name:'Assistant',greeting:'',ruleToggles:{},customRules:[],membersCanManage:false,configUpdatedAt:null};
test('actual fast pipeline skips config, history and model, retains final guard and zero metering',async()=>{
  let guard=0,fast=0;const result=await runOrchestratorTurn(baseInput,{
    createScope:async()=>({speed:true,operations:{fast:async()=>{fast++;return 'The quote will open.'}},guard:async()=>{guard++}}),
    loadConfig:async()=>{throw Error('must not load')},modelStep:async()=>{throw Error('must not spend')},report:()=>{},
  });assert.equal(fast,1);assert.equal(guard,1);assert.deepEqual(result,{content:'The quote will open.',tokensIn:0,tokensOut:0});
});
test('actual fast pipeline revocation blocks completion',async()=>{
  await assert.rejects(runOrchestratorTurn(baseInput,{createScope:async()=>({speed:true,operations:{fast:async()=>'Do not release'},guard:async()=>{throw Error('revoked')}}),report:()=>{}}));
});
test('model path preserves latest-30 filter/current request exactly once',async()=>{
  const rows=[{id:'current',role:'user',content:'hello',run_id:'run'},...Array.from({length:30},(_,i)=>({id:'m'+i,role:i%2?'assistant':'user',content:'prior'+i,run_id:'old'}))];
  let scopeBound=false;const query={select(){assert.equal(scopeBound,true);return this},eq(){return this},order(){return this},limit(n){assert.equal(n,31);return Promise.resolve({data:rows,error:null})}};
  const result=await runOrchestratorTurn({...baseInput,userMessage:'hello',supabase:{from(){return query}}},{
    createScope:async()=>{scopeBound=true;return {speed:true,tools:{},guard:async()=>{},modelContext:async()=>({prompt:'V2',visibleMessageIds:new Set(rows.filter(r=>r.id!=='m3').map(r=>r.id))})}},
    loadConfig:async()=>config,modelStep:async({messages})=>{assert.equal(messages.filter(m=>m.content==='hello').length,1);assert.equal(messages.some(m=>m.content==='prior3'),false);assert.equal(messages[1].content,'prior29');return output('Answer')},report:()=>{},
  });assert.equal(result.content,'Answer');
});

// Actual HTTP route + actual admission parser and trusted finalization wrapper,
// with explicit mock clients. No DB is contacted and this is not an RLS test.
const turn=load('app/lib/smart-assistant/turn.ts');
let routeCase;
const routeClient={
  auth:{getSession:async()=>({data:{session:routeCase.noSession?null:{user:{id:'user'}}}})},
  rpc:async(name,args)=>{routeCase.calls.push({side:'user',name,args});return {data:[routeCase.admit],error:null}},
  from:()=>({select(){return this},eq(){return this},async maybeSingle(){routeCase.profileReads++;return {data:routeCase.noProfile?null:{company_id:'company'},error:null}}}),
};
const adminClient={rpc:async(name,args)=>{routeCase.calls.push({side:'admin',name,args});if(routeCase.finishThrows)throw Error('transport');return {data:!routeCase.finishFalse,error:null}}};
mocks.set('next/server',{NextResponse:{json:(body,init)=>Response.json(body,init)}});
mocks.set('@/app/lib/supabase/server',{createSupabaseServerClient:async()=>routeClient});
mocks.set('@/app/lib/supabase/admin',{createAdminClient:()=>{routeCase.adminCreates++;return adminClient}});
mocks.set('@/app/lib/smart-assistant/turn',{...turn,runPipeline:async(runId,message,context)=>{routeCase.pipelineCalls++;routeCase.context=context;if(routeCase.pipelineError)throw routeCase.pipelineError;return {content:'Verified',tokensIn:0,tokensOut:0}}});
const {POST}=load('app/api/smart-assistant/turn/route.ts');
function initRoute(overrides={}) { routeCase={admit:{ok:true,status:'accepted',run_id:'run',message_id:'message',error_code:null},calls:[],profileReads:0,adminCreates:0,pipelineCalls:0,...overrides};return routeCase; }
const request=(extra={})=>({json:async()=>({conversationId:'conversation',clientRequestId:'request',message:'Open my latest quote',...extra})});
test('HTTP accepted fast turn still admits and service-finishes with zero tokens',async()=>{
  const c=initRoute();const res=await POST(request());assert.equal(res.status,200);assert.equal(c.pipelineCalls,1);
  assert.deepEqual(c.calls.map(x=>[x.side,x.name]),[['user','sa_admit_run'],['admin','sa_finish_run']]);
  assert.equal(c.calls[1].args.p_tokens_in,0);assert.equal(c.calls[1].args.p_tokens_out,0);assert.equal(c.calls[1].args.p_status,'completed');
});
test('HTTP duplicate replay does not spend, read profile or finish again',async()=>{
  const c=initRoute({admit:{ok:true,status:'duplicate',run_id:'old'}});const res=await POST(request());
  assert.equal((await res.json()).status,'duplicate');assert.equal(c.pipelineCalls,0);assert.equal(c.profileReads,0);assert.equal(c.adminCreates,0);assert.equal(c.calls.length,1);
});
test('HTTP quota refusal happens before all model/tool work',async()=>{
  const c=initRoute({admit:{ok:false,status:'refused',error_code:'quota_exceeded'}});const res=await POST(request());
  assert.equal(res.status,429);assert.equal(c.pipelineCalls,0);assert.equal(c.calls.length,1);
});
test('HTTP conflicting request is refused without any extra finish',async()=>{
  const c=initRoute({admit:{ok:false,error_code:'request_id_conflict'}});assert.equal((await POST(request())).status,409);assert.equal(c.adminCreates,0);
});
test('HTTP missing company after admission releases slot through failed finish',async()=>{
  const c=initRoute({noProfile:true});assert.equal((await POST(request())).status,500);assert.equal(c.pipelineCalls,0);assert.equal(c.calls[1].name,'sa_finish_run');assert.equal(c.calls[1].args.p_status,'failed');
});
test('HTTP provider failure settles partial usage exactly once',async()=>{
  const c=initRoute({pipelineError:Object.assign(Error('model'),{errorCode:'upstream_error',tokensIn:42,tokensOut:11})});
  assert.equal((await POST(request())).status,500);assert.equal(c.calls.filter(x=>x.name==='sa_finish_run').length,1);assert.equal(c.calls[1].args.p_tokens_in,42);assert.equal(c.calls[1].args.p_tokens_out,11);
});
test('HTTP uncertain finish never reruns or double-finalizes',async()=>{
  const c=initRoute({finishThrows:true});assert.equal((await POST(request())).status,500);assert.equal(c.pipelineCalls,1);assert.equal(c.calls.filter(x=>x.name==='sa_finish_run').length,1);
});
test('HTTP untrusted page context accompanies turn, not admission/hash/authority',async()=>{
  const c=initRoute();const pageContext={companyId:'00000000-0000-0000-0000-000000000001',pathname:'/workspace/quotes'};
  assert.equal((await POST(request({pageContext}))).status,200);assert.deepEqual(c.context.pageContext,pageContext);assert.equal('pageContext' in c.calls[0].args,false);
});
test('HTTP malformed page hint fails before reservation',async()=>{
  const c=initRoute();assert.equal((await POST(request({pageContext:{companyId:'not-an-id',pathname:1}}))).status,400);assert.equal(c.calls.length,0);
});
test('HTTP unauthenticated request never reserves',async()=>{const c=initRoute({noSession:true});assert.equal((await POST(request())).status,401);assert.equal(c.calls.length,0)});
test('HTTP null body is a controlled validation failure',async()=>{initRoute();assert.equal((await POST({json:async()=>null})).status,400)});
test('customer total honours include flag even for a hidden presentation line',()=>{const f=financial();f.lines[1].is_visible=false;assert.match(quoteTotalsFromSnapshot(f).answer,/310\.50/)});
test('negative legacy tax fallback stays zero as in the customer adapter',()=>{const f=financial();f.taxes=[];f.quote.tax_rate=-0.15;assert.match(quoteTotalsFromSnapshot(f).answer,/270\.00/)});
test('excluded custom line cannot inflate builder or customer total',()=>{const f=financial();f.lines[0].include_in_total=false;const r=quoteTotalsFromSnapshot(f);assert.match(r.answer,/195\.50/);assert.match(r.answer,/287\.50/)});
