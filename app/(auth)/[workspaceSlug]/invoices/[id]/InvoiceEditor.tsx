'use client';
import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CollapsiblePanel, CollapseButton, ExpandTab } from '@/app/components/editor/CollapsiblePanel';
import { saveInvoiceLines, saveInvoiceMeta, saveInvoicePaymentDetails, cancelInvoice, confirmPaymentReceived, markInvoiceSentByLink, resetInvoice } from '../actions';
import { ResetButton } from '@/app/components/ResetButton';
import { InvoicePreview } from './InvoicePreview';
import { SendDocumentButton } from '@/app/components/send/SendDocumentButton';
import type { EmailTemplate } from '@/app/components/send/types';
import { AiUploadModal } from '@/app/components/ai-import/AiUploadModal';
import { AiTextPromptModal } from '@/app/components/ai-import/AiTextPromptModal';
import type { ParsedDocumentResult } from '@/app/components/ai-import/types';
import { elementToPdf } from '@/app/lib/pdf/renderPreviewToPdf';
import { AddInvoiceLineModal } from './AddInvoiceLineModal';
import { InvoiceHeaderModal } from './InvoiceHeaderModal';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { ConfirmModal } from '@/app/components/ConfirmModal';

// ── Types ──────────────────────────────────────────────────────────────────

export interface InvoiceRow {
  id: string;
  invoice_number: string;
  payment_reference: string;
  status: string;
  source_type: string;
  customer_name: string;
  customer_email: string | null;
  customer_snapshot: Record<string, unknown> | null;
  cq_company_name: string | null;
  cq_company_address: string | null;
  cq_company_email: string | null;
  cq_company_phone: string | null;
  cq_company_logo_url: string | null;
  cq_footer_text: string | null;
  business_snapshot: Record<string, unknown> | null;
  currency: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  invoice_date: string;
  due_date: string | null;
  notes: string | null;
  terms: string | null;
  payment_details: Record<string, string> | null;
  public_token: string;
  sent_at: string | null;
  paid_at: string | null;
  payment_reported_at: string | null;
  disputed_at: string | null;
}

export interface InvoiceLineRow {
  id: string;
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
}

export interface EditableLine {
  localId: string;
  line_source_type: 'custom' | 'catalog' | 'component' | 'quote_import' | 'job_import';
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
}

interface Props {
  invoice: InvoiceRow;
  savedLines: InvoiceLineRow[];
  emailTemplates: EmailTemplate[];
  libraryFiles: { id: string; name: string; fileSize: number }[];
  libraryLocked: boolean;
  workspaceSlug: string;
  defaultLogoUrl: string | null;
  currency: string;
  companyTaxes: { id: string; name: string; rate_percent: number }[];
  catalogs: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  componentLibrary: { id: string; name: string; collection_id: string | null }[];
  activity: { id: string; event_type: string; metadata: Record<string, unknown> | null; created_at: string }[];
  /** Whether this company's plan includes scheduled follow-ups. */
  canFollowups?: boolean;
  /** Whether this company can send via QCP email (drives the test-tip copy). */
  canEmail?: boolean;
  /** Whether THIS user has already seen the one-time "test it first" send tip. */
  sendTestTipSeen?: boolean;
  /** Activity card (server-rendered) shown above the invoice document in
   *  the right preview pane to mirror the Quotes summary layout. */
  activitySlot?: ReactNode;
}

// ── Status badge ───────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:            { label: 'Draft',            cls: 'bg-slate-100 text-slate-600' },
  sent:             { label: 'Sent',             cls: 'bg-orange-100 text-orange-700' },
  viewed:           { label: 'Viewed',           cls: 'bg-blue-100 text-blue-700' },
  payment_reported: { label: 'Payment Reported', cls: 'bg-amber-100 text-amber-700' },
  paid:             { label: 'Paid',             cls: 'bg-emerald-100 text-emerald-700' },
  disputed:         { label: 'Disputed',         cls: 'bg-red-100 text-red-700' },
  cancelled:        { label: 'Cancelled',        cls: 'bg-slate-100 text-slate-400' },
};

// ── Main component ─────────────────────────────────────────────────────────

export function InvoiceEditor({
  invoice: initial,
  savedLines,
  workspaceSlug,
  defaultLogoUrl,
  currency,
  companyTaxes,
  catalogs,
  collections,
  componentLibrary,
  activity,
  emailTemplates,
  libraryFiles,
  libraryLocked,
  canFollowups = false,
  canEmail = false,
  sendTestTipSeen = false,
  activitySlot,
}: Props) {
  const router = useRouter();
  // When opened from the Message Center (?from=inbox) the Back arrow returns
  // to the inbox instead of the invoices list.
  const searchParams = useSearchParams();
  const backHref =
    searchParams.get('from') === 'inbox'
      ? `/${workspaceSlug}/inbox`
      : `/${workspaceSlug}/invoices`;

  // ── Line state ──
  const [lines, setLines] = useState<EditableLine[]>(() =>
    savedLines.map((l) => ({
      localId: l.id,
      line_source_type: l.line_source_type as EditableLine['line_source_type'],
      source_id: l.source_id,
      title: l.title,
      description: l.description,
      quantity: Number(l.quantity),
      unit: l.unit,
      unit_price: Number(l.unit_price),
      line_total: Number(l.line_total),
      show_price: l.show_price,
      show_quantity: l.show_quantity ?? true,
      show_description: l.show_description ?? true,
      include_in_total: (l as { include_in_total?: boolean }).include_in_total ?? true,
      is_visible: l.is_visible,
    }))
  );

  // ── Branding / metadata state ──
  const [companyName, setCompanyName] = useState(initial.cq_company_name ?? '');
  const [companyAddress, setCompanyAddress] = useState(initial.cq_company_address ?? '');
  const [companyEmail, setCompanyEmail] = useState(initial.cq_company_email ?? '');
  const [companyPhone, setCompanyPhone] = useState(initial.cq_company_phone ?? '');
  const [companyLogoUrl, setCompanyLogoUrl] = useState(initial.cq_company_logo_url ?? defaultLogoUrl ?? '');
  const [footerText, setFooterText] = useState(initial.cq_footer_text ?? '');
  const [notes, setNotes] = useState(initial.notes ?? '');
  const [terms, setTerms] = useState(initial.terms ?? '');
  const [invoiceDate, setInvoiceDate] = useState(initial.invoice_date?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState(initial.due_date?.slice(0, 10) ?? '');

  // ── Payment details state ──
  const pd = initial.payment_details ?? {};
  const [payAccountName, setPayAccountName] = useState((pd as Record<string,string>).accountName ?? '');
  const [payBankName, setPayBankName] = useState((pd as Record<string,string>).bankName ?? '');
  const [payAccountNumber, setPayAccountNumber] = useState((pd as Record<string,string>).accountNumber ?? '');
  const [paySortCode, setPaySortCode] = useState((pd as Record<string,string>).sortCode ?? '');
  const [payPaymentLink, setPayPaymentLink] = useState((pd as Record<string,string>).paymentLink ?? '');
  const [payDirty, setPayDirty] = useState(false);
  const [paymentSaving, setPaymentSaving] = useState(false);

  // ── Price visibility toggles ──
  const [hideLinePrices, setHideLinePrices] = useState(
    !!(initial as { hide_line_prices?: boolean }).hide_line_prices
  );
  const [hideTotals, setHideTotals] = useState(
    !!(initial as { hide_totals?: boolean }).hide_totals
  );

  // ── UI state ──
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showAddLine, setShowAddLine] = useState(false);
  const [showHeaderModal, setShowHeaderModal] = useState(false);
  const [showAiUpload, setShowAiUpload] = useState(false);
  const [showAiText, setShowAiText] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lines' | 'details' | 'activity'>('lines');
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [showConfirmPaymentModal, setShowConfirmPaymentModal] = useState(false);
  const [confirmPaymentPending, setConfirmPaymentPending] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  // Owner single download: capture the SAME on-screen InvoicePreview (under
  // [data-pdf-content]) into a PDF via the shared helper, so the download is a
  // pixel match of this preview - identical to the bulk ZIP path (which renders
  // the same InvoicePreview off-screen).
  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const el = document.querySelector('[data-pdf-content]') as HTMLElement | null;
      if (!el) {
        alert('Could not find the invoice content to export. Please refresh and try again.');
        return;
      }
      const pdf = await elementToPdf(el);
      const safe = (initial.invoice_number || 'Invoice').replace(/[^a-z0-9]/gi, '_');
      pdf.save(`Invoice-${safe}.pdf`);
    } catch (err) {
      console.error('[InvoiceEditor] PDF download failed:', err);
      alert(`Failed to generate PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setDownloadingPdf(false);
    }
  }

  const status = STATUS_LABELS[initial.status] ?? STATUS_LABELS.draft;
  const isReadOnly = ['cancelled', 'paid'].includes(initial.status);

  // ── Mark dirty on changes ──
  const markDirty = useCallback(() => setIsDirty(true), []);

  function updateLine(localId: string, patch: Partial<EditableLine>) {
    setLines((prev) =>
      prev.map((l) => {
        if (l.localId !== localId) return l;
        const updated = { ...l, ...patch };
        // Recompute line total when qty or unit_price change
        if ('quantity' in patch || 'unit_price' in patch) {
          updated.line_total = Number((updated.quantity * updated.unit_price).toFixed(2));
        }
        return updated;
      })
    );
    markDirty();
  }

  function removeLine(localId: string) {
    setLines((prev) => prev.filter((l) => l.localId !== localId));
    markDirty();
  }

  function moveLine(localId: string, direction: 'up' | 'down') {
    setLines((prev) => {
      const idx = prev.findIndex((l) => l.localId === localId);
      if (idx < 0) return prev;
      const next = [...prev];
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
    markDirty();
  }

  function addLines(newLines: EditableLine[]) {
    setLines((prev) => [...prev, ...newLines]);
    markDirty();
  }

  // ── AI import handler ──
  function handleAiParsed(data: ParsedDocumentResult) {
    const newLines: EditableLine[] = data.lines.map((l, i) => ({
      localId: `ai-${Date.now()}-${i}`,
      line_source_type: 'custom' as const,
      source_id: null,
      title: l.description,
      description: null,
      quantity: l.qty,
      unit: l.unit || '',
      unit_price: l.rate,
      line_total: l.qty * l.rate,
      show_price: true,
      show_quantity: true,
      show_description: false,
      include_in_total: true,
      is_visible: true,
    }));
    setLines((prev) => [...prev, ...newLines]);
    // Populate branding fields if AI extracted them and they're empty
    if (data.companyName && !companyName) setCompanyName(data.companyName);
    if (data.notes && !footerText) setFooterText(data.notes);
    markDirty();
  }

  // ── Totals (include_in_total drives the $, regardless of visibility/show_price) ──
  const subtotal = lines.filter((l) => l.include_in_total).reduce((s, l) => s + l.line_total, 0);
  // Tax: flat rate approach (will extend to per-line taxes in a later phase)
  const taxTotal = 0; // Phase 2: add tax rows
  const total = subtotal + taxTotal;

  // ── Save payment details ──
  async function handleSavePaymentDetails() {
    setPaymentSaving(true);
    try {
      await saveInvoicePaymentDetails(initial.id, {
        accountName: payAccountName,
        bankName: payBankName,
        accountNumber: payAccountNumber,
        sortCode: paySortCode,
        paymentLink: payPaymentLink,
      });
      setPayDirty(false);
    } catch {
      alert('Failed to save payment details.');
    } finally {
      setPaymentSaving(false);
    }
  }

  // ── Core save (no redirect) - used by auto-save and the Save button ──
  async function persistChanges() {
    await saveInvoiceLines(
      initial.id,
      lines.map((l, idx) => ({
        sort_order: idx,
        line_source_type: l.line_source_type,
        source_id: l.source_id,
        title: l.title,
        description: l.description,
        quantity: l.quantity,
        unit: l.unit,
        unit_price: l.unit_price,
        line_total: l.line_total,
        show_price: l.show_price,
        show_quantity: l.show_quantity,
        show_description: l.show_description,
        include_in_total: l.include_in_total,
        is_visible: l.is_visible,
      })),
      { subtotal, taxTotal, discountTotal: 0, total }
    );
    await saveInvoiceMeta(initial.id, {
      notes: notes || null,
      terms: terms || null,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      cq_company_name: companyName || null,
      cq_company_address: companyAddress || null,
      cq_company_email: companyEmail || null,
      cq_company_phone: companyPhone || null,
      cq_company_logo_url: companyLogoUrl || null,
      cq_footer_text: footerText || null,
      hide_line_prices: hideLinePrices,
      hide_totals: hideTotals,
    });
    setIsDirty(false);
    setLastSaved(new Date());
  }

  // ── Manual Save button - saves then returns to invoices list ──
  async function handleSave() {
    setSaving(true);
    try {
      await persistChanges();
      router.push(`/${workspaceSlug}/invoices`);
    } catch {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function doConfirmPayment() {
    setConfirmPaymentPending(true);
    try {
      await confirmPaymentReceived(initial.id);
      router.refresh();
    } finally {
      setConfirmPaymentPending(false);
      setShowConfirmPaymentModal(false);
    }
  }

  async function doCancel() {
    setCancelPending(true);
    try {
      await cancelInvoice(initial.id);
      router.push(`/${workspaceSlug}/invoices`);
    } finally {
      setCancelPending(false);
      setShowCancelModal(false);
    }
  }

  // ── Auto-save after 2s of inactivity ──
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isDirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      persistChanges().catch(() => {/* silent on auto-save fail */});
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [isDirty, lines, notes, terms, invoiceDate, dueDate, companyName, companyAddress, companyEmail, companyPhone, companyLogoUrl, footerText]);

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/invoice/${initial.public_token}`
    : `/invoice/${initial.public_token}`;

  // Sharing the public "Customer View" link counts as sending a DRAFT invoice.
  // We flip status server-side (idempotent no-op once past draft) BEFORE
  // opening the link, so a manually-shared invoice still shows as Sent and the
  // recipient's later open can stamp Read. No email is sent here.
  const openCustomerView = useCallback(() => {
    // Open synchronously to dodge popup blockers, then fire the status flip.
    const win = typeof window !== 'undefined' ? window.open(publicUrl, '_blank', 'noopener,noreferrer') : null;
    markInvoiceSentByLink(initial.id)
      .then(() => router.refresh())
      .catch((err) => console.error('markInvoiceSentByLink failed:', err));
    if (!win && typeof window !== 'undefined') window.location.href = publicUrl;
  }, [publicUrl, initial.id, router]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar - rounded floating card on a continuous grey band, matching
          the Quotes summary style. The band (bg-slate-100) also backs the
          activity card below so header + activity read as one grey section
          above the editor's two-pane body - no second-box look. Non-sticky. */}
      <div className="bg-slate-50 px-4 pt-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between px-4 py-3 border border-slate-200 rounded-2xl bg-white shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={backHref}
            title={backHref.endsWith('/inbox') ? 'Back to Message Center' : 'Back to Invoices'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 text-sm">{initial.invoice_number}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span>
            </div>
            <p className="text-xs text-slate-500 truncate">{initial.customer_name}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          {/* Save indicator */}
          {isDirty && (
            <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
          )}
          {!isDirty && lastSaved && (
            <span className="text-xs text-slate-400">Saved</span>
          )}

          {/* Public link - sharing it flips a draft to Sent (no email). */}
          <button
            type="button"
            onClick={openCustomerView}
            className="inline-flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
            Customer View
          </button>

          {/* Payment Reported action */}
          {initial.status === 'payment_reported' && (
            <button
              type="button"
              onClick={() => setShowConfirmPaymentModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-all"
            >
              Confirm Payment
            </button>
          )}

          {/* Download PDF (owner) - same on-screen InvoicePreview, captured to
              a PDF that matches the bulk ZIP output exactly. */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-1.5 text-xs text-slate-700 border border-slate-300 rounded-full px-3 py-1.5 hover:bg-slate-50 transition-all disabled:opacity-50"
          >
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </button>

          {/* Reset: void the public link + roll back to draft so the user can
              re-send a fresh invoice with a new URL. Only meaningful once the
              invoice has actually been sent (past 'draft'). */}
          {initial.status !== 'draft' && (
            <ResetButton
              action={resetInvoice}
              id={initial.id}
              entityLabel="Invoice"
              className="inline-flex items-center gap-1.5 text-xs text-amber-700 border border-amber-300 rounded-full px-3 py-1.5 hover:bg-amber-50 transition-all"
            />
          )}

          {/* Cancel */}
          {!['cancelled', 'paid'].includes(initial.status) && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="inline-flex items-center gap-1.5 text-xs text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50 transition-all"
            >
              Cancel Invoice
            </button>
          )}

          {/* Save */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              data-copilot="invoice-save"
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}

          {/* Send Invoice - pinned far right (primary action), matching the
              Quotes/Orders editors where Send is the right-most action. */}
          <SendDocumentButton
            entityKind="invoice"
            entityId={initial.id}
            workspaceSlug={workspaceSlug}
            emailTemplates={emailTemplates}
            mergeData={{
              customer_name: initial.customer_name ?? '',
              invoice_number: initial.invoice_number ?? '',
              invoice_total: formatCurrency(Number(initial.total ?? 0), currency),
              company_name: initial.cq_company_name ?? '',
              due_date: initial.due_date
                ? new Date(initial.due_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                : '',
            }}
            defaultRecipientEmail={initial.customer_email}
            canFollowups={canFollowups}
            canEmail={canEmail}
            sendTestTipSeen={sendTestTipSeen}
            libraryFiles={libraryFiles}
            entityFiles={[]}
            libraryLocked={libraryLocked}
            existingToken={initial.public_token}
            hidden={['cancelled', 'paid'].includes(initial.status)}
          />
        </div>
      </div>

      {/* Activity card - inside the same grey band as the header card, so
          header + activity read as one continuous grey section above the
          editor's full-bleed two-pane body. Full width, padded to align
          with the header card. data-exclude-pdf keeps it off the printed doc. */}
      {activitySlot ? (
        <div className="pt-4 data-exclude-pdf">{activitySlot}</div>
      ) : null}
      </div>
      <div className="h-4 bg-slate-50" />

      {/* Editor body - panes float as rounded cards on the slate-50 app
          background, with a gap between them (matches the rounded card
          language of the header/activity section above). */}
      <div className="flex flex-col md:flex-row md:flex-1 md:overflow-hidden relative bg-slate-50 px-4 pb-4 gap-4">
        {/* ── Left panel ── */}
        {!panelCollapsed && (
          <div className="w-full md:w-[480px] md:min-w-[400px] flex-shrink-0 border border-slate-200 rounded-2xl bg-white flex flex-col md:overflow-y-auto shadow-sm">
            {/* Panel tabs */}
            <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10 rounded-t-2xl">
              {(['lines', 'details', 'activity'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  data-copilot={tab === 'lines' ? 'invoice-lines-tab' : tab === 'details' ? 'invoice-details-tab' : undefined}
                  className={`flex-1 py-2.5 text-sm font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'border-b-2 border-orange-500 text-orange-600'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab === 'lines' ? 'Line Items' : tab === 'details' ? 'Details' : 'Activity'}
                </button>
              ))}
              <CollapseButton collapsed={false} onToggle={() => setPanelCollapsed(true)} className="px-3" />
            </div>

            {/* ── Lines tab ── */}
            {activeTab === 'lines' && (
              <div className="p-4 flex flex-col gap-3 flex-1">
                {lines.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-200 p-8 text-center text-slate-400">
                    <p className="text-sm font-medium">No line items yet</p>
                    <p className="text-xs mt-1">Add a line item to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-2" data-copilot="invoice-lines-list">
                    {lines.map((line, idx) => (
                      <div
                        key={line.localId}
                        className={`rounded-xl border ${line.is_visible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'} p-3`}
                      >
                        {editingLineId === line.localId ? (
                          /* ── Edit mode: content fields only ── */
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={line.title}
                              onChange={(e) => updateLine(line.localId, { title: e.target.value })}
                              placeholder="Line title"
                              autoFocus
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-orange-500 focus:outline-none"
                            />
                            <textarea
                              value={line.description ?? ''}
                              onChange={(e) => updateLine(line.localId, { description: e.target.value || null })}
                              placeholder="Description (optional)"
                              rows={2}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm resize-none focus:border-orange-500 focus:outline-none"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-slate-500 mb-0.5">Qty</label>
                                <input type="number" value={line.quantity} min={0} step={0.01}
                                  onChange={(e) => updateLine(line.localId, { quantity: parseFloat(e.target.value) || 0 })}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-0.5">Unit</label>
                                <input type="text" value={line.unit} placeholder="item"
                                  onChange={(e) => updateLine(line.localId, { unit: e.target.value })}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-0.5">Unit Price</label>
                                <input type="number" value={line.unit_price} min={0} step={0.01}
                                  onChange={(e) => updateLine(line.localId, { unit_price: parseFloat(e.target.value) || 0 })}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:border-orange-500 focus:outline-none" />
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-slate-700">
                                Line total: {formatCurrency(line.line_total, currency)}
                              </span>
                              <button type="button" onClick={() => setEditingLineId(null)}
                                className="text-xs text-orange-600 font-medium hover:underline">Done</button>
                            </div>
                          </div>
                        ) : (
                          /* ── Display mode: content + inline toggles ── */
                          <div>
                            <div className="flex items-start gap-2">
                              {/* Reorder arrows */}
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                <button type="button" onClick={() => moveLine(line.localId, 'up')}
                                  disabled={idx === 0 || isReadOnly}
                                  className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                                </button>
                                <button type="button" onClick={() => moveLine(line.localId, 'down')}
                                  disabled={idx === lines.length - 1 || isReadOnly}
                                  className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30">
                                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                </button>
                              </div>
                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">{line.title || 'Untitled'}</p>
                                {line.description && (
                                  <p className="text-xs text-slate-500 truncate">{line.description}</p>
                                )}
                                <p className="text-xs text-slate-400 mt-0.5">
                                  {line.quantity} {line.unit} × {formatCurrency(line.unit_price, currency)}
                                </p>
                              </div>
                              {/* Total + actions */}
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-sm font-semibold text-slate-900 mr-1">
                                  {line.show_price ? formatCurrency(line.line_total, currency) : <span className="text-xs text-slate-400 italic">hidden</span>}
                                </span>
                                {!isReadOnly && (
                                  <>
                                    <button type="button" onClick={() => setEditingLineId(line.localId)}
                                      className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button type="button" onClick={() => removeLine(line.localId)}
                                      className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                            {/* ── Show/hide toggles - checkbox pattern matching CustomerQuoteEditor ── */}
                            {!isReadOnly && (
                              <div className="flex items-center gap-4 mt-2 pt-2 border-t border-slate-100">
                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={line.is_visible}
                                    onChange={() => updateLine(line.localId, { is_visible: !line.is_visible })}
                                    className="toggle-dot"
                                  />
                                  Show
                                </label>
                                <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${
                                  line.is_visible ? 'text-slate-600' : 'text-slate-300'
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={line.show_price}
                                    disabled={!line.is_visible}
                                    onChange={() => updateLine(line.localId, { show_price: !line.show_price })}
                                    className="toggle-dot"
                                  />
                                  Price
                                </label>
                                <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${
                                  line.is_visible ? 'text-slate-600' : 'text-slate-300'
                                }`}>
                                  <input
                                    type="checkbox"
                                    checked={line.show_quantity}
                                    disabled={!line.is_visible}
                                    onChange={() => updateLine(line.localId, { show_quantity: !line.show_quantity })}
                                    className="toggle-dot"
                                  />
                                  Qty
                                </label>
                                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={line.include_in_total}
                                    onChange={() => updateLine(line.localId, { include_in_total: !line.include_in_total })}
                                    className="toggle-dot"
                                  />
                                  Add $
                                </label>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Totals summary */}
                {lines.length > 0 && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1">
                    <div className="flex justify-between text-sm text-slate-600">
                      <span>Subtotal</span>
                      <span>{formatCurrency(subtotal, currency)}</span>
                    </div>
                    {taxTotal > 0 && (
                      <div className="flex justify-between text-sm text-slate-600">
                        <span>Tax</span>
                        <span>{formatCurrency(taxTotal, currency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-semibold text-slate-900 pt-1 border-t border-slate-200">
                      <span>Total</span>
                      <span>{formatCurrency(total, currency)}</span>
                    </div>
                  </div>
                )}

                {/* Price visibility toggles */}
                {!isReadOnly && (
                  <div className="flex items-center gap-4 pt-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 select-none">
                      <input
                        type="checkbox"
                        checked={hideLinePrices}
                        onChange={(e) => { setHideLinePrices(e.target.checked); setIsDirty(true); }}
                        className="rounded border-slate-300 text-orange-600"
                      />
                      Hide line prices
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-600 select-none">
                      <input
                        type="checkbox"
                        checked={hideTotals}
                        onChange={(e) => { setHideTotals(e.target.checked); setIsDirty(true); }}
                        className="rounded border-slate-300 text-orange-600"
                      />
                      Hide totals
                    </label>
                  </div>
                )}

                {/* AI import buttons */}
                {!isReadOnly && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowAiUpload(true)}
                      title="Upload image to auto-fill invoice lines"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35] hover:bg-orange-50/40 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Upload Image
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAiText(true)}
                      title="Paste text to auto-fill invoice lines"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border border-slate-300 text-slate-600 hover:border-[#FF6B35] hover:text-[#FF6B35] hover:bg-orange-50/40 transition-all"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Text Prompt
                    </button>
                  </div>
                )}

                {/* Add line button */}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setShowAddLine(true)}
                    data-copilot="invoice-add-line"
                    className="flex items-center justify-center gap-2 w-full rounded-xl border border-dashed border-slate-200 bg-white px-6 py-4 text-sm font-medium text-slate-500 hover:border-[#FF6B35] hover:text-[#FF6B35] transition-all"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                    Add Line Item
                  </button>
                )}
              </div>
            )}

            {/* ── Details tab ── */}
            {activeTab === 'details' && (
              <div className="p-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Invoice Dates</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Invoice Date</label>
                      <input
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => { setInvoiceDate(e.target.value); markDirty(); }}
                        disabled={isReadOnly}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Due Date <span className="text-slate-400 font-normal">(opt)</span></label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => { setDueDate(e.target.value); markDirty(); }}
                        disabled={isReadOnly}
                        className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Notes & Terms</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                      <textarea
                        value={notes}
                        onChange={(e) => { setNotes(e.target.value); markDirty(); }}
                        disabled={isReadOnly}
                        rows={3}
                        placeholder="Any additional notes for the customer…"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-slate-50"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Terms</label>
                      <textarea
                        value={terms}
                        onChange={(e) => { setTerms(e.target.value); markDirty(); }}
                        disabled={isReadOnly}
                        rows={3}
                        placeholder="Payment terms, e.g. Payment due within 14 days…"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-slate-50"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Business Details</p>
                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => setShowHeaderModal(true)}
                        data-copilot="invoice-edit-header"
                        className="text-xs text-orange-600 hover:underline"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-1.5 text-sm">
                    <p className="font-medium text-slate-900">{companyName || <span className="text-slate-400 italic">Business name not set</span>}</p>
                    {companyAddress && <p className="text-slate-600 text-xs whitespace-pre-line">{companyAddress}</p>}
                    {companyEmail && <p className="text-slate-500 text-xs">{companyEmail}</p>}
                    {companyPhone && <p className="text-slate-500 text-xs">{companyPhone}</p>}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">References</p>
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Invoice Number</span>
                      <span className="font-mono font-medium text-slate-900">{initial.invoice_number}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Payment Reference</span>
                      <span className="font-mono font-medium text-slate-900">{initial.payment_reference}</span>
                    </div>
                    {initial.source_type !== 'blank' && (
                      <div className="flex justify-between">
                        <span className="text-slate-500">Source</span>
                        <span className="text-slate-700 capitalize">{initial.source_type}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Payment Details - editable per-invoice */}
                <div data-copilot="invoice-payment-details">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment Details</p>
                    {payDirty && !isReadOnly && (
                      <button
                        type="button"
                        onClick={handleSavePaymentDetails}
                        disabled={paymentSaving}
                        className="text-xs text-orange-600 font-semibold hover:underline disabled:opacity-50"
                      >
                        {paymentSaving ? 'Saving…' : 'Save'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Account Name</label>
                        <input type="text" value={payAccountName} onChange={(e) => { setPayAccountName(e.target.value); setPayDirty(true); }} disabled={isReadOnly}
                          placeholder="e.g. Smith Roofing Ltd"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:outline-none disabled:bg-slate-50" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Bank Name</label>
                        <input type="text" value={payBankName} onChange={(e) => { setPayBankName(e.target.value); setPayDirty(true); }} disabled={isReadOnly}
                          placeholder="e.g. Barclays"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:outline-none disabled:bg-slate-50" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Account Number</label>
                        <input type="text" value={payAccountNumber} onChange={(e) => { setPayAccountNumber(e.target.value); setPayDirty(true); }} disabled={isReadOnly}
                          placeholder="12345678"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono focus:border-orange-500 focus:outline-none disabled:bg-slate-50" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Sort Code</label>
                        <input type="text" value={paySortCode} onChange={(e) => { setPaySortCode(e.target.value); setPayDirty(true); }} disabled={isReadOnly}
                          placeholder="00-00-00"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono focus:border-orange-500 focus:outline-none disabled:bg-slate-50" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Payment Link <span className="text-slate-400 font-normal">(opt)</span></label>
                      <input type="url" value={payPaymentLink} onChange={(e) => { setPayPaymentLink(e.target.value); setPayDirty(true); }} disabled={isReadOnly}
                        placeholder="https://pay.stripe.com/…"
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:outline-none disabled:bg-slate-50" />
                    </div>
                    {!payAccountName && !payBankName && !payAccountNumber && (
                      <p className="text-xs text-slate-400">
                        Set default payment details in{' '}
                        <a href={`/${workspaceSlug}/account?tab=company`} className="text-orange-600 hover:underline">Account → Company</a>
                        {' '}and they’ll auto-fill here.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Activity tab ── */}
            {activeTab === 'activity' && (
              <div className="p-4">
                {activity.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">No activity yet.</p>
                ) : (
                  <div className="space-y-3">
                    {activity.map((ev) => (
                      <div key={ev.id} className="flex items-start gap-3">
                        <div className="mt-1 h-2 w-2 rounded-full bg-orange-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-slate-900 capitalize">{ev.event_type.replace(/_/g, ' ')}</p>
                          <p className="text-xs text-slate-400">{new Date(ev.created_at).toLocaleString('en-GB')}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Collapsed tab ── */}
        {panelCollapsed && (
          <ExpandTab collapsed={panelCollapsed} onToggle={() => setPanelCollapsed(false)} />
        )}

        {/* ── Right panel: preview ── */}
        <div className="w-full md:flex-1 md:overflow-y-auto bg-slate-50 rounded-2xl p-4" data-copilot="invoice-preview">
          <div data-pdf-content>
          <InvoicePreview
            invoice={initial}
            lines={lines}
            currency={currency}
            hideLinePrices={hideLinePrices}
            hideTotals={hideTotals}
            companyName={companyName}
            companyAddress={companyAddress}
            companyEmail={companyEmail}
            companyPhone={companyPhone}
            companyLogoUrl={companyLogoUrl}
            footerText={footerText}
            notes={notes}
            terms={terms}
            invoiceDate={invoiceDate}
            dueDate={dueDate}
            subtotal={subtotal}
            taxTotal={taxTotal}
            total={total}
            paymentDetails={{
              accountName: payAccountName,
              bankName: payBankName,
              accountNumber: payAccountNumber,
              sortCode: paySortCode,
              paymentLink: payPaymentLink,
            }}
          />
          </div>
        </div>
      </div>

      {/* Modals */}
      {showAddLine && (
        <AddInvoiceLineModal
          currency={currency}
          catalogs={catalogs}
          collections={collections}
          componentLibrary={componentLibrary}
          onAdd={addLines}
          onClose={() => setShowAddLine(false)}
        />
      )}

      {showHeaderModal && (
        <InvoiceHeaderModal
          companyName={companyName}
          companyAddress={companyAddress}
          companyEmail={companyEmail}
          companyPhone={companyPhone}
          companyLogoUrl={companyLogoUrl}
          footerText={footerText}
          onSave={(vals) => {
            setCompanyName(vals.companyName);
            setCompanyAddress(vals.companyAddress);
            setCompanyEmail(vals.companyEmail);
            setCompanyPhone(vals.companyPhone);
            setCompanyLogoUrl(vals.companyLogoUrl);
            setFooterText(vals.footerText);
            markDirty();
            setShowHeaderModal(false);
          }}
          onClose={() => setShowHeaderModal(false)}
        />
      )}

      <ConfirmModal
        open={showCancelModal}
        title="Cancel this invoice?"
        description="The invoice will be marked as cancelled. The customer link will stop working. This cannot be undone."
        confirmLabel="Cancel Invoice"
        cancelLabel="Keep Invoice"
        destructive
        pending={cancelPending}
        pendingLabel="Cancelling…"
        onCancel={() => setShowCancelModal(false)}
        onConfirm={doCancel}
      />

      <ConfirmModal
        open={showConfirmPaymentModal}
        title="Confirm payment received?"
        description="This will mark the invoice as Paid and close it out. Only do this once payment has cleared."
        confirmLabel="Confirm Payment"
        cancelLabel="Not yet"
        destructive={false}
        pending={confirmPaymentPending}
        pendingLabel="Saving…"
        onCancel={() => setShowConfirmPaymentModal(false)}
        onConfirm={doConfirmPayment}
      />

      {/* AI import modals */}
      {showAiUpload && (
        <AiUploadModal
          documentType="invoice"
          onParsed={handleAiParsed}
          onClose={() => setShowAiUpload(false)}
        />
      )}
      {showAiText && (
        <AiTextPromptModal
          documentType="invoice"
          onParsed={handleAiParsed}
          onClose={() => setShowAiText(false)}
        />
      )}
    </div>
  );
}
