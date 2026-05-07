'use server';
import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

// Validate token format (must be a UUID)
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// Loose email validator — we accept anything that looks like one or skip the
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
  if (!checkRateLimit(`revision:${ip}`, 5, 60 * 60 * 1000)) {
    return { success: false, error: 'Too many requests. Please try again later or email directly.' };
  }

  const supabase = createAdminClient();

  // Look up the quote by token. We DON'T require the token to be unexpired
  // here — the whole point is that expired/withdrawn links can still trigger
  // a re-quote.
  const { data: quote, error: fetchErr } = await supabase
    .from('quotes')
    .select('id, company_id, quote_number, customer_name, accepted_at, declined_at, acceptance_token_expires_at, withdrawn_at')
    .eq('acceptance_token', token)
    .single();

  if (fetchErr || !quote) {
    return { success: false, error: 'Quote not found.' };
  }

  // Classify state for the user's awareness. Order matters — a withdrawal
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
  // list renders any type generically.
  await supabase.from('alerts').insert({
    company_id: quote.company_id,
    quote_id: quote.id,
    alert_type: 'revision_requested',
    title: `Re-Quote Requested — #${quote.quote_number ?? 'DRAFT'}`,
    message: `${cleanName || quote.customer_name || 'Customer'} has requested a revision (${sourceState}). Notes: ${trimmedNotes.slice(0, 200)}${trimmedNotes.length > 200 ? '…' : ''}`,
  });

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

export async function respondToQuote(token: string, action: 'accept' | 'decline') {
  // Input validation
  if (!token || !isValidUUID(token)) {
    throw new Error('Invalid link');
  }
  if (action !== 'accept' && action !== 'decline') {
    throw new Error('Invalid action');
  }

  const supabase = createAdminClient();

  // Load quote by token — select ONLY needed fields
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

  // Update quote — double-check token matches (prevents parameter manipulation)
  const { error } = await supabase
    .from('quotes')
    .update(isAccept
      ? { accepted_at: now, job_status: 'accepted' }
      : { declined_at: now, job_status: 'declined' }
    )
    .eq('id', quote.id)
    .eq('acceptance_token', token); // Double verification

  if (error) throw new Error('Failed to process response');

  // Create alert (scoped to the quote's company)
  await supabase.from('alerts').insert({
    company_id: quote.company_id,
    quote_id: quote.id,
    alert_type: isAccept ? 'quote_accepted' : 'quote_declined',
    title: `Quote #${quote.quote_number} ${isAccept ? 'Accepted' : 'Declined'}`,
    message: `${quote.customer_name} has ${isAccept ? 'accepted' : 'declined'} Quote #${quote.quote_number}.`,
  });
}
