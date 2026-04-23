'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Quote {
  id: string;
  quote_number: string;
  job_name: string | null;
  customer_name: string | null;
  created_at: string;
  updated_at: string;
  status: string | null;
  job_status: string | null;
}

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

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unsent', label: 'Unsent' },
  { key: 'sent', label: 'Sent' },
  { key: 'accepted', label: 'Accepted' },
];

function timeAgo(dateStr: string): string {
  const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

export function QuoteSelector({ quotes, workspaceSlug }: Props) {
  const router = useRouter();
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'recently_active'>('newest');

  let filtered = quotes;

  // Status filter
  if (statusFilter !== 'all') {
    filtered = filtered.filter(q => (q.job_status || 'unsent') === statusFilter);
  }

  // Search
  if (searchQuery) {
    const s = searchQuery.toLowerCase();
    filtered = filtered.filter(q =>
      (q.quote_number && q.quote_number.toString().includes(searchQuery)) ||
      (q.customer_name && q.customer_name.toLowerCase().includes(s)) ||
      (q.job_name && q.job_name.toLowerCase().includes(s))
    );
  }

  // Sort
  filtered = [...filtered].sort((a, b) => {
    if (sortBy === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    if (sortBy === 'recently_active') return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // Status counts
  const statusCounts: Record<string, number> = { all: quotes.length };
  quotes.forEach(q => {
    const s = q.job_status || 'unsent';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });

  function handleConfirm() {
    if (!selectedQuote) return;
    router.push(`/${workspaceSlug}/material-orders/create?quoteId=${selectedQuote.id}`);
  }

  return (
    <>
      {/* Status filters */}
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

      {/* Search + Sort */}
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
      {filtered.length > 0 && (
        <div className="hidden sm:grid grid-cols-[70px_1fr_1fr_130px_80px] gap-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
          <span>Quote</span>
          <span>Client / Job</span>
          <span>Status</span>
          <span>Activity</span>
          <span></span>
        </div>
      )}

      {/* Rows */}
      {filtered.length > 0 ? (
        <div className="grid gap-1">
          {filtered.map((quote) => {
            const jobStatus = quote.job_status || 'unsent';
            const config = JOB_STATUS_CONFIG[jobStatus] || JOB_STATUS_CONFIG.unsent;
            return (
              <div
                key={quote.id}
                onClick={() => setSelectedQuote(quote)}
                title="Click to select this quote"
                className="grid sm:grid-cols-[70px_1fr_1fr_130px_80px] gap-4 items-center rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition"
              >
                <div className="font-semibold text-sm text-orange-600">#{quote.quote_number}</div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{quote.customer_name || '—'}</p>
                  {quote.job_name && <p className="text-xs text-slate-400 truncate">{quote.job_name}</p>}
                </div>
                <div>
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
                    {config.label}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{timeAgo(quote.updated_at || quote.created_at)}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
          <p className="text-sm text-slate-500">
            {searchQuery ? 'No quotes match your search.' : 'No confirmed quotes found.'}
          </p>
        </div>
      )}

      {/* Confirmation Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900">Create Order from Quote</h3>
            <div className="mt-3 p-3 bg-slate-50 rounded-xl space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Quote</span>
                <span className="font-medium text-slate-900">#{selectedQuote.quote_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Customer</span>
                <span className="text-slate-700">{selectedQuote.customer_name || '—'}</span>
              </div>
              {selectedQuote.job_name && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Job</span>
                  <span className="text-slate-700">{selectedQuote.job_name}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setSelectedQuote(null)}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                Create Order
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
