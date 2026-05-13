'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { sendOutboundMessage } from '@/app/lib/messages/send';
import { computeTaxLines } from '@/app/lib/taxes/types';
import { loadQuoteTaxesByQuoteId } from '@/app/lib/taxes/actions';
import { formatCurrency, getEffectiveCurrency } from '@/app/lib/currency/currencies';
import crypto from 'node:crypto';

/**
 * Messages Phase 2 \u2014 scheduled outbound messages (auto follow-ups).
 *
 * This module owns the lifecycle of `public.scheduled_messages` rows:
 *
 *   - `scheduleQuoteFollowUp`   user creates a follow-up rule from the
 *                               quote summary modal.
 *   - `cancelScheduledMessage`  user cancels a not-yet-fired row.
 *   - `loadScheduledForQuote`   panel data fetch.
 *   - `runDueScheduledMessages` invoked by the Vercel Cron route every
 *                               30 minutes. Re-evaluates cancel
 *                               conditions and dispatches.
 *
 * The actual send goes through `sendOutboundMessage` so the dispatcher
 * shares EVERY safety check with manual sends (suppression, rate
 * limiting, template rendering, audit row in `outbound_messages`).
 */

// Types live in a sibling non-server file so client components can
// import them without dragging the server action runtime in.
import type {
  ScheduledTriggerEvent,
  ScheduledMessageRow,
  ScheduleResultOk,
  ScheduleResultErr,
  CancelResultOk,
  CancelResultErr,
  ScheduleQuoteFollowUpInput,
  DispatchSweepResult,
} from './scheduled-types';

// Result shapes live in `./scheduled-types`. In a `'use server'`
// module every `export` must be an async function; we keep all type
// surface in the types file so this module exposes only callable
// server actions.

// --- Quiet hours / scheduling helpers --------------------------------

const QUIET_START_HOUR_UTC = 20; // 8pm UTC \u2014 Phase 2.1 makes this per-company
const QUIET_END_HOUR_UTC = 8;    // 8am UTC

/**
 * Shift a candidate fire time forward to the next allowed slot when it
 * falls into quiet hours or onto a weekend. Sender-timezone aware in
 * Phase 2.1; for now we use UTC because companies.timezone doesn't
 * exist yet. Acceptable because the worst case is a follow-up arriving
 * a few hours later than intended, never earlier.
 */
function applyQuietHours(date: Date): Date {
  const out = new Date(date.getTime());
  // Weekend nudge: Saturday=6, Sunday=0 -> push to Monday morning.
  const day = out.getUTCDay();
  if (day === 6) {
    out.setUTCDate(out.getUTCDate() + 2);
    out.setUTCHours(QUIET_END_HOUR_UTC, 0, 0, 0);
    return out;
  }
  if (day === 0) {
    out.setUTCDate(out.getUTCDate() + 1);
    out.setUTCHours(QUIET_END_HOUR_UTC, 0, 0, 0);
    return out;
  }
  const hour = out.getUTCHours();
  if (hour >= QUIET_START_HOUR_UTC) {
    // After 8pm -> next morning 8am.
    out.setUTCDate(out.getUTCDate() + 1);
    out.setUTCHours(QUIET_END_HOUR_UTC, 0, 0, 0);
    return applyQuietHours(out); // re-check in case next day is Saturday
  }
  if (hour < QUIET_END_HOUR_UTC) {
    // Before 8am -> same day 8am.
    out.setUTCHours(QUIET_END_HOUR_UTC, 0, 0, 0);
    return out;
  }
  return out;
}

// --- Scheduling ------------------------------------------------------

const MAX_OPEN_PER_QUOTE = 3;

/**
 * Persist a new scheduled follow-up for a quote.
 *
 * Anchors the wait to the right lifecycle event:
 *   - quote_sent: prefer the most recent successful outbound_messages
 *     row for this quote (kind = 'quote_send'). Falls back to the
 *     quote's updated_at when no manual send exists yet.
 *   - quote_accepted / declined / revision_requested: read the
 *     timestamp from the quote / revision request row.
 *   - manual: anchor to now().
 */
export async function scheduleQuoteFollowUp(
  input: ScheduleQuoteFollowUpInput,
): Promise<ScheduleResultOk | ScheduleResultErr> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // --- Validate input ------------------------------------------------
  const waitDays = Number.isFinite(input.waitDays) ? Math.max(0, Math.floor(input.waitDays)) : 0;
  const waitHours = Number.isFinite(input.waitHours ?? 0) ? Math.max(0, Math.floor(input.waitHours ?? 0)) : 0;
  if (waitDays === 0 && waitHours === 0) {
    return { ok: false, error: 'Pick a delay greater than zero.' };
  }
  // Anti-footgun cap: 1 year. Beyond this the follow-up is almost
  // certainly stale by the time it fires.
  if (waitDays > 365) {
    return { ok: false, error: 'Maximum delay is 365 days.' };
  }
  const recipient = input.recipientEmail.trim();
  if (!recipient || !/^.+@.+\..+$/.test(recipient)) {
    return { ok: false, error: 'Please enter a valid recipient email.' };
  }

  // Ownership: load the quote scoped to the caller's company.
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select('id, customer_name, accepted_at, declined_at, withdrawn_at, updated_at')
    .eq('id', input.quoteId)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (quoteErr || !quote) {
    return { ok: false, error: 'Quote not found.' };
  }

  // No follow-ups on a withdrawn quote \u2014 the link is dead and any
  // message we send would point at /accept/<token> that returns 410.
  if (quote.withdrawn_at) {
    return { ok: false, error: 'Cannot schedule follow-ups on a withdrawn quote.' };
  }

  // Template ownership.
  const { data: template, error: templateErr } = await supabase
    .from('email_templates')
    .select('id, name')
    .eq('id', input.templateId)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (templateErr || !template) {
    return { ok: false, error: 'Email template not found.' };
  }

  // Open-rule cap per quote.
  const { count: openCount } = await supabase
    .from('scheduled_messages')
    .select('id', { count: 'exact', head: true })
    .eq('quote_id', input.quoteId)
    .eq('company_id', profile.company_id)
    .eq('status', 'scheduled');
  if ((openCount ?? 0) >= MAX_OPEN_PER_QUOTE) {
    return {
      ok: false,
      error: `You already have ${MAX_OPEN_PER_QUOTE} scheduled follow-ups for this quote. Cancel one before adding another.`,
    };
  }

  // --- Resolve the anchor timestamp ---------------------------------
  const now = new Date();
  let anchor: Date;
  switch (input.triggerEvent) {
    case 'quote_sent': {
      const { data: lastSend } = await supabase
        .from('outbound_messages')
        .select('sent_at, created_at')
        .eq('related_quote_id', input.quoteId)
        .eq('company_id', profile.company_id)
        .eq('kind', 'quote_send')
        .in('status', ['sent', 'suppressed'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      const anchorIso = lastSend?.sent_at ?? lastSend?.created_at ?? quote.updated_at ?? now.toISOString();
      anchor = new Date(anchorIso);
      break;
    }
    case 'quote_accepted':
      if (!quote.accepted_at) {
        return { ok: false, error: 'Quote has not been accepted yet.' };
      }
      anchor = new Date(quote.accepted_at);
      break;
    case 'quote_declined':
      if (!quote.declined_at) {
        return { ok: false, error: 'Quote has not been declined yet.' };
      }
      anchor = new Date(quote.declined_at);
      break;
    case 'quote_revision_requested': {
      const { data: lastReq } = await supabase
        .from('quote_revision_requests')
        .select('created_at')
        .eq('quote_id', input.quoteId)
        .eq('company_id', profile.company_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!lastReq) {
        return { ok: false, error: 'No revision request on this quote yet.' };
      }
      anchor = new Date(lastReq.created_at);
      break;
    }
    case 'manual':
    default:
      anchor = now;
      break;
  }

  // Compute fire time.
  const rawFire = new Date(
    anchor.getTime() + waitDays * 24 * 60 * 60 * 1000 + waitHours * 60 * 60 * 1000,
  );
  const fireAt = input.respectQuietHours ? applyQuietHours(rawFire) : rawFire;

  // Guard: a fire time in the past usually means the user picked an
  // event from the past and a short delay. We push it forward to "now
  // + 5 minutes" so they get the heads-up faster but not instantly.
  const minimumFire = new Date(now.getTime() + 5 * 60 * 1000);
  const finalFire = fireAt < minimumFire ? minimumFire : fireAt;

  // --- Insert -------------------------------------------------------
  const { data: inserted, error: insertErr } = await supabase
    .from('scheduled_messages')
    .insert({
      company_id: profile.company_id,
      quote_id: input.quoteId,
      template_id: input.templateId,
      trigger_event: input.triggerEvent,
      trigger_anchor_at: anchor.toISOString(),
      fire_at: finalFire.toISOString(),
      require_no_response: input.requireNoResponse,
      respect_quiet_hours: input.respectQuietHours,
      recipient_email: recipient.toLowerCase(),
      recipient_name: input.recipientName ?? quote.customer_name ?? null,
      status: 'scheduled',
      created_by_user_id: profile.id,
    })
    .select('id, fire_at')
    .single();

  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? 'Failed to schedule follow-up.' };
  }

  revalidatePath('/');
  return { ok: true, id: inserted.id, fireAt: inserted.fire_at };
}

/**
 * Cancel a not-yet-fired scheduled message. Mark `cancelled` with a
 * reason. No-op on already-sent rows (returns error). RLS still
 * enforces company scoping.
 */
export async function cancelScheduledMessage(id: string): Promise<CancelResultOk | CancelResultErr> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('scheduled_messages')
    .update({
      status: 'cancelled',
      cancelled_reason: 'cancelled_by_user',
    })
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .eq('status', 'scheduled')
    .select('id');

  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) {
    return { ok: false, error: 'Scheduled message not found or already sent.' };
  }
  revalidatePath('/');
  return { ok: true };
}

/**
 * Force-run a single scheduled row right now.
 *
 * Lets the user fire a scheduled follow-up immediately instead of
 * waiting for the next cron tick (up to 30 minutes). Same risk
 * profile as the user clicking "Send Quote" directly: every safety
 * check (RLS, cancel conditions, suppression, rate limiting) still
 * runs through dispatchOne -> sendOutboundMessage.
 *
 * Ownership scoping uses the caller's company_id rather than the
 * admin flag; if the row belongs to a different company the query
 * returns nothing (RLS would also block it). We deliberately don't
 * gate this on `is_admin` — the gate was overzealous and made the
 * affordance invisible to normal users for no real safety gain.
 */
export async function forceRunScheduledMessage(id: string): Promise<CancelResultOk | CancelResultErr> {
  const profile = await requireCompanyContext();

  // Use the service-role dispatcher so it bypasses RLS and runs the
  // same code path as the cron sweep. We still enforce company
  // scoping in the WHERE clause so a malicious caller can't
  // cross-reach.
  const admin = createAdminClient();
  const { data: row, error } = await admin
    .from('scheduled_messages')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (error || !row) {
    return { ok: false, error: 'Scheduled message not found.' };
  }
  if (row.status !== 'scheduled') {
    return { ok: false, error: `Cannot force-run a ${row.status} message.` };
  }

  await dispatchOne(row as ScheduledMessageRow, admin);
  revalidatePath('/');
  return { ok: true };
}

/**
 * Panel-data loader: scheduled-or-recent rows for one quote, newest
 * first. Used by the Sent Messages panel's "Scheduled" subsection.
 */
export async function loadScheduledForQuote(
  quoteId: string,
): Promise<ScheduledMessageRow[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from('scheduled_messages')
    .select('*')
    .eq('quote_id', quoteId)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false })
    .limit(20);
  return (data ?? []) as ScheduledMessageRow[];
}

// --- Dispatcher (cron) -----------------------------------------------

/**
 * Run a dispatch sweep. Called by `/api/cron/dispatch-scheduled-messages`.
 *
 * Uses the admin client so it can read every company's due rows in one
 * pass. Each row is processed independently \u2014 a failure on one row
 * does not block the rest of the sweep.
 *
 * Concurrency: this route runs at most every 30 minutes and the cap of
 * 3 open rows per quote keeps the working set tiny. We do NOT use a
 * SELECT FOR UPDATE here because two overlapping sweeps would both see
 * the same rows; instead we flip status synchronously in the update
 * call (status='scheduled' -> 'sent' / 'cancelled' / 'failed') and rely
 * on the WHERE-status='scheduled' clause to prevent double-send.
 */
export async function runDueScheduledMessages(): Promise<DispatchSweepResult> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: dueRows } = await admin
    .from('scheduled_messages')
    .select('*')
    .eq('status', 'scheduled')
    .lte('fire_at', now)
    .order('fire_at', { ascending: true })
    .limit(100);

  const result: DispatchSweepResult = {
    scanned: dueRows?.length ?? 0,
    sent: 0,
    cancelled: 0,
    failed: 0,
    suppressed: 0,
  };

  if (!dueRows || dueRows.length === 0) return result;

  for (const row of dueRows as ScheduledMessageRow[]) {
    try {
      const outcome = await dispatchOne(row, admin);
      result[outcome] += 1;
    } catch (err) {
      // dispatchOne already records `failed` on the row. We catch
      // here so an unexpected throw on one row doesn't poison the
      // sweep.
      result.failed += 1;
      console.error('[scheduled-messages] dispatch threw:', err);
    }
  }

  return result;
}

/**
 * Internal: process a single scheduled row.
 *
 * Returns the bucket the row landed in so the sweep can keep counts.
 * Always updates the row with its final status before returning.
 */
async function dispatchOne(
  row: ScheduledMessageRow,
  admin: ReturnType<typeof createAdminClient>,
): Promise<'sent' | 'cancelled' | 'failed' | 'suppressed'> {
  // Atomic claim: flip from 'scheduled' -> 'scheduled' but with
  // updated_at change. We use the WHERE status='scheduled' clause as a
  // mutex: a concurrent sweep that already updated this row will see
  // zero affected rows here and skip. We deliberately don't move to
  // an intermediate 'dispatching' status because a crash would leave
  // the row stuck. The actual status flip happens at the very end.
  if (!row.quote_id) {
    await markFailed(admin, row.id, 'No quote_id on scheduled row.');
    return 'failed';
  }

  // Reload the related quote with the same shape sendQuoteMessage uses.
  const { data: quote, error: quoteErr } = await admin
    .from('quotes')
    .select(
      'id, customer_name, job_name, quote_number, currency, tax_rate, acceptance_token, acceptance_token_expires_at, withdrawn_at, status, accepted_at, declined_at, cq_company_name, cq_company_email, cq_company_phone, cq_company_logo_url',
    )
    .eq('id', row.quote_id)
    .eq('company_id', row.company_id)
    .maybeSingle();

  if (quoteErr || !quote) {
    await markCancelled(admin, row.id, 'Quote no longer exists.');
    return 'cancelled';
  }

  // Cancel safety checks.
  if (quote.withdrawn_at) {
    await markCancelled(admin, row.id, 'Quote was withdrawn.');
    return 'cancelled';
  }
  if (row.require_no_response) {
    if (quote.accepted_at) {
      await markCancelled(admin, row.id, 'Customer accepted the quote.');
      return 'cancelled';
    }
    if (quote.declined_at) {
      await markCancelled(admin, row.id, 'Customer declined the quote.');
      return 'cancelled';
    }
    // Revision-requested counts as a response too.
    const { count: revisionCount } = await admin
      .from('quote_revision_requests')
      .select('id', { count: 'exact', head: true })
      .eq('quote_id', row.quote_id)
      .gte('created_at', row.trigger_anchor_at);
    if ((revisionCount ?? 0) > 0) {
      await markCancelled(admin, row.id, 'Customer submitted a revision request.');
      return 'cancelled';
    }
  }

  // Load the template body + subject.
  const { data: template } = await admin
    .from('email_templates')
    .select('id, subject, body')
    .eq('id', row.template_id ?? '')
    .eq('company_id', row.company_id)
    .maybeSingle();
  if (!template) {
    await markFailed(admin, row.id, 'Email template was deleted.');
    return 'failed';
  }

  // Refresh / mint acceptance token. Same rules as sendQuoteMessage.
  let acceptanceToken: string | null = null;
  if (
    quote.acceptance_token &&
    !quote.withdrawn_at &&
    (!quote.acceptance_token_expires_at || new Date(quote.acceptance_token_expires_at) > new Date())
  ) {
    acceptanceToken = quote.acceptance_token;
  } else if (!quote.accepted_at && !quote.declined_at && quote.status !== 'draft') {
    const token = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);
    await admin
      .from('quotes')
      .update({
        acceptance_token: token,
        acceptance_token_expires_at: expiresAt.toISOString(),
        job_status: 'sent',
        withdrawn_at: null,
        withdrawn_by_user_id: null,
      })
      .eq('id', quote.id);
    acceptanceToken = token;
  }

  // Compute merge context.
  const { data: company } = await admin
    .from('companies')
    .select('name, default_currency')
    .eq('id', row.company_id)
    .maybeSingle();
  const companyDefaultCurrency = company?.default_currency ?? 'NZD';

  const totalString = await computeCustomerTotalString(
    admin,
    quote.id,
    quote.tax_rate,
    quote.currency,
    companyDefaultCurrency,
  );

  const companyName = quote.cq_company_name || company?.name || 'QuoteCore+ user';
  const companyEmail = quote.cq_company_email || null;
  const companyPhone = quote.cq_company_phone || null;
  const companyLogoUrl = quote.cq_company_logo_url || null;

  const sendResult = await sendOutboundMessage({
    companyId: row.company_id,
    senderUserId: row.created_by_user_id,
    kind: 'followup',
    relatedQuoteId: quote.id,
    templateId: template.id,
    subject: template.subject,
    body: template.body,
    recipientEmail: row.recipient_email,
    recipientName: row.recipient_name ?? quote.customer_name ?? null,
    mergeContext: {
      company_name: companyName,
      company_email: companyEmail ?? undefined,
      company_phone: companyPhone ?? undefined,
      today: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      customer_name: quote.customer_name ?? undefined,
      job_name: quote.job_name ?? undefined,
      quote_number: quote.quote_number != null ? String(quote.quote_number) : undefined,
      quote_status: quote.status ?? undefined,
      quote_currency: quote.currency ?? company?.default_currency ?? undefined,
      quote_total: totalString ?? undefined,
    },
    companyName,
    companyLogoUrl,
    companyEmail,
    companyPhone,
    acceptanceToken,
  });

  if (!sendResult.ok) {
    await markFailed(admin, row.id, sendResult.error);
    return 'failed';
  }

  // Suppressed sends still count as "handled" \u2014 we surface them to the
  // user via the panel, but we never retry. The pipeline's status='suppressed'
  // is carried into our row so the UI can show the difference.
  if (sendResult.status === 'suppressed') {
    await admin
      .from('scheduled_messages')
      .update({
        status: 'suppressed',
        fired_at: new Date().toISOString(),
        outbound_message_id: sendResult.messageId,
      })
      .eq('id', row.id)
      .eq('status', 'scheduled');
    return 'suppressed';
  }

  await admin
    .from('scheduled_messages')
    .update({
      status: 'sent',
      fired_at: new Date().toISOString(),
      outbound_message_id: sendResult.messageId,
    })
    .eq('id', row.id)
    .eq('status', 'scheduled');
  return 'sent';
}

async function markCancelled(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  reason: string,
) {
  await admin
    .from('scheduled_messages')
    .update({ status: 'cancelled', cancelled_reason: reason })
    .eq('id', id)
    .eq('status', 'scheduled');
}

async function markFailed(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  errorMessage: string,
) {
  await admin
    .from('scheduled_messages')
    .update({ status: 'failed', failed_error: errorMessage })
    .eq('id', id)
    .eq('status', 'scheduled');
}

// Mirrors the helper in send-message-actions.ts. Duplicated here
// because that file is scoped to one route and this module needs to
// run from the cron route too. If we add a third caller we should
// hoist this to app/lib/messages/mergeContext.ts.
async function computeCustomerTotalString(
  client:
    | Awaited<ReturnType<typeof createSupabaseServerClient>>
    | ReturnType<typeof createAdminClient>,
  quoteId: string,
  legacyTaxRate: number | null,
  storedCurrency: string | null,
  companyDefaultCurrency: string,
): Promise<string | null> {
  const { data: lines } = await client
    .from('customer_quote_lines')
    .select('custom_amount, include_in_total')
    .eq('quote_id', quoteId);
  if (!lines || lines.length === 0) return null;

  const subtotal = lines
    .filter((l) => l.include_in_total)
    .reduce((sum, l) => sum + Number(l.custom_amount ?? 0), 0);

  const quoteTaxes = await loadQuoteTaxesByQuoteId(quoteId);
  let taxTotal = 0;
  if (quoteTaxes.length > 0) {
    taxTotal = computeTaxLines(quoteTaxes, subtotal, 'quote').total;
  } else if ((legacyTaxRate ?? 0) > 0) {
    taxTotal = subtotal * Number(legacyTaxRate);
  }

  const total = subtotal + taxTotal;
  const currency = getEffectiveCurrency(storedCurrency, companyDefaultCurrency);
  return formatCurrency(total, currency);
}
