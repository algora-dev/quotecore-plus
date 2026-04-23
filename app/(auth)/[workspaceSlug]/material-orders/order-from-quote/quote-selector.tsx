'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Quote {
  id: string;
  quote_number: string;
  job_name: string | null;
  customer_name: string | null;
  created_at: string;
  status: string | null;
}

interface Props {
  quotes: Quote[];
  workspaceSlug: string;
}

export function QuoteSelector({ quotes, workspaceSlug }: Props) {
  const router = useRouter();
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = quotes.filter(q => {
    const s = searchQuery.toLowerCase();
    return (
      (q.quote_number && q.quote_number.toString().includes(searchQuery)) ||
      (q.customer_name && q.customer_name.toLowerCase().includes(s)) ||
      (q.job_name && q.job_name.toLowerCase().includes(s))
    );
  });

  function handleConfirm() {
    if (!selectedQuote) return;
    router.push(`/${workspaceSlug}/material-orders/create?quoteId=${selectedQuote.id}`);
  }

  return (
    <>
      {/* Search */}
      <div className="relative max-w-sm">
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

      {/* Table header */}
      {filtered.length > 0 && (
        <div className="hidden sm:grid grid-cols-[80px_1fr_1fr_100px] gap-4 px-4 text-xs font-medium text-slate-400 uppercase tracking-wide">
          <span>Quote #</span>
          <span>Job / Customer</span>
          <span>Created</span>
          <span>Status</span>
        </div>
      )}

      {/* Rows */}
      {filtered.length > 0 ? (
        <div className="grid gap-1">
          {filtered.map((quote) => (
            <div
              key={quote.id}
              onClick={() => setSelectedQuote(quote)}
              title="Click to select this quote"
              className="grid sm:grid-cols-[80px_1fr_1fr_100px] gap-4 items-center rounded-xl border border-slate-200 bg-white px-4 py-3 cursor-pointer hover:bg-orange-50/40 hover:border-orange-200 hover:shadow-[0_0_8px_rgba(255,107,53,0.08)] transition"
            >
              <div className="font-semibold text-sm text-orange-600">#{quote.quote_number}</div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{quote.customer_name || '—'}</p>
                {quote.job_name && <p className="text-xs text-slate-400 truncate">{quote.job_name}</p>}
              </div>
              <div className="text-xs text-slate-400">
                {new Date(quote.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Confirmed
                </span>
              </div>
            </div>
          ))}
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
