'use server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { alertEnabled, emailAlertEnabled } from '@/app/lib/alerts/prefs';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import {
  notifyQuoteResponse,
  notifyRevisionRequested,
} from '@/app/lib/email/notify';

// Validate token format (must be a UUID)
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Loose email validator - we accept anything that looks like one or skip the
// field. The customer can still get help via the mailto fallback even without
// providing a structured email.
function isPlausibleEmail(str: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str) && str.length <= 254;
}

/**
 * Public lookup of who to contact about a quote.
 * Returns ONLY the user-supplied branding email (cq_company_email) when set,
 * otherwise falls back to the creating user's account email. Never leaks any
 * other PII. Used by the acceptance page to render a `mailto:` link.
 */
export async function getQuoteContactInfo(token: string): Promise<{
  contactEmail: string | null;
  companyName: string | null;
  quoteNumber: number | null;
  customerName: string | null;
} | null> {
  if (!token || !isValidUUID(token)) return null;

  const supabase = createAdminClient();
  const { data: quote } = await supabase
    .from('quotes')
    .select('id, customer_name, quote_number, cq_company_name, cq_company_email, created_by_user_id, company_id')
    .eq('acceptance_token', token)
    .single();

  if (!quote) return null;

  let contactEmail: string | null = quote.cq_company_email ?? null;

  // Fall back to the creating user's account email if no branding email is set.
  if (!contactEmail && quote.created_by_user_id) {
    const { data: creator } = await supabase
      .from('users')
      .select('email')
      .eq('id', quote.created_by_user_id)
      .single();
    contactEmail = creator?.email ?? null;
  }

  // Last resort: any owner of the company (so the customer always has a route).
  if (!contactEmail) {
    const { data: anyOwner } = await supabase
      .from('users')
      .select('email')
      .eq('company_id', quote.company_id)
      .order('created_at', { ascending: true })
      .limit(1)
      .single();
    contactEmail = anyOwner?.email ?? null;
  }

  return {
    contactEmail,
    companyName: quote.cq_company_name ?? null,
    quoteNumber: quote.quote_number ?? null,
    customerName: quote.customer_name ?? null,
  };
}

/**
 * Public submission of a re-quote / revision request from the acceptance URL.
 * Works in three states:
 *   - active:    quote not yet accepted/declined
 *   - responded: quote already accepted or declined
 *   - expired:   acceptance link past its expiry
 * Rate-limited per IP to prevent spam.
 */
export async function submitRevisionRequest(
  token: string,
  notes: string,
  customerName?: string | null,
  customerEmail?: string | null
): Promise<{ success: true } | { success: false; error: string }> {
  if (!token || !isValidUUID(token)) {
    return { success: false, error: 'Invalid link' };
  }
  const trimmedNotes = (notes ?? '').trim();
  if (trimmedNotes.length < 5) {
    return { success: false, error: 'Please describe what you would like changed (minimum 5 characters).' };
  }
  if (trimmedNotes.length > 4000) {
    return { success: false, error: 'Notes are too long (maximum 4000 characters).' };
  }

  // Rate limit: 5 revision requests per IP per hour. The acceptance page
  // already rate-limits page loads at 20/hr, so this is a tighter cap on
  // actual submissions.
  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  if (!(await checkRateLimit(`revision:${ip}`, 5, 60 * 60 * 1000))) {
    return { success: false, error: 'Too many requests. Please try again later or email directly.' };
  }

  const supabase = createAdminClient();

  // Look up the quote by token. We DON'T require the token to be unexpired
  // here - the whole point is that expired/withdrawn links can still trigger
  // a re-quote.
  const { data: quote, error: fetchErr } = await supabase
    .from('quotes')
    .select('id, company_id, quote_number, customer_name, accepted_at, declined_at, acceptance_token_expires_at, withdrawn_at')
    .eq('acceptance_token', token)
    .single();

  if (fetchErr || !quote) {
    return { success: false, error: 'Quote not found.' };
  }

  // Classify state for the user's awareness. Order matters - a withdrawal
  // supersedes responded/expired because it's the user's deliberate signal
  // that this quote shouldn't be acted on.
  let sourceState: 'active' | 'expired' | 'responded' | 'withdrawn' = 'active';
  if ((quote as any).withdrawn_at) {
    sourceState = 'withdrawn';
  } else if (quote.accepted_at || quote.declined_at) {
    sourceState = 'responded';
  } else if (
    quote.acceptance_token_expires_at &&
    new Date(quote.acceptance_token_expires_at) < new Date()
  ) {
    sourceState = 'expired';
  }

  const cleanName = customerName?.trim() || null;
  const cleanEmail =
    customerEmail && isPlausibleEmail(customerEmail.trim())
      ? customerEmail.trim().toLowerCase()
      : null;

  const { error: insertErr } = await supabase.from('quote_revision_requests').insert({
    company_id: quote.company_id,
    quote_id: quote.id,
    customer_name: cleanName,
    customer_email: cleanEmail,
    notes: trimmedNotes,
    source_state: sourceState,
  });

  if (insertErr) {
    console.error('[submitRevisionRequest] insert failed:', insertErr);
    return { success: false, error: 'Failed to save request. Please try again or email directly.' };
  }

  // Surface as an alert in the user's dashboard, reusing the existing alerts
  // table. Alert type is new (`revision_requested`) but the existing alerts
  // list renders any type generically. Gated by the Message Center matrix —
  // the request record above is saved regardless; only the alert is gated.
  if (await alertEnabled(supabase, quote.company_id, 'revision_requested')) {
    await supabase.from('alerts').insert({
      company_id: quote.company_id,
      quote_id: quote.id,
      alert_type: 'revision_requested',
      title: `Re-Quote Requested - #${quote.quote_number ?? 'DRAFT'}`,
      message: `${cleanName || quote.customer_name || 'Customer'} has requested a revision (${sourceState}). Notes: ${trimmedNotes.slice(0, 200)}${trimmedNotes.length > 200 ? '…' : ''}`,
    });
  }

  // Best-effort email notification (gated by user preference). Failures are
  // swallowed inside notifyRevisionRequested - the in-app alert above is the
  // source of truth. We MUST await here, not fire-and-forget: Vercel
  // serverless functions terminate the moment the handler returns, killing
  // any in-flight Promise.
  if (await emailAlertEnabled(supabase, quote.company_id, 'revision_requested')) {
    await notifyRevisionRequested({
      companyId: quote.company_id,
      quoteId: quote.id,
      quoteNumber: quote.quote_number ?? null,
      creatorUserId: (quote as { created_by_user_id?: string | null }).created_by_user_id ?? null,
      customerNameForEmail: cleanName || quote.customer_name || null,
      notes: trimmedNotes,
      sourceState,
    });
  }

  return { success: true };
}

/**
 * Authenticated: mark a revision request as resolved. Used from the internal
 * quote summary page so the user can clear the request once they've followed
 * up.
 */
export async function resolveRevisionRequest(requestId: string): Promise<void> {
  // Inline import keeps this file's top-level dependencies public-only.
  const { requireCompanyContext, createSupabaseServerClient } = await import('@/app/lib/supabase/server');
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('quote_revision_requests')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: profile.id,
    })
    .eq('id', requestId)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(`Failed to resolve request: ${error.message}`);
}

export type RevisionRequestActionResult =
  | { ok: true; count: number }
  | { ok: false; error: string };

/**
 * Bulk-resolve a set of revision requests in a single round-trip.
 *
 * Used by the multi-select bar on the quote summary's revision
 * requests panel - same UX as the Sent Messages bulk delete. RLS
 * still filters cross-company rows; we also match company_id
 * explicitly as belt-and-braces.
 */
export async function bulkResolveRevisionRequests(
  requestIds: string[],
): Promise<RevisionRequestActionResult> {
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return { ok: false, error: 'No requests selected.' };
  }
  if (requestIds.length > 100) {
    return { ok: false, error: 'Too many requests selected (max 100).' };
  }
  const { requireCompanyContext, createSupabaseServerClient } = await import('@/app/lib/supabase/server');
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('quote_revision_requests')
    .update({
      resolved_at: new Date().toISOString(),
      resolved_by_user_id: profile.id,
    })
    .in('id', requestIds)
    .eq('company_id', profile.company_id)
    .is('resolved_at', null) // only act on currently-pending rows
    .select('id');

  if (error) return { ok: false, error: error.message };
  console.log(
    `[requests/resolve-bulk] user=${profile.id} company=${profile.company_id} requested=${requestIds.length} resolved=${data?.length ?? 0}`,
  );
  return { ok: true, count: data?.length ?? 0 };
}

/**
 * Hard-delete a set of revision requests by id. Mirrors
 * deleteSentMessagesBulk for the messages panel - same shape, same
 * limits, same audit log.
 *
 * We deliberately allow deleting BOTH pending and resolved rows here:
 * the user might want to clear noise. If a request is mid-resolve in
 * another tab, the second delete will still succeed because the row
 * exists - idempotent enough for this UX.
 */
export async function bulkDeleteRevisionRequests(
  requestIds: string[],
): Promise<RevisionRequestActionResult> {
  if (!Array.isArray(requestIds) || requestIds.length === 0) {
    return { ok: false, error: 'No requests selected.' };
  }
  if (requestIds.length > 100) {
    return { ok: false, error: 'Too many requests selected (max 100).' };
  }
  const { requireCompanyContext, createSupabaseServerClient } = await import('@/app/lib/supabase/server');
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('quote_revision_requests')
    .delete()
    .in('id', requestIds)
    .eq('company_id', profile.company_id)
    .select('id');

  if (error) return { ok: false, error: error.message };
  console.log(
    `[requests/delete-bulk] user=${profile.id} company=${profile.company_id} requested=${requestIds.length} removed=${data?.length ?? 0}`,
  );
  return { ok: true, count: data?.length ?? 0 };
}

export async function respondToQuote(token: string, action: 'accept' | 'decline') {
  // Input validation
  if (!token || !isValidUUID(token)) {
    throw new Error('Invalid link');
  }
  if (action !== 'accept' && action !== 'decline') {
    throw new Error('Invalid action');
  }

  const supabase = createAdminClient();

  // Load quote by token - select ONLY needed fields
  const { data: quote, error: fetchErr } = await supabase
    .from('quotes')
    .select('id, company_id, customer_name, quote_number, accepted_at, declined_at, acceptance_token_expires_at, withdrawn_at')
    .eq('acceptance_token', token)
    .single();

  if (fetchErr || !quote) throw new Error('Quote not found');
  if (quote.accepted_at || quote.declined_at) throw new Error('This quote has already been responded to');
  if ((quote as any).withdrawn_at) {
    throw new Error('This quote has been withdrawn by the sender. Please request a fresh quote below.');
  }

  // Check token expiry
  if ((quote as any).acceptance_token_expires_at && new Date((quote as any).acceptance_token_expires_at) < new Date()) {
    throw new Error('This link has expired. Please contact the sender for a new link.');
  }

  const now = new Date().toISOString();
  const isAccept = action === 'accept';

  // Update quote - double-check token matches (prevents parameter manipulation)
  const { error } = await supabase
    .from('quotes')
    .update(isAccept
      ? { accepted_at: now, job_status: 'accepted' }
      : { declined_at: now, job_status: 'declined' }
    )
    .eq('id', quote.id)
    .eq('acceptance_token', token); // Double verification

  if (error) throw new Error('Failed to process response');

  // Create alert (scoped to the quote's company). Status update above always
  // happens; this alert is gated by the Message Center notification matrix.
  if (await alertEnabled(supabase, quote.company_id, isAccept ? 'quote_accepted' : 'quote_declined')) {
    await supabase.from('alerts').insert({
      company_id: quote.company_id,
      quote_id: quote.id,
      alert_type: isAccept ? 'quote_accepted' : 'quote_declined',
      title: `Quote #${quote.quote_number} ${isAccept ? 'Accepted' : 'Declined'}`,
      message: `${quote.customer_name} has ${isAccept ? 'accepted' : 'declined'} Quote #${quote.quote_number}.`,
    });
  }

  // Activate any pre-staged quote_accepted / quote_declined follow-ups
  // for this quote. The accept/decline modal in the post-send prompt
  // creates these in advance with sentinel timestamps; this is where
  // we flip them live. Best-effort - we don't fail the customer
  // response if activation has trouble. Same await-not-fire-and-forget
  // discipline as notifyQuoteResponse below.
  try {
    const { activateEventScheduledMessages } = await import('@/app/lib/messages/scheduled');
    await activateEventScheduledMessages({
      quoteId: quote.id,
      companyId: quote.company_id,
      event: isAccept ? 'accepted' : 'declined',
      eventAt: now,
    });
  } catch (err) {
    console.error('[respondToQuote] activateEventScheduledMessages failed:', err);
  }

  // Best-effort email notification. notifyQuoteResponse swallows its own
  // errors. We MUST await here, not fire-and-forget: Vercel serverless
  // functions terminate the moment the handler returns, killing any
  // in-flight Promise. (That bug caused decline emails to silently drop
  // because the client state-change resolved faster than Resend.)
  if (await emailAlertEnabled(supabase, quote.company_id, isAccept ? 'quote_accepted' : 'quote_declined')) {
    await notifyQuoteResponse({
      companyId: quote.company_id,
      quoteId: quote.id,
      quoteNumber: quote.quote_number ?? null,
      customerName: quote.customer_name ?? null,
      isAccept,
    });
  }
}
