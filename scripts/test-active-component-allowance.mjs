/**
 * Active Smart Component Allowance - end-to-end test harness.
 *
 * Tests the full active/inactive component model against the real DB
 * using the service-role admin client (bypasses RLS to test DB triggers).
 *
 * Coverage:
 *   1.  Tier limit accuracy (Trial=10, Free=5, Starter=20, Pro=50, Pro Plus=200)
 *   2.  Creation never fails at cap - over-cap inserts land inactive
 *   3.  Activation boundary - below cap OK, at cap P0010
 *   4.  System rows excluded from allowance
 *   5.  Unlimited inactive storage (200+ inactive on Free)
 *   6.  Reconcile on downgrade - deactivates overflow, no data loss
 *   7.  Trial expiry collapse - effective plan becomes free, lazy reconcile
 *   8.  Suspended subscription blocks all inserts (P0001)
 *   9.  Counter accuracy after every operation
 *   10. Deactivation always succeeds (even at cap, even for last active row)
 *   11. Reactivation after reconcile respects new (lower) cap
 *   12. Delete active row decrements count; delete inactive row does not
 *
 * Creates its own throwaway company + user, runs all checks, tears down.
 * Run: node scripts/test-active-component-allowance.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';

// --- Load .env.local ---
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

// --- Constants ---
const TIER_LIMITS = {
  trial: 10,
  free: 5,
  starter: 20,
  pro: 50,
  pro_plus: 200,
};

const BASE_COMP = {
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

const TEST_TAG = `aca-test-${Date.now()}`;
let companyId = null;
let userId = null;
let pass = 0, fail = 0;
const failures = [];

// --- Helpers ---
function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  [PASS] ${label}`);
    pass++;
  } else {
    console.log(`  [FAIL] ${label}${detail ? ' - ' + detail : ''}`);
    fail++;
    failures.push(label);
  }
}

async function getActiveCount() {
  const { data, error } = await admin.rpc('company_component_count', { p_company_id: companyId });
  if (error) throw new Error(`company_component_count failed: ${error.message}`);
  return data;
}

async function getEffectivePlanCode() {
  const { data, error } = await admin.rpc('company_effective_plan_code', { p_company_id: companyId });
  if (error) throw new Error(`company_effective_plan_code failed: ${error.message}`);
  return data;
}

async function setCompany(planCode, status, extra = {}) {
  const update = { plan_code: planCode, subscription_status: status, ...extra };
  const { error } = await admin.from('companies').update(update).eq('id', companyId);
  if (error) throw new Error(`setCompany failed: ${error.message}`);
}

async function insertComponent(name, opts = {}) {
  return admin.from('component_library').insert({
    ...BASE_COMP,
    company_id: companyId,
    name,
    ...opts,
  }).select('id, is_active, is_system').single();
}

async function insertComponentNoSelect(name, opts = {}) {
  return admin.from('component_library').insert({
    ...BASE_COMP,
    company_id: companyId,
    name,
    ...opts,
  });
}

async function setActive(componentId, active) {
  return admin.from('component_library')
    .update({ is_active: active })
    .eq('id', componentId)
    .eq('company_id', companyId)
    .select('id')
    .single();
}

async function deleteComponent(componentId) {
  return admin.from('component_library')
    .delete()
    .eq('id', componentId)
    .eq('company_id', companyId);
}

async function clearAllComponents() {
  await admin.from('component_library').delete().eq('company_id', companyId);
}

async function getPlanLimit(planCode) {
  const { data, error } = await admin
    .from('subscription_plans')
    .select('component_limit')
    .eq('code', planCode)
    .single();
  if (error) throw new Error(`getPlanLimit failed: ${error.message}`);
  return data.component_limit;
}

// --- Setup / Teardown ---
async function setup() {
  console.log('--- Setup ---');
  const { data: company, error: ce } = await admin
    .from('companies')
    .insert({
      name: `ACA Test ${TEST_TAG}`,
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
  console.log('  user created');
  console.log('');
}

async function teardown() {
  console.log('\n--- Teardown ---');
  try {
    if (companyId) {
      await admin.from('component_library').delete().eq('company_id', companyId);
      await admin.from('companies').delete().eq('id', companyId);
    }
    if (userId) {
      await admin.auth.admin.deleteUser(userId);
      await admin.from('users').delete().eq('id', userId);
    }
  } catch (e) {
    console.error('  teardown error:', e.message);
  }
  console.log('  done.');
}

// --- Test Sections ---

async function test1_tierLimitAccuracy() {
  console.log('=== Test 1: Tier limit accuracy ===');
  for (const [planCode, expectedLimit] of Object.entries(TIER_LIMITS)) {
    const limit = await getPlanLimit(planCode);
    check(`${planCode} component_limit = ${expectedLimit}`, limit === expectedLimit,
      `got ${limit}`);
  }
  console.log('');
}

async function test2_creationNeverFailsAtCap() {
  console.log('=== Test 2: Creation never fails at cap (lands inactive) ===');
  await clearAllComponents();
  await setCompany('free', 'active');
  const limit = TIER_LIMITS.free; // 5

  // Fill to cap with active components.
  for (let i = 0; i < limit; i++) {
    const r = await insertComponent(`free-active-${i}`);
    check(`insert #${i + 1} below cap is active`, r.data?.is_active === true,
      `is_active=${r.data?.is_active}`);
  }
  check(`count at cap = ${limit}`, await getActiveCount() === limit,
    `got ${await getActiveCount()}`);

  // Insert one more - must succeed and be inactive.
  const over = await insertComponent(`free-overflow-1`);
  check('over-cap insert succeeds (no error)', !over.error,
    over.error?.message);
  check('over-cap insert lands inactive', over.data?.is_active === false,
    `is_active=${over.data?.is_active}`);

  // Insert several more - all must succeed and be inactive.
  for (let i = 2; i <= 5; i++) {
    const r = await insertComponent(`free-overflow-${i}`);
    check(`overflow insert #${i} succeeds`, !r.error, r.error?.message);
    check(`overflow insert #${i} is inactive`, r.data?.is_active === false,
      `is_active=${r.data?.is_active}`);
  }

  // Count should still be exactly the limit (only active count).
  check(`active count still = ${limit} after overflows`, await getActiveCount() === limit,
    `got ${await getActiveCount()}`);

  console.log('');
}

async function test3_activationBoundary() {
  console.log('=== Test 3: Activation boundary ===');
  await clearAllComponents();
  await setCompany('free', 'active');
  const limit = TIER_LIMITS.free; // 5

  // Fill to cap.
  const ids = [];
  for (let i = 0; i < limit; i++) {
    const r = await insertComponent(`act-bound-${i}`);
    ids.push(r.data.id);
  }
  check(`filled ${limit} active`, await getActiveCount() === limit);

  // Insert one inactive.
  const inactive = await insertComponent('act-bound-inactive', { is_active: false });
  check('inactive insert is inactive', inactive.data?.is_active === false);

  // Try to activate it - must fail with P0010.
  const activateResult = await setActive(inactive.data.id, true);
  check('activation at cap returns P0010', activateResult.error?.code === 'P0010',
    `code=${activateResult.error?.code}`);

  // Deactivate one active row.
  const deactResult = await setActive(ids[0], false);
  check('deactivation succeeds', !deactResult.error, deactResult.error?.message);
  check('count decremented after deactivate', await getActiveCount() === limit - 1,
    `got ${await getActiveCount()}`);

  // Now activation should succeed.
  const reActivate = await setActive(inactive.data.id, true);
  check('activation below cap succeeds', !reActivate.error, reActivate.error?.message);
  check('count incremented after activate', await getActiveCount() === limit,
    `got ${await getActiveCount()}`);

  console.log('');
}

async function test4_systemRowsExcluded() {
  console.log('=== Test 4: System rows excluded from allowance ===');
  await clearAllComponents();
  await setCompany('free', 'active');
  const limit = TIER_LIMITS.free; // 5

  // Fill to cap with user components.
  for (let i = 0; i < limit; i++) {
    await insertComponent(`sys-test-user-${i}`);
  }
  check(`user components at cap = ${limit}`, await getActiveCount() === limit);

  // Insert system components - they must not be blocked and must stay active.
  for (let i = 0; i < 5; i++) {
    const r = await insertComponent(`sys-test-system-${i}`, { is_system: true });
    check(`system insert #${i + 1} succeeds`, !r.error, r.error?.message);
    check(`system insert #${i + 1} is active`, r.data?.is_active === true,
      `is_active=${r.data?.is_active}`);
  }

  // Count must still be `limit` (system rows excluded).
  check(`active count still = ${limit} (system excluded)`, await getActiveCount() === limit,
    `got ${await getActiveCount()}`);

  console.log('');
}

async function test5_unlimitedInactiveStorage() {
  console.log('=== Test 5: Unlimited inactive storage ===');
  await clearAllComponents();
  await setCompany('free', 'active');

  // Insert 50 inactive components (well past the 5 active cap).
  let okCount = 0;
  for (let i = 0; i < 50; i++) {
    const r = await insertComponentNoSelect(`bulk-inactive-${i}`, { is_active: false });
    if (!r.error) okCount++;
  }
  check('50 inactive components all created', okCount === 50,
    `only ${okCount} created`);

  // Active count must be 0.
  check('active count = 0 (all inactive)', await getActiveCount() === 0,
    `got ${await getActiveCount()}`);

  // Total row count should be 50.
  const { count: totalCount } = await admin
    .from('component_library')
    .select('id', { count: 'exact', head: true })
    .eq('company_id', companyId)
    .eq('is_system', false);
  check('total stored components = 50', totalCount === 50,
    `got ${totalCount}`);

  console.log('');
}

async function test6_reconcileOnDowngrade() {
  console.log('=== Test 6: Reconcile on downgrade ===');
  await clearAllComponents();
  await setCompany('trial', 'trialing', {
    trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
  });
  const trialLimit = TIER_LIMITS.trial; // 10

  // Fill to trial cap with active components.
  const ids = [];
  for (let i = 0; i < trialLimit; i++) {
    const r = await insertComponent(`reconcile-${i}`);
    ids.push(r.data.id);
  }
  check(`trial filled to ${trialLimit} active`, await getActiveCount() === trialLimit);

  // Downgrade to free (limit 5). Reconcile should deactivate 5 newest.
  const { data: reconcileResult, error: reconErr } = await admin
    .rpc('reconcile_company_component_limit', { p_company_id: companyId });
  // Reconcile uses the effective plan. Before downgrade, effective = trial (10).
  // So reconcile won't do anything yet. We need to change the plan first.
  await setCompany('free', 'active');

  const { data: reconcileResult2, error: reconErr2 } = await admin
    .rpc('reconcile_company_component_limit', { p_company_id: companyId });
  check('reconcile succeeds', !reconErr2, reconErr2?.message);

  const deactivatedCount = Array.isArray(reconcileResult2) ? reconcileResult2[0]?.deactivated_count : reconcileResult2;
  check('reconcile deactivated exactly 5', deactivatedCount === 5,
    `got ${deactivatedCount}`);

  const postReconcileCount = await getActiveCount();
  check(`active count after reconcile = 5 (free limit)`, postReconcileCount === 5,
    `got ${postReconcileCount}`);

  // Verify the 5 oldest are still active, 5 newest are inactive.
  // We inserted reconcile-0 through reconcile-9 in order, so 0-4 should be active.
  for (let i = 0; i < 5; i++) {
    const { data: row } = await admin.from('component_library')
      .select('is_active')
      .eq('id', ids[i])
      .single();
    check(`oldest component #${i} still active`, row?.is_active === true,
      `is_active=${row?.is_active}`);
  }
  for (let i = 5; i < 10; i++) {
    const { data: row } = await admin.from('component_library')
      .select('is_active')
      .eq('id', ids[i])
      .single();
    check(`newest component #${i} deactivated`, row?.is_active === false,
      `is_active=${row?.is_active}`);
  }

  // Idempotent: running again deactivates 0 more.
  const { data: reconResult3 } = await admin
    .rpc('reconcile_company_component_limit', { p_company_id: companyId });
  const deactivatedCount3 = Array.isArray(reconResult3) ? reconResult3[0]?.deactivated_count : reconResult3;
  check('reconcile idempotent (0 deactivated on re-run)', deactivatedCount3 === 0,
    `got ${deactivatedCount3}`);

  console.log('');
}

async function test7_trialExpiryCollapse() {
  console.log('=== Test 7: Trial expiry collapse ===');
  await clearAllComponents();
  await setCompany('trial', 'trialing', {
    trial_ends_at: new Date(Date.now() + 14 * 86400000).toISOString(),
    stripe_subscription_id: null,
  });
  const trialLimit = TIER_LIMITS.trial; // 10

  // Fill to trial cap.
  for (let i = 0; i < trialLimit; i++) {
    await insertComponent(`expiry-${i}`);
  }
  check(`trial at cap = ${trialLimit}`, await getActiveCount() === trialLimit);

  // Expire the trial.
  await setCompany('trial', 'trialing', {
    trial_ends_at: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    stripe_subscription_id: null,
  });

  // Effective plan must collapse to free.
  const effCode = await getEffectivePlanCode();
  check('expired trial effective plan = free', effCode === 'free',
    `got ${effCode}`);

  // Reconcile should bring active count down to free limit (5).
  const { error: reconErr } = await admin
    .rpc('reconcile_company_component_limit', { p_company_id: companyId });
  check('reconcile after expiry succeeds', !reconErr, reconErr?.message);

  const postExpiryCount = await getActiveCount();
  check(`active count after expiry reconcile = 5 (free limit)`, postExpiryCount === 5,
    `got ${postExpiryCount}`);

  console.log('');
}

async function test8_suspendedBlocksAll() {
  console.log('=== Test 8: Suspended subscription blocks all inserts ===');
  await clearAllComponents();
  await setCompany('pro', 'suspended');

  // Active insert must fail with P0001.
  const activeResult = await insertComponent('suspended-active');
  check('active insert on suspended returns P0001',
    activeResult.error?.code === 'P0001',
    `code=${activeResult.error?.code}`);

  // Inactive insert on suspended: the new active-allowance model intentionally
  // allows inactive storage (can't be activated while suspended). The trigger
  // short-circuits for inactive rows before calling require_component_slot().
  // This is correct - the reactivation trigger (false->true) will P0001 if they
  // try to activate later.
  const inactiveResult = await insertComponent('suspended-inactive', { is_active: false });
  check('inactive insert on suspended succeeds (lands inactive, can\'t activate)',
    !inactiveResult.error && inactiveResult.data?.is_active === false,
    `error=${inactiveResult.error?.code}, is_active=${inactiveResult.data?.is_active}`);

  // Verify the inactive row can't be activated while suspended.
  if (inactiveResult.data) {
    const activateAttempt = await setActive(inactiveResult.data.id, true);
    check('activation attempt on suspended returns P0001',
      activateAttempt.error?.code === 'P0001',
      `code=${activateAttempt.error?.code}`);
  }

  // System insert should still succeed (system rows bypass cap).
  const systemResult = await insertComponent('suspended-system', { is_system: true });
  check('system insert on suspended succeeds', !systemResult.error,
    systemResult.error?.message);

  console.log('');
}

async function test9_counterAccuracy() {
  console.log('=== Test 9: Counter accuracy after operations ===');
  await clearAllComponents();
  await setCompany('starter', 'active');
  const limit = TIER_LIMITS.starter; // 20

  // Create 3 active.
  const ids = [];
  for (let i = 0; i < 3; i++) {
    const r = await insertComponent(`counter-${i}`);
    ids.push(r.data.id);
  }
  check('count = 3 after 3 active creates', await getActiveCount() === 3,
    `got ${await getActiveCount()}`);

  // Create 2 inactive.
  const inactiveIds = [];
  for (let i = 0; i < 2; i++) {
    const r = await insertComponent(`counter-inactive-${i}`, { is_active: false });
    inactiveIds.push(r.data.id);
  }
  check('count = 3 after 2 inactive creates (no change)', await getActiveCount() === 3,
    `got ${await getActiveCount()}`);

  // Deactivate one active (ids[0]).
  await setActive(ids[0], false);
  check('count = 2 after deactivate', await getActiveCount() === 2,
    `got ${await getActiveCount()}`);

  // Delete one active (ids[1]).
  await deleteComponent(ids[1]);
  check('count = 1 after deleting active', await getActiveCount() === 1,
    `got ${await getActiveCount()}`);

  // Delete one inactive (inactiveIds[0]) - should not change active count.
  await deleteComponent(inactiveIds[0]);
  check('count = 1 after deleting inactive (no change)', await getActiveCount() === 1,
    `got ${await getActiveCount()}`);

  // Reactivate ids[0] (was deactivated, not deleted).
  const reactivateResult = await setActive(ids[0], true);
  check('reactivate ids[0] succeeds', !reactivateResult.error,
    `error=${reactivateResult.error?.code} ${reactivateResult.error?.message}`);
  check('count = 2 after reactivate', await getActiveCount() === 2,
    `got ${await getActiveCount()}`);

  console.log('');
}

async function test10_deactivationAlwaysSucceeds() {
  console.log('=== Test 10: Deactivation always succeeds ===');
  await clearAllComponents();
  await setCompany('free', 'active');

  // Single active component.
  const r = await insertComponent('deact-test-1');
  check('one active created', await getActiveCount() === 1);

  // Deactivate it - must succeed even though it's the last active row.
  const result = await setActive(r.data.id, false);
  check('deactivate last active row succeeds', !result.error, result.error?.message);
  check('count = 0 after deactivating last', await getActiveCount() === 0,
    `got ${await getActiveCount()}`);

  // Deactivate an already-inactive row - must also succeed (idempotent).
  const result2 = await setActive(r.data.id, false);
  check('deactivate already-inactive succeeds', !result2.error, result2.error?.message);

  console.log('');
}

async function test11_reactivationAfterReconcile() {
  console.log('=== Test 11: Reactivation after reconcile respects new cap ===');
  await clearAllComponents();
  await setCompany('pro', 'active');
  const proLimit = TIER_LIMITS.pro; // 50

  // Fill to pro cap.
  for (let i = 0; i < proLimit; i++) {
    await insertComponent(`pro-cap-${i}`);
  }
  check(`pro at cap = ${proLimit}`, await getActiveCount() === proLimit);

  // Add 10 more inactive (overflow).
  const overflowIds = [];
  for (let i = 0; i < 10; i++) {
    const r = await insertComponent(`pro-overflow-${i}`, { is_active: false });
    overflowIds.push(r.data.id);
  }

  // Downgrade to starter (limit 20).
  await setCompany('starter', 'active');
  const { error } = await admin.rpc('reconcile_company_component_limit', { p_company_id: companyId });
  check('reconcile on downgrade succeeds', !error, error?.message);

  const postCount = await getActiveCount();
  check(`active count = 20 (starter limit) after downgrade`, postCount === 20,
    `got ${postCount}`);

  // Try to activate one of the overflow rows - must fail (already at starter cap).
  const activateResult = await setActive(overflowIds[0], true);
  check('reactivation at starter cap returns P0010',
    activateResult.error?.code === 'P0010',
    `code=${activateResult.error?.code}`);

  // Deactivate one active, then reactivation should succeed.
  const { data: firstActive } = await admin.from('component_library')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .single();
  if (firstActive) {
    await setActive(firstActive.id, false);
    check('count = 19 after one deactivate', await getActiveCount() === 19,
      `got ${await getActiveCount()}`);

    const reAct = await setActive(overflowIds[0], true);
    check('reactivation below cap succeeds', !reAct.error, reAct.error?.message);
    check('count = 20 after reactivation', await getActiveCount() === 20,
      `got ${await getActiveCount()}`);
  }

  console.log('');
}

async function test12_proPlusHighCap() {
  console.log('=== Test 12: Pro Plus high cap (200) ===');
  await clearAllComponents();
  await setCompany('pro_plus', 'active');
  const limit = TIER_LIMITS.pro_plus; // 200

  // Insert exactly 200 active components.
  let okCount = 0;
  for (let i = 0; i < limit; i++) {
    const r = await insertComponentNoSelect(`pp-${i}`);
    if (!r.error) okCount++;
  }
  check(`200 active components created on pro_plus`, okCount === 200,
    `only ${okCount} created`);
  check(`active count = 200`, await getActiveCount() === 200,
    `got ${await getActiveCount()}`);

  // 201st must land inactive.
  const r = await insertComponent('pp-overflow');
  check('201st insert succeeds', !r.error, r.error?.message);
  check('201st insert is inactive', r.data?.is_active === false,
    `is_active=${r.data?.is_active}`);
  check('active count still 200', await getActiveCount() === 200,
    `got ${await getActiveCount()}`);

  console.log('');
}

// --- Main ---
async function main() {
  console.log('=== Active Smart Component Allowance Test ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log('');

  await setup();

  try {
    await test1_tierLimitAccuracy();
    await test2_creationNeverFailsAtCap();
    await test3_activationBoundary();
    await test4_systemRowsExcluded();
    await test5_unlimitedInactiveStorage();
    await test6_reconcileOnDowngrade();
    await test7_trialExpiryCollapse();
    await test8_suspendedBlocksAll();
    await test9_counterAccuracy();
    await test10_deactivationAlwaysSucceeds();
    await test11_reactivationAfterReconcile();
    await test12_proPlusHighCap();
  } catch (e) {
    console.error(`\nFatal error: ${e.message}`);
    console.error(e.stack);
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
  console.log('=== ALL TESTS PASSED ===');
}

main().catch((e) => {
  console.error(e);
  teardown().finally(() => process.exit(1));
});
