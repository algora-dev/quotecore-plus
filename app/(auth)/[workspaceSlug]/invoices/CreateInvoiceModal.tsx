'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBlankInvoice, createInvoiceFromQuote, getCustomerQuoteLinesSummary } from './actions';
import type { InvoiceTemplate } from './template-actions';

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

type Step = 'pick-method' | 'blank-form' | 'from-quote' | 'line-select' | 'pick-template';

/** Minimal line shape used in the line-selector step. */
type QuoteLine = {
  id: string;
  custom_text: string | null;
  custom_amount: number | null;
  line_type: string | null;
  is_visible: boolean | null;
  sort_order: number | null;
};

function CloseBtn({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors">
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
  // Line-selector step state
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [linesLoading, setLinesLoading] = useState(false);
  const [lineSearch, setLineSearch] = useState('');

  // Template selection
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  // Track the source method so we can go back correctly from template step
  const [pendingMethod, setPendingMethod] = useState<'blank' | 'from-quote' | null>(null);

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
      .then((d) => setQuotes(d.quotes ?? []))
      .catch(() => setQuotes([]))
      .finally(() => setQuotesLoading(false));
  }, [step]);

  // Load customer quote lines when line-select step opens
  useEffect(() => {
    if (step !== 'line-select' || !selectedQuoteId) return;
    setLinesLoading(true);
    getCustomerQuoteLinesSummary(selectedQuoteId)
      .then((lines) => {
        setQuoteLines(lines);
        setSelectedLineIds(new Set(lines.map((l) => l.id)));
      })
      .catch(() => setQuoteLines([]))
      .finally(() => setLinesLoading(false));
  }, [step, selectedQuoteId]);

  // Load templates when template picker opens
  useEffect(() => {
    if (step !== 'pick-template') return;
    setTemplatesLoading(true);
    fetch('/api/invoices/templates')
      .then((r) => r.json())
      .then((d) => setTemplates(d.templates ?? []))
      .catch(() => setTemplates([]))
      .finally(() => setTemplatesLoading(false));
  }, [step]);

  function goToTemplateStep(method: 'blank' | 'from-quote') {
    setPendingMethod(method);
    setStep('pick-template');
  }

  function goBackFromTemplate() {
    if (pendingMethod === 'blank') setStep('blank-form');
    else setStep('line-select'); // Return to line selector, not quote picker
  }

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      let invoiceId: string;
      if (pendingMethod === 'blank') {
        if (!customerName.trim()) { setError('Customer name is required.'); setBusy(false); return; }
        invoiceId = await createBlankInvoice({
          customerName: customerName.trim(),
          customerEmail: customerEmail.trim() || undefined,
          templateId: selectedTemplateId ?? undefined,
        });
      } else {
        if (!selectedQuoteId) { setError('Please select a quote.'); setBusy(false); return; }
        invoiceId = await createInvoiceFromQuote(
          selectedQuoteId,
          selectedTemplateId ?? undefined,
          selectedLineIds.size > 0 ? Array.from(selectedLineIds) : undefined,
        );
      }
      router.push(`/${workspaceSlug}/invoices/${invoiceId}`);
      onClose();
    } catch {
      setError('Failed to create invoice. Please try again.');
      setBusy(false);
    }
  }

  const filteredQuotes = quotes.filter((q) => {
    const s = quoteSearch.toLowerCase();
    return !s || q.customer_name.toLowerCase().includes(s) || (q.job_name?.toLowerCase().includes(s) ?? false) || String(q.quote_number ?? '').includes(s);
  });

  const stepTitle = {
    'pick-method': 'New Invoice',
    'blank-form': 'Blank Invoice',
    'from-quote': 'Invoice from Quote',
    'line-select': 'Select Lines',
    'pick-template': 'Choose a Template',
  }[step];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            {step !== 'pick-method' && (
              <button type="button" onClick={() => {
                if (step === 'pick-template') goBackFromTemplate();
                else if (step === 'line-select') setStep('from-quote');
                else if (step === 'blank-form' || step === 'from-quote') setStep('pick-method');
                setError(null);
              }} className="p-1 rounded text-slate-400 hover:text-slate-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-semibold text-slate-900">{stepTitle}</h2>
          </div>
          <CloseBtn onClose={onClose} />
        </div>

        <div className="px-6 py-5">
          {/* ── Step: pick method ── */}
          {step === 'pick-method' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 mb-4">How would you like to create this invoice?</p>

              <button type="button" data-copilot="invoice-method-blank" data-assistant-id="invoice-method-blank" onClick={() => setStep('blank-form')}
                className="block w-full text-left p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-full bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center flex-shrink-0 transition-colors">
                    <svg className="h-5 w-5 text-[#FF6B35]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">Blank Invoice</p>
                    <p className="text-xs text-slate-500 mt-0.5">Start from scratch - choose a template then build line items manually.</p>
                  </div>
                </div>
              </button>

              <button type="button" data-copilot="invoice-method-from-quote" data-assistant-id="invoice-method-from-quote" onClick={() => setStep('from-quote')}
                className="block w-full text-left p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-[#FF6B35] hover:shadow-lg transition-all group">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-full bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center flex-shrink-0 transition-colors">
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

              <div className="block w-full text-left p-4 bg-white border-2 border-slate-100 rounded-xl opacity-50 cursor-not-allowed" title="Coming soon">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                    <svg className="h-5 w-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-700 text-sm">From a Job</p>
                    <p className="text-xs text-slate-400 mt-0.5">Coming soon - available once Jobs are live.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step: blank form ── */}
          {step === 'blank-form' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name <span className="text-red-500">*</span></label>
                <input type="text" value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="e.g. John Smith" autoFocus
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Customer Email <span className="text-slate-400 font-normal">(optional)</span></label>
                <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="customer@example.com"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none" />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setStep('pick-method'); setError(null); }}
                  className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>
                <button type="button" data-copilot="invoice-choose-template" data-assistant-id="invoice-choose-template" onClick={() => { if (!customerName.trim()) { setError('Customer name is required.'); return; } setError(null); goToTemplateStep('blank'); }}
                  disabled={!customerName.trim()}
                  className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all">
                  Choose Template
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
                <input type="text" value={quoteSearch} onChange={(e) => setQuoteSearch(e.target.value)}
                  placeholder="Search quotes…" autoFocus
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-300 text-sm focus:border-orange-500 focus:outline-none" />
              </div>
              <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                {quotesLoading ? (
                  <p className="p-4 text-sm text-slate-400 text-center">Loading quotes…</p>
                ) : filteredQuotes.length === 0 ? (
                  <p className="p-4 text-sm text-slate-400 text-center">No quotes found.</p>
                ) : filteredQuotes.map((q) => (
                  <button key={q.id} type="button"
                    onClick={() => setSelectedQuoteId(q.id === selectedQuoteId ? null : q.id)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-orange-50/40 transition ${selectedQuoteId === q.id ? 'bg-orange-50/40 border-l-2 border-[#FF6B35]' : ''}`}>
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
                ))}
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { setStep('pick-method'); setError(null); setSelectedQuoteId(null); }}
                  className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>
                <button type="button" onClick={() => { if (!selectedQuoteId) { setError('Please select a quote.'); return; } setError(null); setStep('line-select'); }}
                  disabled={!selectedQuoteId}
                  className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all">
                  Select Lines →
                </button>
              </div>
            </div>
          )}

          {/* ── Step: pick template ── */}
          {/* Line selector step - pick which customer quote lines to include in the invoice */}
          {step === 'line-select' && (() => {
            const filteredLines = quoteLines.filter((l) =>
              !lineSearch.trim() || (l.custom_text ?? '').toLowerCase().includes(lineSearch.toLowerCase())
            );
            const allSelected = filteredLines.length > 0 && filteredLines.every((l) => selectedLineIds.has(l.id));
            return (
              <div className="space-y-3">
                <p className="text-xs text-slate-500">Tick the lines to include in the invoice. Untick to exclude.</p>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input type="text" value={lineSearch} onChange={(e) => setLineSearch(e.target.value)}
                      placeholder="Search lines..." autoFocus
                      className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-sm focus:border-orange-500 focus:outline-none" />
                  </div>
                  <button type="button" onClick={() => {
                    if (allSelected) {
                      setSelectedLineIds((prev) => { const s = new Set(prev); filteredLines.forEach((l) => s.delete(l.id)); return s; });
                    } else {
                      setSelectedLineIds((prev) => { const s = new Set(prev); filteredLines.forEach((l) => s.add(l.id)); return s; });
                    }
                  }} className="text-xs font-medium text-orange-600 hover:text-orange-700 whitespace-nowrap">
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {linesLoading ? (
                    <p className="p-4 text-sm text-slate-400 text-center">Loading lines...</p>
                  ) : filteredLines.length === 0 ? (
                    <p className="p-4 text-sm text-slate-400 text-center">
                      {quoteLines.length === 0 ? 'No customer quote lines saved yet.' : 'No lines match.'}
                    </p>
                  ) : filteredLines.map((l) => (
                    <label key={l.id} className={["flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-orange-50/40 transition", selectedLineIds.has(l.id) ? "" : "opacity-50"].join(" ")}>
                      <input type="checkbox" checked={selectedLineIds.has(l.id)}
                        onChange={() => setSelectedLineIds((prev) => { const s = new Set(prev); s.has(l.id) ? s.delete(l.id) : s.add(l.id); return s; })}
                        className="w-4 h-4 rounded text-orange-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-slate-900 truncate">{l.custom_text || <em className="text-slate-400">Unnamed line</em>}</p>
                      </div>
                      {l.custom_amount != null && (
                        <span className="text-xs font-medium text-slate-700 tabular-nums">${Number(l.custom_amount).toFixed(2)}</span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400">{selectedLineIds.size} of {quoteLines.length} lines selected</p>
                {error && <p className="text-sm text-red-600">{error}</p>}
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => { setStep('from-quote'); setError(null); }}
                    className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>
                  <button type="button" onClick={() => { setError(null); goToTemplateStep('from-quote'); }}
                    disabled={selectedLineIds.size === 0}
                    className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all">
                    Choose Template
                  </button>
                </div>
              </div>
            );
          })()}

          {step === 'pick-template' && (
            <div className="space-y-4">
              {templatesLoading ? (
                <p className="text-sm text-slate-400 text-center py-6">Loading templates…</p>
              ) : templates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                  <p className="text-sm text-slate-500 font-medium">No invoice templates yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Create one in{' '}
                    <a href={`/${workspaceSlug}/resources/invoice-templates`} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline">
                      Resources → Invoice Templates
                    </a>
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {/* No template option */}
                  <button type="button" data-copilot="invoice-template-none" data-assistant-id="invoice-template-none" onClick={() => setSelectedTemplateId(null)}
                    className={`block w-full text-left p-3.5 rounded-xl border-2 transition-all ${selectedTemplateId === null ? 'border-[#FF6B35] bg-orange-50/40' : 'border-slate-200 hover:border-slate-300'}`}>
                    <p className="font-medium text-slate-900 text-sm">No template</p>
                    <p className="text-xs text-slate-500 mt-0.5">Skip - I&apos;ll fill in the details manually.</p>
                  </button>
                  {templates.map((t) => (
                    <button key={t.id} type="button" onClick={() => setSelectedTemplateId(t.id)}
                      className={`block w-full text-left p-3.5 rounded-xl border-2 transition-all ${selectedTemplateId === t.id ? 'border-[#FF6B35] bg-orange-50/40' : 'border-slate-200 hover:border-slate-300'}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 text-sm">{t.name}</p>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {t.company_name && <span className="text-xs text-slate-500">{t.company_name}</span>}
                            {(t.payment_account_name || t.payment_account_number) && (
                              <span className="text-xs text-emerald-600">✓ Payment details</span>
                            )}
                            {t.payment_link && <span className="text-xs text-blue-600">✓ Pay link</span>}
                          </div>
                        </div>
                        {selectedTemplateId === t.id && (
                          <svg className="h-5 w-5 text-[#FF6B35] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => { goBackFromTemplate(); setError(null); }}
                  className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Back</button>
                <button type="button" data-copilot="invoice-create-confirm" data-assistant-id="invoice-create-confirm" onClick={handleCreate} disabled={busy}
                  className="flex-1 rounded-full bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition-all">
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
