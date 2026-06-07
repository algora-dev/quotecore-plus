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

  const overlayRef = useRef<HTMLDivElement>(null);

  // Escape to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load quotes when from-quote step opens
  useEffect(() => {
    if (step !== 'from-quote') return;
    setQuotesLoading(true);
    fetch(`/api/invoices/quote-search`)
      .then((r) => r.json())
      .then((data) => { setQuotes(data.quotes ?? []); })
      .catch(() => setQuotes([]))
      .finally(() => setQuotesLoading(false));
  }, [step]);

  async function handleCreateBlank() {
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const invoiceId = await createBlankInvoice({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim() || undefined,
      });
      router.push(`/${workspaceSlug}/invoices/${invoiceId}`);
      onClose();
    } catch (e) {
      setError('Failed to create invoice. Please try again.');
      setBusy(false);
    }
  }

  async function handleCreateFromQuote() {
    if (!selectedQuoteId) {
      setError('Please select a quote.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const invoiceId = await createInvoiceFromQuote(selectedQuoteId);
      router.push(`/${workspaceSlug}/invoices/${invoiceId}`);
      onClose();
    } catch (e) {
      setError('Failed to create invoice from quote. Please try again.');
      setBusy(false);
    }
  }

  const filteredQuotes = quotes.filter((q) => {
    const s = quoteSearch.toLowerCase();
    return (
      !s ||
      q.customer_name.toLowerCase().includes(s) ||
      (q.job_name?.toLowerCase().includes(s) ?? false) ||
      String(q.quote_number ?? '').includes(s)
    );
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      ref={overlayRef}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">
            {step === 'pick-method' && 'New Invoice'}
            {step === 'blank-form' && 'Blank Invoice'}
            {step === 'from-quote' && 'Invoice from Quote'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5">
          {/* ── Step: pick method ── */}
          {step === 'pick-method' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">How would you like to create this invoice?</p>

              <button
                type="button"
                onClick={() => setStep('blank-form')}
                className="w-full flex items-start gap-4 rounded-xl border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50 p-4 text-left transition-all group"
              >
                <div className="mt-0.5 h-9 w-9 rounded-lg bg-slate-100 group-hover:bg-orange-100 flex items-center justify-center flex-shrink-0 transition-colors">
                  <svg className="h-5 w-5 text-slate-500 group-hover:text-orange-600" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">Blank Invoice</p>
                  <p className="text-xs text-slate-500 mt-0.5">Start from scratch and build line items manually.</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setStep('from-quote')}
                className="w-full flex items-start gap-4 rounded-xl border-2 border-slate-200 hover:border-orange-400 hover:bg-orange-50 p-4 text-left transition-all group"
              >
                <div className="mt-0.5 h-9 w-9 rounded-lg bg-slate-100 group-hover:bg-orange-100 flex items-center justify-center flex-shrink-0 transition-colors">
                  <svg className="h-5 w-5 text-slate-500 group-hover:text-orange-600" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">From a Quote</p>
                  <p className="text-xs text-slate-500 mt-0.5">Import customer details and line items from an existing quote.</p>
                </div>
              </button>

              {/* From Job — hidden until Jobs feature exists */}
              <button
                type="button"
                disabled
                title="Coming soon — available once Jobs are live"
                className="w-full flex items-start gap-4 rounded-xl border-2 border-slate-100 p-4 text-left opacity-50 cursor-not-allowed"
              >
                <div className="mt-0.5 h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd" />
                    <path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-700 text-sm">From a Job</p>
                  <p className="text-xs text-slate-400 mt-0.5">Coming soon — available once Jobs are live.</p>
                </div>
              </button>
            </div>
          )}

          {/* ── Step: blank form ── */}
          {step === 'blank-form' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Smith"
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Email <span className="text-slate-400 font-normal">(optional)</span></label>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setStep('pick-method'); setError(null); }}
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateBlank}
                  disabled={busy || !customerName.trim()}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
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
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
                <input
                  type="text"
                  value={quoteSearch}
                  onChange={(e) => setQuoteSearch(e.target.value)}
                  placeholder="Search quotes…"
                  autoFocus
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-400"
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
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors ${
                        selectedQuoteId === q.id ? 'bg-orange-50 border-l-2 border-orange-400' : ''
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900">
                          {q.quote_number ? `Q-${String(q.quote_number).padStart(4, '0')} · ` : ''}{q.customer_name}
                        </p>
                        {q.job_name && <p className="text-xs text-slate-500 truncate">{q.job_name}</p>}
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 capitalize">{q.status}</span>
                      {selectedQuoteId === q.id && (
                        <svg className="h-4 w-4 text-orange-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
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
                  className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleCreateFromQuote}
                  disabled={busy || !selectedQuoteId}
                  className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 disabled:opacity-50"
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
