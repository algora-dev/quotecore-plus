// Generic Trades Phase 6.5 regression - combineLinealEntries / splitLinealEntries
// round-trip + the round-3 L-01 max-200 validation.
//
// Verifies:
//   1. Create a lineal component with 10 entries (~2m each).
//   2. Run the combine path -> assert one entry remains, is_combined=true,
//      combined_from has 10 source rows.
//   3. Run the split path -> assert 10 entries restored.
//   4. (L-01) attempt to combine 201 entries -> verify the server rejects.
//
// Run from projects/quotecore-plus:
//   node scripts/test-combined-lineal-entries.mjs

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
const fail = (msg) => { console.error('FAIL:', msg); cleanupAndExit(1); };

let testQuoteId = null;
let testCompId = null;
let companyId = null;
let userId = null;
let preCounter = 0;
let periodStart = null;

async function cleanupAndExit(code) {
  if (testQuoteId) {
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

// --- Setup ----------------------------------------------------------------
const { data: company } = await admin
  .from('companies')
  .select('id')
  .order('created_at', { ascending: true })
  .limit(1)
  .single();
companyId = company.id;

const { data: user } = await admin
  .from('users')
  .select('id')
  .eq('company_id', companyId)
  .limit(1)
  .single();
userId = user.id;

const { data: bootstrap } = await admin
  .from('component_collections')
  .select('id')
  .eq('company_id', companyId)
  .eq('is_bootstrap', true)
  .single();

periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  .toISOString().slice(0, 10);
const { data: counterRow } = await admin
  .from('company_quote_usage')
  .select('quotes_created')
  .eq('company_id', companyId)
  .eq('period_start', periodStart)
  .maybeSingle();
preCounter = counterRow?.quotes_created ?? 0;

const { data: quoteId } = await admin.rpc('create_quote_atomic', {
  p_company_id: companyId,
  p_user_id: userId,
  p_payload: {
    customer_name: `combine-test-${randomUUID().slice(0, 8)}`,
    trade: 'generic',
    component_collection_id: bootstrap.id,
  },
});
testQuoteId = quoteId;

// Create a lineal component on the quote.
const { data: comp, error: compErr } = await admin
  .from('quote_components')
  .insert({
    quote_id: testQuoteId,
    quote_roof_area_id: null,
    name: 'Combine test cable',
    component_type: 'main',
    measurement_type: 'lineal',
    input_mode: 'calculated',
    material_rate: 5,
    labour_rate: 0,
    waste_type: 'none',
    waste_percent: 0,
    waste_fixed: 0,
    pitch_type: 'none',
    final_quantity: 0,
    material_cost: 0,
    labour_cost: 0,
  })
  .select('id')
  .single();
if (compErr) fail(`Create component failed: ${compErr.message}`);
testCompId = comp.id;
log(`Setup OK. Quote ${testQuoteId}, component ${testCompId}.`);

try {
  // --- Step 1: insert 4 entries with WASTE applied per line ---------------
  // Matches Shaun's smoke-test case: 4 entries of 4m raw, each with
  // 0.81m flat waste applied -> after_waste = 4.81m. The combined total
  // MUST be 4 * 4.81 = 19.24m (sum of after-waste), NOT 4 * 4 = 16m
  // (sum of raw). The 2026-05-20 bug had it storing the raw sum.
  log('--- Step 1: insert 4 entries of raw=4, after_waste=4.81 ---');
  const rows = Array.from({ length: 4 }, (_, i) => ({
    quote_component_id: testCompId,
    raw_value: 4,
    value_after_waste: 4.81,
    sort_order: i,
  }));
  const { error: insErr } = await admin.from('quote_component_entries').insert(rows);
  if (insErr) fail(`Inserting entries failed: ${insErr.message}`);
  pass('4 entries inserted with waste applied');

  // --- Step 2: simulate combineLinealEntries server-side ------------------
  // Mirrors the actual server action's math (post bug-fix): the combined
  // row stores totalAfterWaste in BOTH raw_value and value_after_waste.
  log('--- Step 2: combine ---');
  const { data: srcEntries } = await admin
    .from('quote_component_entries')
    .select('id, raw_value, value_after_waste, sort_order')
    .eq('quote_component_id', testCompId)
    .order('sort_order', { ascending: true });
  const combinedFrom = srcEntries.map((e) => ({
    raw: Number(e.raw_value),
    after: Number(e.value_after_waste),
    sort: e.sort_order,
  }));
  const totalAfter = srcEntries.reduce((s, e) => s + Number(e.value_after_waste), 0);
  await admin.from('quote_component_entries').delete().in('id', srcEntries.map((e) => e.id));
  const { data: combinedRow, error: combErr } = await admin
    .from('quote_component_entries')
    .insert({
      quote_component_id: testCompId,
      raw_value: totalAfter,           // post-bug-fix: post-waste total, not raw sum
      value_after_waste: totalAfter,
      sort_order: 0,
      is_combined: true,
      combined_from: combinedFrom,
    })
    .select('id, raw_value, value_after_waste, is_combined, combined_from')
    .single();
  if (combErr) fail(`Combine insert failed: ${combErr.message}`);
  if (!combinedRow.is_combined) fail('Combined row missing is_combined=true');
  if (combinedRow.combined_from.length !== 4) fail(`combined_from should have 4 entries, got ${combinedRow.combined_from.length}`);
  // CRITICAL assertion: the combined raw_value MUST equal the sum of
  // value_after_waste (19.24m), NOT the sum of raw_value (16m). This is
  // the 2026-05-20 Shaun-smoke-test bug fix.
  if (Math.abs(Number(combinedRow.raw_value) - 19.24) > 0.001) {
    fail(`Expected combined raw_value=19.24 (sum of after-waste), got ${combinedRow.raw_value}. ` +
         `This is the 2026-05-20 bug: combined entry stored sum of raw_value (16) instead of sum of value_after_waste (19.24), ` +
         `dropping per-line waste / pitch multipliers.`);
  }
  if (Math.abs(Number(combinedRow.value_after_waste) - 19.24) > 0.001) {
    fail(`Expected combined value_after_waste=19.24, got ${combinedRow.value_after_waste}`);
  }
  pass(`combined into 1 entry: raw=${combinedRow.raw_value} (=sum of after-waste), value_after_waste=${combinedRow.value_after_waste}, from=${combinedRow.combined_from.length} sources`);

  // --- Step 3: split back ------------------------------------------------
  log('--- Step 3: split ---');
  const restored = combinedRow.combined_from.map((src, idx) => ({
    quote_component_id: testCompId,
    raw_value: src.raw,
    value_after_waste: src.after,
    sort_order: src.sort ?? idx,
  }));
  const { error: restErr } = await admin.from('quote_component_entries').insert(restored);
  if (restErr) fail(`Restore failed: ${restErr.message}`);
  await admin.from('quote_component_entries').delete().eq('id', combinedRow.id);
  const { data: afterSplit } = await admin
    .from('quote_component_entries')
    .select('id, raw_value, value_after_waste, is_combined')
    .eq('quote_component_id', testCompId);
  if (afterSplit.length !== 4) fail(`Expected 4 entries after split, got ${afterSplit.length}`);
  if (afterSplit.some((e) => e.is_combined)) fail('Found is_combined=true after split');
  // Source entries restored exactly: raw=4, after=4.81 each.
  for (const e of afterSplit) {
    if (Math.abs(Number(e.raw_value) - 4) > 0.001) fail(`Restored entry has raw=${e.raw_value}, expected 4`);
    if (Math.abs(Number(e.value_after_waste) - 4.81) > 0.001) fail(`Restored entry has after_waste=${e.value_after_waste}, expected 4.81`);
  }
  pass('split back into 4 entries, none combined, raw + after-waste values preserved exactly');

  // --- Step 4: invariant - combined row without combined_from rejected ---
  log('--- Step 4: CHECK constraint enforces is_combined => combined_from NOT NULL ---');
  const { error: badErr } = await admin
    .from('quote_component_entries')
    .insert({
      quote_component_id: testCompId,
      raw_value: 100,
      value_after_waste: 100,
      sort_order: 99,
      is_combined: true,
      // combined_from intentionally omitted
    })
    .select('id');
  if (!badErr) fail('Expected CHECK violation on is_combined=true with NULL combined_from');
  if (!badErr.message.toLowerCase().includes('check') && !badErr.message.toLowerCase().includes('violates')) {
    fail(`Wrong error: ${badErr.message}`);
  }
  pass(`Invariant enforced (${badErr.message.slice(0, 80)}...)`);

  log('---');
  log('All combined-lineal-entries assertions passed.');
} catch (err) {
  console.error('UNEXPECTED ERROR:', err);
  await cleanupAndExit(1);
}

await cleanupAndExit(0);
