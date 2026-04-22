'use client';
import { useState } from 'react';
import { respondToQuote } from './actions';

export function AcceptDeclineButtons({ token }: { token: string }) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>('pending');
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'accept' | 'decline' | null>(null);

  async function handleRespond(action: 'accept' | 'decline') {
    setLoading(true);
    try {
      await respondToQuote(token, action);
      setStatus(action === 'accept' ? 'accepted' : 'declined');
    } catch (err) {
      console.error('Failed to respond to quote:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  if (status === 'accepted') {
    return (
      <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-emerald-800">Quote Accepted</h3>
        <p className="text-sm text-emerald-600 mt-1">Thank you! The company has been notified.</p>
      </div>
    );
  }

  if (status === 'declined') {
    return (
      <div className="bg-red-50 rounded-xl p-6 border border-red-200 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-red-800">Quote Declined</h3>
        <p className="text-sm text-red-600 mt-1">The company has been notified of your decision.</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-center space-y-4">
        <p className="text-sm text-slate-600">
          Please accept or decline this quote using the buttons below.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={() => setConfirmAction('accept')}
            disabled={loading}
            className="px-6 py-2.5 text-sm font-semibold rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-all hover:shadow-[0_0_12px_rgba(16,185,129,0.4)] disabled:opacity-50"
          >
            Accept Quote
          </button>
          <button
            onClick={() => setConfirmAction('decline')}
            disabled={loading}
            className="px-6 py-2.5 text-sm font-semibold rounded-full bg-white text-red-600 border border-red-300 hover:bg-red-50 transition-all disabled:opacity-50"
          >
            Decline Quote
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 space-y-4">
            <h3 className={`text-lg font-semibold ${confirmAction === 'accept' ? 'text-emerald-700' : 'text-red-700'}`}>
              {confirmAction === 'accept' ? 'Accept this quote?' : 'Decline this quote?'}
            </h3>
            <p className="text-sm text-slate-600">
              {confirmAction === 'accept'
                ? 'By accepting, you confirm that you agree to the quoted work and pricing.'
                : 'Are you sure you want to decline this quote? The company will be notified.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={loading}
                className="px-4 py-2 text-sm rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRespond(confirmAction)}
                disabled={loading}
                className={`px-4 py-2 text-sm font-medium rounded-full text-white disabled:opacity-50 ${
                  confirmAction === 'accept'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading ? 'Processing...' : confirmAction === 'accept' ? 'Confirm Accept' : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
