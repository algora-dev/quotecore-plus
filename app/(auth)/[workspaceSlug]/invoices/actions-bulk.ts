'use server';

/**
 * Bulk operations on invoices (multi-select on the invoices list).
 *
 * Mirrors quotes/actions-bulk.ts:
 *   - getMaxBulkBatch(): the shared 25-item cap (client mirrors it for UX).
 *   - loadInvoiceBundleData(invoiceId): everything one invoice's downloadable
 *     PDF needs (header, branding, lines, totals). Used by the client ZIP
 *     builder.
 *   - bulkDeleteInvoices(ids[]): deletes multiple invoices in one round-trip,
 *     respecting the SAME status rule the single deleteInvoice() in actions.ts
 *     enforces: only 'draft' invoices may be deleted. Non-draft invoices are
 *     SKIPPED (not cancelled) - cancelling is a deliberate, per-invoice action
 *     left to the row menu's Cancel Invoice option, so a bulk "delete" never
 *     silently changes the lifecycle of sent/paid invoices. The skipped count
 *     is surfaced to the UI.
 *
 * NB on audit: quotes log to `bulk_operations_log`, but that table's
 * `operation` CHECK constraint only allows the quote variants; adding invoice
 * variants needs a DB migration (out of scope here), so invoices skip the
 * audit log. The per-id company filter + draft-only rule + 25 cap remain the
 * authoritative safety controls.
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

const MAX_BULK_BATCH = 25;

export async function getMaxBulkBatch(): Promise<number> {
  return MAX_BULK_BATCH;
}

export interface InvoiceBundleLine {
  title: string;
  description: string | null;
  quantity: number;
  unit: string;
  unitPrice: number;
  lineTotal: number;
  showPrice: boolean;
  showQuantity: boolean;
  showDescription: boolean;
  includeInTotal: boolean;
  isVisible: boolean;
}

export interface InvoiceBundleData {
  /**
   * Everything the REAL on-screen InvoicePreview component needs to render the
   * invoice exactly as the owner sees it in the invoice editor. The bulk ZIP
   * builder mounts <InvoicePreview {...preview} /> off-screen and html2canvas-
   * captures it so the downloaded PDF is a pixel match.
   *
   * We use the owner-side InvoicePreview (not the public PublicInvoiceView)
   * because PublicInvoiceView embeds recipient action forms
   * (PaymentSentForm / DisputeForm / Pay buttons); InvoicePreview is the clean,
   * form-free visual already used as the live preview in InvoiceEditor.
   *
   * Shapes mirror what InvoiceEditor passes on screen:
   *   invoice -> raw `invoices` row (InvoiceRow)
   *   lines   -> `invoice_lines` rows mapped to EditableLine (localId = row id)
   */
  preview: {
    invoice: Record<string, unknown>;
    lines: Array<Record<string, unknown>>;
    currency: string;
    companyName: string;
    companyAddress: string;
    companyEmail: string;
    companyPhone: string;
    companyLogoUrl: string;
    footerText: string;
    notes: string;
    terms: string;
    invoiceDate: string;
    dueDate: string;
    subtotal: number;
    taxTotal: number;
    total: number;
    paymentDetails: {
      accountName?: string;
      bankName?: string;
      accountNumber?: string;
      sortCode?: string;
      paymentLink?: string;
    };
  };
  invoice: {
    id: string;
    invoiceNumber: string;
    paymentReference: string;
    status: string;
    customerName: string;
    customerEmail: string | null;
    currency: string;
    invoiceDate: string;
    dueDate: string | null;
    notes: string | null;
    terms: string | null;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    total: number;
    branding: {
      companyName: string | null;
      companyAddress: string | null;
      companyPhone: string | null;
      companyEmail: string | null;
      companyLogoUrl: string | null;
      footerText: string | null;
    };
  };
  lines: InvoiceBundleLine[];
}

/**
 * Load everything needed to build one invoice's downloadable PDF.
 * Returns null if the invoice doesn't exist or doesn't belong to the caller's company.
 */
export async function loadInvoiceBundleData(invoiceId: string): Promise<InvoiceBundleData | null> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoiceId)
    .eq('company_id', profile.company_id)
    .single();

  if (!invoice) return null;

  const { data: lineRows } = await supabase
    .from('invoice_lines')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('sort_order', { ascending: true });

  const lines: InvoiceBundleLine[] = (lineRows ?? []).map((l) => ({
    title: l.title ?? '',
    description: l.description ?? null,
    quantity: Number(l.quantity) || 0,
    unit: l.unit ?? '',
    unitPrice: Number(l.unit_price) || 0,
    lineTotal: Number(l.line_total) || 0,
    showPrice: l.show_price !== false,
    showQuantity: l.show_quantity !== false,
    showDescription: l.show_description !== false,
    includeInTotal: l.include_in_total !== false,
    isVisible: l.is_visible !== false,
  }));

  // ---- Props for the REAL on-screen InvoicePreview component ----
  // Mirror InvoiceEditor's mapping of saved invoice_lines -> EditableLine and
  // its payment_details -> paymentDetails object exactly.
  const previewLines = (lineRows ?? []).map((l: any) => ({
    localId: l.id,
    line_source_type: l.line_source_type,
    source_id: l.source_id ?? null,
    title: l.title ?? '',
    description: l.description ?? null,
    quantity: Number(l.quantity) || 0,
    unit: l.unit ?? '',
    unit_price: Number(l.unit_price) || 0,
    line_total: Number(l.line_total) || 0,
    show_price: l.show_price !== false,
    show_quantity: l.show_quantity !== false,
    show_description: l.show_description !== false,
    include_in_total: l.include_in_total !== false,
    is_visible: l.is_visible !== false,
  }));
  const pd = (invoice.payment_details ?? {}) as Record<string, string>;

  return {
    preview: {
      invoice: invoice as Record<string, unknown>,
      lines: previewLines as Array<Record<string, unknown>>,
      currency: invoice.currency ?? 'GBP',
      companyName: invoice.cq_company_name ?? '',
      companyAddress: invoice.cq_company_address ?? '',
      companyEmail: invoice.cq_company_email ?? '',
      companyPhone: invoice.cq_company_phone ?? '',
      companyLogoUrl: invoice.cq_company_logo_url ?? '',
      footerText: invoice.cq_footer_text ?? '',
      notes: invoice.notes ?? '',
      terms: invoice.terms ?? '',
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date ?? '',
      subtotal: Number(invoice.subtotal) || 0,
      taxTotal: Number(invoice.tax_total) || 0,
      total: Number(invoice.total) || 0,
      paymentDetails: {
        accountName: pd.accountName ?? '',
        bankName: pd.bankName ?? '',
        accountNumber: pd.accountNumber ?? '',
        sortCode: pd.sortCode ?? '',
        paymentLink: pd.paymentLink ?? '',
      },
    },
    invoice: {
      id: invoice.id,
      invoiceNumber: invoice.invoice_number,
      paymentReference: invoice.payment_reference,
      status: invoice.status,
      customerName: invoice.customer_name,
      customerEmail: invoice.customer_email ?? null,
      currency: invoice.currency ?? 'GBP',
      invoiceDate: invoice.invoice_date,
      dueDate: invoice.due_date ?? null,
      notes: invoice.notes ?? null,
      terms: invoice.terms ?? null,
      subtotal: Number(invoice.subtotal) || 0,
      taxTotal: Number(invoice.tax_total) || 0,
      discountTotal: Number(invoice.discount_total) || 0,
      total: Number(invoice.total) || 0,
      branding: {
        companyName: invoice.cq_company_name,
        companyAddress: invoice.cq_company_address,
        companyPhone: invoice.cq_company_phone,
        companyEmail: invoice.cq_company_email,
        companyLogoUrl: invoice.cq_company_logo_url,
        footerText: invoice.cq_footer_text,
      },
    },
    lines,
  };
}

/**
 * Delete multiple invoices in one call. Mirrors the single deleteInvoice()
 * status rule: ONLY 'draft' invoices are deleted. Non-draft invoices in the
 * selection are skipped (and reported via the `skipped` count) rather than
 * cancelled - bulk delete must never silently change a sent/paid invoice's
 * lifecycle. Each id is verified against the caller's company_id; cross-company
 * / unknown ids are also skipped.
 *
 * @returns deleted = drafts actually removed, skipped = everything else
 *          (non-draft, not owned, or already gone).
 */
export async function bulkDeleteInvoices(ids: string[]): Promise<{ deleted: number; skipped: number }> {
  const profile = await requireCompanyContext();
  if (!Array.isArray(ids) || ids.length === 0) return { deleted: 0, skipped: 0 };

  // Authoritative server-side cap.
  if (ids.length > MAX_BULK_BATCH) {
    throw new Error(`Too many invoices selected: ${ids.length}. The limit is ${MAX_BULK_BATCH} per batch.`);
  }

  ids = Array.from(new Set(ids));

  const supabase = await createSupabaseServerClient();

  // Find which selected invoices are owned drafts. Anything not in this set
  // (non-draft, not owned, missing) is counted as skipped.
  const { data: draftInvoices } = await supabase
    .from('invoices')
    .select('id')
    .in('id', ids)
    .eq('company_id', profile.company_id)
    .eq('status', 'draft');

  const draftIds = (draftInvoices ?? []).map((i) => i.id as string);
  const skipped = ids.length - draftIds.length;

  if (draftIds.length === 0) {
    return { deleted: 0, skipped };
  }

  // Mirror the single delete: delete invoice rows scoped to company + draft
  // status. Lines cascade via FK (invoice_lines.invoice_id -> invoices.id).
  // Use admin client only if needed; the company-scoped delete via the server
  // client respects RLS, matching deleteInvoice().
  const { error: deleteErr } = await supabase
    .from('invoices')
    .delete()
    .in('id', draftIds)
    .eq('company_id', profile.company_id)
    .eq('status', 'draft');

  if (deleteErr) {
    throw new Error(`Failed to delete invoices: ${deleteErr.message}`);
  }

  // Best-effort: ensure any orphaned lines are gone (cascade should handle it,
  // but invoice_lines has its own company_id and we never want stragglers).
  const admin = createAdminClient();
  await admin.from('invoice_lines').delete().in('invoice_id', draftIds);

  revalidatePath('/');

  return { deleted: draftIds.length, skipped };
}
