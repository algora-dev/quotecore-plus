'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteInvoice, cancelInvoice } from './actions';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { formatCurrency } from '@/app/lib/currency/currencies';

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
  created_at: string;
  updated_at: string;
};

interface Props {
  invoices: InvoiceRow[];
  workspaceSlug: string;
}

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  draft:            { label: 'Draft',            bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-300',  dot: 'bg-slate-400' },
  sent:             { label: 'Sent',             bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-300', dot: 'bg-orange-500' },
  viewed:           { label: 'Viewed',           bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-300',   dot: 'bg-blue-500' },
  payment_reported: { label: 'Payment Reported', bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-300',  dot: 'bg-amber-500' },
  paid:             { label: 'Paid',             bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300',dot: 'bg-emerald-500' },
  disputed:         { label: 'Disputed',         bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-300',    dot: 'bg-red-500' },
  cancelled:        { label: 'Cancelled',        bg: 'bg-slate-50',    text: 'text-slate-400',   border: 'border-slate-200',  dot: 'bg-slate-300' },
};

const STATUS_FILTER_TABS = [
  { key: 'all', label: 'All' },
  { key: 'draft', label: 'Draft' },
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
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 14) return '1 week ago';
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  if (diffDays < 60) return '1 month ago';
  return `${Math.floor(diffDays / 30)} months ago`;
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
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
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleDelete() {
    if (!confirm(`Delete draft invoice ${invoice.invoice_number}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await deleteInvoice(invoice.id);
      onDeleted(invoice.id);
    } catch (e) {
      alert('Failed to delete invoice.');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  async function handleCancel() {
    if (!confirm(`Cancel invoice ${invoice.invoice_number}? The invoice will be marked as cancelled.`)) return;
    setBusy(true);
    try {
      await cancelInvoice(invoice.id);
      router.refresh();
    } catch (e) {
      alert('Failed to cancel invoice.');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        disabled={busy}
        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Invoice actions"
      >
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 w-44 rounded-xl bg-white border border-slate-200 shadow-lg py-1 text-sm">
          <Link
            href={`/${workspaceSlug}/invoices/${invoice.id}`}
            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" /></svg>
            Edit
          </Link>
          <Link
            href={`/${workspaceSlug}/invoices/${invoice.id}?preview=1`}
            className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:bg-slate-50"
            onClick={() => setOpen(false)}
          >
            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor"><path d="M10 12a2 2 0 100-4 2 2 0 000 4z" /><path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" /></svg>
            Preview
          </Link>
          {invoice.status !== 'cancelled' && invoice.status !== 'paid' && (
            <>
              <div className="my-1 border-t border-slate-100" />
              {invoice.status === 'draft' ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                  Delete Draft
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex w-full items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50"
                >
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" /></svg>
                  Cancel Invoice
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main list ──────────────────────────────────────────────────────────────

export function InvoiceList({ invoices: initialInvoices, workspaceSlug }: Props) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const router = useRouter();

  const handleDeleted = (id: string) => {
    setInvoices((prev) => prev.filter((inv) => inv.id !== id));
  };

  // Filter
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

  // Counts per status for tab badges
  const countByStatus = invoices.reduce<Record<string, number>>((acc, inv) => {
    acc[inv.status] = (acc[inv.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
          </svg>
          <input
            type="text"
            placeholder="Search customer or invoice number…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>

        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors shadow-sm"
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          New Invoice
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTER_TABS.map((tab) => {
          const count = tab.key === 'all' ? invoices.length : (countByStatus[tab.key] ?? 0);
          const isActive = statusFilter === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm transition-all ${
                isActive
                  ? 'bg-black text-white font-semibold'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 ${isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Invoice list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <svg className="h-6 w-6 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          {invoices.length === 0 ? (
            <>
              <p className="text-slate-900 font-semibold">No invoices yet</p>
              <p className="text-slate-500 text-sm mt-1">Create your first invoice to get started.</p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
              >
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" /></svg>
                New Invoice
              </button>
            </>
          ) : (
            <>
              <p className="text-slate-900 font-semibold">No results</p>
              <p className="text-slate-500 text-sm mt-1">Try adjusting your search or filter.</p>
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden divide-y divide-slate-100">
          {filtered.map((inv) => (
            <Link
              key={inv.id}
              href={`/${workspaceSlug}/invoices/${inv.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
            >
              {/* Invoice number + customer */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm text-slate-900 group-hover:text-orange-600 transition-colors">
                    {inv.invoice_number}
                  </span>
                  <StatusBadge status={inv.status} />
                </div>
                <p className="text-sm text-slate-600 mt-0.5 truncate">{inv.customer_name}</p>
                {inv.customer_email && (
                  <p className="text-xs text-slate-400 truncate">{inv.customer_email}</p>
                )}
              </div>

              {/* Amount */}
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900">
                  {formatCurrency(inv.total ?? 0, inv.currency ?? 'GBP')}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-GB') : '—'}
                </p>
              </div>

              {/* Updated */}
              <div className="text-right hidden md:block w-28">
                <p className="text-xs text-slate-400">{timeAgo(inv.updated_at)}</p>
                {inv.due_date && (
                  <p className={`text-xs mt-0.5 ${new Date(inv.due_date) < new Date() && !['paid','cancelled'].includes(inv.status) ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
                    Due {new Date(inv.due_date).toLocaleDateString('en-GB')}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div onClick={(e) => e.preventDefault()}>
                <InvoiceRowMenu
                  invoice={inv}
                  workspaceSlug={workspaceSlug}
                  onDeleted={handleDeleted}
                />
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create invoice modal */}
      {showCreate && (
        <CreateInvoiceModal
          workspaceSlug={workspaceSlug}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
