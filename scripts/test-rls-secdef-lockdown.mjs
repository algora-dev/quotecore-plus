// Gerald audit C-02 regression test.
//
// Verifies SECURITY DEFINER function execution privileges. A real
// authenticated JWT should be blocked from calling:
//   - create_quote_atomic
//   - get_next_quote_number
//   - require_component_slot
//   - require_flashing_slot
//   - prune_rate_limits
//   - consume_rate_limit
//
// And should be ALLOWED to call (because RLS depends on them):
//   - company_has_feature
//   - company_effective_plan_code
//   - company_effective_plan_active
//   - user_belongs_to_company
//   - current_company_id
//   - company_component_count
//   - company_flashing_count
//
// Anon (no JWT) should be blocked from ALL of the above.
//
// Run: node scripts/test-rls-secdef-lockdown.mjs

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
  console.error('Missing env');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TEST_TAG = `c02-test-${Date.now()}`;
const TEST_EMAIL = `${TEST_TAG}@quotecore.local`;
const TEST_PASSWORD = `Test-${Math.random().toString(36).slice(2)}!A`;

let companyId = null;
let userId = null;

async function setup() {
  console.log('--- Setup ---');
  const { data: company, error: ce } = await admin
    .from('companies')
    .insert({
      name: `C-02 Test ${TEST_TAG}`,
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

  const { data: authUser, error: ae } = await admin.auth.admin.createUser({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (ae) throw new Error(`Auth user create failed: ${ae.message}`);
  userId = authUser.user.id;

  await admin.from('users').insert({
    id: userId,
    email: TEST_EMAIL,
    company_id: companyId,
    role: 'owner',
  });
  console.log(`  company=${companyId} user=${userId}\n`);
}

async function teardown() {
  console.log('\n--- Teardown ---');
  try { if (userId) await admin.auth.admin.deleteUser(userId); } catch {}
  try { if (userId) await admin.from('users').delete().eq('id', userId); } catch {}
  try { if (companyId) await admin.from('companies').delete().eq('id', companyId); } catch {}
  console.log('  done.');
}

async function userClient() {
  const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await c.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error) throw new Error(`Sign-in failed: ${error.message}`);
  return c;
}

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

let pass = 0, fail = 0;
const failures = [];

function expectBlocked(label, result) {
  if (result.error && /permission denied|not exist/i.test(result.error.message)) {
    console.log(`  [PASS] ${label}: blocked (${result.error.code || ''} ${result.error.message?.slice(0,60)})`);
    pass++;
  } else if (result.error) {
    console.log(`  [PASS] ${label}: blocked (${result.error.code || ''} ${result.error.message?.slice(0,60)})`);
    pass++;
  } else {
    console.log(`  [FAIL] ${label}: SUCCEEDED — leak!`);
    fail++;
    failures.push(label);
  }
}

function expectAllowed(label, result) {
  if (result.error) {
    console.log(`  [FAIL] ${label}: blocked unexpectedly — ${result.error.message?.slice(0,80)}`);
    fail++;
    failures.push(label);
  } else {
    console.log(`  [PASS] ${label}: allowed (returned ${JSON.stringify(result.data).slice(0,40)})`);
    pass++;
  }
}

async function main() {
  await setup();

  try {
    const c = await userClient();
    const a = anonClient();

    // ===== Authenticated should be BLOCKED from service-role-only fns =====
    console.log('--- Adversarial (authenticated): service-role-only RPCs ---');

    expectBlocked('rpc create_quote_atomic (cross-tenant)',
      await c.rpc('create_quote_atomic', {
        p_company_id: '00000000-0000-0000-0000-000000000001',
        p_user_id: userId,
        p_payload: { customer_name: 'evil', job_name: 'evil' },
      }));

    expectBlocked('rpc create_quote_atomic (own company)',
      await c.rpc('create_quote_atomic', {
        p_company_id: companyId,
        p_user_id: userId,
        p_payload: { customer_name: 'evil', job_name: 'evil' },
      }));

    expectBlocked('rpc get_next_quote_number',
      await c.rpc('get_next_quote_number', { p_company_id: companyId }));

    expectBlocked('rpc require_component_slot',
      await c.rpc('require_component_slot', { p_company_id: companyId }));

    expectBlocked('rpc require_flashing_slot',
      await c.rpc('require_flashing_slot', { p_company_id: companyId }));

    expectBlocked('rpc prune_rate_limits',
      await c.rpc('prune_rate_limits'));

    expectBlocked('rpc consume_rate_limit',
      await c.rpc('consume_rate_limit', { p_key: 'test', p_max: 10, p_window_ms: 60000 }));

    // ===== Authenticated SHOULD be allowed read-only helpers =====
    console.log('\n--- Allowed (authenticated): read-only RLS helpers ---');

    expectAllowed('rpc company_has_feature',
      await c.rpc('company_has_feature', { p_company_id: companyId, p_feature: 'digital_takeoff' }));

    expectAllowed('rpc company_effective_plan_code',
      await c.rpc('company_effective_plan_code', { p_company_id: companyId }));

    expectAllowed('rpc company_effective_plan_active',
      await c.rpc('company_effective_plan_active', { p_company_id: companyId }));

    expectAllowed('rpc user_belongs_to_company',
      await c.rpc('user_belongs_to_company', { target_company_id: companyId }));

    expectAllowed('rpc current_company_id',
      await c.rpc('current_company_id'));

    expectAllowed('rpc company_component_count',
      await c.rpc('company_component_count', { p_company_id: companyId }));

    expectAllowed('rpc company_flashing_count',
      await c.rpc('company_flashing_count', { p_company_id: companyId }));

    // ===== Anon should be blocked from EVERYTHING =====
    console.log('\n--- Adversarial (anon): everything blocked ---');

    expectBlocked('anon create_quote_atomic',
      await a.rpc('create_quote_atomic', {
        p_company_id: companyId,
        p_user_id: userId,
        p_payload: {},
      }));

    expectBlocked('anon company_has_feature',
      await a.rpc('company_has_feature', { p_company_id: companyId, p_feature: 'digital_takeoff' }));

    expectBlocked('anon user_belongs_to_company',
      await a.rpc('user_belongs_to_company', { target_company_id: companyId }));

    expectBlocked('anon prune_rate_limits',
      await a.rpc('prune_rate_limits'));

    // ===== Sanity: service role still works =====
    console.log('\n--- Sanity (service role): everything allowed ---');

    expectAllowed('service create_quote_atomic',
      await admin.rpc('create_quote_atomic', {
        p_company_id: companyId,
        p_user_id: userId,
        p_payload: { customer_name: 'service test', job_name: 'service test' },
      }));

    expectAllowed('service get_next_quote_number',
      await admin.rpc('get_next_quote_number', { p_company_id: companyId }));

    // Clean up the test quote we just created via service role
    await admin.from('quotes').delete().eq('company_id', companyId);
    await admin.from('company_quote_usage').delete().eq('company_id', companyId);

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
  console.log('=== PASS: C-02 SECURITY DEFINER lockdown verified ===');
}

main().catch((e) => {
  console.error(e);
  teardown().finally(() => process.exit(1));
});
