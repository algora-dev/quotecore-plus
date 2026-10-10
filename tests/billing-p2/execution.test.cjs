require('../../tools/billing-p2/ts-runtime.cjs');
const test=require('node:test'), assert=require('node:assert/strict');
const {executePurchasedScan}=require('../../app/lib/billing/custom/usage/scan-execution.ts');
const {parseScanRequest}=require('../../app/lib/billing/custom/usage/scan-contract.ts');
const {withAssistantProviderBudget}=require('../../app/lib/billing/custom/usage/assistant-provider.ts');
const {UsageError}=require('../../app/lib/billing/custom/usage/contracts.ts');
const scope={companyId:'11111111-1111-4111-8111-111111111111',accountId:'acct_test',mode:'test'};
const id='22222222-2222-4222-8222-222222222222';
const request=parseScanRequest({stage:'scan1',quoteId:scope.companyId,image:'image',qualityLevel:'high'},'attempt_0001');
function client(results) { const calls=[];return {calls, async rpc(name,args) { calls.push({name,args}); const r=results.shift(); if(r instanceof Error) throw r; if(!r) throw new Error('unexpected RPC '+name); return r; }}; }
const ok=data=>({data,error:null});
const accepted=ok({decision:'accepted',id,cost:12});
const finished=ok({state:'consumed'});
test('scan reserves before provider and completes exact operation',async()=>{
 const db=client([accepted,finished]);let n=0;
 const response=await executePurchasedScan(scope,request,db,async()=>{assert.equal(db.calls[0].name,'qcp_begin_scan');n++;return Response.json({success:true,data:{roof_areas:[]}})});
 assert.equal(n,1);assert.equal(response.status,200);assert.equal(db.calls[1].args.p_event_id,id);assert.equal(db.calls[1].args.p_succeeded,true);assert.equal((await response.json()).billingOperationId,id);
});
for (const code of ['QCP01','QCP02','QCP03','QCP05','42501','22023']) test(`scan ${code} admission refusal never calls provider`,async()=>{
 const db=client([{data:null,error:{code}}]);let calls=0;
 await assert.rejects(executePurchasedScan(scope,request,db,async()=>{calls++;return Response.json({success:true})}),UsageError);assert.equal(calls,0);assert.equal(db.calls.length,1);
});
test('database transport failure before admission never calls provider',async()=>{
 let calls=0;await assert.rejects(executePurchasedScan(scope,request,client([new Error('offline')]),async()=>{calls++;return new Response()}));assert.equal(calls,0);
});
for (const state of ['reserved','refunded']) test(`${state} replay does not rerun model`,async()=>{
 let n=0;const db=client([ok({decision:'replay',id,state})]);const response=await executePurchasedScan(scope,request,db,async()=>{n++;return new Response()});
 assert.equal(response.status,409);assert.equal(n,0);assert.equal(db.calls.length,1);
});
test('successful replay returns saved result with no second debit or provider work',async()=>{
 const db=client([ok({decision:'replay',id,state:'consumed',response:{httpStatus:200,body:{success:true,data:{id:'saved'}}}})]);
 const r=await executePurchasedScan(scope,request,db,async()=>{throw new Error('must not execute')});assert.equal((await r.json()).data.id,'saved');assert.equal(db.calls.length,1);
});
test('unverifiable replay stops rather than inventing result or running again',async()=>{
 const db=client([ok({decision:'replay',id,state:'consumed',response:null})]);await assert.rejects(executePurchasedScan(scope,request,db,async()=>new Response()),/recovered/);
});
for (const failure of ['throw','invalidJSON','httpFailure']) test(`scan ${failure} settles original operation as refundable`,async()=>{
 const db=client([accepted,ok({state:'refunded'})]);const r=await executePurchasedScan(scope,request,db,async()=>{
 if(failure==='throw')throw new Error('provider');if(failure==='invalidJSON')return new Response('oops');return Response.json({success:false},{status:502});
 });assert.equal(r.status,502);assert.equal(db.calls[1].args.p_succeeded,false);assert.equal(db.calls[1].args.p_event_id,id);
});
test('unknown finish acknowledgement never reruns provider or releases reservation',async()=>{
 const db=client([accepted,new Error('lost database response')]);let n=0;
 await assert.rejects(executePurchasedScan(scope,request,db,async()=>{n++;return Response.json({success:true})}));assert.equal(n,1);assert.equal(db.calls.length,2);
});
test('custom durable result excludes debug plan images',async()=>{
 const db=client([accepted,finished]);const r=await executePurchasedScan(scope,request,db,async()=>Response.json({success:true,debugImages:{input:'private-plan'},data:{roof_areas:[]}}));
 assert.equal((await r.json()).debugImages,undefined);assert.doesNotMatch(JSON.stringify(db.calls[1]),/private-plan/);
});
test('incomplete component result is refunded rather than granting an unbound free tail',async()=>{
 const r2=parseScanRequest({...request.body,stage:'scan2',outlinePoints:[{x:0,y:0},{x:1,y:0},{x:0,y:1}],analysisDimensions:{width:2,height:2}},'attempt_0002');
 const db=client([accepted,ok({state:'refunded'})]);const r=await executePurchasedScan(scope,r2,db,async()=>Response.json({success:true,data:{lines:[]}}));assert.equal(r.status,502);assert.equal(db.calls[1].args.p_tail_hash,null);assert.equal(db.calls[1].args.p_succeeded,false);
});
function providerInput(db,execute) {return {companyId:scope.companyId,runId:id,accountId:scope.accountId,mode:scope.mode,callKey:'model-call-1',providerRequest:{prompt:'server generated'},inputTokenUpperBound:100,maxOutputTokens:50,timeoutMs:1000,client:db,execute};}
const beginCall=ok({id,maxOutputTokens:50});
test('provider reserves full bound before work and settles measured tokens',async()=>{
 const db=client([beginCall,ok({settled:true,overrun:false})]);const value=await withAssistantProviderBudget(providerInput(db,async({signal,maxOutputTokens})=>{
 assert.equal(db.calls[0].args.p_reserved_tokens,150);assert.equal(maxOutputTokens,50);assert.ok(signal instanceof AbortSignal);return {value:'answer',totalTokens:61};
 }));assert.equal(value,'answer');assert.equal(db.calls[1].args.p_actual_tokens,61);
});
for (const code of ['QCP08','QCP03','QCP01']) test(`provider ${code} refusal never runs billable call`,async()=>{
 const db=client([{data:null,error:{code}}]);let n=0;await assert.rejects(withAssistantProviderBudget(providerInput(db,async()=>{n++;return {value:0,totalTokens:0}})));assert.equal(n,0);
});
test('provider exception retains ceiling as unknown usage, not zero',async()=>{
 const db=client([beginCall,ok({settled:false,overrun:false})]);await assert.rejects(withAssistantProviderBudget(providerInput(db,async()=>{throw new Error('timeout')})),/timeout/);
 assert.equal(db.calls[1].args.p_actual_tokens,null);
});
test('provider missing actual usage retains ceiling',async()=>{
 const db=client([beginCall,ok({settled:false})]);await assert.rejects(withAssistantProviderBudget(providerInput(db,async()=>({value:'x',totalTokens:null}))));assert.equal(db.calls[1].args.p_actual_tokens,null);
});
test('provider failure plus lost settlement leaves reserved budget instead of granting spend',async()=>{
 const db=client([beginCall,new Error('db offline')]);await assert.rejects(withAssistantProviderBudget(providerInput(db,async()=>{throw new Error('provider offline')})),/provider offline/);assert.equal(db.calls.length,2);
});
test('overrun triggers operational review rather than selling extra customer tasks',async()=>{
 const db=client([beginCall,ok({settled:true,overrun:true})]);await assert.rejects(withAssistantProviderBudget(providerInput(db,async()=>({value:'x',totalTokens:500}))),e=>e.code==='provider_budget_review_required');assert.equal(db.calls[1].args.p_actual_tokens,500);
});
test('lost success settlement does not automatically execute another provider call',async()=>{
 const db=client([beginCall,new Error('uncertain')]);let n=0;await assert.rejects(withAssistantProviderBudget(providerInput(db,async()=>{n++;return {value:'x',totalTokens:61}})));assert.equal(n,1);assert.equal(db.calls.length,2);
});
for (const [k,v] of [['inputTokenUpperBound',-1],['maxOutputTokens',0],['timeoutMs',0],['timeoutMs',180001]]) test(`invalid provider ${k} fails before RPC`,async()=>{
 const db=client([]);await assert.rejects(withAssistantProviderBudget({...providerInput(db,async()=>({value:0,totalTokens:0})),[k]:v}));assert.equal(db.calls.length,0);
});
test('database response cannot silently change output bound',async()=>{
 const db=client([ok({id,maxOutputTokens:100})]);let n=0;await assert.rejects(withAssistantProviderBudget(providerInput(db,async()=>{n++;return {value:1,totalTokens:2}})));assert.equal(n,0);
});
