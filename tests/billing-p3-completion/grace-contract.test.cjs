require('../../tools/billing-p2/ts-runtime.cjs');
const test=require('node:test');
const assert=require('node:assert/strict');
const {parseUsageSnapshot}=require('../../app/lib/billing/custom/usage/contracts.ts');
const base={kind:'custom',available:true,reason:'available',accountId:'acct_fixture',mode:'test',subscriptionId:'sub_fixture',periodStart:'2026-09-12T00:00:00Z',periodEnd:'2026-10-12T00:00:00Z',quotesUsed:2,scanTokensUsed:6,assistantTasksUsed:3,storageUsedBytes:100,storagePendingBytes:0};

test('usage snapshot exposes an explicit DB-verified payment grace flag',()=>{
 const value=parseUsageSnapshot({...base,reason:'payment_grace',paymentGrace:true});
 assert.equal(value.paymentGrace,true);
 assert.equal(value.reason,'payment_grace');
});

test('older snapshots default payment grace to false',()=>{
 assert.equal(parseUsageSnapshot(base).paymentGrace,undefined);
});

test('malformed payment grace does not silently enable access',()=>{
 assert.throws(()=>parseUsageSnapshot({...base,paymentGrace:'yes'}),/purchased usage could not be verified/i);
});
