'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createBlankInvoice, createInvoiceFromQuote } from './actions';

type QuoteSummary = {
  id: string;
  quote_number: number | null;
  customer_name: string;
  job_name: string | null;
  status: string;
};

interface Props {
  workspaceSlug: string;
  onClose: () => void;
}

type Step = 'pick-method' | 'blank-form' | 'from-quote';

// ── Shared close button ────────────────────────────────────────────────────

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    </button>
  );
}

export function CreateInvoiceModal({ workspaceSlug, onClose }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('pick-method');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Blank invoice form
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // From quote
  const [quotes, setQuotes] = useState<QuoteSummary[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [quoteSearch, setQuoteSearch] = useState('');
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load quotes when from-quote step opens
  useEffect(() => {
    if (step !== 'from-quote') return;
    setQuotesLoading(true);
    fetch('/api/invoices/quote-search')
      .then((r) => r.json())
      .then((data) => setQuotes(data.quotes ?? []))
      .catch(() => setQuotes([]))
      .finally(() => setQuotesLoading(false));
  }, [step]);

  async function handleCreateBlank() {
    if (!customerName.trim()) { setError('Customer name is required.'); return; }
    setBusy(true);
    setError(null);
    try {
      const invoiceId = await createBlankInvoice({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
      });
      router.push(`/${workspaceSlug}/invoices/${invoiceId}`);
      onClose();
    } catch {
      setError('Failed to create invoice. Please try again.');
      setBusy(false);
    }
  }

  async function handleCreateFromQuote() {
    if (!selectedQuoteId) { setError('Please select a quote.'); return; }
    setBusy(true);
    setError(null);
    try {
      const invoiceId = await createInvoiceFromQuote(selectedQuoteId);
      router.push(`/${workspaceSlug}/invoices/${invoiceId}`);
      onClose();
    } catch {
      setError('Failed to create invoice from quote. Please try again.');
      setBusy(false);
    }
  }

  const filteredQuotes = quotes.filter((q) => {
    const s = quoteSearch.toLowerCase();
    return !s || q.customer_name.toLowerCase().includes(s) || (q.job_name?.toLowerCase().includes(s) ?? false) || String(q.quote_number ?? '').includes(s);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {step === 'pick-method' && 'New Invoice'}
            {step === 'blank-form' && 'Blank Invoice'}
            {step === 'from-quote' && 'Invoice from Quote'}
          </h2>
          <CloseBtn onClose={onClose} />
        </div>

        <div className="px-6 py-5">
          {/* ── Step: pick method ── */}
          {step === 'pick-method' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">How would you like to create this invoice?</p>

              {/* Blank invoice */}
              <button
                type="button"
                onClick={() => setStep('blank-form')}
                className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <svg className="h-5 w-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Blank Invoice</p>
                    <p className="text-xs text-slate-500 mt-0.5">Start from scratch and build line items manually.</p>
                  </div>
                </div>
              </button>

              {/* From quote */}
              <button
                type="button"
                onClick={() => setStep('from-quote')}
                className="block w-full text-left p-5 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-full bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <svg className="h-5 w-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">From a Quote</p>
                    <p className="text-xs text-slate-500 mt-0.5">Import customer details and line items from an existing quote.</p>
                  </div>
                </div>
              </button>

              {/* From Job — disabled until Jobs exist */}
              <div className="block w-full text-left p-5 bg-white border-2 border-slate-100 rounded-xl opacity-50 cursor-not-allowed" title="Coming soon — available once Jobs are live">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 text-sm">From a Job</p>
                    <p className="text-xs text-slate-400 mt-0.5">Coming soon — available once Jobs are live.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step: blank form ── */}
          {step === 'blank-form' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Smith"
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Customer Email <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('pick-method'); setError(null); }}
                  className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateBlank}
                  disabled={busy || !customerName.trim()}
                  className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  {busy ? 'Creating…' : 'Create Invoice'}
                </button>
              </div>
            </div>
          )}

          {/* ── Step: from quote ── */}
          {step === 'from-quote' && (
            <div className="space-y-4">
              <div className="relative">
                <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  placeholder="Search quotes…"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {quotesLoading ? (
                  <p className="p-4 text-sm text-slate-400 text-center">Loading quotes…</p>
                ) : filteredQuotes.length === 0 ? (
                  <p className="p-4 text-sm text-slate-400 text-center">No quotes found.</p>
                ) : (
                  filteredQuotes.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => setSelectedQuoteId(q.id === selectedQuoteId ? null : q.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-orange-50/40 hover:border-orange-200 transition ${
                        selectedQuoteId === q.id ? 'bg-orange-50/40 border-l-2 border-[#FF6B35]' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {q.quote_number ? <span className="text-orange-600 font-semibold">#{q.quote_number} · </span> : null}
                          {q.customer_name}
                        </p>
                        {q.job_name && <p className="text-xs text-slate-500 truncate">{q.job_name}</p>}
                      </div>
                      <span className="text-xs px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200 capitalize">{q.status}</span>
                      {selectedQuoteId === q.id && (
                        <svg className="h-5 w-5 text-[#FF6B35] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </button>
                  ))
                )}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('pick-method'); setError(null); setSelectedQuoteId(null); }}
                  className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateFromQuote}
                  disabled={busy || !selectedQuoteId}
                  className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all"
                >
                  {busy ? 'Creating…' : 'Create Invoice'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
