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

// ── Status config — matches app badge patterns exactly ─────────────────────

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  draft:            { label: 'Draft',            bg: 'bg-slate-100',  text: 'text-slate-500',   border: 'border-slate-200',  dot: 'bg-slate-400' },
  sent:             { label: 'Sent',             bg: 'bg-orange-100', text: 'text-orange-700',  border: 'border-orange-200', dot: 'bg-orange-500' },
  viewed:           { label: 'Viewed',           bg: 'bg-blue-100',   text: 'text-blue-700',    border: 'border-blue-200',   dot: 'bg-blue-500' },
  payment_reported: { label: 'Payment Reported', bg: 'bg-amber-100',  text: 'text-amber-700',   border: 'border-amber-200',  dot: 'bg-amber-500' },
  paid:             { label: 'Paid',             bg: 'bg-emerald-100',text: 'text-emerald-700', border: 'border-emerald-200',dot: 'bg-emerald-500' },
  disputed:         { label: 'Disputed',         bg: 'bg-red-100',    text: 'text-red-700',     border: 'border-red-200',    dot: 'bg-red-500' },
  cancelled:        { label: 'Cancelled',        bg: 'bg-slate-100',  text: 'text-slate-400',   border: 'border-slate-100',  dot: 'bg-slate-300' },
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
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
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
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
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
    } catch {
      alert('Failed to delete invoice.');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  async function handleCancel() {
    if (!confirm(`Cancel invoice ${invoice.invoice_number}? It will be marked as cancelled.`)) return;
    setBusy(true);
    try {
      await cancelInvoice(invoice.id);
      router.refresh();
    } catch {
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
        className="icon-btn opacity-0 group-hover:opacity-100 p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        aria-label="Invoice actions"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-20 w-44 rounded-xl bg-white border border-slate-200 shadow-lg py-1 text-sm">
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
            href={`/invoice/${invoice.id}`}
            target="_blank"
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
                  onClick={handleDelete}
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
                  onClick={handleCancel}
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
  );
}

// ── Main list ──────────────────────────────────────────────────────────────

export function InvoiceList({ invoices: initialInvoices, workspaceSlug }: Props) {
  const [invoices, setInvoices] = useState<InvoiceRow[]>(initialInvoices);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const handleDeleted = (id: string) => setInvoices((prev) => prev.filter((inv) => inv.id !== id));

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

  const countByStatus = invoices.reduce<Record<string, number>>((acc, inv) => {
    acc[inv.status] = (acc[inv.status] ?? 0) + 1;
    return acc;
  }, {});

  const isOverdue = (inv: InvoiceRow) =>
    !!inv.due_date &&
    new Date(inv.due_date) < new Date() &&
    !['paid', 'cancelled'].includes(inv.status);

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center gap-3">
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
        <div className="grid gap-1">
          {filtered.map((inv) => (
            <Link
              key={inv.id}
              href={`/${workspaceSlug}/invoices/${inv.id}`}
              className="grid sm:grid-cols-[1fr_160px_120px_40px] gap-4 items-center rounded-xl border bg-white px-4 py-3 hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group border-slate-200"
            >
              {/* Customer + invoice number */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-orange-600 text-sm">{inv.invoice_number}</span>
                  <StatusBadge status={inv.status} />
                  {isOverdue(inv) && (
                    <span className="text-xs text-red-600 font-medium">Overdue</span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-900 truncate mt-0.5">{inv.customer_name}</p>
                {inv.customer_email && <p className="text-xs text-slate-400 truncate">{inv.customer_email}</p>}
              </div>

              {/* Amount + date */}
              <div className="hidden sm:block text-right">
                <p className="text-sm font-semibold text-slate-900">
                  {formatCurrency(inv.total ?? 0, inv.currency ?? 'GBP')}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {inv.invoice_date ? new Date(inv.invoice_date).toLocaleDateString('en-GB') : '—'}
                </p>
              </div>

              {/* Last activity */}
              <div className="hidden md:block text-right">
                <p className="text-xs text-slate-400">{timeAgo(inv.updated_at)}</p>
                {inv.due_date && (
                  <p className={`text-xs mt-0.5 ${isOverdue(inv) ? 'text-red-500 font-medium' : 'text-slate-400'}`}>
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

      {showCreate && (
        <CreateInvoiceModal
          workspaceSlug={workspaceSlug}
          onClose={() => setShowCreate(false)}
        />
      )}
    </>
  );
}
