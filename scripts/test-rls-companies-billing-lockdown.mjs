// Gerald audit C-01 regression test.
//
// Verifies: an authenticated company user CANNOT update billing/sensitive
// columns on their own company row via direct PostgREST writes. Profile
// columns (name, default_currency, etc) MUST still be updatable so the
// app continues to work.
//
// Strategy:
//   1. Create a throwaway test company + user via service role.
//   2. Sign that user in (signInWithPassword) to get a real JWT.
//   3. Build an anon-key Supabase client carrying that JWT.
//   4. Attempt UPDATEs against billing columns -> expect each to fail
//      (either error code 42501 / "permission denied" OR a 204 No-Content
//      that touches zero rows because the column-level GRANT is missing).
//   5. Attempt UPDATEs against profile columns -> expect success.
//   6. Cleanup: delete the user + company.
//
// Run: node scripts/test-rls-companies-billing-lockdown.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TEST_TAG = `c01-test-${Date.now()}`;
const TEST_EMAIL = `${TEST_TAG}@quotecore.local`;
const TEST_PASSWORD = `Test-${Math.random().toString(36).slice(2)}!A`;
const TEST_COMPANY_NAME = `C-01 Lockdown Test ${TEST_TAG}`;

let companyId = null;
let userId = null;

async function setup() {
  console.log('--- Setup: create throwaway company + user ---');
  const { data: company, error: ce } = await admin
    .from('companies')
    .insert({
      name: TEST_COMPANY_NAME,
      slug: TEST_TAG,
      default_currency: 'USD',
      default_language: 'en',
      default_measurement_system: 'metric',
      plan_code: 'starter',
      subscription_status: 'active',
    })
    .select('id')
    .single();
  if (ce) throw new Error(`Company create failed: ${ce.message}`);
  companyId = company.id;
  console.log(`  company_id = ${companyId}`);

  const { data: authUser, error: ae } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (ae) throw new Error(`Auth user create failed: ${ae.message}`);
  userId = authUser.user.id;
  console.log(`  user_id    = ${userId}`);

  const { error: pe } = await admin
    .from('users')
    .insert({
      id: userId,
      email: TEST_EMAIL,
      company_id: companyId,
      role: 'owner',
    });
  if (pe) throw new Error(`Profile create failed: ${pe.message}`);
  console.log('  profile row inserted\n');
}

async function teardown() {
  console.log('\n--- Teardown ---');
  try { if (userId) await admin.auth.admin.deleteUser(userId); } catch {}
  try { if (userId) await admin.from('users').delete().eq('id', userId); } catch {}
  try { if (companyId) await admin.from('companies').delete().eq('id', companyId); } catch {}
  console.log('  cleanup done.');
}

async function userClient() {
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  console.log(`  signed in as ${TEST_EMAIL}`);
  return c;
}

function snapshotBefore() {
  return admin
    .from('companies')
    .select('plan_code, subscription_status, stripe_customer_id, stripe_subscription_id, comp_until, storage_topup_bytes, seat_count')
    .eq('id', companyId)
    .single();
}

async function main() {
  let pass = 0;
  let fail = 0;
  const failures = [];

  function expectBlocked(label, result, before, after) {
    // PostgREST + column-level grant + RLS combine in a few ways:
    //   - Hard rejection: error.code = '42501' / '42703' / explicit message
    //   - Silent zero-rows: error null but no row changed (RLS hides it)
    //     -> in our case, RLS *allows* the row (user owns it), so we EXPECT
    //        a hard error from missing column UPDATE privilege.
    if (result.error) {
      console.log(`  [PASS] ${label}: blocked with ${result.error.code || ''} ${result.error.message?.slice(0, 80) || ''}`);
      pass++;
      return;
    }
    // No error - did the column actually change?
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    if (!changed) {
      console.log(`  [PASS] ${label}: no rows changed (silent block)`);
      pass++;
      return;
    }
    console.log(`  [FAIL] ${label}: UPDATE SUCCEEDED — column tampered!`);
    fail++;
    failures.push(label);
  }

  function expectAllowed(label, result) {
    if (result.error) {
      console.log(`  [FAIL] ${label}: blocked unexpectedly — ${result.error.code} ${result.error.message}`);
      fail++;
      failures.push(label);
      return;
    }
    console.log(`  [PASS] ${label}: allowed`);
    pass++;
  }

  await setup();

  try {
    const c = await userClient();

    // ===== BILLING COLUMN ATTACKS (each must be blocked) =====
    console.log('\n--- Adversarial: billing column writes ---');

    const before1 = (await snapshotBefore()).data;

    const r1 = await c.from('companies').update({ plan_code: 'pro' }).eq('id', companyId).select();
    const after1 = (await snapshotBefore()).data;
    expectBlocked('UPDATE plan_code', r1, before1, after1);

    const r2 = await c.from('companies').update({ subscription_status: 'active' }).eq('id', companyId).select();
    const after2 = (await snapshotBefore()).data;
    expectBlocked('UPDATE subscription_status', r2, before1, after2);

    const r3 = await c.from('companies').update({ stripe_customer_id: 'cus_evil' }).eq('id', companyId).select();
    const after3 = (await snapshotBefore()).data;
    expectBlocked('UPDATE stripe_customer_id', r3, before1, after3);

    const r4 = await c.from('companies').update({ stripe_subscription_id: 'sub_evil' }).eq('id', companyId).select();
    const after4 = (await snapshotBefore()).data;
    expectBlocked('UPDATE stripe_subscription_id', r4, before1, after4);

    const r5 = await c.from('companies').update({ storage_topup_bytes: 999999999999 }).eq('id', companyId).select();
    const after5 = (await snapshotBefore()).data;
    expectBlocked('UPDATE storage_topup_bytes', r5, before1, after5);

    const r6 = await c.from('companies').update({ comp_until: '2099-01-01T00:00:00Z' }).eq('id', companyId).select();
    const after6 = (await snapshotBefore()).data;
    expectBlocked('UPDATE comp_until', r6, before1, after6);

    const r7 = await c.from('companies').update({ seat_count: 50 }).eq('id', companyId).select();
    const after7 = (await snapshotBefore()).data;
    expectBlocked('UPDATE seat_count', r7, before1, after7);

    const r8 = await c.from('companies').update({ trial_ends_at: '2099-01-01T00:00:00Z' }).eq('id', companyId).select();
    const after8 = (await snapshotBefore()).data;
    expectBlocked('UPDATE trial_ends_at', r8, before1, after8);

    const r9 = await c.from('companies').update({ cancel_at: null }).eq('id', companyId).select();
    const after9 = (await snapshotBefore()).data;
    expectBlocked('UPDATE cancel_at', r9, before1, after9);

    // ===== INSERT + DELETE attacks (each must be blocked) =====
    console.log('\n--- Adversarial: INSERT/DELETE ---');

    const ri = await c.from('companies').insert({
      name: 'rogue company',
      default_currency: 'USD',
      default_language: 'en',
      default_measurement_system: 'metric',
    }).select();
    if (ri.error) {
      console.log(`  [PASS] INSERT companies: blocked (${ri.error.code})`);
      pass++;
    } else {
      console.log(`  [FAIL] INSERT companies: SUCCEEDED`);
      fail++;
      failures.push('INSERT companies');
      // Cleanup the rogue row if it slipped through
      if (ri.data?.[0]?.id) await admin.from('companies').delete().eq('id', ri.data[0].id);
    }

    const rd = await c.from('companies').delete().eq('id', companyId).select();
    if (rd.error || (rd.data && rd.data.length === 0)) {
      console.log(`  [PASS] DELETE own company: blocked`);
      pass++;
    } else {
      console.log(`  [FAIL] DELETE own company: SUCCEEDED`);
      fail++;
      failures.push('DELETE companies');
    }

    // ===== ALLOWED PROFILE COLUMN WRITES =====
    console.log('\n--- Allowed: profile column writes ---');

    expectAllowed('UPDATE name',
      await c.from('companies').update({ name: 'New Name' }).eq('id', companyId));
    expectAllowed('UPDATE default_currency',
      await c.from('companies').update({ default_currency: 'GBP' }).eq('id', companyId));
    expectAllowed('UPDATE default_language',
      await c.from('companies').update({ default_language: 'es' }).eq('id', companyId));
    expectAllowed('UPDATE default_tax_rate',
      await c.from('companies').update({ default_tax_rate: 20 }).eq('id', companyId));
    expectAllowed('UPDATE default_measurement_system',
      await c.from('companies').update({ default_measurement_system: 'imperial_ft' }).eq('id', companyId));
    expectAllowed('UPDATE default_material_margin_percent',
      await c.from('companies').update({ default_material_margin_percent: 25 }).eq('id', companyId));
    expectAllowed('UPDATE default_labor_margin_percent',
      await c.from('companies').update({ default_labor_margin_percent: 30 }).eq('id', companyId));
    expectAllowed('UPDATE onboarding_completed_at',
      await c.from('companies').update({ onboarding_completed_at: new Date().toISOString() }).eq('id', companyId));

    // ===== Cross-company tampering attempt =====
    console.log('\n--- Adversarial: cross-company UPDATE ---');
    // Find some OTHER company id
    const { data: others } = await admin
      .from('companies')
      .select('id')
      .neq('id', companyId)
      .limit(1);
    if (others && others.length > 0) {
      const otherId = others[0].id;
      const rx = await c.from('companies').update({ name: 'hijacked' }).eq('id', otherId).select();
      if (rx.error || (rx.data && rx.data.length === 0)) {
        console.log(`  [PASS] UPDATE other company.name: blocked by RLS`);
        pass++;
      } else {
        console.log(`  [FAIL] UPDATE other company.name: SUCCEEDED`);
        fail++;
        failures.push('UPDATE other company');
      }
    }

    // ===== Smoke #10 / 2026-05-19: trigger path must still succeed =====
    // The C-01 lockdown revokes table-level UPDATE on companies from
    // authenticated AND only whitelists profile columns. Existing DB
    // triggers that update billing-y columns (storage_used_bytes) on
    // child-row inserts MUST still work — they own the only legitimate
    // path to that column. Regression: insert into quote_files as the
    // authenticated user; trg_update_company_storage must succeed and
    // bump companies.storage_used_bytes.
    console.log('\n--- Trigger path: authenticated INSERT into quote_files ---');
    const { data: probeQuote, error: probeQuoteErr } = await admin.from('quotes').insert({
      company_id: companyId,
      created_by_user_id: userId,
      customer_name: 'C01 trigger probe',
      job_name: 'C01 trigger probe',
      entry_mode: 'manual',
      job_status: 'draft',
      quote_number: 999,
      status: 'draft',
    }).select('id').single();
    if (probeQuoteErr) {
      console.log(`  [FAIL] could not create probe quote: ${probeQuoteErr.message}`);
      fail++;
      failures.push('probe quote insert');
    } else {
      const fileSize = 54321;
      const r = await c.from('quote_files').insert({
        company_id: companyId,
        quote_id: probeQuote.id,
        file_name: 'probe.png',
        file_type: 'plan',
        file_size: fileSize,
        mime_type: 'image/png',
        storage_path: `${companyId}/${probeQuote.id}/probe.png`,
      });
      if (r.error) {
        console.log(`  [FAIL] authenticated INSERT into quote_files: ${r.error.code} ${r.error.message?.slice(0,80)}`);
        fail++;
        failures.push('authenticated quote_files insert');
      } else {
        const { data: coAfter } = await admin
          .from('companies')
          .select('storage_used_bytes')
          .eq('id', companyId)
          .single();
        if (coAfter && coAfter.storage_used_bytes === fileSize) {
          console.log(`  [PASS] insert succeeded + trigger bumped storage_used_bytes to ${coAfter.storage_used_bytes}`);
          pass++;
        } else {
          console.log(`  [FAIL] insert succeeded but storage_used_bytes = ${coAfter?.storage_used_bytes} (expected ${fileSize})`);
          fail++;
          failures.push('storage_used_bytes not bumped');
        }
      }
      try { await admin.from('quote_files').delete().eq('company_id', companyId); } catch {}
      try { await admin.from('quotes').delete().eq('id', probeQuote.id); } catch {}
    }

  } catch (e) {
    console.error(`\nFatal: ${e.message}`);
    fail++;
    failures.push(`Fatal: ${e.message}`);
  } finally {
    await teardown();
  }

  console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
  if (fail > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log('=== PASS: C-01 lockdown verified ===');
}

main().catch((e) => {
  console.error(e);
  teardown().finally(() => process.exit(1));
});
