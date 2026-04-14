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
  
  function handleConfirm() {
    if (!selectedQuote) return;
    router.push(`/${workspaceSlug}/material-orders/create?quoteId=${selectedQuote.id}`);
  }
  
  return (
    <>
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Quote #</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Job Name</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Created</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {quotes.map((quote) => (
              <tr
                key={quote.id}
                onClick={() => setSelectedQuote(quote)}
                className="hover:bg-orange-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm font-medium text-slate-900">
                  {quote.quote_number}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {quote.job_name || 'Untitled'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {quote.customer_name || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {new Date(quote.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-green-100 border border-green-200 rounded-full text-xs font-medium text-green-700">
                    {quote.status || 'Confirmed'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Confirmation Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Create Order from Quote?</h3>
            <p className="text-sm text-slate-600 mb-4">
              You are about to create a material order using:
            </p>
            
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Quote Number:</span>
                <span className="text-sm font-semibold text-slate-900">{selectedQuote.quote_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Job Name:</span>
                <span className="text-sm text-slate-700">{selectedQuote.job_name || 'Untitled'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Customer:</span>
                <span className="text-sm text-slate-700">{selectedQuote.customer_name || 'Not specified'}</span>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setSelectedQuote(null)}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-slate-300 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg bg-[#FF6B35] text-white hover:bg-orange-600 transition-colors shadow-sm"
              >
                Yes, Create Order
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
