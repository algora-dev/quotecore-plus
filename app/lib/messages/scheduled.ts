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
import {
  assertCanSendMessage,
  requireFeature,
  BillingError,
  FeatureGatedError,
} from '@/app/lib/billing/entitlements';
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
 * Sentinel timestamp used to park a scheduled_messages row when its
 * triggering event (accepted / declined) hasn't fired yet. The row
 * sits in status='scheduled' with this value in `trigger_anchor_at`
 * AND `fire_at`. The dispatcher's `fire_at <= now()` filter naturally
 * skips it. When the customer accepts or declines, the accept/decline
 * handler finds the row by quote_id + trigger_event and replaces both
 * timestamps with real values so the dispatcher can pick it up next
 * sweep.
 *
 * Year 9999 was picked instead of `null` because `trigger_anchor_at`
 * and `fire_at` are both NOT NULL in the schema, and changing that
 * would need a migration. The sentinel is far enough out that no real
 * scheduled row could ever collide with it.
 */
const PENDING_EVENT_SENTINEL_ISO = '9999-01-01T00:00:00.000Z';

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

  // Entitlement gate: schedule-time check (Gerald audit H-04 / belt-and-
  // braces above the RLS gate on scheduled_messages.insert). The dispatch-
  // time check inside dispatchOne is the authoritative one for the
  // "company paid then downgraded" case; this one stops a Starter user
  // from ever creating a scheduled row in the first place.
  try {
    await requireFeature(profile.company_id, 'followups');
  } catch (gateErr) {
    if (gateErr instanceof FeatureGatedError) {
      return {
        ok: false,
        error: `Automated follow-ups aren't included in your current plan. Upgrade to schedule follow-up messages.`,
      };
    }
    if (gateErr instanceof BillingError) {
      return {
        ok: false,
        error: 'Your subscription is not active. Reactivate to schedule follow-ups.',
      };
    }
    throw gateErr;
  }

  const supabase = await createSupabaseServerClient();

  // --- Validate input ------------------------------------------------
  const waitDays = Number.isFinite(input.waitDays) ? Math.max(0, Math.floor(input.waitDays)) : 0;
  const waitHours = Number.isFinite(input.waitHours ?? 0) ? Math.max(0, Math.floor(input.waitHours ?? 0)) : 0;
  // Zero-wait is allowed for event triggers (the row fires the moment
  // the customer accepts / declines via the activator's inline
  // dispatch). For chase-style triggers (quote_sent / manual) a zero
  // delay would be incoherent - you can't chase a non-response that
  // happened zero seconds ago.
  const isEventTrigger =
    input.triggerEvent === 'quote_accepted' ||
    input.triggerEvent === 'quote_declined' ||
    input.triggerEvent === 'quote_revision_requested';
  if (waitDays === 0 && waitHours === 0 && !isEventTrigger) {
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
      // Pre-event scheduling is allowed: when the customer hasn't
      // accepted yet, park the row with sentinel timestamps. The
      // accept handler will activate it when the customer actually
      // accepts.
      if (!quote.accepted_at) {
        anchor = new Date(PENDING_EVENT_SENTINEL_ISO);
      } else {
        anchor = new Date(quote.accepted_at);
      }
      break;
    case 'quote_declined':
      if (!quote.declined_at) {
        anchor = new Date(PENDING_EVENT_SENTINEL_ISO);
      } else {
        anchor = new Date(quote.declined_at);
      }
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

  // Compute fire time. When the anchor is the pending-event sentinel
  // we keep fire_at on the sentinel too - the activator (accept /
  // decline handler) will compute the real fire time using the same
  // waitDays/waitHours stored on the row.
  const isPendingEvent = anchor.getTime() === new Date(PENDING_EVENT_SENTINEL_ISO).getTime();
  let finalFire: Date;
  if (isPendingEvent) {
    finalFire = new Date(PENDING_EVENT_SENTINEL_ISO);
  } else {
    const rawFire = new Date(
      anchor.getTime() + waitDays * 24 * 60 * 60 * 1000 + waitHours * 60 * 60 * 1000,
    );
    // "Immediately" (zero wait) bypasses quiet hours regardless of
    // respect_quiet_hours. The user explicitly signalled this is
    // time-sensitive; quiet hours are for "fire 3 days after sent"-
    // style rules, not for event-driven immediate sends.
    const isImmediate = waitDays === 0 && waitHours === 0;
    const fireAt = input.respectQuietHours && !isImmediate ? applyQuietHours(rawFire) : rawFire;

    // Guard: a fire time in the past usually means the user picked an
    // event from the past and a short delay. We push it forward to "now
    // + 5 minutes" so they get the heads-up faster but not instantly.
    const minimumFire = new Date(now.getTime() + 5 * 60 * 1000);
    finalFire = fireAt < minimumFire ? minimumFire : fireAt;
  }

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
      // Event-triggered rules (accepted / declined / revision-requested)
      // never gate on "customer responded" - the event IS the response.
      // Forcing false here belt-and-braces the dispatcher fix so even a
      // legacy caller that passes true can't break event rules.
      require_no_response:
        input.triggerEvent === 'quote_accepted' ||
        input.triggerEvent === 'quote_declined' ||
        input.triggerEvent === 'quote_revision_requested'
          ? false
          : input.requireNoResponse,
      respect_quiet_hours: input.respectQuietHours,
      recipient_email: recipient.toLowerCase(),
      recipient_name: input.recipientName ?? quote.customer_name ?? null,
      status: 'scheduled',
      created_by_user_id: profile.id,
      // Pending-event rows store the intended wait so the
      // accept/decline activator can compute the real fire_at when
      // the event happens. Null on live rows.
      pending_wait_days: isPendingEvent ? waitDays : null,
      pending_wait_hours: isPendingEvent ? waitHours : null,
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
 * Activator: called by the accept/decline customer handlers when a
 * customer responds. Finds parked pending-event rows for the same
 * quote and trigger, computes their real fire_at (event timestamp +
 * pending_wait_days/hours, with quiet hours), and flips them from
 * sentinel timestamps to live ones so the dispatcher picks them up.
 *
 * Rows for the OPPOSITE trigger are auto-cancelled at the same time
 * because they can no longer fire (a customer who accepted will
 * never decline, and vice versa).
 *
 * Uses the admin client so it works from a public (token-validated)
 * acceptance flow with no logged-in user context. Quote ownership is
 * established upstream by token validation; we still scope by
 * quote_id + company_id so a stray call can't reach across companies.
 *
 * Best-effort: returns counts but doesn't throw. The customer's
 * accept/decline must not fail just because a follow-up activation
 * had a hiccup.
 */
export async function activateEventScheduledMessages(input: {
  quoteId: string;
  companyId: string;
  event: 'accepted' | 'declined';
  eventAt: string; // ISO
}): Promise<{ activated: number; cancelled: number; firedImmediately: number }> {
  const admin = createAdminClient();
  const matchingTrigger = input.event === 'accepted' ? 'quote_accepted' : 'quote_declined';
  const oppositeTrigger = input.event === 'accepted' ? 'quote_declined' : 'quote_accepted';

  // Activate matching-trigger pending rows.
  const { data: matchingRows } = await admin
    .from('scheduled_messages')
    .select('id, pending_wait_days, pending_wait_hours, respect_quiet_hours')
    .eq('quote_id', input.quoteId)
    .eq('company_id', input.companyId)
    .eq('status', 'scheduled')
    .eq('trigger_event', matchingTrigger)
    .eq('fire_at', PENDING_EVENT_SENTINEL_ISO);

  let activated = 0;
  // Rows whose computed fire_at is now-or-past should dispatch
  // inline instead of waiting up to 30 minutes for the next cron
  // tick. Critical for the user's expectation that a 'fires when
  // customer declines' follow-up actually fires when the customer
  // declines, not whenever the cron next happens to run.
  const dueNowRowIds: string[] = [];
  const eventDate = new Date(input.eventAt);
  const now = new Date();
  for (const row of matchingRows ?? []) {
    const days = row.pending_wait_days ?? 0;
    const hours = row.pending_wait_hours ?? 0;
    const rawFire = new Date(
      eventDate.getTime() + days * 24 * 60 * 60 * 1000 + hours * 60 * 60 * 1000,
    );
    // "Immediately" (zero wait) bypasses quiet hours regardless of
    // respect_quiet_hours. Quiet hours apply to deliberately
    // delayed follow-ups, not to event-driven immediate sends -
    // the customer just accepted/declined seconds ago, they're
    // clearly awake.
    const isImmediate = days === 0 && hours === 0;
    const adjusted = row.respect_quiet_hours && !isImmediate ? applyQuietHours(rawFire) : rawFire;
    // Two paths:
    //   - fire_at is now-or-past => dispatch inline. We set fire_at
    //     to now() so the row is properly marked as due and the
    //     dispatcher's mutex / status checks all work.
    //   - fire_at is future => store the real timestamp and let the
    //     cron pick it up at the right time.
    const isDueNow = adjusted.getTime() <= now.getTime();
    const finalFire = isDueNow ? now : adjusted;
    const { error: updateErr } = await admin
      .from('scheduled_messages')
      .update({
        trigger_anchor_at: input.eventAt,
        fire_at: finalFire.toISOString(),
      })
      .eq('id', row.id)
      .eq('status', 'scheduled')
      .eq('fire_at', PENDING_EVENT_SENTINEL_ISO);
    if (!updateErr) {
      activated += 1;
      if (isDueNow) dueNowRowIds.push(row.id);
    }
  }

  // Cancel opposite-trigger pending rows - they're now irrelevant.
  const { count: cancelledCount } = await admin
    .from('scheduled_messages')
    .update(
      {
        status: 'cancelled',
        cancelled_reason: `Customer ${input.event} the quote; opposite follow-up no longer needed.`,
      },
      { count: 'exact' },
    )
    .eq('quote_id', input.quoteId)
    .eq('company_id', input.companyId)
    .eq('status', 'scheduled')
    .eq('trigger_event', oppositeTrigger)
    .eq('fire_at', PENDING_EVENT_SENTINEL_ISO);

  // Dispatch due-now rows inline so the email lands within seconds
  // of the customer's accept/decline action. Each dispatchOne call
  // runs the same code path as the cron sweep - same safety checks,
  // same audit trail, same final status flip. Best-effort: failures
  // are logged but don't bubble up because the customer's action
  // already succeeded.
  let firedImmediately = 0;
  for (const rowId of dueNowRowIds) {
    try {
      // Reload with the new fire_at so dispatchOne sees a current row.
      const { data: freshRow } = await admin
        .from('scheduled_messages')
        .select('*')
        .eq('id', rowId)
        .maybeSingle();
      if (!freshRow || freshRow.status !== 'scheduled') continue;
      const outcome = await dispatchOne(freshRow as ScheduledMessageRow, admin);
      if (outcome === 'sent' || outcome === 'suppressed') firedImmediately += 1;
    } catch (err) {
      console.error('[activateEventScheduledMessages] inline dispatch failed:', err);
    }
  }

  return { activated, cancelled: cancelledCount ?? 0, firedImmediately };
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
 * gate this on `is_admin` - the gate was overzealous and made the
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
  // Block force-run on pending-event rows: there's no event yet, so
  // running them would be a meaningless send (or worse: fire against
  // a quote that hasn't been responded to). User should cancel +
  // create a new immediate-fire rule instead.
  if (row.fire_at === PENDING_EVENT_SENTINEL_ISO) {
    return {
      ok: false,
      error: 'This follow-up is parked waiting for the customer\u2019s response. Cancel it and create a new \u201cStarting now\u201d follow-up if you want to send immediately.',
    };
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

  // Fire-time entitlement gate (Gerald audit H-04). The schedule-time gate
  // (RLS on scheduled_messages.insert + the schedule action) only confirms
  // the company had the feature WHEN they scheduled. By the time cron fires
  // they may have downgraded. Without this check, a company that paid for
  // Pro for one month and scheduled 5 follow-ups would still get those
  // emails sent for free after they downgraded.
  //
  // Skipped rows are marked cancelled with a distinct reason string that
  // the UI keys off to render the amber "Plan downgrade - not sent" pill.
  // We use the existing markCancelled() so the alert + audit are written
  // exactly the way users expect.
  try {
    await assertCanSendMessage(row.company_id, 'scheduled_dispatch');
    await requireFeature(row.company_id, 'followups');
  } catch (gateErr) {
    if (gateErr instanceof BillingError) {
      const reason =
        gateErr instanceof FeatureGatedError
          ? `Plan no longer includes "${gateErr.feature}". Reactivate to resume follow-ups.`
          : 'Subscription not active.';
      await markCancelled(admin, row.id, reason);
      return 'cancelled';
    }
    // Unexpected error in the gate itself - mark failed so we can retry,
    // and let the caller see the original error via the failed_error column.
    await markFailed(
      admin,
      row.id,
      `Entitlement check failed unexpectedly: ${(gateErr as Error)?.message ?? 'unknown'}`,
    );
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
  // Cancel-on-response only applies to follow-ups whose whole purpose
  // is to chase a missing reply (quote_sent / manual reminders).
  // For event-triggered follow-ups (quote_accepted / quote_declined /
  // quote_revision_requested) the event itself IS the trigger -
  // cancelling because the trigger happened would mean those rows can
  // never fire, which was the exact bug Shaun hit (decline follow-up
  // cancelled itself with reason "Customer declined the quote.").
  const isEventTriggered =
    row.trigger_event === 'quote_accepted' ||
    row.trigger_event === 'quote_declined' ||
    row.trigger_event === 'quote_revision_requested';
  if (row.require_no_response && !isEventTriggered) {
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
  // Flip the row first - we use the WHERE status='scheduled' clause as
  // an idempotency lock so concurrent dispatcher invocations can't
  // double-cancel.
  const { data: updated } = await admin
    .from('scheduled_messages')
    .update({ status: 'cancelled', cancelled_reason: reason })
    .eq('id', id)
    .eq('status', 'scheduled')
    .select('company_id, quote_id, recipient_email')
    .maybeSingle();
  if (!updated) return;

  // Surface auto-cancels via the bell icon so the user finds out
  // without having to revisit the quote summary. We deliberately
  // don't write an alert for user-initiated cancellations (they did
  // it; they know about it) - that path uses `cancelled_by_user` as
  // its reason and is bypassed here because it goes through the
  // server action, not the dispatcher.
  const { data: quote } = await admin
    .from('quotes')
    .select('quote_number, customer_name')
    .eq('id', updated.quote_id ?? '')
    .maybeSingle();
  const quoteRef = quote?.quote_number
    ? `Quote #${quote.quote_number}`
    : 'A scheduled follow-up';
  await admin.from('alerts').insert({
    company_id: updated.company_id,
    quote_id: updated.quote_id,
    alert_type: 'followup_cancelled',
    title: `${quoteRef}: scheduled follow-up cancelled`,
    message: `${reason} The follow-up to ${updated.recipient_email} was not sent.`,
  });
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
