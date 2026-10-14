import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { sendEmail } from '@/app/lib/email/send';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Vercel Cron handler: daily billing lifecycle evaluator.
 *
 * Three independent passes (each capped to 200 companies):
 *
 *   PASS 1 - DUNNING CURVE (subscription_status='past_due')
 *     - Day 21 from first_payment_failure_at -> 'grace'
 *     - Day 45 from first_payment_failure_at -> 'pending_data_purge'
 *     - Day 75 from first_payment_failure_at -> 'suspended'
 *     Existing later-stage lifecycle transitions remain unchanged. P3 adds a
 *     separate one-time custom payment-attention reminder at day 7; this pass
 *     ONLY advances the status; payment recovery (via invoice.payment_
 *     succeeded webhook) clears the timer and restores active.
 *
 *   PASS 2 - CANCELLATION CURVE (subscription_status='cancellation_pending')
 *     - Refund-with-cancellation flow. cancellation_confirmation_required_at
 *       is set when admin issues the refund.
 *     - If cancellation_confirmed_at IS NOT NULL: 7-day window from confirm.
 *     - Otherwise: 14-day window from required_at.
 *     - On expiry -> 'canceled'. (Data purge logic lives in pass 3.)
 *
 *   PASS 3 - DATA PURGE (subscription_status='pending_data_purge' for >30d)
 *     - Day 75 after first_payment_failure_at OR 30 days after
 *       pending_data_purge entry, whichever is sooner.
 *     - For phase 1 we ONLY transition to 'suspended'. The actual data
 *       deletion (storage objects + quotes + flashings + material orders)
 *       is deferred to phase 2 because it needs additional safety guards
 *       (export-before-delete, admin override, dry-run mode).
 *
 * Disputes auto-close is handled by a separate sweep in this same cron:
 *
 *   PASS 4 - DISPUTE AUTO-CLOSE
 *     - support_tickets with category='payment_dispute' AND
 *       auto_close_at < now() AND status NOT IN ('resolved','closed').
 *     - Resolve the ticket. The dispute itself remains "in dispute" at
 *       Stripe until the bank rules; this is just our internal SLA.
 *
 * Every transition writes a subscription_events row for the audit trail.
 */

const DAYS_TO_GRACE = 21;
const DAYS_TO_DATA_PURGE = 45;
const DAYS_TO_SUSPENDED = 75;
const DAYS_CANCELLATION_DEFAULT = 14;
const DAYS_CANCELLATION_CONFIRMED = 7;

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] ?? ch));
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error('[cron/process-billing-lifecycle] CRON_SECRET is not configured');
    return NextResponse.json({ error: 'cron_not_configured' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const summary = {
    advanced_to_grace: 0,
    advanced_to_pending_purge: 0,
    advanced_to_suspended: 0,
    canceled: 0,
    disputes_closed: 0,
    payment_notices_sent: 0,
    payment_notices_failed: 0,
  };

  // ----- P3: custom payment-attention reminder -----
  // Stripe handles the actual retry ladder. QuoteCore sends one operational
  // reminder after seven days and keeps the admin attention row visible.
  // No allowance is renewed by this pass.
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = admin as any;
    const nowIso = new Date().toISOString();
    const attention = await db.from('qcp_payment_attention')
      .select('id, company_id, invoice_id, first_failed_at')
      .eq('status', 'open').is('notice_sent_at', null).lte('notice_due_at', nowIso).limit(200);
    if (attention.error) {
      console.error('[cron/process-billing-lifecycle] payment attention read failed:', attention.error.message);
    } else {
      for (const row of attention.data ?? []) {
        const companyResult = await db.from('companies').select('id, name, slug, billing_model, subscription_status')
          .eq('id', row.company_id).maybeSingle();
        if (companyResult.error || companyResult.data?.billing_model !== 'custom_setup') continue;
        const userResult = await db.from('users').select('email, is_admin').eq('company_id', row.company_id).order('is_admin', { ascending: false }).limit(1).maybeSingle();
        const to = userResult.data?.email;
        if (!to) { summary.payment_notices_failed += 1; continue; }
        const appBase = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/$/, '');
        const billingLink = appBase && companyResult.data.slug ? `${appBase}/${encodeURIComponent(companyResult.data.slug)}/account/billing` : null;
        const text = [
          `We could not collect your latest QuoteCore+ subscription payment for ${companyResult.data.name}.`,
          '',
          'Your new monthly allowances have not been granted. Please update the card or payment method on your account.',
          'During the short payment-recovery window you can only use allowance remaining from your last paid period.',
          billingLink ? `Billing: ${billingLink}` : 'Open QuoteCore+ and go to Account > Billing to update your payment method.',
          '',
          'If you have already updated your payment details, Stripe may retry automatically and no further action may be needed.',
        ].join('\n');
        try {
          await sendEmail({
            to, subject: 'QuoteCore+ payment needs attention', text, html: text.split('\n').map((line: string) => line ? `<p>${escapeHtml(line)}</p>` : '<p>&nbsp;</p>').join(''),
            tags: [{ name: 'kind', value: 'billing-payment-attention' }],
          });
          const marked = await db.from('qcp_payment_attention').update({ notice_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', row.id).eq('status', 'open').is('notice_sent_at', null);
          if (marked.error) throw new Error(marked.error.message);
          summary.payment_notices_sent += 1;
        } catch (error) {
          summary.payment_notices_failed += 1;
          console.error('[cron/process-billing-lifecycle] payment reminder failed:', error instanceof Error ? error.message : String(error));
        }
      }
    }
  }

  // ----- PASS 1: dunning curve -----
  // We advance in three SEPARATE queries (newest stage first) so a company
  // that has been past_due for 80 days lands directly at 'suspended',
  // skipping the intermediate states.

  // -> suspended (>=75 days)
  {
    const { data } = await admin
      .from('companies')
      .select('id, subscription_status, plan_code')
      .in('subscription_status', ['past_due', 'grace', 'pending_data_purge'])
      .lte('first_payment_failure_at', daysAgoIso(DAYS_TO_SUSPENDED))
      .limit(200);
    for (const row of data ?? []) {
      const { error } = await admin
        .from('companies')
        .update({ subscription_status: 'suspended', dunning_stage_entered_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) continue;
      summary.advanced_to_suspended += 1;
      await admin.from('subscription_events').insert({
        company_id: row.id,
        event_type: 'dunning_advanced',
        from_status: row.subscription_status,
        to_status: 'suspended',
        notes: `Dunning day ${DAYS_TO_SUSPENDED}: suspended.`,
      });
    }
  }

  // -> pending_data_purge (>=45 days, but didn't already hit suspended)
  {
    const { data } = await admin
      .from('companies')
      .select('id, subscription_status, plan_code')
      .in('subscription_status', ['past_due', 'grace'])
      .lte('first_payment_failure_at', daysAgoIso(DAYS_TO_DATA_PURGE))
      .gt('first_payment_failure_at', daysAgoIso(DAYS_TO_SUSPENDED))
      .limit(200);
    for (const row of data ?? []) {
      const { error } = await admin
        .from('companies')
        .update({ subscription_status: 'pending_data_purge', dunning_stage_entered_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) continue;
      summary.advanced_to_pending_purge += 1;
      await admin.from('subscription_events').insert({
        company_id: row.id,
        event_type: 'dunning_advanced',
        from_status: row.subscription_status,
        to_status: 'pending_data_purge',
        notes: `Dunning day ${DAYS_TO_DATA_PURGE}: pending data purge.`,
      });
    }
  }

  // -> grace (>=21 days, but didn't already hit a later stage)
  {
    const { data } = await admin
      .from('companies')
      .select('id, subscription_status, plan_code')
      .eq('subscription_status', 'past_due')
      .lte('first_payment_failure_at', daysAgoIso(DAYS_TO_GRACE))
      .gt('first_payment_failure_at', daysAgoIso(DAYS_TO_DATA_PURGE))
      .limit(200);
    for (const row of data ?? []) {
      const { error } = await admin
        .from('companies')
        .update({ subscription_status: 'grace', dunning_stage_entered_at: new Date().toISOString() })
        .eq('id', row.id);
      if (error) continue;
      summary.advanced_to_grace += 1;
      await admin.from('subscription_events').insert({
        company_id: row.id,
        event_type: 'dunning_advanced',
        from_status: row.subscription_status,
        to_status: 'grace',
        notes: `Dunning day ${DAYS_TO_GRACE}: grace.`,
      });
    }
  }

  // ----- PASS 2: cancellation curve -----
  {
    // Confirmed cancellation: 7 days from confirmation.
    const { data: confirmed } = await admin
      .from('companies')
      .select('id, subscription_status, plan_code, cancellation_confirmed_at')
      .eq('subscription_status', 'cancellation_pending')
      .lte('cancellation_confirmed_at', daysAgoIso(DAYS_CANCELLATION_CONFIRMED))
      .limit(200);
    for (const row of confirmed ?? []) {
      const { error } = await admin
        .from('companies')
        .update({ subscription_status: 'canceled' })
        .eq('id', row.id);
      if (error) continue;
      summary.canceled += 1;
      await admin.from('subscription_events').insert({
        company_id: row.id,
        event_type: 'downgraded',
        from_status: 'cancellation_pending',
        to_status: 'canceled',
        notes: `Cancellation confirmed; ${DAYS_CANCELLATION_CONFIRMED}-day window elapsed.`,
      });
    }

    // Default cancellation: 14 days from required_at when not confirmed.
    const { data: unconfirmed } = await admin
      .from('companies')
      .select('id, subscription_status, plan_code, cancellation_confirmation_required_at')
      .eq('subscription_status', 'cancellation_pending')
      .is('cancellation_confirmed_at', null)
      .lte('cancellation_confirmation_required_at', daysAgoIso(DAYS_CANCELLATION_DEFAULT))
      .limit(200);
    for (const row of unconfirmed ?? []) {
      const { error } = await admin
        .from('companies')
        .update({ subscription_status: 'canceled' })
        .eq('id', row.id);
      if (error) continue;
      summary.canceled += 1;
      await admin.from('subscription_events').insert({
        company_id: row.id,
        event_type: 'downgraded',
        from_status: 'cancellation_pending',
        to_status: 'canceled',
        notes: `Cancellation unconfirmed; ${DAYS_CANCELLATION_DEFAULT}-day window elapsed.`,
      });
    }
  }

  // ----- PASS 3: dispute auto-close -----
  {
    const nowIso = new Date().toISOString();
    const { data: tickets } = await admin
      .from('support_tickets')
      .select('id')
      .eq('category', 'payment_dispute')
      .lte('auto_close_at', nowIso)
      .not('status', 'in', '(resolved,closed)')
      .limit(200);
    for (const t of tickets ?? []) {
      const { error } = await admin
        .from('support_tickets')
        .update({ status: 'resolved', resolved_at: nowIso })
        .eq('id', t.id);
      if (error) continue;
      summary.disputes_closed += 1;
    }
  }

  return NextResponse.json({ ok: true, summary });
}
