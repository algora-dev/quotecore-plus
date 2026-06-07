'use server';

import { revalidatePath } from 'next/cache';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

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
}): Promise<string> {
  const profile = await requireCompanyContext();
  const admin = createAdminClient();

  // Generate invoice number atomically
  const { data: invoiceNumber, error: numErr } = await admin.rpc(
    'generate_invoice_number',
    { p_company_id: profile.company_id }
  );
  if (numErr || !invoiceNumber) throw new Error('Failed to generate invoice number');

  const paymentReference = 'QCP-' + invoiceNumber;

  // Fetch company branding snapshot (only name + default_currency live on companies table)
  const { data: company } = await admin
    .from('companies')
    .select('name, default_currency')
    .eq('id', profile.company_id)
    .maybeSingle();

  const { data: invoice, error: insertErr } = await admin
    .from('invoices')
    .insert({
      company_id: profile.company_id,
      user_id: profile.id,
      invoice_number: invoiceNumber as string,
      payment_reference: paymentReference,
      status: 'draft',
      source_type: 'blank',
      customer_name: opts.customerName,
      customer_email: opts.customerEmail ?? null,
      customer_snapshot: (opts.customerSnapshot ?? {}) as never,
      cq_company_name: company?.name ?? null,
      business_snapshot: { businessName: company?.name ?? '' } as never,
      currency: opts.currency ?? company?.default_currency ?? 'GBP',
    })
    .select('id')
    .single();

  if (insertErr || !invoice) throw new Error('Failed to create invoice');

  // Log creation activity
  await admin.from('invoice_activity').insert({
    invoice_id: invoice.id,
    company_id: profile.company_id,
    event_type: 'created',
    metadata: { source_type: 'blank', customer_name: opts.customerName },
  });

  return invoice.id;
}

// ── Create invoice from quote ──────────────────────────────────────────────

export async function createInvoiceFromQuote(quoteId: string): Promise<string> {
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

  // Load customer quote lines
  const { data: cqLines } = await admin
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', quoteId)
    .order('sort_order');

  // Generate invoice number
  const { data: invoiceNumber, error: numErr } = await admin.rpc(
    'generate_invoice_number',
    { p_company_id: profile.company_id }
  );
  if (numErr || !invoiceNumber) throw new Error('Failed to generate invoice number');

  const paymentReference = 'QCP-' + invoiceNumber;

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

  const { data: invoice, error: insertErr } = await admin
    .from('invoices')
    .insert({
      company_id: profile.company_id,
      user_id: profile.id,
      invoice_number: invoiceNumber as string,
      payment_reference: paymentReference,
      status: 'draft',
      source_type: 'quote',
      source_id: quoteId,
      customer_name: quote.customer_name,
      customer_email: quote.customer_email ?? null,
      customer_snapshot: customerSnapshot as never,
      cq_company_name: quote.cq_company_name ?? null,
      cq_company_address: quote.cq_company_address ?? null,
      cq_company_email: quote.cq_company_email ?? null,
      cq_company_phone: quote.cq_company_phone ?? null,
      cq_company_logo_url: quote.cq_company_logo_url ?? null,
      cq_footer_text: quote.cq_footer_text ?? null,
      business_snapshot: businessSnapshot as never,
      currency: quote.currency ?? 'GBP',
      notes: quote.notes_internal ?? null,
    })
    .select('id')
    .single();

  if (insertErr || !invoice) throw new Error('Failed to create invoice from quote');

  // Import lines from customer_quote_lines
  if (cqLines && cqLines.length > 0) {
    const invoiceLines = cqLines
      .filter((l) => l.is_visible !== false)
      .map((l, idx) => ({
        invoice_id: invoice.id,
        company_id: profile.company_id,
        sort_order: idx,
        line_source_type: 'quote_import' as const,
        source_id: null,
        title: l.custom_text ?? '',
        description: null,
        quantity: 1,
        unit: 'item',
        unit_price: Number(l.custom_amount ?? 0),
        line_total: Number(l.custom_amount ?? 0),
        show_price: l.show_price ?? true,
        is_visible: true,
      }));

    await admin.from('invoice_lines').insert(invoiceLines);

    const subtotal = invoiceLines
      .filter((l) => l.show_price)
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
      'id, invoice_number, payment_reference, status, customer_name, customer_email, currency, subtotal, total, invoice_date, due_date, sent_at, paid_at, created_at, updated_at'
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
    is_visible?: boolean;
  }>,
  totals: { subtotal: number; taxTotal: number; discountTotal: number; total: number }
) {
  const profile = await requireCompanyContext();
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
  }
) {
  const profile = await requireCompanyContext();
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

  await admin
    .from('invoices')
    .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
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

// ── Confirm payment received (user-side) ──────────────────────────────────

export async function confirmPaymentReceived(invoiceId: string) {
  const profile = await requireCompanyContext();
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

  // Alert self (user receives "Payment confirmed" notification)
  await admin.from('alerts').insert({
    company_id: profile.company_id,
    invoice_id: invoiceId,
    alert_type: 'invoice_paid',
    title: 'Payment Confirmed',
    message: 'You confirmed payment received on this invoice.',
  });

  revalidatePath(`/[workspaceSlug]/invoices/${invoiceId}`);
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
