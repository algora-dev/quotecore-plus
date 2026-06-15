import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { alertEnabled, emailAlertEnabled } from '@/app/lib/alerts/prefs';
import { notifyQuoteExpired } from '@/app/lib/email/notify';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron handler: marks expired quotes and fires alerts.
 *
 * A quote is "expired" when:
 *   - acceptance_token_expires_at IS NOT NULL and < now()
 *   - accepted_at IS NULL  (not already accepted)
 *   - declined_at IS NULL  (not already declined)
 *   - withdrawn_at IS NULL (withdrawn quotes are already dead — skip)
 *   - job_status != 'expired' (idempotent guard)
 *
 * For each matching quote:
 *   1. Sets job_status = 'expired'
 *   2. Creates an in-app alert (gated by Message Center notify_quote_expired pref — defaults ON)
 *   3. Sends an email notification   (gated separately — defaults ON)
 *
 * Runs hourly. Capped at 200 quotes per run to bound execution time.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/expire-quotes] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  // Find all quotes that have passed their acceptance token expiry and have
  // not yet been actioned or already marked expired.
  const { data: expiring, error: selectErr } = await admin
    .from('quotes')
    .select('id, company_id, customer_name, quote_number')
    .not('acceptance_token_expires_at', 'is', null)
    .lt('acceptance_token_expires_at', nowIso)
    .is('accepted_at', null)
    .is('declined_at', null)
    .is('withdrawn_at', null)
    .neq('job_status', 'expired')
    .neq('status', 'draft')
    .limit(200);

  if (selectErr) {
    console.error('[cron/expire-quotes] select failed:', selectErr.message);
    return NextResponse.json({ error: 'select_failed', message: selectErr.message }, { status: 500 });
  }

  const rows = expiring ?? [];
  if (rows.length === 0) {
    return NextResponse.json({ ok: true, expired: 0 });
  }

  let updated = 0;
  for (const quote of rows) {
    // Atomic claim: repeat ALL eligibility predicates in the WHERE so a quote
    // that was accepted/declined/withdrawn/extended between SELECT and UPDATE is
    // not marked expired, and a duplicate cron invocation that already expired
    // the same row claims zero rows and skips the notifications.
    const { data: claimed, error: updErr } = await admin
      .from('quotes')
      .update({ job_status: 'expired' })
      .eq('id', quote.id)
      .lt('acceptance_token_expires_at', nowIso)
      .is('accepted_at', null)
      .is('declined_at', null)
      .is('withdrawn_at', null)
      .neq('job_status', 'expired')
      .neq('status', 'draft')
      .select('id');

    if (updErr) {
      console.error(`[cron/expire-quotes] update failed for ${quote.id}:`, updErr.message);
      continue;
    }
    // Only fire notifications if this invocation actually claimed the row.
    if (!claimed || claimed.length === 0) continue;
    updated += 1;

    const customerName = quote.customer_name || 'the customer';
    const quoteRef = quote.quote_number ? `#${quote.quote_number}` : 'a quote';

    // In-app alert (gated by Message Center preference — defaults ON).
    if (await alertEnabled(admin, quote.company_id, 'quote_expired')) {
      await admin.from('alerts').insert({
        company_id: quote.company_id,
        quote_id: quote.id,
        alert_type: 'quote_expired',
        title: `Quote Expired — ${quoteRef}`,
        message: `Your quote for ${customerName} has expired with no response from the customer.`,
      });
    }

    // Email notification (gated separately — defaults ON for quote_expired).
    if (await emailAlertEnabled(admin, quote.company_id, 'quote_expired')) {
      await notifyQuoteExpired({
        companyId: quote.company_id,
        quoteId: quote.id,
        quoteNumber: quote.quote_number,
        customerName: quote.customer_name,
      });
    }
  }

  return NextResponse.json({ ok: true, expired: updated, scanned: rows.length });
}
