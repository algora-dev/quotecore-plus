/** Executes the actual route exports with dependency fixtures, not a live DB. */
require('./ts-hook.cjs');
const test=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {initialDemoGuide,acknowledge}=require('../../app/lib/demo/model.ts');
const {DemoError}=require('../../app/lib/demo/errors.ts');
const root=path.resolve(__dirname,'../..'),ID='11111111-1111-4111-8111-111111111111',OTHER='22222222-2222-4222-8222-222222222222';
function load(file,stubs){const full=path.join(root,file),m=new Module(full,module);m.filename=full;m.paths=module.paths;const fallback=Module.createRequire(full);m.require=name=>name in stubs?stubs[name]:fallback(name);m._compile(ts.transpileModule(fs.readFileSync(full,'utf8'),{fileName:full,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,full);return m.exports;}
function setup(){let state=initialDemoGuide({guided_roof_job:ID,maintenance_component:OTHER});const calls=[];const f={calls,body:{},state,failOrigin:false,prepareFailure:false,getError:null};
 const query={select(){return this},eq(){return this},single:async()=>({data:{slug:'demo-test'},error:f.getError})};
 const context=()=>({sessionId:'session-test',companyId:OTHER,tutorialState:f.state});
 const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
 const stubs={
 '@/app/lib/demo/http':{assertSameOrigin:()=>{calls.push('origin');if(f.failOrigin)throw new DemoError('Wrong origin',403)},requireDemoRequest:async()=>{calls.push('identity');return{context:context(),admin:{from:()=>query},client:{}}},readSmallJson:async()=>f.body,demoJson:json,demoErrorResponse:error=>json({error:error.message,code:error.code},error.status||500)},
 '@/app/lib/demo/assistant.server':{prepareDemoAssistant:async()=>{calls.push('prepareAssistant');if(f.prepareFailure)throw new DemoError('Not configured',503)}},
 '@/app/lib/demo/control':{getDemoControl:async()=>({aiEnabled:true})},
 '@/app/lib/demo/budget':{getDemoAllowance:async()=>({configured:true})},
 '@/app/lib/demo/progress':{mutateDemoGuide:async(_id,fn)=>{calls.push('mutate');f.state={...fn(f.state),revision:f.state.revision+1};return f.state;}},
 '@/app/lib/demo/self-send.server':{sendDemoQuote:async(ctx,email)=>{calls.push({send:email,quote:ctx.tutorialState.seed.guided_roof_job});return{acceptedByProvider:true};}},
 };
 f.guide=load('app/api/demo/state/route.ts',stubs);f.send=load('app/api/demo/self-send/route.ts',stubs);return f;
}
test('invalid Assistant chapter request does not rewrite permissions before denying',async()=>{const f=setup();f.body={action:'chapter',chapter:'smart-assistant'};const res=await f.guide.PATCH({});assert.equal(res.status,409);assert.ok(!f.calls.includes('prepareAssistant'));assert.ok(!f.calls.includes('mutate'));});
test('valid Assistant chapter prepares permissions then persists transition',async()=>{const f=setup();f.state=acknowledge(acknowledge(f.state,'takeoff.saved',ID),'quote.presentation',ID);f.body={action:'chapter',chapter:'smart-assistant'};const res=await f.guide.PATCH({});assert.equal(res.status,200);assert.deepEqual(f.calls,['origin','identity','prepareAssistant','mutate']);assert.equal((await res.json()).tutorialState.chapter,'smart-assistant');});
test('failed Assistant setup does not claim a successful transition',async()=>{const f=setup();f.state=acknowledge(acknowledge(f.state,'takeoff.saved',ID),'quote.presentation',ID);f.body={action:'chapter',chapter:'smart-assistant'};f.prepareFailure=true;assert.equal((await f.guide.PATCH({})).status,503);assert.equal(f.state.chapter,'pricing');assert.ok(!f.calls.includes('mutate'));});
test('origin failure occurs before identity, setup or mutation',async()=>{const f=setup();f.failOrigin=true;f.body={action:'chapter',chapter:'smart-assistant'};assert.equal((await f.guide.PATCH({})).status,403);assert.deepEqual(f.calls,['origin']);});
test('optional skip route writes only a skip, not a success acknowledgement',async()=>{const f=setup();f.state=acknowledge(acknowledge({...f.state,guided_created_component_id:ID},'component.created',ID),'component.tested',ID);f.body={action:'skip'};const res=await f.guide.PATCH({});assert.equal(res.status,200);assert.ok(f.state.skipped['component.edited']);assert.equal(f.state.acknowledgements['component.edited'],undefined);});
test('explicit wrong quote is rejected before calling the delivery service',async()=>{const f=setup();f.body={email:'visitor@example.invalid',quoteId:OTHER};assert.equal((await f.send.POST({})).status,409);assert.ok(!f.calls.some(x=>x.send));});
test('correct quote ID calls the scoped service exactly once',async()=>{const f=setup();f.body={email:'visitor@example.invalid',quoteId:ID};const res=await f.send.POST({});assert.equal(res.status,200);assert.deepEqual(f.calls.filter(x=>x.send),[{send:'visitor@example.invalid',quote:ID}]);});
test('legacy email-only caller remains compatible without selecting arbitrary quote IDs',async()=>{const f=setup();f.body={email:'visitor@example.invalid'};assert.equal((await f.send.POST({})).status,200);assert.equal(f.calls.find(x=>x.send).quote,ID);});
for(const body of [{email:'visitor@example.invalid',quoteId:null},{email:'visitor@example.invalid',token:'fake'},{email:35},{email:'visitor@example.invalid',companyId:OTHER}])test('invalid self-send body is rejected without delivery: '+JSON.stringify(body),async()=>{const f=setup();f.body=body;const res=await f.send.POST({});assert.ok(res.status>=400);assert.ok(!f.calls.some(x=>x.send));});
