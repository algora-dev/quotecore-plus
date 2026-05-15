// Smoke test: load entitlements for a real grandfathered company, then
// flip it temporarily to each tier and verify the effective entitlements
// match the seed feature matrix. Restores plan_code='pro' on exit.
//
// Run: node scripts/test-entitlements.mjs

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

// Pick the most stable grandfathered company we know is safe to poke at:
// Residential Roofing (the prod test account). We'll restore plan_code='pro'
// at the end.
const COMPANY_ID = '10453bde-98f5-46cb-a621-e540c19580ea';

const EXPECTED = {
  trial:    { takeoff: true,  flashings: false, orders: false, followups: false, send: false, activity: true  },
  starter:  { takeoff: false, flashings: false, orders: false, followups: false, send: false, activity: false },
  growth:   { takeoff: true,  flashings: false, orders: false, followups: false, send: true,  activity: true  },
  pro:      { takeoff: true,  flashings: true,  orders: true,  followups: true,  send: true,  activity: true  },
};

async function setPlan(code) {
  const { error } = await admin
    .from('companies')
    .update({ plan_code: code, subscription_status: 'active' })
    .eq('id', COMPANY_ID);
  if (error) throw new Error(`Failed to set plan ${code}: ${error.message}`);
}

async function checkFeatures(planLabel) {
  const features = ['digital_takeoff', 'flashings', 'material_orders', 'followups', 'email_send', 'activity_card'];
  const results = {};
  for (const f of features) {
    const { data, error } = await admin.rpc('company_has_feature', {
      p_company_id: COMPANY_ID,
      p_feature: f,
    });
    if (error) throw new Error(`company_has_feature(${f}) failed: ${error.message}`);
    results[f] = data;
  }
  const { data: effCode } = await admin.rpc('company_effective_plan_code', { p_company_id: COMPANY_ID });
  const { data: effActive } = await admin.rpc('company_effective_plan_active', { p_company_id: COMPANY_ID });
  console.log(`[${planLabel}] effective=${effCode} active=${effActive}`);
  console.log(`  takeoff=${results.digital_takeoff} flashings=${results.flashings} orders=${results.material_orders} followups=${results.followups} send=${results.email_send} activity=${results.activity_card}`);
  return { effCode, effActive, ...results };
}

function expect(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) {
    console.log(`  FAIL: ${label} = ${actual} (expected ${expected})`);
  }
  return ok;
}

async function verifyPlan(planCode) {
  await setPlan(planCode);
  const r = await checkFeatures(planCode);
  const exp = EXPECTED[planCode];
  let ok = true;
  ok &= expect('effectivePlanCode', r.effCode, planCode);
  ok &= expect('effectiveActive', r.effActive, true);
  ok &= expect('digital_takeoff', r.digital_takeoff, exp.takeoff);
  ok &= expect('flashings', r.flashings, exp.flashings);
  ok &= expect('material_orders', r.material_orders, exp.orders);
  ok &= expect('followups', r.followups, exp.followups);
  ok &= expect('email_send', r.email_send, exp.send);
  ok &= expect('activity_card', r.activity_card, exp.activity);
  return !!ok;
}

async function main() {
  let allOk = true;
  console.log('=== Subscription tiers entitlement smoke test ===\n');

  try {
    for (const code of ['trial', 'starter', 'growth', 'pro']) {
      const ok = await verifyPlan(code);
      allOk = allOk && ok;
      console.log(ok ? `  PASS\n` : `  *** FAIL ***\n`);
    }

    // Suspended / canceled simulations
    console.log('--- Suspended status (with plan_code=pro) ---');
    await setPlan('pro');
    await admin.from('companies').update({ subscription_status: 'suspended' }).eq('id', COMPANY_ID);
    const r = await checkFeatures('pro+suspended');
    if (r.effActive !== false) { console.log('  FAIL: expected effActive=false for suspended'); allOk = false; }
    else { console.log('  PASS: effActive=false, gates all closed\n'); }

  } finally {
    // Always restore.
    await admin
      .from('companies')
      .update({ plan_code: 'pro', subscription_status: 'active' })
      .eq('id', COMPANY_ID);
    console.log('Cleanup: restored plan_code=pro, status=active.');
  }

  console.log(allOk ? '\n=== ALL TESTS PASSED ===' : '\n*** SOME TESTS FAILED ***');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(2); });
