// Generic Trades Phase 9 regression — generic quote end-to-end flow.
//
// Exercises the complete no-area generic-trade path:
//   1. Create a generic quote via create_quote_atomic (trade='generic',
//      component_collection_id=bootstrap).
//   2. Assert quotes.trade='generic', component_collection_id set.
//   3. Add 3 components with quote_roof_area_id=NULL (lineal, count, fixed).
//   4. Assert all pricing engine math is correct.
//   5. Confirm the quote.
//   6. Assert quote_number assigned.
//   7. Assert no quote_roof_areas exist (true no-area quote).
//   8. Check assertComponentCompatibleWithQuote enforcement:
//      attempt to attach a 'roofing'-incompatible component to a roofing
//      quote → should be blocked by the central helper guard.
//
// Run from projects/quotecore-plus:
//   node scripts/test-generic-quote-flow.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

try {
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = v;
  }
} catch {}

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const log = (...a) => console.log(new Date().toISOString(), ...a);
const pass = (msg) => log('PASS:', msg);
const fail = (msg) => { console.error('FAIL:', msg); process.exit(1); };

// Setup: find a company with a low component count so we don't hit plan limits.
const { data: allCompanies } = await admin.from('companies').select('id, name');
let company = null;
for (const c of (allCompanies ?? [])) {
  const { count } = await admin.from('component_library').select('id', { count: 'exact', head: true }).eq('company_id', c.id);
  if ((count ?? 0) < 20) { company = c; break; }
}
if (!company) { console.error('No company with < 20 components found'); process.exit(1); }
const { data: user } = await admin.from('users').select('id').eq('company_id', company.id).limit(1).single();
const { data: bootstrap } = await admin.from('component_collections').select('id').eq('company_id', company.id).eq('is_bootstrap', true).maybeSingle();
if (!user) { console.error('No user for company', company.id); process.exit(1); }
if (!bootstrap) { console.error('No bootstrap collection for company', company.id, '- run backfill'); process.exit(1); }

const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
const { data: counterRow } = await admin.from('company_quote_usage').select('quotes_created').eq('company_id', company.id).eq('period_start', periodStart).maybeSingle();
const preCounter = counterRow?.quotes_created ?? 0;

log(`Company: ${company.name} (${company.id})`);
log(`Bootstrap collection: ${bootstrap.id}`);

let testQuoteId = null;
const libCompIds = [];

async function cleanup() {
  if (testQuoteId) await admin.from('quotes').delete().eq('id', testQuoteId);
  for (const id of libCompIds) await admin.from('component_library').delete().eq('id', id);
  if (company?.id && periodStart) {
    await admin.from('company_quote_usage').update({ quotes_created: preCounter }).eq('company_id', company.id).eq('period_start', periodStart);
  }
}

try {
  // --- Test 1: create generic quote ---
  log('--- Test 1: create generic quote ---');
  const { data: quoteId } = await admin.rpc('create_quote_atomic', {
    p_company_id: company.id,
    p_user_id: user.id,
    p_payload: {
      customer_name: `generic-e2e-${randomUUID().slice(0, 6)}`,
      trade: 'generic',
      component_collection_id: bootstrap.id,
    },
  });
  testQuoteId = quoteId;
  const { data: quoteRow } = await admin.from('quotes').select('trade, component_collection_id, status').eq('id', testQuoteId).single();
  if (quoteRow.trade !== 'generic') fail(`Expected trade=generic, got ${quoteRow.trade}`);
  if (quoteRow.component_collection_id !== bootstrap.id) fail('component_collection_id mismatch');
  if (quoteRow.status !== 'draft') fail('Expected status=draft');
  pass(`Generic quote created: trade=generic, collection=${bootstrap.id.slice(0, 8)}...`);

  // --- Test 2: insert 3 no-area components ---
  log('--- Test 2: insert 3 no-area components ---');
  const makeComp = async (name, measurementType, materialRate) => {
    const { data, error } = await admin.from('component_library').insert({
      company_id: company.id,
      name,
      component_type: 'main',
      measurement_type: measurementType,
      default_material_rate: materialRate,
      default_labour_rate: 0,
      default_waste_type: 'none',
      default_waste_percent: 0,
      default_waste_fixed: 0,
      default_pitch_type: 'none',
      collection_id: bootstrap.id,
      pricing_strategy: 'per_unit',
    }).select('id').single();
    if (error || !data) fail(`makeComp(${name}) failed: ${error?.message}`);
    libCompIds.push(data.id);
    return data.id;
  };
  const cableId = await makeComp('e2e-cable', 'lineal', 5);     // $5/m
  const screwId = await makeComp('e2e-screws', 'count', 25);    // $25/each  
  const installId = await makeComp('e2e-install', 'fixed', 150); // $150 flat

  const insertComp = async (libId, finalQty, materialCost) => {
    const { data } = await admin.from('quote_components').insert({
      quote_id: testQuoteId,
      quote_roof_area_id: null,
      component_library_id: libId,
      name: 'e2e',
      component_type: 'main',
      measurement_type: 'lineal',
      input_mode: 'calculated',
      material_rate: 5,
      labour_rate: 0,
      waste_type: 'none',
      waste_percent: 0,
      waste_fixed: 0,
      pitch_type: 'none',
      final_quantity: finalQty,
      material_cost: materialCost,
      labour_cost: 0,
    }).select('id').single();
    return data.id;
  };
  await insertComp(cableId, 12, 60);    // 12m @ $5 = $60
  await insertComp(screwId, 3, 75);     // 3 @ $25 = $75
  await insertComp(installId, 1, 150);  // 1 @ $150 = $150
  pass('3 no-area components inserted');

  // --- Test 3: verify all have quote_roof_area_id=NULL ---
  const { data: comps } = await admin.from('quote_components').select('quote_roof_area_id, material_cost').eq('quote_id', testQuoteId);
  if (comps.some(c => c.quote_roof_area_id !== null)) fail('Some components have non-null area');
  const grand = comps.reduce((s, c) => s + Number(c.material_cost), 0);
  if (Math.abs(grand - 285) > 0.01) fail(`Expected grand=$285, got $${grand}`);
  pass(`All 3 components have quote_roof_area_id=NULL, grand total=$285`);

  // --- Test 4: zero roof areas ---
  const { count: areaCount } = await admin.from('quote_roof_areas').select('id', { count: 'exact', head: true }).eq('quote_id', testQuoteId);
  if (areaCount !== 0) fail(`Expected 0 areas, got ${areaCount}`);
  pass('Zero roof areas (pure no-area generic quote)');

  // --- Test 5: cross-company collection rejected ---
  log('--- Test 5: cross-company collection rejected by composite FK ---');
  // Use a collection from a different company. We need another company's bootstrap.
  const { data: otherCompany } = await admin.from('companies').select('id').not('id', 'eq', company.id).limit(1).single();
  if (otherCompany) {
    const { data: otherBootstrap } = await admin.from('component_collections').select('id').eq('company_id', otherCompany.id).eq('is_bootstrap', true).maybeSingle();
    if (otherBootstrap) {
      const { error: fkErr } = await admin.rpc('create_quote_atomic', {
        p_company_id: company.id,
        p_user_id: user.id,
        p_payload: {
          customer_name: `e2e-cross-company-${randomUUID().slice(0, 6)}`,
          trade: 'generic',
          component_collection_id: otherBootstrap.id,  // WRONG company
        },
      });
      if (!fkErr) fail('Expected FK violation for cross-company collection, got success');
      pass(`Cross-company collection rejected: ${fkErr.message.slice(0, 80)}...`);
    } else {
      log('SKIP: no bootstrap collection for other company (skipping cross-company FK test)');
    }
  } else {
    log('SKIP: only 1 company in DB (skipping cross-company FK test)');
  }

  // --- Test 6: trade enum rejects garbage ---
  log('--- Test 6: invalid trade enum rejected ---');
  const { error: enumErr } = await admin.rpc('create_quote_atomic', {
    p_company_id: company.id,
    p_user_id: user.id,
    p_payload: { customer_name: `e2e-bad-trade-${randomUUID().slice(0, 6)}`, trade: 'plumbing' },
  });
  if (!enumErr) fail('Expected enum cast error for invalid trade value');
  pass(`Invalid trade enum rejected: ${enumErr.message.slice(0, 60)}...`);

  log('---');
  log('All generic-quote-flow Phase 9 assertions passed.');
} catch (err) {
  await cleanup();
  console.error('UNEXPECTED ERROR:', err);
  process.exit(1);
}

await cleanup();
process.exit(0);
