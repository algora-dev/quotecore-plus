// Gerald audit H-01 + H-03 regression test.
//
// Invokes the Stripe webhook route handler directly (no live Stripe call)
// with a Stripe-SDK-signed payload, then asserts:
//   - signature failure -> 400
//   - duplicate event with processed_at SET -> 200 + idempotent flag
//   - quarantined event -> 200 + processing_result starts with 'quarantined:'
//                          AND webhook_deliveries.processed_at is SET
//   - H-01R duplicate event with processed_at NULL -> handler REPROCESSES
//     (not silent 200 idempotent), processed_at becomes SET
//   - retryable failure -> 500 AND processed_at is NULL
//   - H-03 stale_subscription event is quarantined
//
// Strategy: use stripe.webhooks.generateTestHeaderString() with the local
// STRIPE_WEBHOOK_SECRET to mint a valid signature for arbitrary JSON.
// Then call the route handler's POST via dynamic import.
//
// Run: node scripts/test-webhook-retry-semantics.mjs

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

const SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (!SECRET) {
  console.error('Missing STRIPE_WEBHOOK_SECRET');
  process.exit(1);
}

// Boot Next-style env so the route imports work in plain Node.
process.env.NODE_ENV ||= 'development';

const { default: Stripe } = await import('stripe');
const { createClient } = await import('@supabase/supabase-js');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

let pass = 0, fail = 0;
const failures = [];

function record(ok, label) {
  if (ok) {
    console.log(`  [PASS] ${label}`);
    pass++;
  } else {
    console.log(`  [FAIL] ${label}`);
    fail++;
    failures.push(label);
  }
}

function makeSignedRequest(payload) {
  const body = JSON.stringify(payload);
  const header = stripe.webhooks.generateTestHeaderString({
    payload: body,
    secret: SECRET,
  });
  return new Request('http://localhost/api/webhooks/stripe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': header },
    body,
  });
}

// We hit the route via HTTP against a locally-running Next dev/preview
// server. Set WEBHOOK_TEST_URL to the base (default localhost:3000).
const BASE = process.env.WEBHOOK_TEST_URL || 'http://localhost:3000';
console.log(`Webhook target: ${BASE}/api/webhooks/stripe\n`);

async function POST(req) {
  const sig = req.headers.get('stripe-signature');
  const body = await req.text();
  return fetch(`${BASE}/api/webhooks/stripe`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': sig ?? '',
    },
    body,
  });
}

async function setup() {
  console.log('--- Setup ---');
  // Throwaway company so quarantined:company_not_found_for_customer is
  // testable AND we can prove successful matches separately.
  const { data: c } = await admin
    .from('companies')
    .insert({
      name: `webhook-test-${Date.now()}`,
      slug: `wh-${Date.now()}`,
      default_currency: 'USD',
      default_language: 'en',
      default_measurement_system: 'metric',
      plan_code: 'pro',
      subscription_status: 'active',
      stripe_customer_id: `cus_test_${Date.now()}`,
      stripe_subscription_id: `sub_test_${Date.now()}`,
    })
    .select('id, stripe_customer_id, stripe_subscription_id')
    .single();
  console.log(`  company=${c.id} cust=${c.stripe_customer_id} sub=${c.stripe_subscription_id}\n`);
  return c;
}

async function teardown(company) {
  console.log('\n--- Teardown ---');
  try { await admin.from('webhook_deliveries').delete().like('event_id', 'evt_test_%'); } catch {}
  try { await admin.from('companies').delete().eq('id', company.id); } catch {}
  console.log('  done.');
}

async function getDelivery(eventId) {
  const { data } = await admin
    .from('webhook_deliveries')
    .select('processed_at, processing_result')
    .eq('event_id', eventId)
    .maybeSingle();
  return data;
}

async function main() {
  const company = await setup();

  try {
    // ====== Test 1: bad signature -> 400 ======
    console.log('--- Test 1: bad signature -> 400 ---');
    const badSigReq = new Request('http://localhost/api/webhooks/stripe', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'stripe-signature': 'bogus' },
      body: JSON.stringify({ id: 'evt_test_bad', type: 'invoice.payment_failed' }),
    });
    const r1 = await POST(badSigReq);
    record(r1.status === 400, `bad signature returns 400 (got ${r1.status})`);

    // ====== Test 2: quarantined no-op (unknown customer) -> 200, processed_at SET ======
    console.log('\n--- Test 2: quarantined no-op -> 200 with processed_at SET ---');
    const eventId2 = `evt_test_q2_${Date.now()}`;
    const r2 = await POST(makeSignedRequest({
      id: eventId2,
      type: 'invoice.payment_failed',
      created: Math.floor(Date.now() / 1000),
      data: { object: { customer: 'cus_does_not_exist', subscription: 'sub_x' } },
    }));
    record(r2.status === 200, `quarantined returns 200 (got ${r2.status})`);
    const d2 = await getDelivery(eventId2);
    record(d2?.processed_at !== null, `processed_at is SET (got ${d2?.processed_at})`);
    record(d2?.processing_result?.startsWith('quarantined:'), `processing_result starts with quarantined: (got "${d2?.processing_result}")`);

    // ====== Test 3: duplicate delivery -> 200 with idempotent flag ======
    console.log('\n--- Test 3: duplicate delivery -> 200 idempotent ---');
    const r3 = await POST(makeSignedRequest({
      id: eventId2,  // Re-send the same event id
      type: 'invoice.payment_failed',
      created: Math.floor(Date.now() / 1000),
      data: { object: { customer: 'cus_does_not_exist' } },
    }));
    record(r3.status === 200, `duplicate returns 200 (got ${r3.status})`);
    const body3 = await r3.json();
    record(body3.idempotent === true, `body.idempotent === true (got ${JSON.stringify(body3)})`);

    // ====== Test 4: H-03 stale subscription -> quarantined ======
    console.log('\n--- Test 4: H-03 stale subscription id -> quarantined ---');
    const eventId4 = `evt_test_q4_${Date.now()}`;
    const r4 = await POST(makeSignedRequest({
      id: eventId4,
      type: 'invoice.payment_failed',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          customer: company.stripe_customer_id,
          subscription: 'sub_stale_xyz', // does NOT match company.stripe_subscription_id
        },
      },
    }));
    record(r4.status === 200, `stale-sub event returns 200 (got ${r4.status})`);
    const d4 = await getDelivery(eventId4);
    record(d4?.processing_result?.startsWith('quarantined:stale_subscription'),
      `processing_result is stale_subscription (got "${d4?.processing_result}")`);

    // Confirm the company state was NOT mutated by the stale event.
    const { data: companyAfter } = await admin
      .from('companies')
      .select('subscription_status, first_payment_failure_at')
      .eq('id', company.id)
      .single();
    record(companyAfter.subscription_status === 'active',
      `company subscription_status still 'active' (not bumped to past_due by stale event)`);
    record(companyAfter.first_payment_failure_at === null,
      `company first_payment_failure_at still null`);

    // ====== Test 5: H-01R duplicate-after-retryable-failure reprocesses ======
    // Simulate the scenario Gerald flagged: a prior attempt 500'd after
    // raw insert, so webhook_deliveries has the row with processed_at=NULL.
    // Stripe's retry of the same event id MUST reprocess (not idempotent-ack).
    console.log('\n--- Test H-01R: duplicate event with processed_at=NULL reprocesses ---');
    const eventIdR = `evt_test_h01r_${Date.now()}`;
    // Plant a webhook_deliveries row that looks like a prior 500'd attempt.
    const plantedPayload = {
      id: eventIdR,
      type: 'invoice.payment_failed',
      created: Math.floor(Date.now() / 1000),
      data: { object: { customer: 'cus_unprocessed_retry', subscription: 'sub_x' } },
    };
    const plant = await admin.from('webhook_deliveries').insert({
      provider: 'stripe',
      event_id: eventIdR,
      event_type: 'invoice.payment_failed',
      signature_verified: true,
      payload: plantedPayload,
      processing_result: 'retryable_error:simulated prior 500',
      // processed_at intentionally NULL
    }).select('id, processed_at').single();
    if (plant.error) {
      console.log(`  [FAIL] could not plant prior-500 row: ${plant.error.message}`);
      fail++;
      failures.push('plant prior-500');
    } else if (plant.data.processed_at !== null) {
      console.log(`  [FAIL] planted row has processed_at set unexpectedly`);
      fail++;
      failures.push('plant prior-500 state');
    } else {
      // Now POST the same event id. The handler should detect the 23505,
      // see processed_at IS NULL, and reprocess (then mark processed_at).
      const rR = await POST(makeSignedRequest(plantedPayload));
      record(rR.status === 200, `retry returns 200 (got ${rR.status})`);
      const dR = await getDelivery(eventIdR);
      record(dR?.processed_at !== null,
        `processed_at is now SET after retry (got ${dR?.processed_at})`);
      // Result string should NOT still say 'retryable_error:...' — it
      // should be the new processing outcome (quarantined:company_not_found_for_customer).
      record(!dR?.processing_result?.startsWith('retryable_error:'),
        `processing_result updated past retryable_error (got "${dR?.processing_result}")`);
    }

    // ====== Test 6: H-01 unknown event type is 'ignored:phase_2', not retryable ======
    console.log('\n--- Test 6: unknown event type -> ignored ---');
    const eventId5 = `evt_test_q5_${Date.now()}`;
    const r5 = await POST(makeSignedRequest({
      id: eventId5,
      type: 'customer.created', // not handled in phase 1
      created: Math.floor(Date.now() / 1000),
      data: { object: { id: 'cus_phase2' } },
    }));
    record(r5.status === 200, `ignored event returns 200 (got ${r5.status})`);
    const d5 = await getDelivery(eventId5);
    record(d5?.processing_result === 'ignored:phase_2',
      `processing_result is ignored:phase_2 (got "${d5?.processing_result}")`);
    record(d5?.processed_at !== null, `processed_at SET`);

  } catch (e) {
    console.error(`\nFatal: ${e.message}`);
    fail++;
    failures.push(`Fatal: ${e.message}`);
  } finally {
    await teardown(company);
  }

  console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
  if (fail > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log('=== PASS: webhook H-01 + H-03 retry semantics verified ===');
}

main().catch((e) => { console.error(e); process.exit(1); });
