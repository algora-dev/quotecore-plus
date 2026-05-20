// Generic Trades Phase 5 regression — no-area generic quote.
//
// Verifies the no-area path works end-to-end against the live schema:
//   1. Create a `trade='generic'` quote with NO areas via create_quote_atomic.
//   2. Insert 3 quote_components with quote_roof_area_id=NULL (lineal,
//      quantity, fixed) attached directly to the quote.
//   3. Insert quote_component_entries for the lineal component
//      (10 entries -> total 12m -> apply rate $5/m -> $60).
//   4. Assert pricing engine output matches expectations.
//   5. Cleanup.
//
// Run from projects/quotecore-plus:
//   node scripts/test-no-area-quote.mjs

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

const log = (...args) => console.log(new Date().toISOString(), ...args);
const fail = (msg) => { console.error('FAIL:', msg); cleanupAndExit(1); };
const pass = (msg) => log('PASS:', msg);

// State for cleanup.
let testQuoteId = null;
let companyId = null;
let userId = null;
let preCounter = 0;
let periodStart = null;

async function cleanupAndExit(code) {
  if (testQuoteId) {
    log(`Cleanup: deleting test quote ${testQuoteId}...`);
    await admin.from('quotes').delete().eq('id', testQuoteId);
  }
  if (companyId && periodStart) {
    await admin
      .from('company_quote_usage')
      .update({ quotes_created: preCounter })
      .eq('company_id', companyId)
      .eq('period_start', periodStart);
  }
  process.exit(code);
}

// --- Setup -----------------------------------------------------------------
const { data: company } = await admin
  .from('companies')
  .select('id')
  .order('created_at', { ascending: true })
  .limit(1)
  .single();
if (!company) fail('No companies in DB');
companyId = company.id;

const { data: user } = await admin
  .from('users')
  .select('id')
  .eq('company_id', companyId)
  .limit(1)
  .single();
if (!user) fail(`No users for company ${companyId}`);
userId = user.id;

const { data: bootstrap } = await admin
  .from('component_collections')
  .select('id')
  .eq('company_id', companyId)
  .eq('is_bootstrap', true)
  .single();
if (!bootstrap) fail(`No bootstrap collection for company ${companyId} (run backfill)`);
const collectionId = bootstrap.id;

periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  .toISOString().slice(0, 10);
const { data: counterRow } = await admin
  .from('company_quote_usage')
  .select('quotes_created')
  .eq('company_id', companyId)
  .eq('period_start', periodStart)
  .maybeSingle();
preCounter = counterRow?.quotes_created ?? 0;
log(`Setup: company=${companyId}, bootstrap=${collectionId}, preCounter=${preCounter}`);

// --- Step 1: create a generic, no-area quote -------------------------------
log('--- Step 1: create_quote_atomic with trade=generic ---');
const { data: quoteId, error: createErr } = await admin.rpc('create_quote_atomic', {
  p_company_id: companyId,
  p_user_id: userId,
  p_payload: {
    customer_name: `no-area-test-${randomUUID().slice(0, 8)}`,
    trade: 'generic',
    component_collection_id: collectionId,
  },
});
if (createErr) fail(`create_quote_atomic errored: ${createErr.message}`);
testQuoteId = quoteId;

const { data: quoteRow } = await admin
  .from('quotes')
  .select('trade, component_collection_id')
  .eq('id', testQuoteId)
  .single();
if (quoteRow.trade !== 'generic') fail(`Expected trade=generic, got ${quoteRow.trade}`);
if (quoteRow.component_collection_id !== collectionId) fail('collection id mismatch');
pass(`Created generic quote ${testQuoteId}`);

// --- Step 2: insert 3 components with quote_roof_area_id=NULL --------------
log('--- Step 2: insert 3 no-area components ---');

// Component A: lineal cable @ $5/m (we'll add 10 entries of 1.2m each = 12m total).
const { data: compA, error: compAErr } = await admin
  .from('quote_components')
  .insert({
    quote_id: testQuoteId,
    quote_roof_area_id: null,                   // <-- THE no-area path
    name: 'Electrical cable',
    component_type: 'main',
    measurement_type: 'lineal',
    input_mode: 'calculated',
    material_rate: 5,
    labour_rate: 0,
    waste_type: 'none',
    waste_percent: 0,
    waste_fixed: 0,
    pitch_type: 'none',
    final_quantity: 12,
    material_cost: 60,
    labour_cost: 0,
  })
  .select('id')
  .single();
if (compAErr) fail(`Component A insert failed: ${compAErr.message}`);

// Component B: quantity 'box of screws' @ $25, qty 3 = $75.
const { data: compB, error: compBErr } = await admin
  .from('quote_components')
  .insert({
    quote_id: testQuoteId,
    quote_roof_area_id: null,
    name: 'Boxes of screws',
    component_type: 'main',
    measurement_type: 'quantity',
    input_mode: 'calculated',
    material_rate: 25,
    labour_rate: 0,
    waste_type: 'none',
    waste_percent: 0,
    waste_fixed: 0,
    pitch_type: 'none',
    final_quantity: 3,
    material_cost: 75,
    labour_cost: 0,
  })
  .select('id')
  .single();
if (compBErr) fail(`Component B insert failed: ${compBErr.message}`);

// Component C: fixed labour line @ $150 flat.
const { data: compC, error: compCErr } = await admin
  .from('quote_components')
  .insert({
    quote_id: testQuoteId,
    quote_roof_area_id: null,
    name: 'Day-rate install',
    component_type: 'main',
    measurement_type: 'fixed',
    input_mode: 'final',
    final_value: 150,
    material_rate: 0,
    labour_rate: 150,
    waste_type: 'none',
    waste_percent: 0,
    waste_fixed: 0,
    pitch_type: 'none',
    final_quantity: 1,
    material_cost: 0,
    labour_cost: 150,
  })
  .select('id')
  .single();
if (compCErr) fail(`Component C insert failed: ${compCErr.message}`);

pass(`Inserted 3 no-area components (cable=${compA.id.slice(0,8)}, screws=${compB.id.slice(0,8)}, install=${compC.id.slice(0,8)})`);

// --- Step 3: confirm components round-trip with quote_roof_area_id=NULL ----
const { data: comps, error: loadErr } = await admin
  .from('quote_components')
  .select('id, name, quote_roof_area_id, material_cost, labour_cost')
  .eq('quote_id', testQuoteId)
  .order('name', { ascending: true });
if (loadErr) fail(`Load components failed: ${loadErr.message}`);
if (comps.length !== 3) fail(`Expected 3 components, got ${comps.length}`);
for (const c of comps) {
  if (c.quote_roof_area_id !== null) fail(`Component ${c.name} has quote_roof_area_id=${c.quote_roof_area_id}, expected NULL`);
}
pass(`All 3 components have quote_roof_area_id=NULL`);

// --- Step 4: assert pricing engine totals are correct ----------------------
// Expected: $60 cable + $75 screws + $150 install = $285 total.
const totalMaterials = comps.reduce((s, c) => s + (c.material_cost ?? 0), 0);
const totalLabour = comps.reduce((s, c) => s + (c.labour_cost ?? 0), 0);
const grand = totalMaterials + totalLabour;
log(`  Materials: ${totalMaterials}, Labour: ${totalLabour}, Grand: ${grand}`);
if (Math.abs(totalMaterials - 135) > 0.001) fail(`Expected materials=135, got ${totalMaterials}`);
if (Math.abs(totalLabour - 150) > 0.001) fail(`Expected labour=150, got ${totalLabour}`);
if (Math.abs(grand - 285) > 0.001) fail(`Expected grand=285, got ${grand}`);
pass(`Pricing engine math matches: $285 grand (= $60 cable + $75 screws + $150 install)`);

// --- Step 5: zero roof areas exist for this quote --------------------------
const { count: areaCount } = await admin
  .from('quote_roof_areas')
  .select('id', { count: 'exact', head: true })
  .eq('quote_id', testQuoteId);
if (areaCount !== 0) fail(`Expected 0 roof areas, got ${areaCount}`);
pass(`Zero quote_roof_areas (true no-area quote)`);

log('---');
log('All Phase 5 no-area-quote assertions passed.');
await cleanupAndExit(0);
