'use server';

import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  requireCompanyContext,
} from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { sendOutboundMessage } from '@/app/lib/messages/send';
import {
  assertCanSendMessage,
  FeatureGatedError,
  SubscriptionInactiveError,
  FEATURE_LABELS,
} from '@/app/lib/billing/entitlements';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { getSiteUrl } from '@/app/lib/email/urls';

export interface SendInvoiceMessageInput {
  invoiceId: string;
  templateId: string | null;
  subject: string;
  body: string;
  recipientEmail: string;
  recipientName?: string | null;
}

export type SendInvoiceMessageResult =
  | { ok: true; messageId: string; status: 'sent' | 'suppressed' }
  | { ok: false; error: string };

/**
 * Invoice "Send from QuoteCore+" server action.
 *
 * Wraps the Messages pipeline for invoice sends:
 *  - ownership-checks the invoice against the caller's company
 *  - builds the merge context (invoice number, total, public link, due date)
 *  - calls sendOutboundMessage with kind='invoice_send'
 *  - updates invoice status draft→sent + stamps sent_at
 *  - logs invoice_activity + creates an alert for the account owner
 */
export async function sendInvoiceMessage(
  input: SendInvoiceMessageInput,
): Promise<SendInvoiceMessageResult> {
  const profile = await requireCompanyContext();

  // Entitlement gate: same manual-send check as quote sends.
  try {
    await assertCanSendMessage(profile.company_id, 'manual');
  } catch (gateErr) {
    if (gateErr instanceof FeatureGatedError) {
      return {
        ok: false,
        error: `${FEATURE_LABELS[gateErr.feature]} isn't included in your current plan. Upgrade to send invoices directly from QuoteCore+, or copy the public invoice link and email it yourself.`,
      };
    }
    if (gateErr instanceof SubscriptionInactiveError) {
      return {
        ok: false,
        error: 'Your subscription is not active. Reactivate to send messages.',
      };
    }
    throw gateErr;
  }

  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();

  // Ownership check: load invoice scoped to caller's company.
  const { data: invoice, error: invoiceErr } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, customer_name, customer_email, currency, total, due_date, public_token, status, sent_at, cq_company_name, cq_company_email, cq_company_phone, cq_company_logo_url',
    )
    .eq('id', input.invoiceId)
    .eq('company_id', profile.company_id)
    .maybeSingle();

  if (invoiceErr || !invoice) {
    return { ok: false, error: 'Invoice not found.' };
  }

  // Only allow sending when invoice is in a sendable state.
  if (['cancelled', 'paid'].includes(invoice.status)) {
    return { ok: false, error: 'This invoice cannot be sent in its current state.' };
  }

  // Load company branding.
  const { data: company } = await admin
    .from('companies')
    .select('name, default_currency')
    .eq('id', profile.company_id)
    .maybeSingle();

  const companyName = invoice.cq_company_name || company?.name || 'QuoteCore+ user';
  const companyEmail = invoice.cq_company_email || profile.email || null;
  const companyPhone = invoice.cq_company_phone || null;
  const companyLogoUrl = invoice.cq_company_logo_url || null;
  const currency = invoice.currency ?? company?.default_currency ?? 'GBP';

  // Build the public invoice URL using the invoice's existing public_token.
  const siteUrl = getSiteUrl();
  const invoicePublicUrl = `${siteUrl}/invoice/${encodeURIComponent(invoice.public_token)}`;

  // Format the invoice total for the merge context.
  const invoiceTotalString = formatCurrency(Number(invoice.total ?? 0), currency);

  // Format due date if present.
  const dueDateString = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '';

  // Validate recipient.
  const recipient = input.recipientEmail.trim();
  if (!recipient || !/^.+@.+\..+$/.test(recipient)) {
    return { ok: false, error: 'Please enter a valid recipient email.' };
  }

  const result = await sendOutboundMessage({
    companyId: profile.company_id,
    senderUserId: profile.id,
    kind: 'invoice_send',
    templateId: input.templateId,
    subject: input.subject,
    body: input.body,
    recipientEmail: recipient,
    recipientName: input.recipientName ?? invoice.customer_name ?? null,
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
      customer_name: invoice.customer_name ?? undefined,
      invoice_number: invoice.invoice_number ?? undefined,
      invoice_total: invoiceTotalString,
      invoice_link: invoicePublicUrl,
      due_date: dueDateString || undefined,
    },
    companyName,
    companyLogoUrl,
    companyEmail,
    companyPhone,
    // Pass public_token as acceptanceToken so the pipeline builds the
    // "View invoice" CTA button from it (invoice_send case in send.ts).
    acceptanceToken: invoice.public_token,
    // Override the CTA explicitly to be safe (belt-and-braces).
    primaryCta: {
      label: 'View Invoice',
      url: invoicePublicUrl,
    },
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // On a real send (not suppressed): update invoice status draft→sent.
  if (result.status === 'sent' && invoice.status === 'draft') {
    const now = new Date().toISOString();
    await supabase
      .from('invoices')
      .update({ status: 'sent', sent_at: now })
      .eq('id', invoice.id)
      .eq('company_id', profile.company_id);

    // Log invoice activity.
    await admin.from('invoice_activity').insert({
      invoice_id: invoice.id,
      company_id: profile.company_id,
      event_type: 'sent',
      metadata: {
        recipient_email: recipient,
        sent_by_user_id: profile.id,
      },
    });

    // Create an in-app alert for the account owner.
    await admin.from('alerts').insert({
      company_id: profile.company_id,
      invoice_id: invoice.id,
      alert_type: 'invoice_sent',
      title: 'Invoice Sent',
      message: `Invoice ${invoice.invoice_number} was sent to ${recipient}.`,
    });
  }

  revalidatePath(`/[workspaceSlug]/invoices/${input.invoiceId}`);
  revalidatePath(`/[workspaceSlug]/invoices`);

  return { ok: true, messageId: result.messageId, status: result.status };
}
