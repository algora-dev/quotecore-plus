'use client';
import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { deleteQuote, updateQuoteJobStatus } from './actions';
import type { JobStatus } from './actions';

type Quote = {
  id: string;
  customer_name: string;
  job_name: string | null;
  status: string;
  quote_number: number | null;
  created_at: string;
  updated_at: string;
  job_status: string | null;
};

interface Props {
  quotes: Quote[];
  workspaceSlug: string;
}

const JOB_STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; border: string; dot: string }> = {
  unsent:            { label: 'Unsent',            bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-300', dot: 'bg-slate-400' },
  sent:              { label: 'Sent',              bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-300', dot: 'bg-orange-500' },
  accepted:          { label: 'Accepted',          bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  declined:          { label: 'Declined',          bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-300', dot: 'bg-red-500' },
  deposit_paid:      { label: 'Deposit Paid',      bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  materials_ordered: { label: 'Materials Ordered', bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-300', dot: 'bg-blue-500' },
  install:           { label: 'Install',           bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-300', dot: 'bg-blue-500' },
  invoice_sent:      { label: 'Invoice Sent',      bg: 'bg-orange-50',   text: 'text-orange-700',  border: 'border-orange-300', dot: 'bg-orange-500' },
  invoice_paid:      { label: 'Invoice Paid',      bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
  finished:          { label: 'Finished',          bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-300', dot: 'bg-emerald-500' },
};

const JOB_STATUS_ORDER: string[] = [
  'unsent', 'sent', 'accepted', 'declined', 'deposit_paid',
  'materials_ordered', 'install', 'invoice_sent', 'invoice_paid', 'finished',
];

// Status filter tabs for confirmed quotes
const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unsent', label: 'Unsent' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'declined', label: 'Declined' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'finished', label: 'Finished' },
];

const IN_PROGRESS_STATUSES = ['deposit_paid', 'materials_ordered', 'install', 'invoice_sent', 'invoice_paid'];

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

function JobStatusDropdown({ quoteId, currentStatus }: { quoteId: string; currentStatus: string }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(currentStatus);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const config = JOB_STATUS_CONFIG[status] || JOB_STATUS_CONFIG.unsent;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function handleSelect(newStatus: string) {
    if (newStatus === status) {
      setOpen(false);
      return;
    }
    setSaving(true);
    setOpen(false);
    try {
      await updateQuoteJobStatus(quoteId, newStatus as JobStatus);
      setStatus(newStatus);
      router.refresh();
    } catch (err) {
      console.error('Failed to update job status:', err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={ref} onClick={e => e.stopPropagation()}>
      <button
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
        <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {JOB_STATUS_ORDER.map((s) => {
            const c = JOB_STATUS_CONFIG[s];
            const isActive = s === status;
            return (
              <button
                key={s}
                onClick={() => handleSelect(s)}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-xs transition hover:bg-slate-50 ${isActive ? 'font-semibold' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full ${c.dot}`} />
                <span className={isActive ? c.text : 'text-slate-700'}>{c.label}</span>
                {isActive && (
                  <svg className="w-3 h-3 ml-auto text-slate-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function QuotesList({ quotes, workspaceSlug }: Props) {
  const [activeTab, setActiveTab] = useState<'confirmed' | 'draft'>('confirmed');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'recently_active'>('newest');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const drafts = quotes.filter(q => q.status === 'draft');
  const confirmed = quotes
    .filter(q => q.status !== 'draft');

  // Apply status filter
  let filteredConfirmed = confirmed;
  if (statusFilter !== 'all') {
    if (statusFilter === 'in_progress') {
      filteredConfirmed = confirmed.filter(q => IN_PROGRESS_STATUSES.includes(q.job_status || ''));
    } else {
      filteredConfirmed = confirmed.filter(q => (q.job_status || 'unsent') === statusFilter);
    }
  }

  // Apply search
  const searchLower = searchQuery.toLowerCase();
  filteredConfirmed = filteredConfirmed.filter(q =>
    (q.quote_number && q.quote_number.toString().includes(searchQuery)) ||
    q.customer_name.toLowerCase().includes(searchLower) ||
    (q.job_name && q.job_name.toLowerCase().includes(searchLower))
  );

  const filteredDrafts = drafts.filter(q =>
    q.customer_name.toLowerCase().includes(searchLower) ||
    (q.job_name && q.job_name.toLowerCase().includes(searchLower))
  );

  // Apply sort
  const sortFn = (a: Quote, b: Quote) => {
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'recently_active') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  };

  const displayQuotes = activeTab === 'draft'
    ? [...filteredDrafts].sort(sortFn)
    : [...filteredConfirmed].sort(sortFn);

  // Count statuses for filter badges
  const statusCounts: Record<string, number> = { all: confirmed.length };
  confirmed.forEach(q => {
    const s = q.job_status || 'unsent';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
    if (IN_PROGRESS_STATUSES.includes(s)) {
      statusCounts['in_progress'] = (statusCounts['in_progress'] || 0) + 1;
    }
  });

  async function handleDelete() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await deleteQuote(deleteId);
      setDeleteId(null);
      router.refresh();
    } catch (err) {
      console.error('Failed to delete quote:', err);
      alert('Failed to delete quote. Please try again.');
    } finally {
      setDeleting(false);
    }
  }

  function handleRowClick(q: Quote) {
    if (q.status === 'draft') {
      router.push(`/${workspaceSlug}/quotes/${q.id}`);
    } else {
      router.push(`/${workspaceSlug}/quotes/${q.id}/summary`);
    }
  }

  return (
    <>
      {/* Top actions row */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-full w-fit">
          <button
            onClick={() => { setActiveTab('confirmed'); setStatusFilter('all'); }}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === 'confirmed'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Confirmed ({confirmed.length})
          </button>
          <button
            onClick={() => setActiveTab('draft')}
            className={`px-4 py-1.5 text-sm font-medium rounded-full transition ${
              activeTab === 'draft'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            Drafts ({drafts.length})
          </button>
        </div>

        <div className="flex gap-2">
          <Link
            href={`/${workspaceSlug}/quotes/new`}
            title="Click to create a new quote"
            data-copilot="new-quote"
            className="inline-flex items-center gap-1.5 rounded-full bg-black px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_16px_rgba(255,107,53,0.5)] ring-2 ring-transparent hover:ring-orange-400/30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Quote
          </Link>
          <Link
            href={`/${workspaceSlug}/templates`}
            className="inline-flex items-center rounded-full bg-[#FF6B35] px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            Templates
          </Link>
        </div>
      </div>

      {/* Status filter tabs (confirmed only) */}
      {activeTab === 'confirmed' && (
        <div className="flex gap-1 flex-wrap">
          {STATUS_FILTERS.map(f => {
            const count = statusCounts[f.key] || 0;
            if (f.key !== 'all' && count === 0) return null;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition ${
                  statusFilter === f.key
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                }`}
              >
                {f.label} {count > 0 && <span className="ml-1 opacity-70">{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Search + Sort row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by quote #, client, or job..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
          />
          <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600">✕</button>
          )}
        </div>

        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none bg-white"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="recently_active">Recently active</option>
        </select>
      </div>

      {/* Table header */}
      {displayQuotes.length > 0 && (
        <div className="hidden sm:grid grid-cols-[1fr_1fr_140px_120px_40px] gap-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
          <span>Quote</span>
          <span>Client / Job</span>
          <span>Status</span>
          <span>Last Activity</span>
          <span></span>
        </div>
      )}

      {/* Quote rows */}
      {displayQuotes.length > 0 ? (
        <div className="grid gap-1">
          {displayQuotes.map((q) => (
            <div
              key={q.id}
              onClick={() => handleRowClick(q)}
              title="Click to open this quote"
              className="grid sm:grid-cols-[1fr_1fr_140px_120px_40px] gap-4 items-center rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition group"
            >
              {/* Quote info */}
              <div className="min-w-0">
                {q.quote_number && (
                  <span className="font-semibold text-orange-600 text-sm">#{q.quote_number}</span>
                )}
                <span className="text-xs text-slate-400 ml-2">
                  {new Date(q.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Client / Job */}
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{q.customer_name}</p>
                {q.job_name && <p className="text-xs text-slate-400 truncate">{q.job_name}</p>}
              </div>

              {/* Status */}
              <div>
                {q.status === 'draft' ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Draft
                  </span>
                ) : (
                  <JobStatusDropdown quoteId={q.id} currentStatus={q.job_status || 'unsent'} />
                )}
              </div>

              {/* Last Activity */}
              <div className="text-xs text-slate-400">
                {timeAgo(q.updated_at || q.created_at)}
              </div>

              {/* Delete */}
              <div className="flex justify-end">
                <button
                  onClick={(e) => { e.stopPropagation(); setDeleteId(q.id); }}
                  title="Click to delete"
                  className="icon-btn icon-btn--danger opacity-0 group-hover:opacity-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {searchQuery
              ? 'No quotes match your search.'
              : activeTab === 'draft'
                ? 'No draft quotes.'
                : statusFilter !== 'all'
                  ? `No ${STATUS_FILTERS.find(f => f.key === statusFilter)?.label.toLowerCase()} quotes.`
                  : 'No confirmed quotes yet.'}
          </p>
        </div>
      )}

      {/* Delete Modal */}
      {deleteId && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete Quote</h3>
            <p className="text-sm text-slate-500 mt-2">
              This action cannot be undone. The quote will be permanently deleted.
            </p>
            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setDeleteId(null)}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 text-sm font-medium rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
