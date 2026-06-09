'use server';

import { createAdminClient } from '@/app/lib/supabase/admin';
import { alertEnabled, emailAlertEnabled } from '@/app/lib/alerts/prefs';
import { notifyGenericAlert } from '@/app/lib/email/notify';
import { quoteSummaryUrl, orderPreviewUrl, invoiceDetailUrl } from '@/app/lib/email/urls';

/**
 * Recipient-view stamping (Message Center Phase 3).
 *
 * These run as POST server actions fired from a client component on the
 * PUBLIC token pages (quote /accept, order /orders, invoice /invoice). We do
 * NOT stamp inside the page's GET render: email/link scanners issue GET
 * requests and would falsely mark an item "Read" before the human ever sees
 * it (see MEMORY "GET-on-mutate is a class of bug").
 *
 * Each action is idempotent: it only stamps `viewed_at` (and, for quotes,
 * advances job_status to "viewed") on the FIRST genuine open, and only emits a
 * Read alert when the company has that channel's Read toggle enabled in the
 * Message Center notification matrix (`companies.notification_prefs` keys
 * quote_viewed / order_viewed / invoice_viewed; default ON). The STATUS always
 * updates regardless of the toggle; the toggle gates only the alert.
 *
 * Token formats: quotes/invoices use UUID; orders use a long opaque token.
 */

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

/**
 * Quote: recipient opened the public acceptance link.
 * Stamps viewed_at + advances job_status to 'viewed' ONLY while the quote is
 * still 'sent' and unviewed (so we never clobber accepted/declined/etc).
 */
export async function stampQuoteViewed(token: string): Promise<void> {
  if (!token || !isValidUUID(token)) return;
  const admin = createAdminClient();

  const { data: quote } = await admin
    .from('quotes')
    .select('id, company_id, quote_number, customer_name, viewed_at, job_status, accepted_at, declined_at')
    .eq('acceptance_token', token)
    .maybeSingle();

  if (!quote || quote.viewed_at) return; // already stamped -> idempotent no-op

  const now = new Date().toISOString();

  // Only advance job_status to 'viewed' when the quote is still in the
  // pre-decision 'sent' state. If it's accepted/declined/anything else we
  // leave job_status alone but still record viewed_at.
  const update: Record<string, string> = { viewed_at: now };
  if ((quote.job_status ?? 'unsent') === 'sent' && !quote.accepted_at && !quote.declined_at) {
    update.job_status = 'viewed';
  }

  await admin
    .from('quotes')
    .update(update)
    .eq('id', quote.id)
    .is('viewed_at', null); // guard against double-stamp race

  const qTitle = `Quote #${quote.quote_number ?? 'DRAFT'} opened`;
  const qBody = `${quote.customer_name ?? 'The recipient'} has opened Quote #${quote.quote_number ?? 'DRAFT'}.`;
  if (await alertEnabled(admin, quote.company_id, 'quote_viewed')) {
    await admin.from('alerts').insert({
      company_id: quote.company_id,
      quote_id: quote.id,
      alert_type: 'quote_viewed',
      title: qTitle,
      message: qBody,
    });
  }
  // Best-effort Read email, gated independently (default OFF).
  if (await emailAlertEnabled(admin, quote.company_id, 'quote_viewed')) {
    const { data: company } = await admin
      .from('companies').select('slug').eq('id', quote.company_id).maybeSingle();
    await notifyGenericAlert({
      companyId: quote.company_id,
      alertType: 'quote_viewed',
      title: qTitle,
      body: qBody,
      ctaUrl: company?.slug ? quoteSummaryUrl(company.slug, quote.id) : null,
      ctaLabel: 'View quote',
    });
  }
}

/**
 * Order: recipient (supplier) opened the public order link.
 * Orders carry an opaque token (not a UUID) so we validate by length only,
 * mirroring the public order page/actions.
 */
export async function stampOrderViewed(token: string): Promise<void> {
  if (!token || token.length < 16) return;
  const admin = createAdminClient();

  const { data: order } = await admin
    .from('material_orders')
    .select('id, company_id, order_number, to_supplier, viewed_at')
    .eq('acceptance_token', token)
    .maybeSingle();

  if (!order || order.viewed_at) return;

  const now = new Date().toISOString();
  await admin
    .from('material_orders')
    .update({ viewed_at: now })
    .eq('id', order.id)
    .is('viewed_at', null);

  const oTitle = `Order ${order.order_number} opened`;
  const oBody = `${order.to_supplier || 'The supplier'} has opened order ${order.order_number}.`;
  if (await alertEnabled(admin, order.company_id, 'order_viewed')) {
    await admin.from('alerts').insert({
      company_id: order.company_id,
      order_id: order.id,
      alert_type: 'order_viewed',
      title: oTitle,
      message: oBody,
    });
  }
  // Best-effort Read email, gated independently (default OFF).
  if (await emailAlertEnabled(admin, order.company_id, 'order_viewed')) {
    const { data: company } = await admin
      .from('companies').select('slug').eq('id', order.company_id).maybeSingle();
    await notifyGenericAlert({
      companyId: order.company_id,
      alertType: 'order_viewed',
      title: oTitle,
      body: oBody,
      ctaUrl: company?.slug ? orderPreviewUrl(company.slug, order.id) : null,
      ctaLabel: 'View order',
    });
  }
}

/**
 * Invoice: recipient opened the public invoice link.
 * Replaces the previous GET-render mutation in app/invoice/[token]/page.tsx.
 * Advances status sent -> viewed (+ viewed_at) and logs activity, and gates
 * the Read alert behind the company preference.
 */
export async function stampInvoiceViewed(token: string): Promise<void> {
  if (!token || !isValidUUID(token)) return;
  const admin = createAdminClient();

  const { data: invoice } = await admin
    .from('invoices')
    .select('id, company_id, invoice_number, customer_name, status, viewed_at')
    .eq('public_token', token)
    .maybeSingle();

  if (!invoice) return;
  // Flip to 'viewed' on the first genuine open from EITHER 'draft' or 'sent'.
  // We accept 'draft' too because an owner may share the public link himself
  // (markInvoiceSentByLink flips draft->sent, but if the recipient opens the
  // link before any send-stamp fires the invoice can still be 'draft'). This
  // makes Read robust in that exact scenario. Idempotent once viewed/beyond.
  if (invoice.status !== 'sent' && invoice.status !== 'draft') return;

  const now = new Date().toISOString();
  await admin
    .from('invoices')
    .update({ status: 'viewed', viewed_at: now })
    .eq('id', invoice.id)
    .in('status', ['sent', 'draft']); // guard against double-stamp race

  // Activity log is independent of the alert preference.
  await admin.from('invoice_activity').insert({
    invoice_id: invoice.id,
    company_id: invoice.company_id,
    event_type: 'viewed',
    metadata: { source: 'recipient_open' },
  });

  const iBody = `${invoice.customer_name} has opened invoice ${invoice.invoice_number}.`;
  if (await alertEnabled(admin, invoice.company_id, 'invoice_viewed')) {
    await admin.from('alerts').insert({
      company_id: invoice.company_id,
      invoice_id: invoice.id,
      alert_type: 'invoice_viewed',
      title: 'Invoice Viewed',
      message: iBody,
    });
  }
  // Best-effort Read email, gated independently (default OFF).
  if (await emailAlertEnabled(admin, invoice.company_id, 'invoice_viewed')) {
    const { data: company } = await admin
      .from('companies').select('slug').eq('id', invoice.company_id).maybeSingle();
    await notifyGenericAlert({
      companyId: invoice.company_id,
      alertType: 'invoice_viewed',
      title: 'Invoice Viewed',
      body: iBody,
      ctaUrl: company?.slug ? invoiceDetailUrl(company.slug, invoice.id) : null,
      ctaLabel: 'View invoice',
    });
  }
}
