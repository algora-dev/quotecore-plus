import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron handler: marks expired trials.
 *
 * A trial is "expired" when:
 *   - subscription_status = 'trialing'
 *   - trial_ends_at < now()
 *   - stripe_subscription_id IS NULL (user never converted to paid)
 *
 * The SQL function company_effective_plan_code() already collapses these
 * accounts to "starter effective" the moment trial_ends_at passes, so no
 * entitlement change is needed. What this cron does:
 *
 *   1. Find all expired trial companies.
 *   2. Set subscription_status = 'canceled' (we treat an unconverted trial
 *      as a soft-cancel; the user can still sign in and read existing data
 *      but cannot create new quotes / send emails / etc.).
 *   3. Write a subscription_events row per company for the audit trail.
 *
 * Phase 2 will add a notification email on day -3 / day -1 / day 0 of the
 * trial; this cron just enforces the lifecycle transition.
 *
 * Why a daily cron instead of a SQL view / lazy evaluation: the audit row
 * + future notification email both want a definite firing moment. Lazy
 * evaluation would either spam every page-load or silently never log.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/expire-trials] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Find expired trials in one batch. We cap at 200 per run to bound cron
  // duration; if a company is missed today it'll catch up tomorrow.
  const { data: expired, error: selectErr } = await admin
    .from('companies')
    .select('id, plan_code, subscription_status, trial_ends_at')
    .eq('subscription_status', 'trialing')
    .is('stripe_subscription_id', null)
    .lt('trial_ends_at', nowIso)
    .limit(200);

  if (selectErr) {
    console.error('[cron/expire-trials] select failed:', selectErr.message);
    return NextResponse.json({ error: 'select_failed', message: selectErr.message }, { status: 500 });
  }

  const rows = expired ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, expired: 0 });
  }

  let updated = 0;
  for (const row of rows) {
    // Roll an unconverted trial DIRECTLY INTO the FREE tier (active), not a
    // canceled read-only shell. The effective-plan SQL functions already
    // resolve expired trials to 'free' the moment trial_ends_at passes; here we
    // also persist that on the stored row so billing UI + future logic agree.
    const { error: updErr } = await admin
      .from('companies')
      .update({ subscription_status: 'active', plan_code: 'free' })
      .eq('id', row.id)
      .eq('subscription_status', 'trialing'); // optimistic concurrency
    if (updErr) {
      console.error(`[cron/expire-trials] update failed for ${row.id}:`, updErr.message);
      continue;
    }
    updated += 1;
    await admin.from('subscription_events').insert({
      company_id: row.id,
      event_type: 'downgraded',
      from_plan_code: row.plan_code,
      to_plan_code: 'free',
      from_status: 'trialing',
      to_status: 'active',
      notes: `Trial expired without conversion at ${row.trial_ends_at}; rolled into Free tier`,
    });
  }

  return NextResponse.json({ ok: true, expired: updated, scanned: rows.length });
}
