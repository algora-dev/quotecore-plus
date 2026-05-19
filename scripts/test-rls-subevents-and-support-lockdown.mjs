// Gerald pass-3 evidence: M-02 + M-03 adversarial verification.
//
// Verifies:
//   M-02: an authenticated company user cannot SELECT raw subscription_events
//         (only the redacted subscription_events_audit_v1 view).
//   M-03: an authenticated user cannot mutate support_tickets workflow
//         fields (status, priority, category, related_stripe_*, auto_close_at,
//         created_by_system, assignee_user_id, resolved_at). Allowed:
//         email_forwarded_at, email_forward_error, messages, updated_at.
//
// Run: node scripts/test-rls-subevents-and-support-lockdown.mjs

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
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const TAG = `m02m03-${Date.now()}`;
let companyId = null, userId = null, ticketId = null, eventId = null;
let pass = 0, fail = 0;
const failures = [];

function record(ok, label) {
  if (ok) { console.log(`  [PASS] ${label}`); pass++; }
  else { console.log(`  [FAIL] ${label}`); fail++; failures.push(label); }
}

async function setup() {
  console.log('--- Setup ---');
  const { data: c } = await admin.from('companies').insert({
    name: `M-02/03 ${TAG}`,
    slug: TAG,
    default_currency: 'USD',
    default_language: 'en',
    default_measurement_system: 'metric',
    plan_code: 'pro',
    subscription_status: 'active',
  }).select('id').single();
  companyId = c.id;

  const email = `${TAG}@quotecore.local`;
  const password = 'TestPassword123!';
  const { data: au } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  userId = au.user.id;
  await admin.from('users').insert({ id: userId, email, company_id: companyId, role: 'owner' });

  // Seed a subscription_events row (service role bypasses M-02 policy).
  const { data: se, error: seErr } = await admin.from('subscription_events').insert({
    company_id: companyId,
    event_type: 'updated',
    from_status: 'trialing',
    to_status: 'active',
    notes: 'test',
    stripe_payload: { sensitive: 'should-not-be-visible-to-user' },
    stripe_event_id: 'evt_sensitive_test',
    stripe_event_type: 'customer.subscription.updated',
  }).select('id').single();
  if (seErr) { console.error('subscription_events insert failed:', seErr); throw new Error(seErr.message); }
  eventId = se.id;

  // Seed a support_tickets row (created by the user themselves via the
  // INSERT path that signup uses).
  const { data: st, error: stErr } = await admin.from('support_tickets').insert({
    company_id: companyId,
    user_id: userId,
    category: 'question',
    subject: 'Test support ticket',
    body: 'This is a test support ticket body for adversarial regression coverage.',
    status: 'open',
    priority: 'normal',
    messages: [{ role: 'user', text: 'initial' }],
  }).select('id').single();
  if (stErr) { console.error('support_tickets insert failed:', stErr); throw new Error(stErr.message); }
  ticketId = st.id;

  console.log(`  company=${companyId} user=${userId} sub_event=${eventId} ticket=${ticketId}`);
  return { email, password };
}

async function teardown() {
  console.log('\n--- Teardown ---');
  try { if (ticketId) await admin.from('support_tickets').delete().eq('id', ticketId); } catch {}
  try { if (eventId) await admin.from('subscription_events').delete().eq('id', eventId); } catch {}
  try { if (userId) await admin.auth.admin.deleteUser(userId); } catch {}
  try { if (userId) await admin.from('users').delete().eq('id', userId); } catch {}
  try { if (companyId) await admin.from('companies').delete().eq('id', companyId); } catch {}
  console.log('  done.');
}

async function main() {
  const { email, password } = await setup();
  try {
    const c = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
    const { error: signInErr } = await c.auth.signInWithPassword({ email, password });
    if (signInErr) throw new Error(`signIn: ${signInErr.message}`);

    // ===== M-02 raw subscription_events =====
    console.log('\n--- M-02: raw subscription_events SELECT is BLOCKED ---');
    const r1 = await c.from('subscription_events').select('id, stripe_payload').eq('company_id', companyId);
    // Either error (permission denied) OR empty result (RLS hides it). Both acceptable; the data MUST NOT come back.
    const leaked = r1.data && r1.data.length > 0;
    if (r1.error) {
      console.log(`  [PASS] SELECT raw subscription_events: blocked with ${r1.error.code} ${r1.error.message?.slice(0, 80)}`);
      pass++;
    } else if (!leaked) {
      console.log(`  [PASS] SELECT raw subscription_events: empty result (RLS hides rows)`);
      pass++;
    } else {
      console.log(`  [FAIL] SELECT raw subscription_events: LEAKED ${r1.data.length} row(s) with stripe_payload`);
      fail++;
      failures.push('SELECT raw subscription_events');
    }

    // The redacted view should be readable.
    console.log('\n--- M-02: redacted subscription_events_audit_v1 view IS readable ---');
    const r2 = await c.from('subscription_events_audit_v1').select('*').eq('company_id', companyId);
    if (r2.error) {
      console.log(`  [FAIL] SELECT redacted view: ${r2.error.message}`);
      fail++; failures.push('SELECT redacted view');
    } else {
      console.log(`  [PASS] SELECT redacted view: returned ${r2.data?.length ?? 0} row(s)`);
      pass++;
      // Confirm stripe_payload column is NOT in the view.
      const cols = Object.keys(r2.data?.[0] ?? {});
      const exposed = ['stripe_payload', 'stripe_event_id', 'stripe_event_type'];
      const leaks = exposed.filter(c => cols.includes(c));
      if (leaks.length === 0) {
        console.log(`  [PASS] view does not expose stripe_payload / stripe_event_id / stripe_event_type`);
        pass++;
      } else {
        console.log(`  [FAIL] view leaks: ${leaks.join(', ')}`);
        fail++; failures.push(`view leaks ${leaks.join(',')}`);
      }
    }

    // ===== M-03 support_tickets workflow tampering =====
    console.log('\n--- M-03: workflow column writes on own ticket are BLOCKED ---');
    const workflowAttempts = [
      { col: 'status', val: 'resolved' },
      { col: 'priority', val: 'low' },
      { col: 'category', val: 'billing' },
      { col: 'related_stripe_dispute_id', val: 'di_fake_123' },
      { col: 'related_stripe_charge_id', val: 'ch_fake_456' },
      { col: 'auto_close_at', val: '2099-01-01T00:00:00Z' },
      { col: 'created_by_system', val: true },
      { col: 'assignee_user_id', val: userId },
      { col: 'resolved_at', val: '2026-05-19T00:00:00Z' },
    ];
    for (const a of workflowAttempts) {
      const r = await c.from('support_tickets')
        .update({ [a.col]: a.val })
        .eq('id', ticketId)
        .select();
      if (r.error) {
        console.log(`  [PASS] UPDATE ${a.col}: blocked (${r.error.code} ${r.error.message?.slice(0,60)})`);
        pass++;
      } else if (!r.data || r.data.length === 0) {
        console.log(`  [PASS] UPDATE ${a.col}: no rows changed (silent block)`);
        pass++;
      } else {
        // Confirm via service-role read whether the value actually changed.
        const { data: post } = await admin.from('support_tickets').select(a.col).eq('id', ticketId).single();
        if (post && JSON.stringify(post[a.col]) !== JSON.stringify(a.val)) {
          console.log(`  [PASS] UPDATE ${a.col}: column unchanged after attempt (got ${JSON.stringify(post[a.col])})`);
          pass++;
        } else {
          console.log(`  [FAIL] UPDATE ${a.col}: SUCCEEDED \u2014 value persisted as ${a.val}`);
          fail++; failures.push(`UPDATE ${a.col}`);
        }
      }
    }

    // Allowed workflow-adjacent fields.
    console.log('\n--- M-03: whitelisted column writes ARE allowed ---');
    for (const a of [
      { col: 'email_forwarded_at', val: new Date().toISOString() },
      { col: 'email_forward_error', val: null },
      { col: 'messages', val: [{ role: 'user', text: 'update' }] },
    ]) {
      const r = await c.from('support_tickets').update({ [a.col]: a.val }).eq('id', ticketId);
      if (r.error) {
        console.log(`  [FAIL] UPDATE ${a.col}: blocked unexpectedly (${r.error.code})`);
        fail++; failures.push(`whitelist UPDATE ${a.col}`);
      } else {
        console.log(`  [PASS] UPDATE ${a.col}: allowed`);
        pass++;
      }
    }

  } catch (e) {
    console.error(`\nFatal: ${e.message}`);
    fail++; failures.push(`Fatal: ${e.message}`);
  } finally {
    await teardown();
  }

  console.log(`\n=== Result: ${pass} pass / ${fail} fail ===`);
  if (fail > 0) {
    console.log('Failures:');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
  console.log('=== PASS: M-02 + M-03 lockdown verified ===');
}

main().catch(e => { console.error(e); teardown().finally(() => process.exit(1)); });
