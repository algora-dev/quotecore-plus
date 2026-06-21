'use server';

import { revalidatePath } from 'next/cache';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { alertEnabled } from '@/app/lib/alerts/prefs';
import { createInvoiceAtomic, requireInvoiceFeature } from '@/app/lib/billing/entitlements';

// ── Types ──────────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | 'draft'
  | 'sent'
  | 'viewed'
  | 'payment_reported'
  | 'paid'
  | 'disputed'
  | 'cancelled';

export type InvoiceSourceType = 'quote' | 'job' | 'blank';

export interface InvoiceLine {
  id: string;
  invoice_id: string;
  company_id: string;
  sort_order: number;
  line_source_type: 'custom' | 'catalog' | 'component' | 'quote_import' | 'job_import';
  source_id: string | null;
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  line_total: number;
  show_price: boolean;
  is_visible: boolean;
}

// ── Create blank invoice ───────────────────────────────────────────────────

export async function createBlankInvoice(opts: {
  customerName: string;
  customerEmail?: string;
  customerSnapshot?: Record<string, unknown>;
  currency?: string;
  templateId?: string;
}): Promise<string> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient();

  // Fetch company defaults + optional template (not cap-sensitive).
  const { data: company } = await admin
    .from('companies')
    .select('name, default_currency')
    .eq('id', profile.company_id)
    .maybeSingle();

  // Load template if specified
  let tmpl: Record<string, string | null> | null = null;
  if (opts.templateId) {
    const { data: t } = await admin
      .from('invoice_templates')
      .select('*')
      .eq('id', opts.templateId)
      .eq('company_id', profile.company_id)
      .maybeSingle();
    tmpl = t as Record<string, string | null> | null;
  }

  const paymentDetails = tmpl ? {
    accountName: tmpl.payment_account_name,
    bankName: tmpl.payment_bank_name,
    accountNumber: tmpl.payment_account_number,
    sortCode: tmpl.payment_sort_code,
    paymentLink: tmpl.payment_link,
  } : {};

  // H-03: atomic create. The RPC takes the per-company advisory lock, runs
  // the feature + monthly-cap checks AND inserts the row in one transaction,
  // closing the count-then-insert race. It throws the same SQLSTATEs
  // (P0001/P0012/P0015) that createInvoiceError() maps to typed billing
  // errors for the UI upgrade prompt.
  const invoiceId = await createInvoiceAtomic(profile.company_id, profile.id, {
    source_type: 'blank',
    source_id: null,
    customer_name: opts.customerName,
    customer_email: opts.customerEmail ?? null,
    customer_snapshot: opts.customerSnapshot ?? {},
    cq_company_name: tmpl?.company_name ?? company?.name ?? null,
    cq_company_address: tmpl?.company_address ?? null,
    cq_company_email: tmpl?.company_email ?? null,
    cq_company_phone: tmpl?.company_phone ?? null,
    cq_company_logo_url: tmpl?.company_logo_url ?? null,
    cq_footer_text: tmpl?.footer_text ?? null,
    business_snapshot: { businessName: tmpl?.company_name ?? company?.name ?? '' },
    payment_details: paymentDetails,
    template_id: opts.templateId ?? null,
    notes: tmpl?.default_notes ?? null,
    terms: tmpl?.default_terms ?? null,
    currency: opts.currency ?? company?.default_currency ?? 'GBP',
  });

  // Log creation activity (post-create; not cap-sensitive).
  await admin.from('invoice_activity').insert({
    invoice_id: invoiceId,
    company_id: profile.company_id,
    event_type: 'created',
    metadata: { source_type: 'blank', customer_name: opts.customerName },
  });

  return invoiceId;
}

// ── Create invoice from quote ──────────────────────────────────────────────

/**
 * Return the customer-quote lines for a quote, for the Invoice line-selector
 * step. Only returns visible lines with their id, text, amount, and type.
 */
export async function getCustomerQuoteLinesSummary(
  quoteId: string,
): Promise<Array<{ id: string; custom_text: string | null; custom_amount: number | null; line_type: string | null; is_visible: boolean | null; sort_order: number | null }>> {
  'use server';
  const profile = await requireCompanyContext();
  const admin = createAdminClient();
  const { data: quote } = await admin.from('quotes').select('id').eq('id', quoteId).eq('company_id', profile.company_id).maybeSingle();
  if (!quote) throw new Error('Quote not found');
  const { data: lines } = await admin
    .from('customer_quote_lines')
    .select('id, custom_text, custom_amount, line_type, is_visible, sort_order')
    .eq('quote_id', quoteId)
    .order('sort_order', { ascending: true });
  return (lines ?? []).filter((l) => l.is_visible !== false);
}

export async function createInvoiceFromQuote(quoteId: string, templateId?: string, selectedLineIds?: string[]): Promise<string> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient();

  // Load source quote (must belong to this company)
  const { data: quote } = await admin
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (!quote) throw new Error('Quote not found');

  // Load customer quote lines; filter by selectedLineIds when the line-selector
  // step was used (undefined = include all).
  const { data: allCqLines } = await admin
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order');
  // H-03 / H-03-R1: track whether the caller explicitly provided a selection.
  // selectedLineIds is undefined  → key was absent → no selection, allow fallback.
  // selectedLineIds is []         → key was present but empty/invalid → reject.
  // selectedLineIds is [id, ...]  → valid selection → filter + reject if nothing matches.
  const selectionProvided = selectedLineIds !== undefined;
  if (selectionProvided && selectedLineIds!.length === 0) {
    throw new Error('No valid line IDs provided. Please re-select lines and try again.');
  }
  const cqLines = selectionProvided
    ? (allCqLines ?? []).filter((l) => selectedLineIds!.includes(l.id))
    : (allCqLines ?? []);

  // Load optional template
  let tmplFromQuote: Record<string, string | null> | null = null;
  if (templateId) {
    const { data: t } = await admin
      .from('invoice_templates')
      .select('*')
      .eq('id', templateId)
      .eq('company_id', profile.company_id)
      .maybeSingle();
    tmplFromQuote = t as Record<string, string | null> | null;
  }

  // Deep-copy snapshots so future quote edits don't affect the invoice
  const customerSnapshot = {
    name: quote.customer_name,
    email: quote.customer_email ?? '',
    phone: quote.customer_phone ?? '',
    address: quote.site_address ?? '',
  };
  const businessSnapshot = {
    businessName: quote.cq_company_name ?? '',
    email: quote.cq_company_email ?? '',
    phone: quote.cq_company_phone ?? '',
    address: quote.cq_company_address ?? '',
  };

  // H-03: atomic create (see createBlankInvoice). Closes the cap race.
  const invoiceId = await createInvoiceAtomic(profile.company_id, profile.id, {
    source_type: 'quote',
    source_id: quoteId,
    customer_name: quote.customer_name,
    customer_email: quote.customer_email ?? null,
    customer_snapshot: customerSnapshot,
    cq_company_name: (tmplFromQuote?.company_name ?? quote.cq_company_name) ?? null,
    cq_company_address: (tmplFromQuote?.company_address ?? quote.cq_company_address) ?? null,
    cq_company_email: (tmplFromQuote?.company_email ?? quote.cq_company_email) ?? null,
    cq_company_phone: (tmplFromQuote?.company_phone ?? quote.cq_company_phone) ?? null,
    cq_company_logo_url: (tmplFromQuote?.company_logo_url ?? quote.cq_company_logo_url) ?? null,
    cq_footer_text: (tmplFromQuote?.footer_text ?? quote.cq_footer_text) ?? null,
    business_snapshot: businessSnapshot,
    payment_details: tmplFromQuote ? {
      accountName: tmplFromQuote.payment_account_name,
      bankName: tmplFromQuote.payment_bank_name,
      accountNumber: tmplFromQuote.payment_account_number,
      sortCode: tmplFromQuote.payment_sort_code,
      paymentLink: tmplFromQuote.payment_link,
    } : {},
    template_id: templateId ?? null,
    currency: quote.currency ?? 'GBP',
    notes: tmplFromQuote?.default_notes ?? quote.notes_internal ?? null,
    terms: tmplFromQuote?.default_terms ?? null,
  });

  const invoice = { id: invoiceId };

  // Import lines.
  //
  // Preferred source: customer_quote_lines (populated when the user has opened
  // and saved the Customer Quote Editor for this quote). These hold the exact
  // customer-facing text, visibility flags, and amounts the user chose.
  //
  // Fallback source: quote_components where is_customer_visible = true. This
  // covers build-mode quotes that were confirmed without ever opening the
  // Customer Quote Editor — in that case customer_quote_lines is empty and
  // the invoice would otherwise be blank.
  const visibleCqLines = (cqLines ?? []).filter((l) => l.is_visible !== false);

  // H-03: if the user explicitly selected lines but the filtered set is empty
  // (tampered/stale IDs), reject rather than silently importing all components.
  if (selectionProvided && visibleCqLines.length === 0) {
    throw new Error('None of the selected quote lines could be found. Please re-select lines and try again.');
  }

  let invoiceLines: Array<{
    invoice_id: string;
    company_id: string;
    sort_order: number;
    line_source_type: string;
    source_id: string | null;
    title: string;
    description: string | null;
    quantity: number;
    unit: string;
    unit_price: number;
    line_total: number;
    show_price: boolean;
    show_quantity: boolean;
    show_description: boolean;
    include_in_total: boolean;
    is_visible: boolean;
  }>;

  if (visibleCqLines.length > 0) {
    // Use the saved customer quote lines.
    invoiceLines = visibleCqLines.map((l, idx) => {
      const unitPrice = Number(l.custom_amount ?? 0);
      return {
        invoice_id: invoice.id,
        company_id: profile.company_id,
        sort_order: idx,
        line_source_type: 'quote_import',
        source_id: null,
        title: l.custom_text ?? '',
        description: (l as { quantity_text?: string | null }).quantity_text ?? null,
        quantity: 1,
        unit: 'item',
        unit_price: unitPrice,
        line_total: unitPrice,
        show_price: l.show_price ?? true,
        show_quantity: false,
        show_description: !!(l as { quantity_text?: string | null }).quantity_text,
        include_in_total: (l as { include_in_total?: boolean | null }).include_in_total ?? true,
        is_visible: true,
      };
    });
  } else {
    // Fallback: build lines from quote_components (build-mode quotes).
    // Apply margins exactly as the Customer Quote Editor does so the invoice
    // amounts match what the user saw during quoting.
    const { data: qComponents } = await admin
      .from('quote_components')
      .select('id, name, material_cost, labour_cost, is_customer_visible, sort_order')
      .eq('quote_id', quoteId)
      .eq('is_customer_visible', true)
      .order('sort_order');

    const materialMarginRate = (quote.material_margin_enabled && quote.material_margin_percent)
      ? Number(quote.material_margin_percent) / 100
      : 0;
    const labourMarginRate = (quote.labor_margin_enabled && quote.labor_margin_percent)
      ? Number(quote.labor_margin_percent) / 100
      : 0;

    invoiceLines = (qComponents ?? []).map((c, idx) => {
      const mat = Number(c.material_cost ?? 0);
      const lab = Number(c.labour_cost ?? 0);
      const total = mat * (1 + materialMarginRate) + lab * (1 + labourMarginRate);
      const unitPrice = Math.round(total * 100) / 100;
      return {
        invoice_id: invoice.id,
        company_id: profile.company_id,
        sort_order: idx,
        line_source_type: 'quote_import',
        source_id: null,
        title: String(c.name ?? ''),
        description: null,
        quantity: 1,
        unit: 'item',
        unit_price: unitPrice,
        line_total: unitPrice,
        show_price: true,
        show_quantity: false,
        show_description: false,
        include_in_total: true,
        is_visible: true,
      };
    });
  }

  if (invoiceLines.length > 0) {
    const { error: insertErr } = await admin.from('invoice_lines').insert(invoiceLines);
    if (insertErr) {
      console.error('[createInvoiceFromQuote] invoice_lines insert error:', insertErr);
    }

    const subtotal = invoiceLines
      .filter((l) => l.include_in_total)
      .reduce((s, l) => s + l.line_total, 0);

    await admin
      .from('invoices')
      .update({ subtotal, total: subtotal })
      .eq('id', invoice.id);
  }

  // Log activity
  await admin.from('invoice_activity').insert({
    invoice_id: invoice.id,
    company_id: profile.company_id,
    event_type: 'created',
    metadata: { source_type: 'quote', source_id: quoteId, quote_number: quote.quote_number },
  });

  return invoice.id;
}

// ── List invoices ──────────────────────────────────────────────────────────

export async function listInvoices() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, payment_reference, status, customer_name, customer_email, currency, subtotal, total, invoice_date, due_date, sent_at, paid_at, created_at, updated_at, public_token'
    )
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// ── Save invoice lines + recalc totals ────────────────────────────────────

export async function saveInvoiceLines(
  invoiceId: string,
  lines: Array<{
    id?: string;
    sort_order: number;
    line_source_type: 'custom' | 'catalog' | 'component' | 'quote_import' | 'job_import';
    source_id?: string | null;
    title: string;
    description?: string | null;
    quantity: number;
    unit: string;
    unit_price: number;
    line_total: number;
    show_price?: boolean;
    show_quantity?: boolean;
    show_description?: boolean;
    is_visible?: boolean;
  }>,
  totals: { subtotal: number; taxTotal: number; discountTotal: number; total: number }
) {
  const profile = await requireCompanyContext();
  // H-02: editing an existing invoice requires the invoices feature.
  await requireInvoiceFeature(profile.company_id);
  const admin = createAdminClient();

  // Verify ownership
  const { data: inv } = await admin
    .from('invoices')
    .select('id')
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id)
    .maybeSingle();
  if (!inv) throw new Error('Invoice not found');

  // Delete existing lines and reinsert (same pattern as customer_quote_lines)
  await admin.from('invoice_lines').delete().eq('invoice_id', invoiceId);

  if (lines.length > 0) {
    await admin.from('invoice_lines').insert(
      lines.map((l) => ({
        invoice_id: invoiceId,
        company_id: profile.company_id,
        sort_order: l.sort_order,
        line_source_type: l.line_source_type,
        source_id: l.source_id ?? null,
        title: l.title,
        description: l.description ?? null,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price,
        line_total: l.line_total,
        show_price: l.show_price ?? true,
        show_quantity: l.show_quantity ?? true,
        show_description: l.show_description ?? true,
        include_in_total: (l as { include_in_total?: boolean }).include_in_total ?? true,
        is_visible: l.is_visible ?? true,
      }))
    );
  }

  await admin
    .from('invoices')
    .update({
      subtotal: totals.subtotal,
      tax_total: totals.taxTotal,
      discount_total: totals.discountTotal,
      total: totals.total,
      updated_at: new Date().toISOString(),
    })
    .eq('id', invoiceId);

  await admin.from('invoice_activity').insert({
    invoice_id: invoiceId,
    company_id: profile.company_id,
    event_type: 'edited',
    metadata: { line_count: lines.length },
  });

  revalidatePath(`/[workspaceSlug]/invoices/${invoiceId}`);
}

// ── Save invoice metadata ──────────────────────────────────────────────────

export async function saveInvoiceMeta(
  invoiceId: string,
  patch: {
    notes?: string | null;
    terms?: string | null;
    invoice_date?: string;
    due_date?: string | null;
    cq_company_name?: string | null;
    cq_company_address?: string | null;
    cq_company_email?: string | null;
    cq_company_phone?: string | null;
    cq_company_logo_url?: string | null;
    cq_footer_text?: string | null;
    hide_line_prices?: boolean;
    hide_totals?: boolean;
  }
) {
  const profile = await requireCompanyContext();
  // H-02: editing invoice metadata requires the invoices feature.
  await requireInvoiceFeature(profile.company_id);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('invoices')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id);

  if (error) throw error;
  revalidatePath(`/[workspaceSlug]/invoices/${invoiceId}`);
}

// ── Cancel invoice ─────────────────────────────────────────────────────────

export async function cancelInvoice(invoiceId: string) {
  const profile = await requireCompanyContext();
  const admin = createAdminClient();

  // Cancelling clears any "Action Required" (dispute) state too. The badge is
  // derived as `status === 'disputed' || disputed_at`, so we must null
  // disputed_at or a cancelled-but-previously-disputed invoice keeps the
  // badge stuck (bug 2026-06-10).
  await admin
    .from('invoices')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString(), disputed_at: null })
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id);

  await admin.from('invoice_activity').insert({
    invoice_id: invoiceId,
    company_id: profile.company_id,
    event_type: 'cancelled',
    metadata: {},
  });

  revalidatePath(`/[workspaceSlug]/invoices`);
  revalidatePath(`/[workspaceSlug]/invoices/${invoiceId}`);
}

// ── Reset invoice ("start fresh") ──────────────────────────────────────────

/**
 * Reset an invoice back to its pre-send state.
 *
 * Mirrors the quote Withdraw/Reopen + order reset flow: rotates the
 * public_token to a brand-new UUID (so the OLD invoice URL stops resolving and
 * a re-send issues a fresh link), clears every recipient/lifecycle stamp
 * (viewed / disputed / payment-reported / paid / sent / cancelled), rolls
 * status back to 'draft', and cancels any still-pending follow-ups.
 *
 * public_token is NOT NULL (DB default gen_random_uuid()), so we rotate it
 * rather than null it. Returns the cancelled-follow-up count for the confirm UI.
 */
export async function resetInvoice(
  invoiceId: string,
): Promise<{ ok: true; cancelledFollowUps: number } | { ok: false; error: string }> {
  const profile = await requireCompanyContext();
  // H-02: resetting an invoice back to draft (a re-send enabler) requires the
  // invoices feature.
  await requireInvoiceFeature(profile.company_id);
  const admin = createAdminClient();

  const { data: invoice, error: loadErr } = await admin
    .from('invoices')
    .select('id, company_id, invoice_number')
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id)
    .single();

  if (loadErr || !invoice) return { ok: false, error: 'Invoice not found.' };

  const { error: updateErr } = await admin
    .from('invoices')
    .update({
      public_token: crypto.randomUUID(),
      viewed_at: null,
      disputed_at: null,
      payment_reported_at: null,
      paid_at: null,
      sent_at: null,
      cancelled_at: null,
      status: 'draft',
    } as Record<string, unknown>)
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id);

  if (updateErr) return { ok: false, error: `Failed to reset invoice: ${updateErr.message}` };

  const { count: cancelledFollowUps } = await admin
    .from('scheduled_messages')
    .update(
      { status: 'cancelled', cancelled_reason: 'Invoice was reset.' } as Record<string, unknown>,
      { count: 'exact' },
    )
    .eq('invoice_id', invoiceId)
    .eq('company_id', profile.company_id)
    .eq('status', 'scheduled');

  try {
    await admin.from('invoice_activity').insert({
      invoice_id: invoiceId,
      company_id: profile.company_id,
      event_type: 'reset',
      metadata: {},
    });
  } catch {
    /* ignore audit failure */
  }

  revalidatePath(`/[workspaceSlug]/invoices`);
  revalidatePath(`/[workspaceSlug]/invoices/${invoiceId}`);
  return { ok: true, cancelledFollowUps: cancelledFollowUps ?? 0 };
}

// ── Confirm payment received (user-side) ──────────────────────────────────

export async function confirmPaymentReceived(invoiceId: string) {
  const profile = await requireCompanyContext();
  // H-02: marking an invoice paid requires the invoices feature.
  await requireInvoiceFeature(profile.company_id);
  const now = new Date().toISOString();
  const admin = createAdminClient();

  await admin
    .from('invoices')
    .update({ status: 'paid', paid_at: now })
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id);

  await admin.from('invoice_activity').insert({
    invoice_id: invoiceId,
    company_id: profile.company_id,
    event_type: 'paid',
    metadata: { confirmed_at: now },
  });

  // Alert self (user receives "Payment confirmed" notification). Status update
  // above always happens; this alert is gated by the notification matrix.
  if (await alertEnabled(admin, profile.company_id, 'invoice_paid')) {
    await admin.from('alerts').insert({
      company_id: profile.company_id,
      invoice_id: invoiceId,
      alert_type: 'invoice_paid',
      title: 'Payment Confirmed',
      message: 'You confirmed payment received on this invoice.',
    });
  }

  revalidatePath(`/[workspaceSlug]/invoices/${invoiceId}`);
}

// ── Save invoice payment details ────────────────────────────────────────────

export async function saveInvoicePaymentDetails(
  invoiceId: string,
  paymentDetails: {
    accountName?: string;
    bankName?: string;
    accountNumber?: string;
    sortCode?: string;
    paymentLink?: string;
  }
) {
  const profile = await requireCompanyContext();
  // H-02: editing invoice payment details requires the invoices feature.
  await requireInvoiceFeature(profile.company_id);
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('invoices')
    .update({ payment_details: paymentDetails as never, updated_at: new Date().toISOString() })
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id);

  if (error) throw error;
  revalidatePath(`/[workspaceSlug]/invoices/${invoiceId}`);
}

// ── Update invoice status (owner-driven, from the list Status dropdown) ─────

/**
 * Owner-settable lifecycle statuses for the Status dropdown on the invoices
 * list. Recipient/system-driven states (viewed, payment_reported, disputed)
 * are intentionally excluded from manual selection - they are surfaced via the
 * RecipientStatusBadge / status flow, not set by hand here.
 */
const MANUAL_INVOICE_STATUSES = ['draft', 'sent', 'paid', 'cancelled'] as const;
export type ManualInvoiceStatus = (typeof MANUAL_INVOICE_STATUSES)[number];

export async function updateInvoiceStatus(invoiceId: string, status: string) {
  if (!(MANUAL_INVOICE_STATUSES as readonly string[]).includes(status)) {
    throw new Error('Invalid invoice status');
  }
  const profile = await requireCompanyContext();
  // H-02: changing invoice status requires the invoices feature. Exception:
  // 'cancelled' is a wind-down action we allow on Free (mirrors cancelInvoice).
  if (status !== 'cancelled') {
    await requireInvoiceFeature(profile.company_id);
  }
  const supabase = await createSupabaseServerClient();
  const now = new Date().toISOString();

  // Stamp the matching timestamp on transition so downstream views stay
  // consistent with the existing send/pay flows.
  const patch: Record<string, string> = { status, updated_at: now };
  if (status === 'paid') patch.paid_at = now;
  if (status === 'sent') patch.sent_at = now;

  const { error } = await supabase
    .from('invoices')
    .update(patch as never)
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id);

  if (error) throw error;
  revalidatePath(`/[workspaceSlug]/invoices`);
}

// ── Mark invoice sent by shared link (owner copies/opens public link) ───────

/**
 * Treat generating/opening the public "Customer View" link as the send event
 * for a DRAFT invoice. The owner often skips QuoteCore+ email and shares the
 * public link himself; without this the invoice stays 'draft'/"Unsent" and
 * (because Read gates on status) the recipient open never stamped either.
 *
 * Idempotent: no-op unless status === 'draft'. Mirrors the email send path's
 * status flip + activity log + owner alert, but sends NO email.
 */
export async function markInvoiceSentByLink(invoiceId: string): Promise<void> {
  const profile = await requireCompanyContext();
  // H-02: sharing/sending an invoice via its public link requires the
  // invoices feature.
  await requireInvoiceFeature(profile.company_id);
  const supabase = await createSupabaseServerClient();
  const admin = createAdminClient();

  // Ownership check scoped to caller's company.
  const { data: invoice } = await supabase
    .from('invoices')
    .select('id, invoice_number, status')
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id)
    .maybeSingle();

  // Not found / not owned, or already past draft -> idempotent no-op.
  if (!invoice || invoice.status !== 'draft') return;

  const now = new Date().toISOString();

  // Race-guarded flip: only stamps while still draft.
  await supabase
    .from('invoices')
    .update({ status: 'sent', sent_at: now, updated_at: now })
    .eq('id', invoice.id)
    .eq('company_id', profile.company_id)
    .eq('status', 'draft');

  // Log invoice activity (source distinguishes from email send).
  await admin.from('invoice_activity').insert({
    invoice_id: invoice.id,
    company_id: profile.company_id,
    event_type: 'sent',
    metadata: { source: 'link_shared', sent_by_user_id: profile.id },
  });

  // Same owner alert as the email path.
  await admin.from('alerts').insert({
    company_id: profile.company_id,
    invoice_id: invoice.id,
    alert_type: 'invoice_sent',
    title: 'Invoice Sent',
    message: `Invoice ${invoice.invoice_number} was shared via its public link.`,
  });

  revalidatePath(`/[workspaceSlug]/invoices/${invoiceId}`);
  revalidatePath(`/[workspaceSlug]/invoices`);
}

// ── Delete invoice (draft only) ────────────────────────────────────────────

export async function deleteInvoice(invoiceId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Only allow deletion of drafts
  const { error } = await supabase
    .from('invoices')
    .delete()
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id)
    .eq('status', 'draft');

  if (error) throw error;
  revalidatePath(`/[workspaceSlug]/invoices`);
}

/**
 * Mark an invoice dispute as resolved (stamps `resolved_at`). Used by
 * the "Unresolved" tab of the invoice Activity card so the user can
 * clear a customer-raised dispute once they've actioned it. Ownership
 * scoped via company_id; idempotent (already-resolved rows are a
 * no-op success).
 */
export async function resolveInvoiceDispute(
  disputeId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('invoice_disputes')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', disputeId)
    .eq('company_id', profile.company_id)
    .is('resolved_at', null);

  if (error) return { ok: false, error: error.message };
  revalidatePath('/');
  return { ok: true };
}
