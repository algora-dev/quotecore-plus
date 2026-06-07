'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CollapsiblePanel, CollapseButton, ExpandTab } from '@/app/components/editor/CollapsiblePanel';
import { saveInvoiceLines, saveInvoiceMeta, cancelInvoice, confirmPaymentReceived } from '../actions';
import { InvoicePreview } from './InvoicePreview';
import { AddInvoiceLineModal } from './AddInvoiceLineModal';
import { InvoiceHeaderModal } from './InvoiceHeaderModal';
import { formatCurrency } from '@/app/lib/currency/currencies';

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
  is_visible: boolean;
}

interface Props {
  invoice: InvoiceRow;
  savedLines: InvoiceLineRow[];
  workspaceSlug: string;
  defaultLogoUrl: string | null;
  currency: string;
  companyTaxes: { id: string; name: string; rate_percent: number }[];
  catalogs: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  componentLibrary: { id: string; name: string; collection_id: string | null }[];
  activity: { id: string; event_type: string; metadata: Record<string, unknown> | null; created_at: string }[];
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
}: Props) {
  const router = useRouter();

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

  // ── UI state ──
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showAddLine, setShowAddLine] = useState(false);
  const [showHeaderModal, setShowHeaderModal] = useState(false);
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'lines' | 'details' | 'activity'>('lines');

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

  // ── Totals ──
  const visibleLines = lines.filter((l) => l.is_visible && l.show_price);
  const subtotal = visibleLines.reduce((s, l) => s + l.line_total, 0);
  // Tax: flat rate approach (will extend to per-line taxes in a later phase)
  const taxTotal = 0; // Phase 2: add tax rows
  const total = subtotal + taxTotal;

  // ── Save ──
  async function handleSave() {
    setSaving(true);
    try {
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
      });
      setIsDirty(false);
      setLastSaved(new Date());
      router.refresh();
    } catch (e) {
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  async function handleConfirmPayment() {
    if (!confirm('Confirm that payment has been received for this invoice?')) return;
    await confirmPaymentReceived(initial.id);
    router.refresh();
  }

  async function handleCancel() {
    if (!confirm('Cancel this invoice? It will be marked as cancelled and cannot be sent further.')) return;
    await cancelInvoice(initial.id);
    router.push(`/${workspaceSlug}/invoices`);
  }

  // ── Auto-save after 2s of inactivity ──
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isDirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      handleSave();
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [isDirty, lines, notes, terms, invoiceDate, dueDate, companyName, companyAddress, companyEmail, companyPhone, companyLogoUrl, footerText]);

  const publicUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/invoice/${initial.public_token}`
    : `/invoice/${initial.public_token}`;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href={`/${workspaceSlug}/invoices`}
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

        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Save indicator */}
          {isDirty && (
            <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>
          )}
          {!isDirty && lastSaved && (
            <span className="text-xs text-slate-400">Saved</span>
          )}

          {/* Public link */}
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs text-slate-600 border border-slate-200 rounded-full px-3 py-1.5 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" /><path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" /></svg>
            Customer View
          </a>

          {/* Payment Reported action */}
          {initial.status === 'payment_reported' && (
            <button
              type="button"
              onClick={handleConfirmPayment}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-all"
            >
              Confirm Payment
            </button>
          )}

          {/* Cancel */}
          {!['cancelled', 'paid'].includes(initial.status) && (
            <button
              type="button"
              onClick={handleCancel}
              className="hidden sm:inline-flex items-center gap-1.5 text-xs text-red-600 border border-red-200 rounded-full px-3 py-1.5 hover:bg-red-50 transition-all"
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
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          )}
        </div>
      </div>

      {/* Editor body */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* ── Left panel ── */}
        {!panelCollapsed && (
          <div className="w-full md:w-[480px] md:min-w-[400px] flex-shrink-0 border-r border-slate-200 bg-white flex flex-col overflow-y-auto">
            {/* Panel tabs */}
            <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
              {(['lines', 'details', 'activity'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
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
                  <div className="space-y-2">
                    {lines.map((line, idx) => (
                      <div
                        key={line.localId}
                        className={`rounded-xl border ${line.is_visible ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 opacity-60'} p-3`}
                      >
                        {editingLineId === line.localId ? (
                          /* Inline edit mode */
                          <div className="space-y-2">
                            <input
                              type="text"
                              value={line.title}
                              onChange={(e) => updateLine(line.localId, { title: e.target.value })}
                              placeholder="Line title"
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                            />
                            <textarea
                              value={line.description ?? ''}
                              onChange={(e) => updateLine(line.localId, { description: e.target.value || null })}
                              placeholder="Description (optional)"
                              rows={2}
                              className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
                            />
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="block text-xs text-slate-500 mb-0.5">Qty</label>
                                <input
                                  type="number"
                                  value={line.quantity}
                                  min={0}
                                  step={0.01}
                                  onChange={(e) => updateLine(line.localId, { quantity: parseFloat(e.target.value) || 0 })}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-0.5">Unit</label>
                                <input
                                  type="text"
                                  value={line.unit}
                                  onChange={(e) => updateLine(line.localId, { unit: e.target.value })}
                                  placeholder="item"
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-slate-500 mb-0.5">Unit Price</label>
                                <input
                                  type="number"
                                  value={line.unit_price}
                                  min={0}
                                  step={0.01}
                                  onChange={(e) => updateLine(line.localId, { unit_price: parseFloat(e.target.value) || 0 })}
                                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-between">
                              <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={line.show_price}
                                  onChange={(e) => updateLine(line.localId, { show_price: e.target.checked })}
                                  className="rounded"
                                />
                                Show price
                              </label>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-slate-700">
                                  Line total: {formatCurrency(line.line_total, currency)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setEditingLineId(null)}
                                  className="text-xs text-orange-600 font-medium hover:underline"
                                >
                                  Done
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* Display mode */
                          <div className="flex items-start gap-2">
                            <div className="flex flex-col gap-1 mr-1">
                              <button
                                type="button"
                                onClick={() => moveLine(line.localId, 'up')}
                                disabled={idx === 0 || isReadOnly}
                                className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" /></svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => moveLine(line.localId, 'down')}
                                disabled={idx === lines.length - 1 || isReadOnly}
                                className="p-0.5 text-slate-300 hover:text-slate-600 disabled:opacity-30"
                              >
                                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                              </button>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-900 truncate">{line.title || 'Untitled'}</p>
                              {line.description && <p className="text-xs text-slate-500 truncate">{line.description}</p>}
                              <p className="text-xs text-slate-400 mt-0.5">
                                {line.quantity} {line.unit} × {formatCurrency(line.unit_price, currency)}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {line.show_price && (
                                <p className="text-sm font-semibold text-slate-900">{formatCurrency(line.line_total, currency)}</p>
                              )}
                              {!line.show_price && (
                                <p className="text-xs text-slate-400 italic">hidden</p>
                              )}
                            </div>
                            {!isReadOnly && (
                              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                <button
                                  type="button"
                                  onClick={() => setEditingLineId(line.localId)}
                                  className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => removeLine(line.localId)}
                                  className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                                >
                                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                                </button>
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

                {/* Add line button */}
                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => setShowAddLine(true)}
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
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
          <InvoicePreview
            invoice={initial}
            lines={lines}
            currency={currency}
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
          />
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
    </div>
  );
}
