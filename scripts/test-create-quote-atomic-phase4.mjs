// Generic Trades Phase 4 regression — create_quote_atomic with trade +
// component_collection_id projection.
//
// Asserts:
//   1. Omitting both new fields → quote defaults to trade='roofing',
//      component_collection_id=NULL (backwards compat with pre-Phase-4
//      callers).
//   2. Supplying trade='generic' + a valid bootstrap collection id →
//      both fields land on the quote.
//   3. Supplying a component_collection_id that belongs to ANOTHER
//      company → rejected by the composite FK
//      (company_id, component_collection_id) (round-3 H-03).
//   4. Supplying an invalid trade enum string → rejected (enum cast fails).
//
// Run from projects/quotecore-plus:
//   node scripts/test-create-quote-atomic-phase4.mjs

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
const fail = (msg) => { console.error('FAIL:', msg); process.exit(1); };
const pass = (msg) => log('PASS:', msg);

// --- Pick test companies (need TWO different ones for cross-company test) ---
const { data: companies } = await admin
  .from('companies')
  .select('id, name')
  .order('created_at', { ascending: true })
  .limit(5);
if (!companies || companies.length < 2) fail('Need at least 2 companies in DB to run cross-company test.');
const companyA = companies[0];
const companyB = companies[1];
log(`Using companyA=${companyA.id} (${companyA.name}), companyB=${companyB.id} (${companyB.name})`);

// Pick a user belonging to companyA to satisfy the RPC's p_user_id.
const { data: userA } = await admin
  .from('users')
  .select('id')
  .eq('company_id', companyA.id)
  .limit(1)
  .single();
if (!userA) fail(`No user found for companyA=${companyA.id}`);

// Look up bootstrap collection ids for both companies.
const { data: bootstrapA } = await admin
  .from('component_collections')
  .select('id')
  .eq('company_id', companyA.id)
  .eq('is_bootstrap', true)
  .single();
const { data: bootstrapB } = await admin
  .from('component_collections')
  .select('id')
  .eq('company_id', companyB.id)
  .eq('is_bootstrap', true)
  .single();
if (!bootstrapA || !bootstrapB) fail('Both companies need bootstrap collections (run backfill).');
log(`bootstrapA=${bootstrapA.id}, bootstrapB=${bootstrapB.id}`);

// Track created quote ids for cleanup.
const createdQuoteIds = [];
let preCounter = 0;

// Capture current monthly counter so we can restore it. Period = first of month UTC.
const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1))
  .toISOString().slice(0, 10);
const { data: counterRow } = await admin
  .from('company_quote_usage')
  .select('quotes_created')
  .eq('company_id', companyA.id)
  .eq('period_start', periodStart)
  .maybeSingle();
preCounter = counterRow?.quotes_created ?? 0;
log(`Pre-test counter for companyA / ${periodStart}: ${preCounter}`);

async function cleanup() {
  if (createdQuoteIds.length === 0) return;
  log(`Cleaning up ${createdQuoteIds.length} test quote(s) + restoring counter to ${preCounter}...`);
  await admin.from('quotes').delete().in('id', createdQuoteIds);
  await admin
    .from('company_quote_usage')
    .update({ quotes_created: preCounter })
    .eq('company_id', companyA.id)
    .eq('period_start', periodStart);
  log('Cleanup complete.');
}

try {
  // --- Test 1: omitting both new fields -> column defaults apply ---------
  log('--- Test 1: omit trade + collection -> defaults ---');
  const { data: id1, error: err1 } = await admin.rpc('create_quote_atomic', {
    p_company_id: companyA.id,
    p_user_id: userA.id,
    p_payload: { customer_name: `phase4-test-1-${randomUUID().slice(0, 8)}` },
  });
  if (err1) fail(`Test 1 errored: ${err1.message}`);
  createdQuoteIds.push(id1);
  const { data: row1 } = await admin.from('quotes').select('trade, component_collection_id').eq('id', id1).single();
  if (row1.trade !== 'roofing') fail(`Test 1: expected trade=roofing, got ${row1.trade}`);
  if (row1.component_collection_id !== null) fail(`Test 1: expected NULL collection, got ${row1.component_collection_id}`);
  pass(`Test 1: defaults applied (trade=roofing, collection=NULL)`);

  // --- Test 2: supply both valid fields -> both land ----------------------
  log('--- Test 2: supply trade=generic + valid collection ---');
  const { data: id2, error: err2 } = await admin.rpc('create_quote_atomic', {
    p_company_id: companyA.id,
    p_user_id: userA.id,
    p_payload: {
      customer_name: `phase4-test-2-${randomUUID().slice(0, 8)}`,
      trade: 'generic',
      component_collection_id: bootstrapA.id,
    },
  });
  if (err2) fail(`Test 2 errored: ${err2.message}`);
  createdQuoteIds.push(id2);
  const { data: row2 } = await admin.from('quotes').select('trade, component_collection_id').eq('id', id2).single();
  if (row2.trade !== 'generic') fail(`Test 2: expected trade=generic, got ${row2.trade}`);
  if (row2.component_collection_id !== bootstrapA.id) fail(`Test 2: collection mismatch`);
  pass(`Test 2: trade=generic + collection landed correctly`);

  // --- Test 3: cross-company collection id -> composite FK rejects --------
  log('--- Test 3: cross-company collection id (companyB collection on companyA quote) ---');
  const { data: id3, error: err3 } = await admin.rpc('create_quote_atomic', {
    p_company_id: companyA.id,
    p_user_id: userA.id,
    p_payload: {
      customer_name: `phase4-test-3-${randomUUID().slice(0, 8)}`,
      component_collection_id: bootstrapB.id,   // companyB's bootstrap
    },
  });
  if (!err3) {
    if (id3) createdQuoteIds.push(id3);
    fail(`Test 3: expected FK violation, got success (quote=${id3})`);
  }
  if (!err3.message.toLowerCase().includes('foreign key') && !err3.message.toLowerCase().includes('violates')) {
    fail(`Test 3: expected FK violation, got: ${err3.message}`);
  }
  pass(`Test 3: cross-company collection rejected by composite FK`);

  // --- Test 4: invalid trade enum -> rejected -----------------------------
  log('--- Test 4: invalid trade enum value ---');
  const { data: id4, error: err4 } = await admin.rpc('create_quote_atomic', {
    p_company_id: companyA.id,
    p_user_id: userA.id,
    p_payload: {
      customer_name: `phase4-test-4-${randomUUID().slice(0, 8)}`,
      trade: 'plumbing',  // not in the trade enum
    },
  });
  if (!err4) {
    if (id4) createdQuoteIds.push(id4);
    fail(`Test 4: expected enum violation, got success`);
  }
  pass(`Test 4: invalid trade enum rejected (${err4.message.slice(0, 80)}...)`);

  log('---');
  log('All Phase 4 assertions passed.');
} catch (err) {
  await cleanup();
  console.error('UNEXPECTED ERROR:', err);
  process.exit(1);
}

await cleanup();
process.exit(0);
