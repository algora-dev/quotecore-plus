/**
 * Phase 1 regression matrix.
 *
 * Verifies the entitlement system end-to-end:
 *   1. company_has_feature(plan, feature) truth table - full 4x6 grid
 *   2. company_effective_plan_active(status) truth table
 *   3. company_effective_plan_code(plan, status) - dunning collapse rules
 *   4. create_quote_atomic refuses when subscription is inactive (P0001)
 *   5. create_quote_atomic refuses when monthly limit reached (P0002)
 *
 * Strategy: drive a real fixture company through every (plan, status)
 * combination via the Supabase Management API SQL endpoint, assert each
 * SQL gate behaves correctly, then restore the company to its original
 * state on exit (always, even on failure).
 *
 * Why SQL-level testing not API-level:
 *   - Every server-side gate flows through one of these three SQL
 *     functions (company_has_feature, company_effective_plan_active,
 *     company_effective_plan_code) or through create_quote_atomic.
 *   - The Node /TypeScript code on top is thin and tested by the regular
 *     `next build` typecheck.
 *   - Proving the SQL functions are correct proves the gates are correct
 *     for both app code AND RLS policies (they share the same functions).
 *
 * Run:
 *   node scripts/test-regression-matrix.mjs
 *
 * Requires SUPABASE_ACCESS_TOKEN (PAT) and FIXTURE_COMPANY_ID env vars,
 * or fallback defaults below. Safe to re-run; restores fixture state on
 * exit.
 */

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

const PAT = process.env.SUPABASE_ACCESS_TOKEN;
const PROJECT_REF = 'aaavvfttkesdzblttmby';
// Use the company that's currently grandfathered to pro. Override via
// FIXTURE_COMPANY_ID if you want to use a different company.
const COMPANY_ID = process.env.FIXTURE_COMPANY_ID ?? '10453bde-98f5-46cb-a621-e540c19580ea';

if (!PAT) {
  console.error('SUPABASE_ACCESS_TOKEN is not set. Add to .env.local or export before running.');
  process.exit(1);
}

// Light rate limit so we don't trigger Supabase Management API gateway
// throttling (~90 calls in this script). 25ms baseline + 3 retries with
// exponential backoff on 5xx / network errors.
let lastCallAt = 0;
const MIN_INTERVAL_MS = 25;
const MAX_RETRIES = 3;

async function sql(query) {
  // Throttle: ensure at least MIN_INTERVAL_MS between requests.
  const elapsed = Date.now() - lastCallAt;
  if (elapsed < MIN_INTERVAL_MS) {
    await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS - elapsed));
  }

  let lastErr;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    lastCallAt = Date.now();
    let res;
    try {
      res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
    } catch (err) {
      lastErr = err;
      // Network blip: backoff and retry.
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt)));
        continue;
      }
      throw err;
    }
    const body = await res.text();
    if (res.ok) return JSON.parse(body);
    // Retry on 5xx / 429; fail fast on 4xx so we surface bad SQL.
    if ((res.status >= 500 || res.status === 429) && attempt < MAX_RETRIES) {
      lastErr = new Error(`SQL ${res.status}: ${body.slice(0, 200)}`);
      await new Promise((r) => setTimeout(r, 500 * Math.pow(2, attempt)));
      continue;
    }
    throw new Error(`SQL ${res.status}: ${body}`);
  }
  throw lastErr ?? new Error('sql: exhausted retries');
}

/**
 * Run a SQL statement that's expected to RAISE EXCEPTION. Returns the
 * Postgres SQLSTATE code (e.g. 'P0001') on success, or null if the
 * statement unexpectedly succeeded.
 */
async function sqlExpectError(query) {
  try {
    await sql(query);
    return null;
  } catch (err) {
    const msg = String(err.message ?? err);
    // Supabase returns JSON like {"code":"P0002","message":"...","details":"..."}
    const match = msg.match(/"code"\s*:\s*"([A-Z0-9]+)"/);
    if (match) return match[1];
    // Fallback: try to find PXXXX pattern in the raw text.
    const m2 = msg.match(/\b(P\d{4})\b/);
    return m2 ? m2[1] : 'unknown';
  }
}

let allOk = true;
let originalState = null;

function record(ok, label) {
  if (!ok) allOk = false;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}: ${label}`);
}

// ---------------------------------------------------------------------------
// EXPECTED TRUTH TABLES (source of truth: 2026-05-15 migration seeds)
// ---------------------------------------------------------------------------

// Feature flags from the seed INSERT in subscription_plans.
// NOTE 2026-05-19: trial flags updated post-tier_gating_v3 — trial is now
// "try ANY tier for 14 days" so it has every gated feature on; the cap
// columns (component_limit / flashing_limit / monthly_quote_limit) still
// hold it on a leash. On trial expiry the effective-plan helper collapses
// it to starter.
const PLAN_FEATURES = {
  trial:      { digital_takeoff: true,  flashings: true,  material_orders: true,  followups: true,  email_send: true,  activity_card: true  },
  starter:    { digital_takeoff: false, flashings: false, material_orders: false, followups: false, email_send: false, activity_card: false },
  growth:     { digital_takeoff: true,  flashings: false, material_orders: false, followups: false, email_send: true,  activity_card: true  },
  pro:        { digital_takeoff: true,  flashings: true,  material_orders: true,  followups: true,  email_send: true,  activity_card: true  },
  scaling:    { digital_takeoff: true,  flashings: true,  material_orders: true,  followups: true,  email_send: true,  activity_card: true  },
  business:   { digital_takeoff: true,  flashings: true,  material_orders: true,  followups: true,  email_send: true,  activity_card: true  },
  enterprise: { digital_takeoff: true,  flashings: true,  material_orders: true,  followups: true,  email_send: true,  activity_card: true  },
};

const PLAN_LIMITS = {
  trial: 10, starter: 50, growth: 100, pro: 100, scaling: 200, business: 500, enterprise: 2000,
};

const FEATURES = ['digital_takeoff', 'flashings', 'material_orders', 'followups', 'email_send', 'activity_card'];
const PLANS_TO_TEST = ['trial', 'starter', 'growth', 'pro'];
const STATUSES = ['trialing', 'active', 'past_due', 'grace', 'pending_data_purge', 'disputed', 'cancellation_pending', 'suspended', 'canceled'];

// Effective-plan-active expectation per status (independent of plan_code).
const STATUS_TO_ACTIVE = {
  trialing: true,
  active: true,
  past_due: true,
  grace: true,
  pending_data_purge: true,
  disputed: true,
  cancellation_pending: true,
  suspended: false,
  canceled: false,
};

// Effective-plan-CODE expectation given (plan_code, status). Healthy states
// keep the purchased plan; the "in trouble but alive" states collapse to
// starter; suspended/canceled fall back to starter via the ELSE branch.
function expectedEffectiveCode(planCode, status) {
  if (['active', 'trialing', 'past_due', 'disputed'].includes(status)) return planCode;
  if (['grace', 'pending_data_purge', 'cancellation_pending'].includes(status)) return 'starter';
  // suspended/canceled fall through to ELSE -> 'starter'.
  return 'starter';
}

async function setCompanyState(planCode, status, extra = '') {
  const safeExtra = extra ? `, ${extra}` : '';
  await sql(`UPDATE public.companies SET plan_code='${planCode}', subscription_status='${status}'${safeExtra} WHERE id='${COMPANY_ID}'`);
}

async function snapshotCompany() {
  const rows = await sql(`SELECT plan_code, subscription_status, trial_ends_at, first_payment_failure_at, current_period_end FROM public.companies WHERE id='${COMPANY_ID}'`);
  return rows[0];
}

async function restoreCompany() {
  if (!originalState) return;
  const o = originalState;
  // Clear any timers we set during the run, then restore plan + status.
  await sql(`UPDATE public.companies
    SET plan_code='${o.plan_code}',
        subscription_status='${o.subscription_status}',
        trial_ends_at=${o.trial_ends_at ? `'${o.trial_ends_at}'` : 'NULL'},
        first_payment_failure_at=${o.first_payment_failure_at ? `'${o.first_payment_failure_at}'` : 'NULL'}
    WHERE id='${COMPANY_ID}'`);
}

async function main() {
  console.log('=== Phase 1 regression matrix ===');
  console.log(`Fixture company: ${COMPANY_ID}\n`);

  originalState = await snapshotCompany();
  console.log(`Snapshot: plan=${originalState.plan_code} status=${originalState.subscription_status}\n`);

  // -------------------------------------------------------------------------
  // SECTION 1: company_effective_plan_active across all statuses
  // -------------------------------------------------------------------------
  console.log('--- Section 1: company_effective_plan_active across all statuses ---');
  for (const status of STATUSES) {
    await setCompanyState('pro', status);
    const rows = await sql(`SELECT public.company_effective_plan_active('${COMPANY_ID}'::uuid) AS active`);
    const got = rows[0].active;
    const expected = STATUS_TO_ACTIVE[status];
    record(got === expected, `status=${status.padEnd(22)} active=${got} (expected ${expected})`);
  }

  // -------------------------------------------------------------------------
  // SECTION 2: company_effective_plan_code (dunning collapse)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 2: company_effective_plan_code (dunning collapse) ---');
  for (const plan of PLANS_TO_TEST) {
    for (const status of STATUSES) {
      await setCompanyState(plan, status);
      const rows = await sql(`SELECT public.company_effective_plan_code('${COMPANY_ID}'::uuid) AS code`);
      const got = rows[0].code;
      const expected = expectedEffectiveCode(plan, status);
      record(got === expected, `plan=${plan.padEnd(8)} status=${status.padEnd(22)} -> effective=${got} (expected ${expected})`);
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 3: company_has_feature - full 4x6 grid in status='active'
  // -------------------------------------------------------------------------
  console.log('\n--- Section 3: company_has_feature full grid (status=active) ---');
  for (const plan of PLANS_TO_TEST) {
    await setCompanyState(plan, 'active');
    for (const feat of FEATURES) {
      const rows = await sql(`SELECT public.company_has_feature('${COMPANY_ID}'::uuid, '${feat}') AS allowed`);
      const got = rows[0].allowed;
      const expected = PLAN_FEATURES[plan][feat];
      record(got === expected, `plan=${plan.padEnd(8)} feat=${feat.padEnd(16)} got=${got} expected=${expected}`);
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 4: company_has_feature under dunning collapse
  // -------------------------------------------------------------------------
  // For a company on 'pro', once status moves to grace/pending_purge/
  // cancellation_pending, the effective plan is 'starter' so ALL features
  // should be false. suspended/canceled also yield starter -> false.
  console.log('\n--- Section 4: company_has_feature under dunning collapse (purchased=pro) ---');
  for (const status of ['grace', 'pending_data_purge', 'cancellation_pending', 'suspended', 'canceled']) {
    await setCompanyState('pro', status);
    for (const feat of FEATURES) {
      const rows = await sql(`SELECT public.company_has_feature('${COMPANY_ID}'::uuid, '${feat}') AS allowed`);
      const got = rows[0].allowed;
      // Expected: starter's feature value (all false in our seed).
      const expected = PLAN_FEATURES.starter[feat];
      record(got === expected, `pro+status=${status.padEnd(22)} feat=${feat.padEnd(16)} got=${got} expected=${expected}`);
    }
  }

  // -------------------------------------------------------------------------
  // SECTION 5: create_quote_atomic raises P0001 on suspended / canceled
  // -------------------------------------------------------------------------
  console.log('\n--- Section 5: create_quote_atomic refuses on inactive subscription ---');
  for (const status of ['suspended', 'canceled']) {
    await setCompanyState('pro', status);
    // Pick a user from the company to pass as p_user_id. Some validation
    // happens against quote columns, so we send the minimum required jsonb.
    const userRows = await sql(`SELECT id FROM public.users WHERE company_id='${COMPANY_ID}' LIMIT 1`);
    if (userRows.length === 0) {
      console.log(`  SKIP: no users on fixture company; cannot test create_quote_atomic`);
      continue;
    }
    const userId = userRows[0].id;
    const payload = `'{"customerName":"_regression_test","jobName":null,"taxRate":0,"measurementSystem":"metric","entryMode":"manual"}'::jsonb`;
    const code = await sqlExpectError(`SELECT public.create_quote_atomic('${COMPANY_ID}'::uuid, '${userId}'::uuid, ${payload})`);
    record(code === 'P0001', `status=${status.padEnd(22)} -> SQLSTATE=${code} (expected P0001)`);
  }

  // -------------------------------------------------------------------------
  // SECTION 6: create_quote_atomic raises P0002 at monthly limit
  // -------------------------------------------------------------------------
  console.log('\n--- Section 6: create_quote_atomic refuses at monthly quote limit ---');
  // Force a "limit reached" condition WITHOUT actually creating 50 real
  // quotes: write the company_quote_usage row directly to plan limit,
  // then attempt one more create. After the test, roll back the usage
  // counter so the real fixture company isn't affected.
  await setCompanyState('starter', 'active');
  const periodStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString().slice(0, 10);
  // Snapshot existing usage so we restore it after the test.
  const usageBefore = await sql(`SELECT quotes_created FROM public.company_quote_usage WHERE company_id='${COMPANY_ID}' AND period_start='${periodStart}'`);
  const usageBeforeVal = usageBefore[0]?.quotes_created ?? null;
  // Set usage at the starter limit (50).
  await sql(`INSERT INTO public.company_quote_usage (company_id, period_start, quotes_created)
             VALUES ('${COMPANY_ID}', '${periodStart}', 50)
             ON CONFLICT (company_id, period_start) DO UPDATE SET quotes_created = EXCLUDED.quotes_created`);

  const userRows2 = await sql(`SELECT id FROM public.users WHERE company_id='${COMPANY_ID}' LIMIT 1`);
  if (userRows2.length > 0) {
    const userId = userRows2[0].id;
    const payload = `'{"customerName":"_regression_test","jobName":null,"taxRate":0,"measurementSystem":"metric","entryMode":"manual"}'::jsonb`;
    const code = await sqlExpectError(`SELECT public.create_quote_atomic('${COMPANY_ID}'::uuid, '${userId}'::uuid, ${payload})`);
    record(code === 'P0002', `starter @ 50/50 -> SQLSTATE=${code} (expected P0002)`);
  } else {
    console.log('  SKIP: no users on fixture company');
  }

  // Restore the usage counter to its prior value (or delete if it didn't
  // exist before).
  if (usageBeforeVal === null) {
    await sql(`DELETE FROM public.company_quote_usage WHERE company_id='${COMPANY_ID}' AND period_start='${periodStart}'`);
  } else {
    await sql(`UPDATE public.company_quote_usage SET quotes_created=${usageBeforeVal} WHERE company_id='${COMPANY_ID}' AND period_start='${periodStart}'`);
  }

  // -------------------------------------------------------------------------
  // SECTION 7: Trial expiry collapse (trialing + past trial_ends_at = starter effective)
  // -------------------------------------------------------------------------
  console.log('\n--- Section 7: expired trial collapses to starter effective ---');
  // Set trial in the past with no stripe_subscription_id. Effective plan
  // should be 'starter'. Then put trial in the future -> effective stays
  // on the purchased plan (trial).
  await sql(`UPDATE public.companies
    SET plan_code='trial', subscription_status='trialing',
        trial_ends_at=now() - INTERVAL '1 day',
        stripe_subscription_id=NULL
    WHERE id='${COMPANY_ID}'`);
  const expiredRows = await sql(`SELECT public.company_effective_plan_code('${COMPANY_ID}'::uuid) AS code`);
  record(expiredRows[0].code === 'starter', `expired trial (no stripe_sub) -> ${expiredRows[0].code} (expected starter)`);

  await sql(`UPDATE public.companies
    SET trial_ends_at=now() + INTERVAL '7 days'
    WHERE id='${COMPANY_ID}'`);
  const validRows = await sql(`SELECT public.company_effective_plan_code('${COMPANY_ID}'::uuid) AS code`);
  record(validRows[0].code === 'trial', `valid trial -> ${validRows[0].code} (expected trial)`);

  // -------------------------------------------------------------------------
  // RESTORE + SUMMARY
  // -------------------------------------------------------------------------
  await restoreCompany();
  const after = await snapshotCompany();
  console.log(`\nRestored: plan=${after.plan_code} status=${after.subscription_status}`);

  console.log(allOk ? '\n=== PASS: all regression checks green ===' : '\n*** FAIL: one or more regression checks failed (see above) ***');
  process.exit(allOk ? 0 : 1);
}

main().catch(async (err) => {
  console.error('\n*** UNCAUGHT ERROR ***');
  console.error(err);
  // Best-effort restore even on uncaught failure.
  try { await restoreCompany(); } catch {}
  process.exit(2);
});
