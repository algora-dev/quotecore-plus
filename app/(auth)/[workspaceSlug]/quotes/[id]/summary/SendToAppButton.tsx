'use client';

import { useState } from 'react';

interface SendToAppButtonProps {
  quoteId: string;
}

type ExportState =
  | { phase: 'idle' }
  | { phase: 'exporting'; provider: 'xero' | 'quickbooks' }
  | { phase: 'done'; provider: 'xero' | 'quickbooks'; invoiceNumber: string; attachedPdf: boolean }
  | { phase: 'error'; message: string };

export function SendToAppButton({ quoteId }: SendToAppButtonProps) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ExportState>({ phase: 'idle' });

  const exportQuote = async (provider: 'xero' | 'quickbooks') => {
    setState({ phase: 'exporting', provider });
    try {
      const res = await fetch(`/api/integrations/${provider}/export-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quoteId }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 400 && data.error === 'Xero is not connected') {
          setState({ phase: 'error', message: 'Xero is not connected yet. Connect it in Account > Integrations first.' });
        } else if (res.status === 400 && data.error === 'QuickBooks is not connected') {
          setState({ phase: 'error', message: 'QuickBooks is not connected yet. Connect it in Account > Integrations first.' });
        } else {
          setState({ phase: 'error', message: data.error ?? 'Export failed' });
        }
        return;
      }
      setState({
        phase: 'done',
        provider,
        invoiceNumber: data.invoiceNumber ?? '',
        attachedPdf: !!data.attachedPdf,
      });
    } catch {
      setState({ phase: 'error', message: 'Export failed - please try again' });
    }
  };

  const close = () => {
    setOpen(false);
    setState({ phase: 'idle' });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Send to App"
        className="inline-flex items-center gap-1.5 rounded-full border border-black bg-white px-4 py-2 text-sm font-medium text-slate-900 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        Send to App
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40"
          onClick={close}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-slate-900">Send to App</h3>
              <button
                type="button"
                onClick={close}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {state.phase === 'idle' && (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  Export this quote as a draft invoice with line items to your accounting software.
                </p>
                <button
                  type="button"
                  onClick={() => exportQuote('xero')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#13B5EA] px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90 transition"
                >
                  <span className="font-bold">X</span>
                  Export to Xero
                </button>
                <button
                  type="button"
                  onClick={() => exportQuote('quickbooks')}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#2CA01C] px-5 py-2.5 text-xs font-semibold text-white hover:opacity-90 transition"
                >
                  <span className="font-bold">QB</span>
                  Export to QuickBooks
                </button>
              </div>
            )}

            {state.phase === 'exporting' && (
              <div className="space-y-3 py-4">
                <div className="flex justify-center">
                  <svg className="w-8 h-8 animate-spin text-slate-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
                <p className="text-center text-sm text-slate-600">
                  Creating draft invoice in {state.provider === 'xero' ? 'Xero' : 'QuickBooks'}...
                </p>
              </div>
            )}

            {state.phase === 'done' && (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <svg className="w-12 h-12 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-center text-sm text-slate-600">
                  Draft invoice{state.invoiceNumber ? ` ${state.invoiceNumber}` : ''} created in {state.provider === 'xero' ? 'Xero' : 'QuickBooks'}.
                  {state.attachedPdf ? ' Quote PDF attached.' : ''}
                </p>
                {state.provider === 'xero' ? (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium text-slate-700">To find it in Xero:</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Contacts &gt; All contacts, then open the contact named after this quote&apos;s customer. The draft invoice is on their profile - review and approve it there before sending.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="text-xs font-medium text-slate-700">To find it in QuickBooks:</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Sales &gt; Customers, then open the customer named after this quote - the draft invoice is on their profile. Review and send it from there.
                    </p>
                  </div>
                )}
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-full bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                >
                  Done
                </button>
              </div>
            )}

            {state.phase === 'error' && (
              <div className="space-y-3">
                <div className="flex justify-center">
                  <svg className="w-12 h-12 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-center text-sm text-slate-600">{state.message}</p>
                <button
                  type="button"
                  onClick={close}
                  className="w-full rounded-full bg-black px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
