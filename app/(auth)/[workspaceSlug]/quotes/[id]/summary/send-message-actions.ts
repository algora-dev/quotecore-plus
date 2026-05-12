'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '@/app/lib/supabase/server';
import crypto from 'node:crypto';
import { sendOutboundMessage } from '@/app/lib/messages/send';
import { computeTaxLines } from '@/app/lib/taxes/types';
import { loadQuoteTaxesByQuoteId } from '@/app/lib/taxes/actions';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { getEffectiveCurrency } from '@/app/lib/currency/currencies';

export interface SendQuoteMessageInput {
  quoteId: string;
  templateId: string | null;
  subject: string;
  body: string;
  recipientEmail: string;
  recipientName?: string | null;
}

export type SendQuoteMessageResult =
  | { ok: true; messageId: string; status: 'sent' | 'suppressed' }
  | { ok: false; error: string };

/**
 * Compute the customer-visible total for a quote as a localised
 * currency string suitable for {{quote_total}} substitution. Uses the
 * same shape `/accept/<token>` uses: sum of `customer_quote_lines`
 * where `include_in_total = true`, plus tax via the multi-tax engine
 * (or the legacy single-rate fallback).
 *
 * Returns null when there are no customer-quote lines yet (draft state),
 * which leaves the merge variable unsubstituted rather than printing
 * a misleading $0.00 in the recipient's email.
 */
async function computeCustomerTotalString(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  quoteId: string,
  legacyTaxRate: number | null,
  storedCurrency: string | null,
  companyDefaultCurrency: string,
): Promise<string | null> {
  const { data: lines } = await supabase
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

/**
 * Quote-summary "Send from QuoteCore+" action. Wraps the Messages
 * pipeline with the right ownership checks and the right merge-context
 * for a quote send.
 *
 * Why a wrapper rather than calling sendOutboundMessage directly: this
 * action has to (a) verify the quote belongs to the caller's company,
 * (b) gather the merge-context (customer name, job, totals from the
 * quote row + company branding from companies), (c) supply the
 * company-name display string to the pipeline. The pipeline itself stays
 * dumb \u2014 it receives a fully-resolved input and dispatches.
 */
export async function sendQuoteMessage(
  input: SendQuoteMessageInput,
): Promise<SendQuoteMessageResult> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Ownership: load the quote scoped to the caller's company so an
  // attempt to send a message about someone else's quote returns the
  // same generic "Quote not found" rather than leaking existence.
  const { data: quote, error: quoteErr } = await supabase
    .from('quotes')
    .select(
      'id, customer_name, job_name, quote_number, currency, tax_rate, acceptance_token, acceptance_token_expires_at, withdrawn_at, status, accepted_at, declined_at, cq_company_name, cq_company_email, cq_company_phone, cq_company_logo_url',
    )
    .eq('id', input.quoteId)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (quoteErr || !quote) {
    return { ok: false, error: 'Quote not found.' };
  }

  // Ensure a live acceptance token exists so the email's primary CTA
  // ("View quote") can point at /accept/<token>. Mirrors the rules used
  // by generateAcceptanceToken: reuse a live token, mint a fresh one
  // after a withdrawal or when none exists. 30-day default expiry
  // matches the existing modal default.
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
    const { error: tokenErr } = await supabase
      .from('quotes')
      .update({
        acceptance_token: token,
        acceptance_token_expires_at: expiresAt.toISOString(),
        job_status: 'sent',
        // Re-issue clears any prior withdrawal so the new link is live.
        withdrawn_at: null,
        withdrawn_by_user_id: null,
      })
      .eq('id', quote.id)
      .eq('company_id', profile.company_id);
    if (!tokenErr) acceptanceToken = token;
  }
  // If we couldn't mint a token (draft / accepted / declined / withdraw
  // edge cases), the pipeline falls back to /m/<replyToken> and
  // {{quote_link}} stays unsubstituted (which is the best signal to the
  // user: they sent a quote message for a quote that can't be viewed).

  // Company branding falls back to the companies row when the per-quote
  // CQ branding fields are empty (CQ branding is per-quote override).
  // Loaded before the total computation because the latter needs the
  // company default currency for the effective-currency fallback.
  const { data: company } = await supabase
    .from('companies')
    .select('name, default_currency')
    .eq('id', profile.company_id)
    .maybeSingle();
  const companyDefaultCurrency = company?.default_currency ?? 'NZD';

  // Compute the customer-facing total the same way /accept/<token> does
  // so the merge variable shows what the recipient sees.
  const quoteTotalString = await computeCustomerTotalString(
    supabase,
    quote.id,
    quote.tax_rate,
    quote.currency,
    companyDefaultCurrency,
  );

  const companyName =
    quote.cq_company_name || company?.name || 'QuoteCore+ user';
  const companyEmail = quote.cq_company_email || profile.email || null;
  const companyPhone = quote.cq_company_phone || null;
  const companyLogoUrl = quote.cq_company_logo_url || null;

  // Validate recipient.
  const recipient = input.recipientEmail.trim();
  if (!recipient || !/^.+@.+\..+$/.test(recipient)) {
    return { ok: false, error: 'Please enter a valid recipient email.' };
  }

  const result = await sendOutboundMessage({
    companyId: profile.company_id,
    senderUserId: profile.id,
    kind: 'quote_send',
    relatedQuoteId: quote.id,
    templateId: input.templateId,
    subject: input.subject,
    body: input.body,
    recipientEmail: recipient,
    recipientName: input.recipientName ?? quote.customer_name ?? null,
    mergeContext: {
      company_name: companyName,
      company_email: companyEmail ?? undefined,
      company_phone: companyPhone ?? undefined,
      sender_name: profile.full_name ?? undefined,
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
      quote_total: quoteTotalString ?? undefined,
      // {{quote_link}} is substituted by the pipeline using
      // `acceptanceToken` (next-but-one line) so the text reference and
      // the primary CTA URL stay consistent.
    },
    companyName,
    companyLogoUrl,
    companyEmail,
    companyPhone,
    acceptanceToken,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Bust the cache so the Sent Messages tab on the summary page shows
  // the new row on next render.
  revalidatePath(`/[workspaceSlug]/quotes/${input.quoteId}/summary`);

  return { ok: true, messageId: result.messageId, status: result.status };
}
