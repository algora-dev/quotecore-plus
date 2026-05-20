// Generic Trades Phase 3 regression — bootstrap concurrency.
//
// Goal: prove that 5 concurrent calls to ensure_company_has_collection(uuid)
// for the same company result in exactly ONE bootstrap row. This validates
// the round-2 M-02 fix: pg_advisory_xact_lock + partial unique index.
//
// Setup:
//   1. Create a throwaway company.
//   2. Promise.all([5 RPC calls]) for that company_id.
//   3. Assert all 5 promises resolved to the same uuid.
//   4. Assert SELECT count(*) FROM component_collections WHERE company_id=X
//      AND is_bootstrap=true returns exactly 1.
//   5. Cleanup: delete the bootstrap row + company.
//
// Run from projects/quotecore-plus:
//   node scripts/test-bootstrap-concurrency.mjs

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

// --- Setup: throwaway company ----------------------------------------------
const throwawayName = `bootstrap-concurrency-${randomUUID().slice(0, 8)}`;
const { data: company, error: insertErr } = await admin
  .from('companies')
  .insert({
    name: throwawayName,
    slug: throwawayName,
    default_currency: 'NZD',
    default_tax_rate: 0,
  })
  .select('id')
  .single();

if (insertErr) fail(`Failed to create throwaway company: ${insertErr.message}`);
const companyId = company.id;
log(`Throwaway company id: ${companyId}`);

let teardownDone = false;
async function teardown() {
  if (teardownDone) return;
  teardownDone = true;
  log('Tearing down...');
  // Bootstrap rows aren't deletable from user-context per H-02 RLS, but
  // the admin client bypasses RLS entirely.
  await admin.from('component_collections').delete().eq('company_id', companyId);
  await admin.from('companies').delete().eq('id', companyId);
  log('Teardown complete.');
}
process.on('exit', () => { /* synchronous only; teardown runs in catch */ });

try {
  // --- 5 concurrent RPC calls ---------------------------------------------
  log('Firing 5 concurrent ensure_company_has_collection calls...');
  const results = await Promise.all(
    Array.from({ length: 5 }, () =>
      admin.rpc('ensure_company_has_collection', { p_company_id: companyId }),
    ),
  );

  // 5a. None should error.
  for (const [i, r] of results.entries()) {
    if (r.error) fail(`Call ${i + 1} errored: ${r.error.message}`);
  }
  pass('All 5 RPC calls returned without error.');

  // 5b. All should return the same uuid.
  const ids = results.map((r) => r.data);
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length !== 1) {
    fail(`Expected all 5 calls to return the same id; got ${uniqueIds.length} distinct ids: ${JSON.stringify(uniqueIds)}`);
  }
  pass(`All 5 calls returned the same id: ${uniqueIds[0]}`);

  // --- Verify exactly one bootstrap row in the DB --------------------------
  const { count: bootstrapCount, error: countErr } = await admin
    .from('component_collections')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_bootstrap', true);

  if (countErr) fail(`count query failed: ${countErr.message}`);
  if (bootstrapCount !== 1) {
    fail(`Expected exactly 1 bootstrap row, got ${bootstrapCount}`);
  }
  pass('Exactly 1 bootstrap row in component_collections.');

  // --- Sanity: 6th call still returns same id ------------------------------
  const { data: sixthId, error: sixthErr } = await admin.rpc(
    'ensure_company_has_collection',
    { p_company_id: companyId },
  );
  if (sixthErr) fail(`6th call errored: ${sixthErr.message}`);
  if (sixthId !== uniqueIds[0]) {
    fail(`6th call returned a different id: ${sixthId} (expected ${uniqueIds[0]})`);
  }
  pass('6th sequential call returns same id (idempotency).');

  log('---');
  log('All assertions passed.');
} catch (err) {
  await teardown();
  console.error('UNEXPECTED ERROR:', err);
  process.exit(1);
}

await teardown();
process.exit(0);
