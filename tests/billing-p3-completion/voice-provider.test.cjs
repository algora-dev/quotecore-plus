require('../../tools/billing-p2/ts-runtime.cjs');
const test=require('node:test');const assert=require('node:assert/strict');
const {withVoiceProviderBudget}=require('../../app/lib/billing/custom/usage/voice-provider.ts');

function client(sequence){const calls=[];return {calls,rpc:async(name,args)=>{calls.push({name,args});const next=sequence.shift();if(next instanceof Error)throw next;return next??{data:{},error:null};}}}
const base={companyId:'11111111-1111-4111-8111-111111111111',userId:'22222222-2222-4222-8222-222222222222',accountId:'acct_fixture',mode:'test',requestKey:'voice_request_0001',payloadHash:'a'.repeat(64),audioBytes:1000,reservedMicroUsd:250};

test('voice reserves internal spend and never creates a customer task',async()=>{
 const c=client([{data:{id:'33333333-3333-4333-8333-333333333333',reservedMicroUsd:250},error:null},{data:{accounted:true,overrun:false,uncertain:true},error:null}]);let ran=0;
 const value=await withVoiceProviderBudget({...base,client:c,execute:async signal=>{ran++;assert.equal(signal.aborted,false);return {value:'hello',actualMicroUsd:null}}});
 assert.equal(value,'hello');assert.equal(ran,1);assert.deepEqual(c.calls.map(x=>x.name),['qcp_begin_voice_call','qcp_finish_voice_call']);
 assert.equal(c.calls.some(x=>/task/i.test(x.name)),false);assert.equal(c.calls[1].args.p_actual_micro_usd,null);
});

test('voice admission refusal never calls provider',async()=>{
 const c=client([{data:null,error:{code:'QCP08'}}]);let ran=0;
 await assert.rejects(()=>withVoiceProviderBudget({...base,client:c,execute:async()=>{ran++;return {value:'x'}}}));assert.equal(ran,0);
});

test('provider failure retains reserved ceiling as uncertain',async()=>{
 const c=client([{data:{id:'33333333-3333-4333-8333-333333333333',reservedMicroUsd:250},error:null},{data:{accounted:true,overrun:false,uncertain:true},error:null}]);
 await assert.rejects(()=>withVoiceProviderBudget({...base,client:c,execute:async()=>{throw new Error('provider down')}}),/provider down/);
 assert.equal(c.calls[1].args.p_actual_micro_usd,null);
});

test('provider overrun returns completed transcript and leaves DB review marker',async()=>{
 const c=client([{data:{id:'33333333-3333-4333-8333-333333333333',reservedMicroUsd:250},error:null},{data:{accounted:true,overrun:true,uncertain:false},error:null}]);
 const value=await withVoiceProviderBudget({...base,client:c,execute:async()=>({value:'done',actualMicroUsd:300})});assert.equal(value,'done');assert.equal(c.calls[1].args.p_actual_micro_usd,300);
});

for(const [field,value] of [['audioBytes',0],['reservedMicroUsd',0],['payloadHash','bad'],['requestKey','x']]) test(`invalid ${field} fails before RPC`,async()=>{
 const c=client([]);await assert.rejects(()=>withVoiceProviderBudget({...base,[field]:value,client:c,execute:async()=>({value:'x'})}));assert.equal(c.calls.length,0);
});
