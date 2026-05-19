// Gerald audit H-04 regression test.
//
// Verifies BEFORE INSERT triggers on component_library and flashing_library
// enforce tier caps even when the caller bypasses the app server actions.
//
// Strategy: use the service-role admin client (bypasses RLS) to do direct
// .from('component_library').insert(...) and .from('flashing_library').insert(...)
// past the documented cap. Each over-cap insert MUST fail with the expected
// SQLSTATE. UI-layer enforcement isn't exercised here \u2014 only the DB boundary.
//
// Run: node scripts/test-library-cap-triggers.mjs

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

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const TEST_TAG = `h04-test-${Date.now()}`;
let companyId = null;
let userId = null;
let pass = 0, fail = 0;
const failures = [];

async function setup() {
  console.log('--- Setup ---');
  const { data: company, error: ce } = await admin
    .from('companies')
    .insert({
      name: `H-04 Test ${TEST_TAG}`,
      slug: TEST_TAG,
      default_currency: 'USD',
      default_language: 'en',
      default_measurement_system: 'metric',
      plan_code: 'starter',           // starter: 10 components, 0 flashings, flashings feature OFF
      subscription_status: 'active',
    })
    .select('id')
    .single();
  if (ce) throw new Error(`Company create failed: ${ce.message}`);
  companyId = company.id;
  console.log(`  company_id = ${companyId}`);

  const { data: authUser, error: ae } = await admin.auth.admin.createUser({
    email: `${TEST_TAG}@quotecore.local`,
    password: 'TestPassword123!',
    email_confirm: true,
  });
  if (ae) throw new Error(`User create failed: ${ae.message}`);
  userId = authUser.user.id;
  await admin.from('users').insert({
    id: userId,
    email: `${TEST_TAG}@quotecore.local`,
    company_id: companyId,
    role: 'owner',
  });
  console.log('');
}

async function teardown() {
  console.log('\n--- Teardown ---');
  try { await admin.from('flashing_library').delete().eq('company_id', companyId); } catch {}
  try { await admin.from('component_library').delete().eq('company_id', companyId); } catch {}
  try { if (userId) await admin.auth.admin.deleteUser(userId); } catch {}
  try { if (userId) await admin.from('users').delete().eq('id', userId); } catch {}
  try { if (companyId) await admin.from('companies').delete().eq('id', companyId); } catch {}
  console.log('  done.');
}

function expectInsertBlocked(label, result, expectedCode) {
  if (result.error && (result.error.code === expectedCode || result.error.message?.includes(expectedCode))) {
    console.log(`  [PASS] ${label}: blocked with ${expectedCode}`);
    pass++;
  } else if (result.error) {
    console.log(`  [PASS] ${label}: blocked (${result.error.code} ${result.error.message?.slice(0,80)})`);
    pass++;
  } else {
    console.log(`  [FAIL] ${label}: SUCCEEDED \u2014 cap leak!`);
    fail++;
    failures.push(label);
  }
}

function expectInsertAllowed(label, result) {
  if (result.error) {
    console.log(`  [FAIL] ${label}: blocked unexpectedly (${result.error.code} ${result.error.message?.slice(0,80)})`);
    fail++;
    failures.push(label);
  } else {
    console.log(`  [PASS] ${label}: allowed`);
    pass++;
  }
}

async function main() {
  await setup();

  try {
    // ===== component_library cap on STARTER (limit = 10) =====
    console.log('--- component_library: starter cap = 10 ---');

    const baseComp = {
      component_type: 'main',
      measurement_type: 'lineal',
      default_material_rate: 1,
      default_labour_rate: 0,
      default_waste_type: 'percent',
      default_waste_percent: 0,
      default_waste_fixed: 0,
      default_pitch_type: 'none',
      show_price_default: true,
      show_dimensions_default: true,
    };

    // Fill to exactly the limit.
    let fillOk = true;
    for (let i = 0; i < 10; i++) {
      const r = await admin.from('component_library').insert({
        ...baseComp,
        company_id: companyId,
        name: `comp-${i}`,
      });
      if (r.error) {
        console.log(`  [FAIL] fill-${i}: ${r.error.message}`);
        fail++;
        failures.push(`fill-${i}`);
        fillOk = false;
        break;
      }
    }
    if (fillOk) {
      console.log(`  [PASS] filled 10/10 components OK`);
      pass++;
    }

    // 11th must be blocked by trigger -> P0010.
    expectInsertBlocked(
      'INSERT 11th component (over cap)',
      await admin.from('component_library').insert({
        ...baseComp,
        company_id: companyId,
        name: 'comp-11-overflow',
      }),
      'P0010',
    );

    // Soft-delete one (is_active=false) -> count drops to 9, new insert OK.
    const { data: existing } = await admin
      .from('component_library')
      .select('id')
      .eq('company_id', companyId)
      .limit(1)
      .single();
    await admin.from('component_library').update({ is_active: false }).eq('id', existing.id);

    expectInsertAllowed(
      'INSERT after soft-delete (back under cap)',
      await admin.from('component_library').insert({
        ...baseComp,
        company_id: companyId,
        name: 'comp-replacement',
      }),
    );

    // Reactivating the soft-deleted row would push us back to 11 -> blocked.
    expectInsertBlocked(
      'UPDATE is_active=true on soft-deleted row (would overflow)',
      await admin.from('component_library').update({ is_active: true }).eq('id', existing.id),
      'P0010',
    );

    // ===== flashing_library on STARTER (feature OFF) -> P0012 =====
    console.log('\n--- flashing_library: starter (feature off) ---');

    expectInsertBlocked(
      'INSERT flashing on starter (feature gated)',
      await admin.from('flashing_library').insert({
        company_id: companyId,
        name: 'flash-1',
        image_url: 'https://example.com/flash.png',
      }),
      'P0012',
    );

    // Upgrade to trial (flashings ON, limit 5).
    await admin
      .from('companies')
      .update({ plan_code: 'trial', subscription_status: 'trialing', trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString() })
      .eq('id', companyId);

    console.log('\n--- flashing_library: trial cap = 5 ---');

    let flashFillOk = true;
    for (let i = 0; i < 5; i++) {
      const r = await admin.from('flashing_library').insert({
        company_id: companyId,
        name: `flash-${i}`,
        image_url: 'https://example.com/flash.png',
      });
      if (r.error) {
        console.log(`  [FAIL] flash-fill-${i}: ${r.error.message}`);
        fail++;
        failures.push(`flash-fill-${i}`);
        flashFillOk = false;
        break;
      }
    }
    if (flashFillOk) {
      console.log(`  [PASS] filled 5/5 flashings on trial OK`);
      pass++;
    }

    expectInsertBlocked(
      'INSERT 6th flashing (over cap)',
      await admin.from('flashing_library').insert({
        company_id: companyId,
        name: 'flash-overflow',
        image_url: 'https://example.com/flash.png',
      }),
      'P0011',
    );

    // ===== Suspended subscription blocks everything =====
    console.log('\n--- suspended subscription blocks all library inserts ---');
    await admin
      .from('companies')
      .update({ plan_code: 'pro', subscription_status: 'suspended' })
      .eq('id', companyId);

    expectInsertBlocked(
      'INSERT component while suspended',
      await admin.from('component_library').insert({
        ...baseComp,
        company_id: companyId,
        name: 'comp-suspended',
      }),
      'P0001',
    );

    expectInsertBlocked(
      'INSERT flashing while suspended',
      await admin.from('flashing_library').insert({
        company_id: companyId,
        name: 'flash-suspended',
        image_url: 'https://example.com/flash.png',
      }),
      'P0001',
    );
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
  console.log('=== PASS: H-04 cap triggers verified ===');
}

main().catch((e) => {
  console.error(e);
  teardown().finally(() => process.exit(1));
});
