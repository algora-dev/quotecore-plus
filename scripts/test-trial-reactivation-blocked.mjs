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
