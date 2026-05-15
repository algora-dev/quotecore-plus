// Smoke test the dispatch-time entitlement gate (Gerald audit H-04).
//
//   1. Insert a scheduled_messages row owned by Residential Roofing (pro).
//   2. Trigger force-run via the existing forceRunScheduledMessage path,
//      which itself calls dispatchOne. (We could call dispatchOne directly
//      but it's not exported; this is the production flow.)
//      ACTUALLY \u2014 dispatchOne is not exported. We'll simulate by calling
//      the cron route via fetch. Too much setup. Alternative: insert
//      a row with fire_at <= now and call /api/cron/dispatch-scheduled-messages
//      directly. Authentication via the Bearer secret is needed.
//
//   For simplicity, this test sidesteps the HTTP layer:
//   - Set the company to plan_code='starter' so feat_followups=false.
//   - Try to INSERT a scheduled_messages row via the user's RLS-bound
//     client (simulated by directly inserting and observing whether the
//     new RLS policy with company_has_feature() refuses).
//   - Cleanup.
//
// For the FIRE-TIME gate test (which is the actual H-04 fix), we'll need
// to either trigger the cron HTTP route or call dispatchOne directly.
// Cleanest path: insert a scheduled row directly via service role
// (bypassing RLS), THEN downgrade the company, THEN call the cron
// HTTP route. We have CRON_SECRET in .env.local.
//
// This proves the dispatch gate works even when the schedule gate is
// bypassed (i.e. service role inserted the row), which is the actual
// H-04 attack surface.

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
// We hit DEV here because that's where the new entitlement gate code lives.
// Both envs share the same DB, so the row + cleanup are the same regardless.
const APP_URL = process.env.GAVIN_TEST_URL || 'https://quotecore-plus-dev.vercel.app';
const CRON_SECRET = process.env.CRON_SECRET;

async function getProfileId() {
  const { data } = await admin.from('users').select('id').eq('company_id', COMPANY_ID).limit(1).maybeSingle();
  return data?.id;
}

async function getTemplateId() {
  const { data } = await admin
    .from('email_templates')
    .select('id')
    .eq('company_id', COMPANY_ID)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function getOrCreateTestQuote(userId) {
  // Avoid touching the atomic counter; just use service-role to insert
  // a minimal quote row we can attach the scheduled follow-up to.
  const { data, error } = await admin
    .from('quotes')
    .insert({
      company_id: COMPANY_ID,
      customer_name: 'Dispatch Gate Test',
      job_name: 'Dispatch Gate Test',
      tax_rate: 0,
      measurement_system: 'metric',
      created_by_user_id: userId,
      entry_mode: 'blank',
      status: 'draft',
    })
    .select('id')
    .single();
  if (error) throw new Error('insert quote: ' + error.message);
  return data.id;
}

async function main() {
  if (!CRON_SECRET) {
    console.error('CRON_SECRET missing from .env.local');
    process.exit(1);
  }

  let allOk = true;
  const cleanup = { rowIds: [], quoteId: null };

  try {
    const userId = await getProfileId();
    const templateId = await getTemplateId();
    if (!userId || !templateId) {
      throw new Error(`Need a user + email_template for company ${COMPANY_ID}`);
    }
    cleanup.quoteId = await getOrCreateTestQuote(userId);

    // --- Step 1: Insert a scheduled_messages row directly (service role
    // bypasses RLS so this works regardless of plan).
    const fireAt = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago
    const { data: row, error: rowErr } = await admin
      .from('scheduled_messages')
      .insert({
        company_id: COMPANY_ID,
        quote_id: cleanup.quoteId,
        template_id: templateId,
        trigger_event: 'manual',
        trigger_anchor_at: new Date().toISOString(),
        fire_at: fireAt,
        recipient_email: 'gavin-dispatch-test@example.invalid',
        recipient_name: 'Dispatch Test',
        status: 'scheduled',
        created_by_user_id: userId,
        require_no_response: false,
        respect_quiet_hours: false,
      })
      .select('id')
      .single();
    if (rowErr) throw new Error('insert scheduled_messages: ' + rowErr.message);
    cleanup.rowIds.push(row.id);
    console.log(`Inserted scheduled_messages id=${row.id} (fire_at=${fireAt})`);

    // --- Step 2: Downgrade company to starter (no followups, no email_send).
    console.log('\n--- Downgrade to starter ---');
    await admin.from('companies').update({ plan_code: 'starter' }).eq('id', COMPANY_ID);

    // --- Step 3: Fire the cron route.
    console.log(`\n--- Firing ${APP_URL}/api/cron/dispatch-scheduled-messages ---`);
    const res = await fetch(`${APP_URL}/api/cron/dispatch-scheduled-messages`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
    });
    console.log(`  HTTP ${res.status}`);
    const text = await res.text();
    console.log(`  body: ${text.slice(0, 300)}`);

    // --- Step 4: Confirm the row was marked cancelled with the plan reason.
    const { data: after } = await admin
      .from('scheduled_messages')
      .select('id, status, cancelled_reason')
      .eq('id', row.id)
      .maybeSingle();
    console.log(`\n--- Post-dispatch row state ---`);
    console.log(`  status=${after?.status} reason="${after?.cancelled_reason}"`);
    const cancelledOk = after?.status === 'cancelled';
    const reasonOk = (after?.cancelled_reason ?? '').includes('followups')
                  || (after?.cancelled_reason ?? '').includes('not active')
                  || (after?.cancelled_reason ?? '').includes('Plan no longer');
    if (cancelledOk && reasonOk) console.log('  PASS');
    else { console.log('  FAIL'); allOk = false; }

    // --- Step 5: Check for the alert row — must be NEW (created after we
    // inserted the scheduled row, and to our test recipient).
    const { data: alerts } = await admin
      .from('alerts')
      .select('id, alert_type, title, message, created_at')
      .eq('company_id', COMPANY_ID)
      .eq('alert_type', 'followup_cancelled')
      .ilike('message', '%gavin-dispatch-test%')
      .order('created_at', { ascending: false })
      .limit(1);
    if (alerts?.length) {
      console.log(`  Alert: "${alerts[0].title}"`);
      console.log(`         "${alerts[0].message}"`);
      cleanup.alertId = alerts[0].id;
    } else {
      console.log('  FAIL: no followup_cancelled alert mentioning our test recipient');
      allOk = false;
    }

  } finally {
    // Cleanup
    if (cleanup.alertId) {
      await admin.from('alerts').delete().eq('id', cleanup.alertId);
    }
    for (const id of cleanup.rowIds) {
      await admin.from('scheduled_messages').delete().eq('id', id);
    }
    if (cleanup.quoteId) {
      await admin.from('quotes').delete().eq('id', cleanup.quoteId);
    }
    await admin.from('companies').update({ plan_code: 'pro', subscription_status: 'active' }).eq('id', COMPANY_ID);
    console.log(`\nCleanup: removed test row(s) + alert + quote, restored plan=pro.`);
  }

  console.log(allOk ? '\n=== PASS ===' : '\n*** FAIL ***');
  process.exit(allOk ? 0 : 1);
}

main().catch((err) => { console.error(err); process.exit(2); });
