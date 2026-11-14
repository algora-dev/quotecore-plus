#!/usr/bin/env node
/** Offline integrity test for the exact v3 practice-priced starter data and SQL migration. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const catalog = JSON.parse(fs.readFileSync(path.join(root,'app/lib/pricing-setup/starter-catalog.json'),'utf8'));
const examples = JSON.parse(fs.readFileSync(path.join(root,'app/lib/pricing-setup/starter-practice-examples.json'),'utf8'));
const v2Sql = fs.readFileSync(path.join(root,'backend/supabase/migrations/20261114180000_pricing_starter_libraries.sql'),'utf8');
const v3Sql = fs.readFileSync(path.join(root,'backend/supabase/migrations/20261114190000_pricing_starter_practice_prices.sql'),'utf8');
const expected = new Map([['asphalt-shingles',7],['long-run-metal',7],['concrete-tile',8],['natural-slate',8],['low-slope-tpo',5]]);
assert.equal(catalog.schemaVersion,3);
assert.equal(examples.schemaVersion,'3.0.0');
assert.equal(examples.currency,'USD');
assert.equal(examples.status,'RESEARCHED_PRACTICE_PRICING_NOT_FOR_REAL_QUOTES');
assert.equal(examples.priceBasis,'illustrative_direct_cost_allocation');
assert.equal(catalog.libraries.length,5);
assert.equal(examples.libraries.length,5);
const seen=new Set();
const allowedMeasurement=new Set(['area','lineal','quantity','fixed','quantity_by_spacing']);
const allowedPitch=new Set(['none','rafter','valley_hip']);
let count=0;
for(const lib of examples.libraries){
 assert.equal(lib.items.length,expected.get(lib.slug),`${lib.slug}: correct component count`);
 assert.equal(lib.version,3);
 assert.equal(lib.practicePricing,true);
 const descriptor=catalog.libraries.find(l=>l.slug===lib.slug);
 assert.ok(descriptor,`${lib.slug}: catalog entry exists`);
 assert.equal(descriptor.items.length,lib.items.length);
 assert.ok(v3Sql.includes(`'${lib.slug}'`),`SQL seeds ${lib.slug}`);
 for(const [index,item] of lib.items.entries()){
  const key=`${lib.slug}/${item.code}`;
  assert.ok(!seen.has(key),`unique component ${key}`);seen.add(key);
  assert.ok(item.name.trim() && item.notes.trim(),`named, explained ${key}`);
  assert.ok(allowedMeasurement.has(item.measurementType),`measurement ${key}`);
  assert.ok(allowedPitch.has(item.pitchType),`pitch ${key}`);
  assert.equal(item.sourceUnit,item.measurementType==='area'?'m²':item.measurementType==='lineal'?'m':'each');
  assert.ok(item.materialRate>=0 && Number.isFinite(item.materialRate),`material cost ${key}`);
  assert.ok(item.labourRate>=0 && Number.isFinite(item.labourRate),`labour cost ${key}`);
  assert.ok(['none','percent','fixed'].includes(item.wasteKind),`waste kind ${key}`);
  if(item.wasteKind==='none')assert.equal(item.wasteValue,null,`explicit no waste ${key}`);
  else assert.ok(item.wasteValue>=0 && Number.isFinite(item.wasteValue),`waste amount ${key}`);
  assert.equal(item.priceBasis,'practice_example');
  assert.equal(item.canSendCustomerQuote,false);
  assert.equal(item.verifiedByCustomer,false);
  assert.ok(item.sourceUrl.startsWith('https://'));
  assert.equal(item.sortOrder,index+1);
  assert.ok(v3Sql.includes(`'${item.code}'`),`SQL seeds ${key}`);
  assert.ok(v3Sql.includes(`'${lib.slug}','${item.code}',${Number(item.materialRate).toFixed(1)},${Number(item.labourRate).toFixed(1)}`),`SQL costs ${key}`);
  const meta=descriptor.items.find(i=>i.code===item.code);
  assert.ok(meta,`catalog code ${key}`);
  for(const field of ['name','measurementType','pitchType','sourceUnit','takeoffSlot','notes'])assert.deepEqual(meta[field],item[field],`${field} matches: ${key}`);
  count++;
 }
}
assert.equal(count,35);
assert.deepEqual([...expected.keys()],examples.libraries.map(l=>l.slug));
assert.ok(v2Sql.includes('pricing_setup_starter_destinations'));
assert.ok(v3Sql.includes('pricing_setup_practice_snapshot'));
assert.ok(v3Sql.includes('CREATE TRIGGER pricing_setup_practice_quote_send_guard'));
assert.ok(v3Sql.includes('20261114180000'));
const guards=fs.readFileSync(path.join(root,'app/lib/pricing-setup/practice-guard.server.ts'),'utf8');
assert.ok(guards.includes('pricing_setup_practice_snapshot'));
const actions=fs.readFileSync(path.join(root,'app/(auth)/[workspaceSlug]/pricing/assistant/actions.ts'),'utf8');
assert.ok(actions.includes('practiceImport'));
assert.ok(actions.includes('pricing_setup_practice:true'));
for(const pathName of ['app/(auth)/[workspaceSlug]/quotes/actions.ts','app/lib/send-document/orchestrator.ts']){
 const text=fs.readFileSync(path.join(root,pathName),'utf8');
 assert.ok(text.startsWith("'use server';"),`Next.js directive must be first: ${pathName}`);
 assert.ok(text.includes('assertQuoteHasNoPracticePricing'),`outbound guard: ${pathName}`);
}
console.log(`PASS: ${examples.libraries.length} roofing libraries, ${count} practice-priced components, matching editable catalogue and SQL seed, and quote-send guards.`);
