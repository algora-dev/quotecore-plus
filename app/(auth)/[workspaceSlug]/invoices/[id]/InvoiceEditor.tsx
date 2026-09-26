'use client';
import { useState, useRef, useCallback, useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { QcStudioToolbar, QcStudioInspectorHeading, QcStudioSection, QcStudioOverview, type QcStudioOption } from '@/app/components/ui/v2/QcDocumentStudio';
import { QcButton } from '@/app/components/ui/v2/QcButton';
import { QcDocumentWorkspace, QcDocumentHeader, QcDocumentSaveState, QcDocumentBody, QcDocumentPanel, QcDocumentPanelHeader, QcDocumentSection, QcDocumentPreview, QcDocumentDialogScope } from '@/app/components/ui/v2/QcDocumentWorkspace';

import { saveInvoiceLines, saveInvoiceMeta, saveInvoicePaymentDetails, cancelInvoice, confirmPaymentReceived, markInvoiceSentByLink, resetInvoice } from '../actions';
import { ResetButton } from '@/app/components/ResetButton';
import { InvoicePreview } from './InvoicePreview';
import { SendDocumentButton } from '@/app/components/send/SendDocumentButton';
import type { EmailTemplate } from '@/app/components/send/types';
import type { InvoiceTemplate } from '../template-actions';
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
  invoiceTemplates?: InvoiceTemplate[];
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
  invoiceTemplates = [],
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

  // AGENT-TODO P5-PAY-01 (Gavin): payment details are saved separately.
  // Do not imply that the invoice autosave/save/send persists these fields.
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
  const [studioSection, setStudioSection] = useState('document');
  const [studioPreview, setStudioPreview] = useState(false);
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

  /** Apply a saved invoice template: business details, logo, footer,
   *  notes/terms and payment details (payment saves via its own button). */
  function applyInvoiceTemplate(templateId: string) {
    const template = invoiceTemplates.find(t => t.id === templateId);
    if (!template) return;
    setCompanyName(template.company_name || '');
    setCompanyAddress(template.company_address || '');
    setCompanyEmail(template.company_email || '');
    setCompanyPhone(template.company_phone || '');
    setCompanyLogoUrl(template.company_logo_url || defaultLogoUrl || '');
    setFooterText(template.footer_text || '');
    setNotes(template.default_notes || '');
    setTerms(template.default_terms || '');
    setPayAccountName(template.payment_account_name || '');
    setPayBankName(template.payment_bank_name || '');
    setPayAccountNumber(template.payment_account_number || '');
    setPaySortCode(template.payment_sort_code || '');
    setPayPaymentLink(template.payment_link || '');
    markDirty();
    setPayDirty(true);
  }

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
  // AGENT-TODO P5-TAX-01: no new invoice tax calculation/editor in this UX pass.
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

  // Presentation selection only. Invoice edits still use the original update/save owners.
  const studioOptions: QcStudioOption[] = [
    { id: 'dates', label: 'Dates & references', description: 'Issue date, due date and invoice reference' },
    { id: 'header', label: 'Business details', description: 'Business name, contact details and logo' },
    { id: 'appearance', label: 'Price display', description: 'Show or hide line prices and totals' },
    { id: 'payment', label: 'Payment details', description: 'Bank information and payment link' },
    { id: 'notes', label: 'Notes', description: 'A message for your customer' },
    { id: 'terms', label: 'Terms', description: 'Payment terms for this invoice' },
    { id: 'footer', label: 'Footer', description: 'Closing text on the document' },
    { id: 'import', label: 'Import items', description: 'Use an image or text with AI' },
    { id: 'activity', label: 'Activity', description: 'Invoice events and communication' },
  ];
  function selectStudioSection(target: string) {
    setStudioSection(target);
    setStudioPreview(false);
    setPanelCollapsed(false);
    setEditingLineId(target.startsWith('line:') ? target.slice(5) : null);
    setActiveTab(target === 'activity' ? 'activity' : target === 'items' || target.startsWith('line:') ? 'lines' : 'details');
  }

  return (
    <QcDocumentWorkspace className="qc-document-studio">
      <QcDocumentHeader title={`Invoice ${initial.invoice_number}`} subtitle={initial.customer_name}
        back={<Link
            href={backHref}
            title={backHref.endsWith('/inbox') ? 'Back to Message Center' : 'Back to Invoices'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors flex-shrink-0"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          <span>Back</span></Link>}
        status={<><span className={`text-xs px-2 py-1 rounded-full font-medium ${status.cls}`}>{status.label}</span>
          <QcDocumentSaveState saving={saving || paymentSaving} dirty={isDirty || payDirty} lastSaved={lastSaved}
            idle={isReadOnly ? 'Read only' : 'Auto-save enabled'} /></>}
        actions={<>          {/* Public link - sharing it flips a draft to Sent (no email). */}
          <QcButton variant="ghost" size="sm"
            type="button"
            onClick={openCustomerView}
            title="Opening the customer link also marks a draft invoice as sent"
            
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
            Customer link
          </QcButton>

          {/* Payment Reported action */}
          {initial.status === 'payment_reported' && (
            <QcButton variant="secondary" size="sm"
              type="button"
              onClick={() => setShowConfirmPaymentModal(true)}
              
            >
              Confirm Payment
            </QcButton>
          )}

          {/* Download PDF (owner) - same on-screen InvoicePreview, captured to
              a PDF that matches the bulk ZIP output exactly. */}
          <QcButton variant="ghost" size="sm"
            type="button"
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            
          >
            {downloadingPdf ? 'Generating PDF...' : 'Download PDF'}
          </QcButton>

          {/* Reset: void the public link + roll back to draft so the user can
              re-send a fresh invoice with a new URL. Only meaningful once the
              invoice has actually been sent (past 'draft'). */}
          {initial.status !== 'draft' && (
            <QcDocumentDialogScope><ResetButton
              action={resetInvoice}
              id={initial.id}
              entityLabel="Invoice"
              className="inline-flex items-center gap-1.5 text-xs text-amber-700 border border-amber-300 rounded-full px-3 py-1.5 hover:bg-amber-50 transition-all"
            /></QcDocumentDialogScope>
          )}

          {/* Cancel */}
          {!['cancelled', 'paid'].includes(initial.status) && (
            <QcButton variant="ghost" size="sm"
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="qc-document-danger-control"
            >
              Cancel Invoice
            </QcButton>
          )}

          {/* Save */}
          {!isReadOnly && (
            <QcButton variant="secondary" size="sm"
              type="button"
              onClick={handleSave}
              disabled={saving}
              data-copilot="invoice-save"
              
            >
              {saving ? 'Saving…' : 'Save & return'}
            </QcButton>
          )}

          {/* Send Invoice - pinned far right (primary action), matching the
              Quotes/Orders editors where Send is the right-most action. */}
          <QcDocumentDialogScope><SendDocumentButton
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
          /></QcDocumentDialogScope>
</>} />
      <QcStudioToolbar section={studioSection} onSelect={selectStudioSection} options={studioOptions}
        preview={studioPreview} onPreview={() => setStudioPreview(!studioPreview)}
        primary={!isReadOnly ? <QcButton variant="secondary" size="sm" type="button" onClick={() => setShowAddLine(true)} data-copilot="invoice-add-line">+ Add item</QcButton> : undefined} />
      <div className="qc-document-note">
        {isReadOnly ? 'This invoice is read only.' : 'Invoice edits save automatically. Payment details use their own Save button in Payment details.'}
        {initial.status === 'draft' && ' Opening the customer link also marks this draft as sent.'}
        {payDirty && <strong> Payment details have unsaved changes.</strong>}
      </div>
      <QcDocumentBody collapsed={panelCollapsed || studioPreview}>
        <QcDocumentPanel collapsed={panelCollapsed || studioPreview}>
          <QcStudioInspectorHeading section={studioSection}
            title={studioSection.startsWith('line:') ? 'Invoice item' : studioSection === 'items' ? 'All items' : studioOptions.find(option => option.id === studioSection)?.label ?? 'Your invoice'}
            subtitle={isReadOnly ? 'This invoice is read only.' : studioSection.startsWith('line:') ? 'Changes update the invoice immediately.' : undefined}
            onBack={() => selectStudioSection('document')} onCollapse={() => setPanelCollapsed(true)} />
          <QcStudioSection active={studioSection === 'document'}>
            <QcStudioOverview readOnly={isReadOnly} options={studioOptions.filter(option => ['dates', 'header', 'appearance', 'payment', 'notes'].includes(option.id))} onSelect={selectStudioSection} />
            <div className="qc-document-note"><strong>{initial.customer_name}</strong><p>Customer details come from this invoice’s saved customer record.</p></div>
          </QcStudioSection>
          <QcStudioSection active={studioSection === 'items' || studioSection.startsWith('line:')}>
            <div className="qc-document-panel-content space-y-4" data-copilot="invoice-lines-list">
              <p className="qc-document-help">Show controls visibility. In total controls the amount, even when an item is hidden.</p>
              {lines.length === 0 && <p className="qc-document-empty">No items yet. Choose Add item to start your invoice.</p>}
              {lines.map((line, idx) => (
                <div key={line.localId} className="qc-document-line" data-studio-detail={studioSection.startsWith('line:')} data-visible={line.is_visible}
                  hidden={studioSection.startsWith('line:') && editingLineId !== line.localId}>
                  {!isReadOnly && <>
                    <div className="qc-document-line-toggles">
                      <label><input type="checkbox" checked={line.is_visible} onChange={() => updateLine(line.localId, { is_visible: !line.is_visible })} /> Show item</label>
                      <label><input type="checkbox" checked={line.show_price} disabled={!line.is_visible} onChange={() => updateLine(line.localId, { show_price: !line.show_price })} /> Price</label>
                      <label><input type="checkbox" checked={line.show_quantity} disabled={!line.is_visible} onChange={() => updateLine(line.localId, { show_quantity: !line.show_quantity })} /> Quantity</label>
                      <label><input type="checkbox" checked={line.include_in_total} onChange={() => updateLine(line.localId, { include_in_total: !line.include_in_total })} /> In total</label>
                      {studioSection.startsWith('line:') && <label><input type="checkbox" checked={line.show_description} disabled={!line.is_visible}
                        onChange={() => updateLine(line.localId, { show_description: !line.show_description })} /> Description</label>}
                    </div>
                    <div className="qc-document-row-actions">
                      <QcButton variant="ghost" size="sm" aria-label="Move line up" onClick={() => moveLine(line.localId, 'up')} disabled={idx === 0 || isReadOnly}>↑ Move up</QcButton>
                      <QcButton variant="ghost" size="sm" aria-label="Move line down" onClick={() => moveLine(line.localId, 'down')} disabled={idx === lines.length - 1 || isReadOnly}>↓ Move down</QcButton>
                      <QcButton variant="ghost" size="sm" className="qc-document-danger-control" aria-label="Remove line" onClick={() => removeLine(line.localId)}>Remove</QcButton>
                    </div>
                  </>}
                  {studioSection.startsWith('line:') && editingLineId === line.localId ? (
                    <div className="qc-studio-fields">
                      <label>Item name<input aria-label="Item name" value={line.title} disabled={isReadOnly}
                        onChange={(e) => updateLine(line.localId, { title: e.target.value })} placeholder="Line title" /></label>
                      <label>Description<textarea aria-label="Description" value={line.description ?? ''} disabled={isReadOnly}
                        onChange={(e) => updateLine(line.localId, { description: e.target.value || null })} rows={4} placeholder="Description (optional)" /></label>
                      <div className="qc-studio-field-row"><label>Quantity<input aria-label="Quantity" type="number" value={line.quantity} min={0} step={0.01} disabled={isReadOnly}
                        onChange={(e) => updateLine(line.localId, { quantity: parseFloat(e.target.value) || 0 })} /></label>
                      <label>Unit<input aria-label="Unit" value={line.unit} placeholder="item" disabled={isReadOnly}
                        onChange={(e) => updateLine(line.localId, { unit: e.target.value })} /></label></div>
                      <label>Unit price ({currency})<input aria-label="Unit price" type="number" value={line.unit_price} min={0} step={0.01} disabled={isReadOnly}
                        onChange={(e) => updateLine(line.localId, { unit_price: parseFloat(e.target.value) || 0 })} /></label>
                      <p className="qc-document-note">Item total: <strong>{formatCurrency(line.line_total, currency)}</strong></p>
                    </div>
                  ) : (
                    <div className="qc-studio-item-summary">
                      <button type="button" className="qc-studio-item-link" onClick={() => selectStudioSection(`line:${line.localId}`)}>{line.title || 'Untitled item'}</button>
                      {!line.is_visible && <span className="qc-studio-hidden-badge">Hidden</span>}
                      <p className="qc-document-help">{line.quantity} {line.unit} × {formatCurrency(line.unit_price, currency)}</p>
                      <strong>{line.show_price ? formatCurrency(line.line_total, currency) : 'Price hidden'}</strong>
                    </div>
                  )}

                </div>
              ))}
              {studioSection.startsWith('line:') && !lines.some(line => line.localId === editingLineId) && <QcButton onClick={() => selectStudioSection('items')}>Back to all items</QcButton>}
              {studioSection === 'items' && lines.length > 0 && <p className="qc-document-note">Invoice total: <strong>{formatCurrency(total, currency)}</strong></p>}
            </div>
          </QcStudioSection>
          <QcStudioSection active={studioSection === 'appearance'}>
            <div className="qc-studio-fields">
              <label className="qc-studio-toggle"><input type="checkbox" checked={hideLinePrices} disabled={isReadOnly}
                onChange={(e) => { setHideLinePrices(e.target.checked); setIsDirty(true); }} /> Hide line prices</label>
              <label className="qc-studio-toggle"><input type="checkbox" checked={hideTotals} disabled={isReadOnly}
                onChange={(e) => { setHideTotals(e.target.checked); setIsDirty(true); }} /> Hide totals</label>
              <p className="qc-document-help">These controls change what is shown, not the underlying invoice amount.</p>
            </div>
          </QcStudioSection>
          <QcStudioSection active={studioSection === 'dates'}>
            <div className="qc-studio-fields" data-copilot="invoice-details-tab">
              <label>Invoice date<input aria-label="Invoice date" type="date" value={invoiceDate} disabled={isReadOnly} onChange={(e) => { setInvoiceDate(e.target.value); markDirty(); }} /></label>
              <label>Due date (optional)<input aria-label="Due date" type="date" value={dueDate} disabled={isReadOnly} onChange={(e) => { setDueDate(e.target.value); markDirty(); }} /></label>
              <p className="qc-document-note">Invoice: <strong>{initial.invoice_number}</strong><br />Payment reference: <strong>{initial.payment_reference}</strong>
                {initial.source_type !== 'blank' && <><br />Source: {initial.source_type}</>}</p>
            </div>
          </QcStudioSection>
          <QcStudioSection active={studioSection === 'header'}>
            <div className="qc-studio-fields">
              <label>Load from saved template
                <select aria-label="Invoice template" value="" disabled={isReadOnly || invoiceTemplates.length === 0}
                  onChange={(e) => {
                    if (e.target.value) {
                      applyInvoiceTemplate(e.target.value);
                      e.target.value = '';
                    }
                  }}
                >
                  <option value="">{invoiceTemplates.length > 0 ? 'Choose a template...' : 'No templates saved yet'}</option>
                  {invoiceTemplates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <p className="qc-document-help">Applies business details, logo, footer, notes, terms and payment details. Payment details save with their own button afterwards.</p>
              <label>Business name<input aria-label="Business name" value={companyName} disabled={isReadOnly} onChange={e => { setCompanyName(e.target.value); markDirty(); }} /></label>
              <label>Address<textarea aria-label="Business address" value={companyAddress} rows={3} disabled={isReadOnly} onChange={e => { setCompanyAddress(e.target.value); markDirty(); }} /></label>
              <label>Email<input aria-label="Business email" type="email" value={companyEmail} disabled={isReadOnly} onChange={e => { setCompanyEmail(e.target.value); markDirty(); }} /></label>
              <label>Phone<input aria-label="Business phone" value={companyPhone} disabled={isReadOnly} onChange={e => { setCompanyPhone(e.target.value); markDirty(); }} /></label>
              <label>Logo URL<input aria-label="Logo URL" type="url" value={companyLogoUrl} disabled={isReadOnly} onChange={e => { setCompanyLogoUrl(e.target.value); markDirty(); }} /></label>
              {!isReadOnly && <QcButton size="sm" variant="ghost" onClick={() => setShowHeaderModal(true)}>Open full header editor</QcButton>}
            </div>
          </QcStudioSection>
          <QcStudioSection active={studioSection === 'notes'}><div className="qc-studio-fields"><label>Notes<textarea aria-label="Invoice notes" value={notes} rows={6} disabled={isReadOnly} onChange={(e) => { setNotes(e.target.value); markDirty(); }} placeholder="A message for your customer…" /></label></div></QcStudioSection>
          <QcStudioSection active={studioSection === 'terms'}><div className="qc-studio-fields"><label>Terms<textarea aria-label="Terms" value={terms} rows={6} disabled={isReadOnly} onChange={(e) => { setTerms(e.target.value); markDirty(); }} placeholder="Payment terms for this invoice…" /></label></div></QcStudioSection>
          <QcStudioSection active={studioSection === 'footer'}><div className="qc-studio-fields"><label>Footer<textarea aria-label="Footer" value={footerText} rows={6} disabled={isReadOnly} onChange={(e) => { setFooterText(e.target.value); markDirty(); }} /></label></div></QcStudioSection>
          <QcStudioSection active={studioSection === 'payment'}>
            <p className="qc-document-note">Payment details save separately. Use Save payment details below before sending or leaving.</p>
            <div className="qc-document-panel-content">                <div data-copilot="invoice-payment-details">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Payment Details</p>
                    {payDirty && !isReadOnly && (
                      <QcButton variant="ghost" size="sm"
                        type="button"
                        onClick={handleSavePaymentDetails}
                        disabled={paymentSaving}
                        
                      >
                        {paymentSaving ? 'Saving…' : 'Save payment details'}
                      </QcButton>
                    )}
                  </div>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Account Name</label>
                        <input type="text" aria-label="Account name" value={payAccountName} onChange={(e) => { setPayAccountName(e.target.value); setPayDirty(true); }} disabled={isReadOnly}
                          placeholder="e.g. Smith Roofing Ltd"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:outline-none disabled:bg-slate-50" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Bank Name</label>
                        <input type="text" aria-label="Bank name" value={payBankName} onChange={(e) => { setPayBankName(e.target.value); setPayDirty(true); }} disabled={isReadOnly}
                          placeholder="e.g. Barclays"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:border-orange-500 focus:outline-none disabled:bg-slate-50" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Account Number</label>
                        <input type="text" aria-label="Account number" value={payAccountNumber} onChange={(e) => { setPayAccountNumber(e.target.value); setPayDirty(true); }} disabled={isReadOnly}
                          placeholder="12345678"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono focus:border-orange-500 focus:outline-none disabled:bg-slate-50" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Sort Code</label>
                        <input type="text" aria-label="Sort code" value={paySortCode} onChange={(e) => { setPaySortCode(e.target.value); setPayDirty(true); }} disabled={isReadOnly}
                          placeholder="00-00-00"
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono focus:border-orange-500 focus:outline-none disabled:bg-slate-50" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-700 mb-1">Payment Link <span className="text-slate-400 font-normal">(opt)</span></label>
                      <input type="url" aria-label="Payment link" value={payPaymentLink} onChange={(e) => { setPayPaymentLink(e.target.value); setPayDirty(true); }} disabled={isReadOnly}
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
                </div></div>
          </QcStudioSection>
          <QcStudioSection active={studioSection === 'import'}><div className="qc-studio-fields">
            <p className="qc-document-help">Add invoice items from an image or text. Review imported descriptions and amounts before sending.</p>
            <QcButton disabled={isReadOnly} onClick={() => setShowAiUpload(true)}>Import from image</QcButton>
            <QcButton disabled={isReadOnly} onClick={() => setShowAiText(true)}>Import from text</QcButton>
          </div></QcStudioSection>
          <QcStudioSection active={studioSection === 'activity'}>
            {activitySlot ? <div className="qc-document-activity" data-exclude-pdf>{activitySlot}</div> : null}
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
          </QcStudioSection>
        </QcDocumentPanel>
        <QcDocumentPreview title={studioPreview ? 'Recipient preview' : 'Your invoice'} description={isReadOnly || studioPreview ? 'Clean output without editing controls.' : 'Click an item or section to edit it. Changes appear here.'}
          collapsed={panelCollapsed || studioPreview} onExpand={() => { setPanelCollapsed(false); setStudioPreview(false); }} data-copilot="invoice-preview">
          <div className="qc-document-paper qc-document-paper--invoice"><div data-pdf-content>
          <InvoicePreview
            selection={isReadOnly || studioPreview ? undefined : { active: studioSection, onSelect: selectStudioSection }}
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
          </div></div>
        </QcDocumentPreview>
      </QcDocumentBody>
      <QcDocumentDialogScope>      {/* Modals */}
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

      <ConfirmModal appearance="v2"
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

      <ConfirmModal appearance="v2"
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
</QcDocumentDialogScope>
    </QcDocumentWorkspace>
  );
}
