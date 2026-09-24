import { NextResponse } from 'next/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

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
 *     Phase 2 will add the corresponding notification emails. This cron
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
 *   PASS 4 - DISPUTE AUTO-CLOSE
 *     - support_tickets with category='payment_dispute' AND
 *       auto_close_at < now() AND status NOT IN ('resolved','closed').
 *     - Resolve the ticket. The dispute itself remains "in dispute" at
 *       Stripe until the bank rules; this is just our internal SLA.
 *
 *   PASS 5 - COMP EXPIRY NOTICES (2026-09-24)
 *     - Companies with comp_until set and no Stripe subscription.
 *     - T-7 and T-1 warning emails, then an expiry-day notice.
 *     - Every send writes a subscription_events marker row so the daily
 *       cron never double-sends (idempotent across missed runs via a
 *       3-day expiry catch-up window).
 *     - Plan enforcement itself lives in company_effective_plan_code()
 *       (patch_056): comp expired + no Stripe sub collapses to 'free'.
 *       This pass only communicates; it never changes plan state.
 *     - Internal summary email to info@quote-core.com on expiry day.
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
    comp_warned_7d: 0,
    comp_warned_1d: 0,
    comp_expired_notified: 0,
  };

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

  // ----- PASS 5: comp expiry notices -----
  // Communication only; plan collapse is enforced by company_effective_plan_code (patch_056).
  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  const isoIn = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

  async function compEventExists(companyId: string, eventType: string): Promise<boolean> {
    const { data } = await admin
      .from('subscription_events')
      .select('id')
      .eq('company_id', companyId)
      .eq('event_type', eventType)
      .limit(1);
    return (data ?? []).length > 0;
  }

  async function ownerEmail(companyId: string): Promise<string | null> {
    const { data } = await admin
      .from('users')
      .select('email')
      .eq('company_id', companyId)
      .eq('role', 'owner')
      .order('created_at', { ascending: true })
      .limit(1);
    return data?.[0]?.email ?? null;
  }

  async function sendCompEmail(to: string, subject: string, html: string): Promise<boolean> {
    if (!RESEND_API_KEY) return false;
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'QuoteCore+ <info@quote-core.com>', to, subject, html }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  function compEmailHtml(heading: string, bodyText: string, cta: boolean): string {
    return `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
      <h2 style="margin:0 0 16px;">${heading}</h2>
      <p style="color:#303641;line-height:1.6;">${bodyText}</p>
      ${cta ? `<p style="margin:24px 0;"><a href="https://app.quote-core.com" style="background:#FF6B35;color:#191B20;padding:12px 24px;border-radius:999px;text-decoration:none;font-weight:600;display:inline-block;">Keep my Pro features</a></p>` : ''}
      <p style="color:#596273;font-size:13px;line-height:1.5;margin-top:28px;">QuoteCore+ - measure, quote and manage roofing jobs in one place.<br/><a href="https://quote-core.com" style="color:#B63D0A;">quote-core.com</a></p>
    </div>`;
  }

  const expiryDate = (compUntil: string) =>
    new Date(compUntil).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' });

  const compTargets = await admin
    .from('companies')
    .select('id, name, comp_until, stripe_subscription_id')
    .not('comp_until', 'is', null)
    .is('stripe_subscription_id', null)
    .gte('comp_until', isoIn(-3)) // 3-day catch-up window past expiry
    .lte('comp_until', isoIn(7))
    .limit(200);

  const expiredNow: string[] = [];
  for (const row of compTargets.data ?? []) {
    const isTestAccount = row.name === 'test'; // internal test company: events yes, emails no
    const until = row.comp_until as string; // narrowed: query filters comp_until not-null
    const nowMs = Date.now();
    const untilMs = new Date(until).getTime();
    const daysLeft = (untilMs - nowMs) / (24 * 60 * 60 * 1000);

    if (daysLeft > 1 && daysLeft <= 7) {
      if (!(await compEventExists(row.id, 'comp_warning_7d'))) {
        const email = isTestAccount ? null : await ownerEmail(row.id);
        if (email) {
          await sendCompEmail(
            email,
            `Your QuoteCore+ Pro access ends on ${expiryDate(until)}`,
            compEmailHtml(
              'Your complimentary Pro period is ending',
              `You have been enjoying QuoteCore+ Pro at no cost since the launch of our new plans. Your complimentary Pro period ends on <strong>${expiryDate(until)}</strong>. After that, your account moves to the Free plan: you keep full access to view, download and export your quotes and data, but Pro features such as creating new quotes, takeoff tools and the assistant switch off. To keep everything exactly as it is, subscribe any time before then - Starter, Pro or Pro Plus are available under Settings &rarr; Billing.`,
              true,
            ),
          );
        }
        await admin.from('subscription_events').insert({
          company_id: row.id,
          event_type: 'comp_warning_7d',
          to_status: 'active',
          notes: `Comp expiry T-7 notice (email ${email && !isTestAccount ? 'sent' : isTestAccount ? 'skipped: test account' : 'skipped: no owner email or RESEND unset'}).`,
        });
        summary.comp_warned_7d += 1;
      }
    } else if (daysLeft > 0 && daysLeft <= 1) {
      if (!(await compEventExists(row.id, 'comp_warning_1d'))) {
        const email = isTestAccount ? null : await ownerEmail(row.id);
        if (email) {
          await sendCompEmail(
            email,
            `Your QuoteCore+ Pro access ends tomorrow`,
            compEmailHtml(
              'Final reminder: your Pro access ends tomorrow',
              `Your complimentary QuoteCore+ Pro period ends <strong>tomorrow, ${expiryDate(until)}</strong>. Subscribe today under Settings &rarr; Billing to keep creating quotes and using takeoff tools without interruption. Your existing data stays safe and exportable on the Free plan either way.`,
              true,
            ),
          );
        }
        await admin.from('subscription_events').insert({
          company_id: row.id,
          event_type: 'comp_warning_1d',
          to_status: 'active',
          notes: `Comp expiry T-1 notice (email ${email && !isTestAccount ? 'sent' : isTestAccount ? 'skipped: test account' : 'skipped: no owner email or RESEND unset'}).`,
        });
        summary.comp_warned_1d += 1;
      }
    } else if (daysLeft <= 0) {
      if (!(await compEventExists(row.id, 'comp_expired'))) {
        const email = isTestAccount ? null : await ownerEmail(row.id);
        if (email) {
          await sendCompEmail(
            email,
            'Your QuoteCore+ Pro access has ended',
            compEmailHtml(
              'Your complimentary Pro period has ended',
              `Your complimentary QuoteCore+ Pro period has now ended, and your account is on the Free plan. You can still view, download and export every quote and all your data at any time. If you want Pro features back - new quotes, takeoff tools, the assistant - subscribe under Settings &rarr; Billing whenever you are ready. It takes about a minute.`,
            false,
          ),
          );
        }
        await admin.from('subscription_events').insert({
          company_id: row.id,
          event_type: 'comp_expired',
          to_status: 'active',
          notes: `Comp expired; effective plan collapses to free via company_effective_plan_code (patch_056). Email ${email && !isTestAccount ? 'sent' : isTestAccount ? 'skipped: test account' : 'skipped: no owner email or RESEND unset'}.`,
        });
        summary.comp_expired_notified += 1;
        if (!isTestAccount) expiredNow.push(row.name);
      }
    }
  }

  if (expiredNow.length > 0 && RESEND_API_KEY) {
    await sendCompEmail(
      'info@quote-core.com',
      'Comps expired today',
      `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <p>${expiredNow.length} comped compan${expiredNow.length === 1 ? 'y has' : 'ies have'} moved to the Free plan today:</p>
        <ul>${expiredNow.map((n) => `<li>${n}</li>`).join('')}</ul>
      </div>`,
    );
  }

  return NextResponse.json({ ok: true, summary });
}
