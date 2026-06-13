'use client';
import { useState } from 'react';
import { respondToQuote } from './actions';

interface AcceptDeclineProps {
  token: string;
  /** Optional middle action rendered inline between Accept and Decline. */
  middleAction?: React.ReactNode;
  /**
   * Optional secondary action rendered to the right of Decline as a
   * passive button. Stays visible after the user has accepted or
   * declined so they can still e.g. download a copy of the quote.
   */
  secondaryAction?: React.ReactNode;
  /**
   * Server-truth decision state (fix #4). When the quote was already
   * accepted/declined, the page renders the full document + this control
   * with Accept/Decline DISABLED and a status banner, while Request Changes
   * (middleAction) stays live. Driven by the server-fetched timestamps, not
   * just client state, so a refresh after deciding still shows the banner.
   */
  initialDecision?: {
    status: 'accepted' | 'declined';
    decidedAt: string;
  } | null;
}

function formatDecisionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function AcceptDeclineButtons({
  token,
  middleAction,
  secondaryAction,
  initialDecision = null,
}: AcceptDeclineProps) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>(
    initialDecision ? initialDecision.status : 'pending',
  );
  const [decidedAt, setDecidedAt] = useState<string | null>(
    initialDecision ? initialDecision.decidedAt : null,
  );
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'accept' | 'decline' | null>(null);

  const decided = status !== 'pending';

  async function handleRespond(action: 'accept' | 'decline') {
    setLoading(true);
    try {
      await respondToQuote(token, action);
      setStatus(action === 'accept' ? 'accepted' : 'declined');
      setDecidedAt(new Date().toISOString());
    } catch (err) {
      console.error('Failed to respond to quote:', err);
      alert('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  }

  return (
    <>
      {/* Status banner (fix #4): explains why Accept/Decline are disabled. */}
      {decided ? (
        <div
          className={`rounded-xl p-4 border text-center ${
            status === 'accepted'
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              status === 'accepted' ? 'text-emerald-800' : 'text-red-800'
            }`}
          >
            You {status} this quote{decidedAt ? ` on ${formatDecisionDate(decidedAt)}` : ''}.
          </p>
          <p
            className={`text-xs mt-1 ${
              status === 'accepted' ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            The company has been notified. You can still request changes below.
          </p>
        </div>
      ) : null}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-center space-y-4">
        {!decided ? (
          <p className="text-sm text-slate-600">
            Please accept or decline this quote using the buttons below.
          </p>
        ) : null}
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={() => setConfirmAction('accept')}
            disabled={loading || decided}
            className="px-6 py-2.5 text-sm font-semibold rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-all hover:shadow-[0_0_12px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            Accept Quote
          </button>
          {middleAction}
          <button
            onClick={() => setConfirmAction('decline')}
            disabled={loading || decided}
            className="px-6 py-2.5 text-sm font-semibold rounded-full bg-white text-red-600 border border-red-300 hover:bg-red-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Decline Quote
          </button>
          {secondaryAction}
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
