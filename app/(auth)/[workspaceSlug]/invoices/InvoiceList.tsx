'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteInvoice, cancelInvoice, updateInvoiceStatus } from './actions';
import { loadInvoiceBundleData, bulkDeleteInvoices } from './actions-bulk';
import { addInvoiceToZip, downloadBlob, sanitizeFilename } from './lib/invoice-bundle';
import JSZip from 'jszip';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { ConfirmModal } from '@/app/components/ConfirmModal';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { RecipientStatusBadge, type RecipientStatus } from '@/app/components/RecipientStatusBadge';

/**
 * Client-side cap on the multi-select. Must match `MAX_BULK_BATCH` in
 * actions-bulk.ts. The server enforces the same cap authoritatively; this is
 * for UX so the user can't even build a selection larger than we'll process.
 */
const MAX_BULK_SELECTION = 25;

type InvoiceRow = {
  id: string;
  invoice_number: string;
  payment_reference: string;
  status: string;
  customer_name: string;
  customer_email: string | null;
  currency: string;
  total: number;
  invoice_date: string;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  viewed_at: string | null;
  disputed_at: string | null;
  created_at: string;
  updated_at: string;
  public_token: string;
};

/**
 * Recipient-driven status for an invoice's Status column.
 * Action Required: invoice disputed by the recipient.
 * Read: recipient opened the public invoice link.
 */
// "Read" is TRANSIENT: only shown while the invoice is still in its as-sent
// baseline ('sent' / 'viewed'). Once it moves to paid / cancelled / draft (or
// any other status change, manual or auto) "Read" disappears (2026-06-10).
const INVOICE_SENT_BASELINE = new Set(['sent', 'viewed']);
function invoiceRecipientStatus(inv: InvoiceRow): RecipientStatus {
  if (inv.status === 'disputed' || inv.disputed_at) return 'action_required';
  if ((inv.viewed_at || inv.status === 'viewed') && INVOICE_SENT_BASELINE.has(inv.status)) return 'read';
  return null;
}

interface Props {
  invoices: InvoiceRow[];
  workspaceSlug: string;
}

// ── Status config ──────────────────────────────────────────────────────────
// "draft" shows as "Unsent" in the UI (invoice is complete but not yet sent)

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  draft:            { label: 'Unsent',           bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',  dot: 'bg-slate-400' },
  sent:             { label: 'Sent',             bg: 'bg-orange-100', text: 'text-orange-700',  border: 'border-orange-200', dot: 'bg-orange-500' },
  viewed:           { label: 'Viewed',           bg: 'bg-blue-100',   text: 'text-blue-700',    border: 'border-blue-200',   dot: 'bg-blue-500' },
  payment_reported: { label: 'Payment Reported', bg: 'bg-amber-100',  text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-500' },
  paid:             { label: 'Paid',             bg: 'bg-emerald-100',text: 'text-emerald-700', border: 'border-emerald-200',dot: 'bg-emerald-500' },
  disputed:         { label: 'Disputed',         bg: 'bg-red-100',    text: 'text-red-700',     border: 'border-red-200',    dot: 'bg-red-500' },
  cancelled:        { label: 'Cancelled',        bg: 'bg-slate-100',  text: 'text-slate-400',   border: 'border-slate-100',  dot: 'bg-slate-300' },
};

const STATUS_FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Unsent' },
  { key: 'sent', label: 'Sent' },
  { key: 'viewed', label: 'Viewed' },
  { key: 'payment_reported', label: 'Payment Reported' },
  { key: 'paid', label: 'Paid' },
  { key: 'disputed', label: 'Disputed' },
  { key: 'cancelled', label: 'Cancelled' },
];

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  return `${Math.floor(diffDays / 30)} months ago`;
}

// Owner-settable lifecycle statuses (mirrors MANUAL_INVOICE_STATUSES in
// actions.ts). Recipient/system-driven states (viewed, payment_reported,
// disputed) are shown as the current badge but aren't manually selectable;
// they surface via the RecipientStatusBadge instead.
const INVOICE_STATUS_ORDER = ['draft', 'sent', 'paid', 'cancelled'];

/**
 * Status dropdown for the invoices list — same interaction pattern as the
 * Orders (OrderStatusDropdown) and Quotes (JobStatusDropdown) lists so all
 * three match. Selecting a status persists via updateInvoiceStatus.
 */
function InvoiceStatusDropdown({ invoiceId, currentStatus }: { invoiceId: string; currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  // Statuses we can't manually switch to (recipient/system-driven) but may be
  // the current value — the dropdown then shows them as the active, read-only
  // current state and only offers the manual options.
  const selectable = INVOICE_STATUS_ORDER.includes(status)
    ? INVOICE_STATUS_ORDER
    : [status, ...INVOICE_STATUS_ORDER];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleSelect(newStatus: string) {
    if (newStatus === status) { setOpen(false); return; }
    if (!INVOICE_STATUS_ORDER.includes(newStatus)) { setOpen(false); return; }
    setSaving(true);
    setOpen(false);
    try {
      await updateInvoiceStatus(invoiceId, newStatus);
      setStatus(newStatus);
      router.refresh();
    } catch (err) {
      console.error('Failed to update invoice status:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={ref} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={saving}
        title="Click to change status"
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-all hover:shadow-sm ${config.bg} ${config.text} ${config.border} ${saving ? 'opacity-50' : ''}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
        {saving ? '...' : config.label}
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {selectable.map((s) => {
            const c = STATUS_CONFIG[s] ?? STATUS_CONFIG.draft;
            const isActive = s === status;
            const isManual = INVOICE_STATUS_ORDER.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => handleSelect(s)}
                disabled={!isManual}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition hover:bg-slate-50 ${isActive ? 'font-semibold' : ''} ${!isManual ? 'opacity-60 cursor-default' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className={isActive ? c.text : 'text-slate-700'}>{c.label}</span>
                {isActive && <svg className="w-3 h-3 ml-auto text-slate-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Per-row action menu ────────────────────────────────────────────────────

function InvoiceRowMenu({
  invoice,
  workspaceSlug,
  onDeleted,
}: {
  invoice: InvoiceRow;
  workspaceSlug: string;
  onDeleted: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'delete' | 'cancel' | null>(null);
  const router = useRouter();

  async function handleDelete() {
    setBusy(true);
    try {
      await deleteInvoice(invoice.id);
      onDeleted(invoice.id);
    } catch {
      alert('Failed to delete invoice.');
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  async function handleCancel() {
    setBusy(true);
    try {
      await cancelInvoice(invoice.id);
      router.refresh();
    } catch {
      alert('Failed to cancel invoice.');
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  return (
    <>
      <div className="relative">
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
          disabled={busy}
          className="icon-btn opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          aria-label="Invoice actions"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
          </svg>
        </button>

        {open && (
          <div
            className="absolute right-0 top-8 z-20 w-44 rounded-xl bg-white border border-slate-200 shadow-lg py-1 text-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <Link
              href={`/${workspaceSlug}/invoices/${invoice.id}`}
              className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Edit
            </Link>
            <Link
              href={`/invoice/${invoice.public_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50"
              onClick={() => setOpen(false)}
            >
              <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Customer View
            </Link>
            {!['cancelled', 'paid'].includes(invoice.status) && (
              <>
                <div className="my-1 border-t border-slate-100" />
                {invoice.status === 'draft' ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpen(false); setConfirmAction('delete'); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete Draft
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setOpen(false); setConfirmAction('cancel'); }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Invoice
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ConfirmModal for delete */}
      <ConfirmModal
        open={confirmAction === 'delete'}
        title={`Delete ${invoice.invoice_number}?`}
        description="This draft invoice will be permanently deleted. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        destructive
        pending={busy}
        pendingLabel="Deleting…"
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleDelete}
      />

      {/* ConfirmModal for cancel */}
      <ConfirmModal
        open={confirmAction === 'cancel'}
        title={`Cancel ${invoice.invoice_number}?`}
        description="This invoice will be marked as cancelled and can no longer be sent."
        confirmLabel="Cancel Invoice"
        cancelLabel="Keep"
        destructive
        pending={busy}
        pendingLabel="Cancelling…"
        onCancel={() => setConfirmAction(null)}
        onConfirm={handleCancel}
      />
    </>
  );
}

// ── Main list ──────────────────────────────────────────────────────────────

export function InvoiceList({ invoices: initialInvoices, workspaceSlug }: Props) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  // Multi-select state for bulk download / delete (mirrors QuotesList).
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<null | 'download' | 'delete'>(null);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number; message: string } | null>(null);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [capNotice, setCapNotice] = useState<string | null>(null);
  const router = useRouter();

  const handleDeleted = (id: string) => setInvoices((prev) => prev.filter((inv) => inv.id !== id));

  // Keep local invoices in sync if the server prop changes (e.g. router.refresh).
  useEffect(() => setInvoices(initialInvoices), [initialInvoices]);

  // Drop selections that no longer exist.
  useEffect(() => {
    setSelectedIds((prev) => {
      const stillExists = new Set(invoices.map((i) => i.id));
      const next = new Set<string>();
      for (const id of prev) if (stillExists.has(id)) next.add(id);
      return next;
    });
  }, [invoices]);

  useEffect(() => {
    if (!capNotice) return;
    const t = setTimeout(() => setCapNotice(null), 4000);
    return () => clearTimeout(t);
  }, [capNotice]);

  const filtered = invoices.filter((inv) => {
    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      inv.customer_name.toLowerCase().includes(q) ||
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.customer_email?.toLowerCase().includes(q) ?? false);
    return matchesStatus && matchesSearch;
  });

  const countByStatus = invoices.reduce<Record<string, number>>((acc, inv) => {
    acc[inv.status] = (acc[inv.status] ?? 0) + 1;
    return acc;
  }, {});

  const isOverdue = (inv: InvoiceRow) =>
    !!inv.due_date &&
    new Date(inv.due_date) < new Date() &&
    !['paid', 'cancelled'].includes(inv.status);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        return next;
      }
      if (next.size >= MAX_BULK_SELECTION) {
        setCapNotice(`You can select up to ${MAX_BULK_SELECTION} invoices at a time.`);
        return prev;
      }
      next.add(id);
      return next;
    });
  }

  function toggleSelectAllVisible(visible: InvoiceRow[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const visibleIds = visible.map((i) => i.id);
      const allSelected = visibleIds.every((id) => next.has(id));
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      for (const id of visibleIds) {
        if (next.has(id)) continue;
        if (next.size >= MAX_BULK_SELECTION) break;
        next.add(id);
      }
      const remainingVisible = visibleIds.filter((id) => !next.has(id)).length;
      if (remainingVisible > 0) {
        setCapNotice(
          `Selected the first ${MAX_BULK_SELECTION} invoices. Process this batch first, then select the next ${remainingVisible}.`,
        );
      }
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // How many selected invoices are non-draft (and will be skipped by delete).
  const selectedNonDraftCount = invoices.filter(
    (i) => selectedIds.has(i.id) && i.status !== 'draft',
  ).length;

  /**
   * Bulk download: load each invoice's data on the server, build one ZIP
   * client-side, then download. Serial + best-effort (a failure is reported,
   * the rest continue). Cap 25.
   */
  async function handleBulkDownload() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (ids.length > MAX_BULK_SELECTION) {
      alert(`Too many invoices selected (${ids.length}). Maximum ${MAX_BULK_SELECTION} per batch.`);
      return;
    }

    setBulkBusy('download');
    setBulkProgress({ done: 0, total: ids.length, message: 'Preparing export...' });

    try {
      const zip = new JSZip();
      let succeeded = 0;
      const failures: string[] = [];

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const row = invoices.find((x) => x.id === id);
        const label = row ? row.invoice_number : id;
        setBulkProgress({ done: i, total: ids.length, message: `Bundling ${label} (${i + 1} of ${ids.length})...` });

        try {
          const data = await loadInvoiceBundleData(id);
          if (!data) {
            failures.push(`${label} (not found)`);
          } else {
            const fileName = await addInvoiceToZip(zip, data);
            if (fileName) succeeded++;
            else failures.push(`${label} (render failed)`);
          }
        } catch (err) {
          console.error('[bulkDownload] failed for', id, err);
          failures.push(`${label} (${err instanceof Error ? err.message : 'error'})`);
        }

        await new Promise((r) => setTimeout(r, 0));
      }

      if (succeeded === 0) {
        alert(`No invoices could be exported.${failures.length ? '\n\nFailed:\n' + failures.join('\n') : ''}`);
        return;
      }

      setBulkProgress({ done: ids.length, total: ids.length, message: 'Compressing ZIP...' });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });

      let zipName: string;
      if (succeeded === 1 && ids.length === 1) {
        const inv = invoices.find((x) => x.id === ids[0]);
        zipName = `Invoice-${sanitizeFilename([inv?.invoice_number ?? 'Invoice', inv?.customer_name ?? ''].filter(Boolean).join('-'))}.zip`;
      } else {
        const stamp = new Date().toISOString().slice(0, 10);
        zipName = `QuoteCore-Invoices-${stamp}-${succeeded}-invoices.zip`;
      }

      downloadBlob(blob, zipName);

      if (failures.length > 0) {
        alert(`Exported ${succeeded} of ${ids.length} invoices.\n\nFailed:\n${failures.join('\n')}`);
      }
    } finally {
      setBulkBusy(null);
      setBulkProgress(null);
    }
  }

  /** Bulk delete after explicit confirmation. Only drafts are deleted. */
  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkBusy('delete');
    try {
      const result = await bulkDeleteInvoices(ids);
      // Reflect the deletion locally (only drafts were removed) and clear.
      setInvoices((prev) => prev.filter((inv) => !(selectedIds.has(inv.id) && inv.status === 'draft')));
      setSelectedIds(new Set());
      setBulkDeleteConfirmOpen(false);
      router.refresh();
      if (result.skipped > 0) {
        alert(`Deleted ${result.deleted} draft invoice(s). ${result.skipped} were skipped (only draft invoices can be bulk-deleted; cancel sent invoices individually).`);
      }
    } catch (err) {
      console.error('[bulkDelete] failed:', err);
      alert(`Failed to delete invoices: ${err instanceof Error ? err.message : 'unknown error'}`);
    } finally {
      setBulkBusy(null);
    }
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by customer or invoice number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
        </div>
        <button
          type="button"
          data-copilot="new-invoice"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Invoice
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_FILTER_TABS.map((tab) => {
          const count = tab.key === 'all' ? invoices.length : (countByStatus[tab.key] ?? 0);
          if (tab.key !== 'all' && count === 0) return null;
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
                isActive
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
              }`}
            >
              {tab.label} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
            </button>
          );
        })}
      </div>

      {/* Invoice rows */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {invoices.length === 0
              ? 'No invoices yet. Create your first invoice to get started.'
              : 'No invoices match your search or filter.'}
          </p>
          {invoices.length === 0 && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)]"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Invoice
            </button>
          )}
        </div>
      ) : (
        <div>
          {/* Column headers — mirrors Quotes/Orders list header styling. Status
              sits in its own column immediately before Last Activity. The grid
              template MUST match the rows below so columns line up. */}
          <div className="hidden sm:grid grid-cols-[28px_1fr_1fr_140px_140px_120px_40px] gap-4 px-4 pb-2 text-xs font-medium text-slate-400 uppercase tracking-wide items-center">
            <input
              type="checkbox"
              checked={filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id))}
              ref={(el) => {
                if (!el) return;
                const someSelected = filtered.some((i) => selectedIds.has(i.id));
                const allSelected = filtered.every((i) => selectedIds.has(i.id));
                el.indeterminate = someSelected && !allSelected;
              }}
              onChange={() => toggleSelectAllVisible(filtered)}
              onClick={(e) => e.stopPropagation()}
              title="Select all visible invoices"
              className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
            />
            <span>Invoice Number</span>
            <span>Client / Job</span>
            <span className="text-right">Value</span>
            <span>Status</span>
            <span>Last Activity</span>
            <span></span>
          </div>

          <div className="grid gap-1">
            {filtered.map((inv) => (
              <div
                key={inv.id}
                onClick={() => router.push(`/${workspaceSlug}/invoices/${inv.id}`)}
                title="Click to open this invoice"
                className={`grid sm:grid-cols-[28px_1fr_1fr_140px_140px_120px_40px] gap-4 items-center rounded-xl border bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group ${selectedIds.has(inv.id) ? 'border-orange-300 bg-orange-50/30' : 'border-slate-200'}`}
              >
                {/* Selection checkbox — onChange + stopPropagation so it
                    selects (not navigates), matching the Quotes/Orders rows. */}
                <input
                  type="checkbox"
                  checked={selectedIds.has(inv.id)}
                  onChange={() => toggleSelect(inv.id)}
                  onClick={(e) => e.stopPropagation()}
                  title="Select for bulk download or delete"
                  className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                />

                {/* Invoice Number */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-orange-600 text-sm">{inv.invoice_number}</span>
                    {isOverdue(inv) && (
                      <span className="text-xs text-red-600 font-medium">Overdue</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-GB') : '—'}
                  </p>
                </div>

                {/* Client / Job */}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{inv.customer_name}</p>
                  {inv.customer_email && <p className="text-xs text-slate-400 truncate">{inv.customer_email}</p>}
                </div>

                {/* Value */}
                <div className="hidden sm:block text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrency(inv.total ?? 0, inv.currency ?? 'GBP')}
                  </p>
                </div>

                {/* Status — owner dropdown + recipient badge, beside Last Activity */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <InvoiceStatusDropdown invoiceId={inv.id} currentStatus={inv.status} />
                  <RecipientStatusBadge status={invoiceRecipientStatus(inv)} />
                </div>

                {/* Last Activity */}
                <div className="hidden md:block">
                  <p className="text-xs text-slate-400">{timeAgo(inv.updated_at)}</p>
                  {inv.due_date && (
                    <p className={`text-xs mt-0.5 ${isOverdue(inv) ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                      Due {new Date(inv.due_date).toLocaleDateString('en-GB')}
                    </p>
                  )}
                </div>

                {/* stopPropagation (not preventDefault) so inner links still navigate */}
                <div onClick={(e) => e.stopPropagation()} className="flex justify-end">
                  <InvoiceRowMenu
                    invoice={inv}
                    workspaceSlug={workspaceSlug}
                    onDeleted={handleDeleted}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cap notice toast (fires when the user tries to exceed MAX_BULK_SELECTION). */}
      {capNotice && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-md rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-900 shadow-lg">
          {capNotice}
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-lg">
          <span className="text-sm text-slate-700">
            {selectedIds.size} selected
            <span className="ml-1 text-xs text-slate-400">/ {MAX_BULK_SELECTION} max</span>
          </span>
          <button onClick={clearSelection} className="text-xs text-slate-500 hover:text-slate-700 underline">
            clear
          </button>
          <span className="w-px h-6 bg-slate-200" />
          <button
            onClick={handleBulkDownload}
            disabled={bulkBusy !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5 5-5M12 15V3" />
            </svg>
            {bulkBusy === 'download' ? 'Bundling...' : `Download ${selectedIds.size} as ZIP`}
          </button>
          <button
            onClick={() => setBulkDeleteConfirmOpen(true)}
            disabled={bulkBusy !== null}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-sm font-semibold text-white transition-all hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected
          </button>
        </div>
      )}

      {/* Bulk download progress modal */}
      {bulkProgress && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Building Export</h3>
            <p className="text-sm text-slate-600 mt-2">{bulkProgress.message}</p>
            <div className="mt-4 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all"
                style={{ width: `${Math.round((bulkProgress.done / Math.max(1, bulkProgress.total)) * 100)}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-2 text-right">
              {bulkProgress.done} / {bulkProgress.total}
            </p>
          </div>
        </div>
      )}

      {/* Bulk delete confirmation (only drafts are deletable; others skipped). */}
      <ConfirmModal
        open={bulkDeleteConfirmOpen}
        title={`Delete ${selectedIds.size} selected invoice(s)?`}
        description={
          selectedNonDraftCount > 0
            ? `Only draft invoices will be permanently deleted. ${selectedNonDraftCount} non-draft invoice(s) in your selection will be skipped — cancel sent invoices individually from their row menu. This cannot be undone.`
            : 'These draft invoices will be permanently deleted. This cannot be undone. Download a copy first if you want to keep records.'
        }
        confirmLabel="Delete drafts"
        cancelLabel="Keep"
        destructive
        pending={bulkBusy === 'delete'}
        pendingLabel="Deleting…"
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={handleBulkDelete}
      />

      {showCreate && (
        <CreateInvoiceModal
          workspaceSlug={workspaceSlug}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
