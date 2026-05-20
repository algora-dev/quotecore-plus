// Generic Trades Phase 7 regression — multi_lineal + page_id scoped saves.
//
// Tests:
//   1. save_takeoff_atomic with multi_lineal measurements (no page).
//   2. Per-page scoped save: save page 1, save page 2, assert both kept.
//   3. Re-save page 1: assert page 1 updated, page 2 untouched (C-02).
//   4. page_id validates ownership — wrong quote's page rejected (M-01).
//
// Run from projects/quotecore-plus:
//   node scripts/test-multi-lineal-tool.mjs

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

// Setup: find a low-component company
const { data: allCos } = await admin.from('companies').select('id');
let company = null;
for (const c of (allCos ?? [])) {
  const { count } = await admin.from('component_library').select('id', { count: 'exact', head: true }).eq('company_id', c.id);
  if ((count ?? 0) < 10) { company = c; break; }
}
if (!company) { console.error('No company with < 10 components'); process.exit(1); }
const { data: user } = await admin.from('users').select('id').eq('company_id', company.id).limit(1).single();
const { data: bootstrap } = await admin.from('component_collections').select('id').eq('company_id', company.id).eq('is_bootstrap', true).maybeSingle();
if (!user || !bootstrap) { console.error('Missing user or bootstrap for company', company.id); process.exit(1); }

const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
const { data: counterRow } = await admin.from('company_quote_usage').select('quotes_created').eq('company_id', company.id).eq('period_start', periodStart).maybeSingle();
const preCounter = counterRow?.quotes_created ?? 0;

// Create lib component
const { data: libComp, error: libErr } = await admin.from('component_library').insert({
  company_id: company.id, name: `ml-test-${randomUUID().slice(0, 6)}`,
  component_type: 'main', measurement_type: 'multi_lineal',
  default_material_rate: 5, default_labour_rate: 0,
  default_waste_type: 'percent', default_waste_percent: 5, default_waste_fixed: 0,
  default_pitch_type: 'none', pricing_strategy: 'per_unit', collection_id: bootstrap.id,
}).select('id').single();
if (libErr || !libComp) fail(`Create library component failed: ${libErr?.message}`);

// Create quote
const { data: quoteId } = await admin.rpc('create_quote_atomic', {
  p_company_id: company.id, p_user_id: user.id,
  p_payload: { customer_name: `ml-test-${randomUUID().slice(0, 6)}`, trade: 'generic', component_collection_id: bootstrap.id },
});

// Create another quote (for M-01 cross-quote page_id test)
const { data: otherQuoteId } = await admin.rpc('create_quote_atomic', {
  p_company_id: company.id, p_user_id: user.id,
  p_payload: { customer_name: `ml-other-${randomUUID().slice(0, 6)}`, trade: 'generic', component_collection_id: bootstrap.id },
});

async function cleanup() {
  await admin.from('quotes').delete().eq('id', quoteId);
  await admin.from('quotes').delete().eq('id', otherQuoteId);
  await admin.from('component_library').delete().eq('id', libComp.id);
  await admin.from('company_quote_usage').update({ quotes_created: preCounter }).eq('company_id', company.id).eq('period_start', periodStart);
}

try {
  // Create takeoff session + two pages via DB directly (admin)
  const { data: session } = await admin.from('takeoff_sessions').insert({ quote_id: quoteId }).select('id').single();
  const { data: page1 } = await admin.from('takeoff_pages').insert({ session_id: session.id, quote_id: quoteId, page_order: 1, page_name: 'Page 1' }).select('id').single();
  const { data: page2 } = await admin.from('takeoff_pages').insert({ session_id: session.id, quote_id: quoteId, page_order: 2, page_name: 'Page 2' }).select('id').single();
  log(`Session: ${session.id}, Page1: ${page1.id}, Page2: ${page2.id}`);

  const makeMeasurements = (pageId, value, count) => Array.from({ length: count }, (_, i) => ({
    company_id: company.id, component_library_id: libComp.id,
    measurement_type: 'multi_lineal', measurement_value: value,
    measurement_unit: 'meters', canvas_points: [{ x: i * 10, y: 0 }],
    is_visible: true, page_id: pageId,
  }));

  const makeComponents = (totalQty, materialCost) => [{
    component_library_id: libComp.id, name: 'ml-test', measurement_type: 'multi_lineal',
    material_rate: 5, labour_rate: 0, waste_type: 'percent', waste_percent: 5,
    waste_fixed: 0, pitch_type: 'none', final_quantity: totalQty, material_cost: materialCost, labour_cost: 0,
    entries: Array.from({ length: 3 }, (_, i) => ({ raw_value: totalQty / 3, value_after_waste: totalQty / 3, sort_order: i })),
  }];

  // --- Test 1: save page 1 with 3 measurements (2m each) ---
  log('--- Test 1: save page 1 ---');
  const { error: e1 } = await admin.rpc('save_takeoff_atomic', {
    p_quote_id: quoteId,
    p_payload: {
      current_page_id: page1.id,
      measurements: makeMeasurements(page1.id, 2, 3),
      components: makeComponents(6.3, 31.5),
      roof_areas: [],
    },
  });
  if (e1) fail(`Save page 1 failed: ${e1.message}`);
  const { data: r1 } = await admin.from('quote_takeoff_measurements').select('measurement_value, page_id').eq('quote_id', quoteId);
  if (r1.length !== 3) fail(`Expected 3 measurements after page 1 save, got ${r1.length}`);
  if (r1.some(m => m.page_id !== page1.id)) fail('Page 1 measurements do not have correct page_id');
  pass(`Page 1 saved: 3 measurements with page_id=${page1.id.slice(0, 8)}...`);

  // --- Test 2: save page 2 — page 1 measurements must survive ---
  log('--- Test 2: save page 2, assert page 1 survives ---');
  const { error: e2 } = await admin.rpc('save_takeoff_atomic', {
    p_quote_id: quoteId,
    p_payload: {
      current_page_id: page2.id,
      measurements: makeMeasurements(page2.id, 3, 2),
      components: makeComponents(6.3, 31.5),
      roof_areas: [],
    },
  });
  if (e2) fail(`Save page 2 failed: ${e2.message}`);
  const { data: r2 } = await admin.from('quote_takeoff_measurements').select('measurement_value, page_id').eq('quote_id', quoteId);
  const p1rows = r2.filter(m => m.page_id === page1.id);
  const p2rows = r2.filter(m => m.page_id === page2.id);
  if (p1rows.length !== 3) fail(`Page 1 should still have 3 rows after page 2 save, got ${p1rows.length}`);
  if (p2rows.length !== 2) fail(`Page 2 should have 2 rows, got ${p2rows.length}`);
  pass(`Page 1 preserved (${p1rows.length} rows) + page 2 added (${p2rows.length} rows) = ${r2.length} total`);

  // --- Test 3: re-save page 1 (C-02) — component entries reconciled ---
  log('--- Test 3: re-save page 1 updates component entries (C-02) ---');
  const { error: e3 } = await admin.rpc('save_takeoff_atomic', {
    p_quote_id: quoteId,
    p_payload: {
      current_page_id: page1.id,
      measurements: makeMeasurements(page1.id, 4, 5), // different: 5 measurements of 4m
      components: makeComponents(21, 105), // 5x4.2m = 21m after 5% waste
      roof_areas: [],
    },
  });
  if (e3) fail(`Re-save page 1 failed: ${e3.message}`);
  const { data: r3 } = await admin.from('quote_takeoff_measurements').select('page_id').eq('quote_id', quoteId);
  const p1after = r3.filter(m => m.page_id === page1.id);
  const p2after = r3.filter(m => m.page_id === page2.id);
  if (p1after.length !== 5) fail(`Page 1 should have 5 rows after re-save, got ${p1after.length}`);
  if (p2after.length !== 2) fail(`Page 2 should still have 2 rows, got ${p2after.length}`);
  // Check component entries updated (C-02)
  const { data: compRow } = await admin.from('quote_components').select('final_quantity, material_cost').eq('quote_id', quoteId).single();
  if (Math.abs(Number(compRow.final_quantity) - 21) > 0.01) fail(`Expected final_quantity=21 after re-save, got ${compRow.final_quantity}`);
  pass(`Re-save: page 1 updated (${p1after.length} rows), page 2 untouched (${p2after.length} rows), component totals reconciled (qty=${compRow.final_quantity})`);

  // --- Test 4: cross-quote page_id rejected (M-01) ---
  log('--- Test 4: page_id from another quote rejected (M-01) ---');
  const { data: otherSession } = await admin.from('takeoff_sessions').insert({ quote_id: otherQuoteId }).select('id').single();
  const { data: otherPage } = await admin.from('takeoff_pages').insert({ session_id: otherSession.id, quote_id: otherQuoteId, page_order: 1, page_name: 'P1' }).select('id').single();
  const { error: e4 } = await admin.rpc('save_takeoff_atomic', {
    p_quote_id: quoteId,
    p_payload: {
      current_page_id: otherPage.id, // page from a different quote
      measurements: [], components: [], roof_areas: [],
    },
  });
  if (!e4) fail('Expected rejection for cross-quote page_id, got success');
  pass(`Cross-quote page_id rejected: ${e4.message.slice(0, 60)}...`);

  // Cleanup other session
  await admin.from('quotes').delete().eq('id', otherQuoteId);

  log('---');
  log('All multi-lineal + page_id regression assertions passed.');
} catch (err) {
  await cleanup();
  console.error('UNEXPECTED ERROR:', err);
  process.exit(1);
}

await cleanup();
process.exit(0);
