// Smoke test create_quote_atomic against the live DB.
//   1. Read current monthly counter for Residential Roofing.
//   2. Insert a quote via the RPC.
//   3. Verify counter incremented + new row in quotes.
//   4. Flip company to plan_code='starter' (quote_limit=50). If they're
//      already over 50, force a counter that's at the limit and confirm
//      the RPC rejects with P0002. Restore.
//   5. Flip company to subscription_status='suspended'. Confirm the RPC
//      rejects with P0001. Restore.
//   6. Cleanup: delete the test quote, decrement counter, restore status.

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

const COMPANY_ID = '10453bde-98f5-46cb-a621-e540c19580ea';

async function getProfileId() {
  const { data, error } = await admin
    .from('users')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .limit(1)
    .maybeSingle();
  if (error || !data) throw new Error(`No user for company: ${error?.message}`);
  return data.id;
}

async function getCounter() {
  const period = new Date();
  period.setUTCDate(1);
  const periodStart = period.toISOString().slice(0, 10);
  const { data } = await admin
    .from('company_quote_usage')
    .select('quotes_created')
    .eq('company_id', COMPANY_ID)
    .eq('period_start', periodStart)
    .maybeSingle();
  return { periodStart, count: data?.quotes_created ?? 0 };
}

async function callRpc(userId, payload) {
  return admin.rpc('create_quote_atomic', {
    p_company_id: COMPANY_ID,
    p_user_id: userId,
    p_payload: payload,
  });
}

async function main() {
  const userId = await getProfileId();
  console.log(`User: ${userId}\n`);

  let allOk = true;
  const createdQuoteIds = [];
  const before = await getCounter();
  console.log(`Initial counter for ${before.periodStart}: ${before.count}\n`);

  try {
    // --- Test 1: happy-path create
    console.log('--- Test 1: happy path ---');
    const r1 = await callRpc(userId, {
      customer_name: 'Atomic Test Customer',
      job_name: 'Atomic Test Job',
      measurement_system: 'metric',
      entry_mode: 'manual',
    });
    if (r1.error) { console.log('  FAIL:', r1.error); allOk = false; }
    else {
      const newId = r1.data;
      createdQuoteIds.push(newId);
      const after = await getCounter();
      const incOk = after.count === before.count + 1;
      console.log(`  Created quote: ${newId}`);
      console.log(`  Counter: ${before.count} -> ${after.count}  ${incOk ? 'PASS' : 'FAIL'}`);
      if (!incOk) allOk = false;
    }

    // --- Test 2: subscription_inactive (P0001)
    console.log('\n--- Test 2: subscription_status=suspended -> P0001 ---');
    await admin.from('companies').update({ subscription_status: 'suspended' }).eq('id', COMPANY_ID);
    const r2 = await callRpc(userId, { customer_name: 'Should Fail', measurement_system: 'metric' });
    const code2 = r2.error?.code;
    if (code2 === 'P0001') console.log('  PASS: rejected with P0001');
    else { console.log(`  FAIL: expected P0001, got code=${code2} msg=${r2.error?.message ?? '(none)'} data=${r2.data}`); allOk = false; }
    await admin.from('companies').update({ subscription_status: 'active' }).eq('id', COMPANY_ID);

    // --- Test 3: quote_limit_reached (P0002) by flipping to plan_code='starter' with limit 50,
    //     then forcing the counter to 50.
    console.log('\n--- Test 3: starter limit (50) hit -> P0002 ---');
    await admin.from('companies').update({ plan_code: 'starter' }).eq('id', COMPANY_ID);
    const periodNow = new Date(); periodNow.setUTCDate(1);
    const periodStartIso = periodNow.toISOString().slice(0, 10);
    await admin.from('company_quote_usage').upsert({
      company_id: COMPANY_ID, period_start: periodStartIso, quotes_created: 50,
    });
    const r3 = await callRpc(userId, { customer_name: 'Should Hit Limit', measurement_system: 'metric' });
    const code3 = r3.error?.code;
    if (code3 === 'P0002') {
      console.log('  PASS: rejected with P0002');
      console.log(`    detail: ${r3.error?.details ?? '(no detail)'}`);
    } else {
      console.log(`  FAIL: expected P0002, got code=${code3} msg=${r3.error?.message ?? '(none)'} data=${r3.data}`);
      allOk = false;
    }
    // Restore plan and counter
    await admin.from('companies').update({ plan_code: 'pro' }).eq('id', COMPANY_ID);
    await admin.from('company_quote_usage').upsert({
      company_id: COMPANY_ID, period_start: periodStartIso, quotes_created: before.count + createdQuoteIds.length,
    });

    // --- Test 4: bumping back over with pro (limit 100) still works
    console.log('\n--- Test 4: back to pro, create works again ---');
    const r4 = await callRpc(userId, { customer_name: 'Recovered Customer', measurement_system: 'metric' });
    if (r4.error) { console.log('  FAIL:', r4.error); allOk = false; }
    else { createdQuoteIds.push(r4.data); console.log(`  PASS: created ${r4.data}`); }

  } finally {
    // Cleanup: remove inserted quotes + roll counter back to its starting value
    for (const id of createdQuoteIds) {
      await admin.from('quotes').delete().eq('id', id);
    }
    await admin.from('company_quote_usage').upsert({
      company_id: COMPANY_ID, period_start: before.periodStart, quotes_created: before.count,
    });
    await admin.from('companies').update({
      plan_code: 'pro', subscription_status: 'active',
    }).eq('id', COMPANY_ID);
    console.log(`\nCleanup: removed ${createdQuoteIds.length} test quotes, restored counter=${before.count}, plan=pro, status=active.`);
  }

  console.log(allOk ? '\n=== ALL TESTS PASSED ===' : '\n*** SOME TESTS FAILED ***');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(2); });
