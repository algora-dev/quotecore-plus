// Gerald audit M-01R regression test.
//
// Verifies the durable once-per-company trial marker:
//   1. companies.trial_started_at column exists.
//   2. A fresh company starts with trial_started_at = NULL.
//   3. After a simulated first activation (matches what the server action
//      writes), trial_started_at is set.
//   4. The activateTrial server-action source guards on trial_started_at,
//      so a second attempt (even with status flipped back to 'canceled'
//      and trial_ends_at in the past) would be refused.
//   5. Backfill: no pre-existing trialing/post-trial companies remain
//      with NULL trial_started_at after the migration.
//
// Run: node scripts/test-trial-reactivation-blocked.mjs

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

const TAG = `m01r-test-${Date.now()}`;
let companyId = null;
let userId = null;
let pass = 0, fail = 0;
const failures = [];

function record(ok, label) {
  if (ok) { console.log(`  [PASS] ${label}`); pass++; }
  else { console.log(`  [FAIL] ${label}`); fail++; failures.push(label); }
}

async function setup() {
  console.log('--- Setup ---');
  const { data: c } = await admin.from('companies').insert({
    name: `M-01R ${TAG}`,
    slug: TAG,
    default_currency: 'USD',
    default_language: 'en',
    default_measurement_system: 'metric',
    plan_code: 'trial',
    subscription_status: 'canceled',
    trial_ends_at: null,
    trial_started_at: null,
    stripe_customer_id: null,
    stripe_subscription_id: null,
  }).select('id, trial_started_at').single();
  companyId = c.id;

  const email = `${TAG}@quotecore.local`;
  const password = 'TestPassword123!';
  const { data: au } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  userId = au.user.id;
  await admin.from('users').insert({
    id: userId, email, company_id: companyId, role: 'owner',
  });

  console.log(`  company=${companyId} user=${userId}`);
}

async function teardown() {
  console.log('\n--- Teardown ---');
  try { if (userId) await admin.auth.admin.deleteUser(userId); } catch {}
  try { if (userId) await admin.from('users').delete().eq('id', userId); } catch {}
  try { if (companyId) await admin.from('companies').delete().eq('id', companyId); } catch {}
  console.log('  done.');
}

async function main() {
  await setup();

  try {
    // 1. Initial state: trial_started_at IS NULL.
    const { data: initial } = await admin
      .from('companies')
      .select('trial_started_at')
      .eq('id', companyId)
      .single();
    record(initial && initial.trial_started_at === null,
      `fresh company has trial_started_at = NULL (got ${initial?.trial_started_at})`);

    // 2. Simulate the server action's successful first-activation write.
    const trialEndsAt = new Date(Date.now() + 14 * 86400000).toISOString();
    const now = new Date().toISOString();
    const { error: act1 } = await admin
      .from('companies')
      .update({
        plan_code: 'trial',
        subscription_status: 'trialing',
        trial_ends_at: trialEndsAt,
        trial_started_at: now,
      })
      .eq('id', companyId);
    record(!act1, `first activation update succeeds (${act1?.message ?? 'ok'})`);

    const { data: afterAct } = await admin
      .from('companies')
      .select('trial_started_at, subscription_status')
      .eq('id', companyId)
      .single();
    record(afterAct.trial_started_at !== null,
      `trial_started_at is SET after activation`);
    record(afterAct.subscription_status === 'trialing',
      `subscription_status = 'trialing'`);

    // 3. Expire the trial (simulating reality 14 days later) and flip status.
    await admin.from('companies').update({
      trial_ends_at: new Date(Date.now() - 86400000).toISOString(),
      subscription_status: 'canceled',
    }).eq('id', companyId);

    // 4. The server action source must guard on trial_started_at and
    // stamp it on activation. Static source check is what catches a future
    // regression where someone removes the guard.
    const src = readFileSync(
      'app/(auth)/[workspaceSlug]/account/billing/actions.ts',
      'utf8',
    );
    record(
      /if\s*\(\s*company\.trial_started_at\s*\)/.test(src),
      `activateTrial source guards on company.trial_started_at`,
    );
    record(
      /trial_started_at\s*:\s*nowIso/.test(src),
      `activateTrial source stamps trial_started_at on first activation`,
    );

    // 5. trial_started_at persists after expiry, so a second activation
    // would fail the guard from #4 even though trial_ends_at is past and
    // subscription_status is 'canceled'.
    const { data: postExpiry } = await admin
      .from('companies')
      .select('trial_started_at, subscription_status, trial_ends_at')
      .eq('id', companyId)
      .single();
    record(postExpiry.trial_started_at !== null,
      `trial_started_at persists after expiry`);
    record(postExpiry.subscription_status === 'canceled',
      `subscription_status = 'canceled' (would fail old proxy, blocked by new guard)`);

    // 6. Backfill sanity: no live company should be trialing OR have a
    // trial_ends_at set without trial_started_at backfilled.
    const { data: orphans, error: orphErr } = await admin
      .from('companies')
      .select('id')
      .is('trial_started_at', null)
      .or('subscription_status.eq.trialing,trial_ends_at.not.is.null');
    if (orphErr) {
      record(false, `backfill orphan check failed: ${orphErr.message}`);
    } else {
      const realOrphans = (orphans ?? []).filter(o => o.id !== companyId);
      record(realOrphans.length === 0,
        `no live companies with NULL trial_started_at remain (orphans: ${realOrphans.length})`);
    }

    // 7. M-01R-P2: signup/onboarding minimal-insert path. Mirror exactly
    // what app/signup/actions.ts and app/(auth)/onboarding/actions.ts do:
    // insert with profile fields only and let the BEFORE INSERT trigger
    // (set_company_trial_defaults) fill plan_code, subscription_status,
    // trial_ends_at AND now also trial_started_at. If the trigger fix
    // didn't land, this test fails.
    console.log('\n--- Test 7: signup-path minimal insert sets trial_started_at via trigger ---');
    const SIGNUP_TAG = `m01r-p2-signup-${Date.now()}`;
    const { data: signupCo, error: signupErr } = await admin
      .from('companies')
      .insert({
        name: `Signup ${SIGNUP_TAG}`,
        slug: SIGNUP_TAG,
        default_currency: 'USD',
        default_language: 'en',
        default_measurement_system: 'metric',
        // INTENTIONALLY no plan_code / subscription_status / trial_ends_at /
        // trial_started_at — same as signup/onboarding actions today.
      })
      .select('id, plan_code, subscription_status, trial_ends_at, trial_started_at')
      .single();

    let signupCleanupId = null;
    if (signupErr) {
      record(false, `signup-style insert failed: ${signupErr.message}`);
    } else {
      signupCleanupId = signupCo.id;
      record(signupCo.plan_code === 'trial',
        `auto-trial: plan_code='${signupCo.plan_code}' (expected 'trial')`);
      record(signupCo.subscription_status === 'trialing',
        `auto-trial: subscription_status='${signupCo.subscription_status}' (expected 'trialing')`);
      record(signupCo.trial_ends_at !== null,
        `auto-trial: trial_ends_at is SET`);
      record(signupCo.trial_started_at !== null,
        `auto-trial: trial_started_at is SET (M-01R-P2 trigger fix) (got ${signupCo.trial_started_at})`);

      // Now expire the auto-trial and verify a follow-up activateTrial call
      // would still be refused because trial_started_at remains set.
      await admin.from('companies').update({
        trial_ends_at: new Date(Date.now() - 86400000).toISOString(),
        subscription_status: 'canceled',
      }).eq('id', signupCleanupId);

      const { data: postExpireSignup } = await admin
        .from('companies')
        .select('trial_started_at')
        .eq('id', signupCleanupId)
        .single();
      record(postExpireSignup.trial_started_at !== null,
        `signup-path trial_started_at persists post-expiry (would block activateTrial)`);
    }

    // Cleanup the signup-style fixture.
    if (signupCleanupId) {
      await admin.from('companies').delete().eq('id', signupCleanupId);
    }

    // 8. Smoke #2 fix (2026-05-19 migration 20260519120000): an EXPIRED
    // trial without a Stripe subscription must report effective_active =
    // false, AND mutating helpers (create_quote_atomic, the cap-check
    // RPCs) must refuse with P0001 subscription_inactive. Before the
    // migration, the same fixture reported effective_active = true and
    // the user could create up to 25 quotes/month under starter caps.
    console.log('\n--- Test 8: smoke #2 — expired trial without Stripe sub = inactive ---');
    const EXP_TAG = `m01r-p2-expired-${Date.now()}`;
    const { data: expCo, error: expErr } = await admin
      .from('companies')
      .insert({
        name: `Expired ${EXP_TAG}`,
        slug: EXP_TAG,
        default_currency: 'USD',
        default_language: 'en',
        default_measurement_system: 'metric',
        plan_code: 'trial',
        subscription_status: 'trialing',
        trial_started_at: new Date(Date.now() - 20 * 86400000).toISOString(),
        trial_ends_at: new Date(Date.now() - 6 * 86400000).toISOString(),
        stripe_subscription_id: null,
      })
      .select('id')
      .single();

    let expCleanupId = null;
    if (expErr) {
      record(false, `expired-trial fixture insert failed: ${expErr.message}`);
    } else {
      expCleanupId = expCo.id;

      // Effective plan + active flag.
      const { data: planData } = await admin.rpc('company_effective_plan_code', { p_company_id: expCleanupId });
      const { data: activeData } = await admin.rpc('company_effective_plan_active', { p_company_id: expCleanupId });
      record(planData === 'starter',
        `expired trial: effective_plan = 'starter' (got ${planData})`);
      record(activeData === false,
        `expired trial: effective_active = false (got ${activeData})`);

      // create_quote_atomic must refuse with P0001. We call it via
      // service-role admin (RPC is locked down to service_role anyway).
      // P0001 = subscription_inactive per the SQL helper conventions.
      const ownerUserId = userId; // re-use the fixture user from setup
      const { error: rpcErr } = await admin.rpc('create_quote_atomic', {
        p_company_id: expCleanupId,
        p_user_id: ownerUserId,
        p_payload: { customer_name: 'should not be created', job_name: 'should not be created' },
      });
      if (rpcErr && (rpcErr.code === 'P0001' || rpcErr.message?.includes('subscription_inactive'))) {
        console.log(`  [PASS] create_quote_atomic refuses with P0001 subscription_inactive`);
        pass++;
      } else if (rpcErr) {
        console.log(`  [FAIL] create_quote_atomic refused but with unexpected code: ${rpcErr.code} ${rpcErr.message?.slice(0,80)}`);
        fail++;
        failures.push('create_quote_atomic unexpected SQLSTATE on expired trial');
      } else {
        console.log(`  [FAIL] create_quote_atomic SUCCEEDED on expired trial — write window leak`);
        fail++;
        failures.push('create_quote_atomic succeeded on expired trial');
      }

      // Cleanup any quote/usage row that did sneak through, then the
      // company itself.
      try { await admin.from('quotes').delete().eq('company_id', expCleanupId); } catch {}
      try { await admin.from('company_quote_usage').delete().eq('company_id', expCleanupId); } catch {}
      await admin.from('companies').delete().eq('id', expCleanupId);
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
  console.log('=== PASS: M-01R trial reactivation blocked verified ===');
}

main().catch(e => { console.error(e); teardown().finally(() => process.exit(1)); });
