'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '@/app/lib/supabase/server';
import { sendOutboundMessage } from '@/app/lib/messages/send';

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
      'id, customer_name, job_name, quote_number, currency, cq_company_name, cq_company_email, cq_company_phone, cq_company_logo_url',
    )
    .eq('id', input.quoteId)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (quoteErr || !quote) {
    return { ok: false, error: 'Quote not found.' };
  }

  // Company branding falls back to the companies row when the per-quote
  // CQ branding fields are empty (CQ branding is per-quote override).
  const { data: company } = await supabase
    .from('companies')
    .select('name, default_currency')
    .eq('id', profile.company_id)
    .maybeSingle();

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
      quote_currency: quote.currency ?? company?.default_currency ?? undefined,
      // The caller already wired `{{quote_link}}` to the accept URL via
      // the existing acceptance-token flow; we don't re-inject it here
      // to avoid clobbering whatever they typed.
    },
    companyName,
    companyLogoUrl,
    companyEmail,
    companyPhone,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // Bust the cache so the Sent Messages tab on the summary page shows
  // the new row on next render.
  revalidatePath(`/[workspaceSlug]/quotes/${input.quoteId}/summary`);

  return { ok: true, messageId: result.messageId, status: result.status };
}
