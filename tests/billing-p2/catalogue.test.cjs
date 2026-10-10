require('../../tools/billing-p2/ts-runtime.cjs');
const test=require('node:test'),assert=require('node:assert/strict');
const {PREVIEW_CATALOG:c}=require('../../app/components/pricing/calculator/calculatorConfig.ts');
test('owner prices unchanged for core, capacity and Digital Takeoff',()=>{
 assert.equal(c.baseMonthlyCents,1900);assert.deepEqual(['low','medium','high'].map(x=>c.core[x].capacityCents),[1000,2000,4000]);assert.equal(c.digital.monthlyCents,2000);
});
test('owner Scan, Offcuts and Assistant prices unchanged',()=>{
 assert.deepEqual(['low','medium','high'].map(x=>c.scan[x].monthlyCents),[1000,3000,8000]);assert.deepEqual(['low','medium','high'].map(x=>c.offcuts[x].monthlyCents),[1000,2000,4000]);
 assert.deepEqual(['light','regular','heavy'].map(x=>c.assistant[x].monthlyCents),[2000,4000,6000]);
});
test('owner allowance amounts unchanged',()=>{
 assert.deepEqual(['low','medium','high'].map(x=>[c.core[x].quotes,c.core[x].storageBytes,c.scan[x].tokens]),[[5,1e9,50],[20,3e9,150],[100,10e9,400]]);
 assert.deepEqual(['light','regular','heavy'].map(x=>c.assistant[x].tasks),[200,400,1500]);
});
test('customer copy names creation, drafts, copies and no delete refund',()=>{
 assert.match(c.shareRule,/Each new quote counts once/);assert.match(c.shareRule,/drafts and copies/);assert.match(c.shareRule,/Deleting it does not restore/);
});
