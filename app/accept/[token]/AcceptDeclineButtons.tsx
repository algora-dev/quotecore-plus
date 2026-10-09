'use client';
import { useState } from 'react';
import { respondToQuote } from './actions';
import { QcButton } from '@/app/components/ui/v2/QcButton';

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
  const [error, setError] = useState<string | null>(null);

  const decided = status !== 'pending';

  async function handleRespond(action: 'accept' | 'decline') {
    setLoading(true);
    setError(null);
    try {
      await respondToQuote(token, action);
      setStatus(action === 'accept' ? 'accepted' : 'declined');
      setDecidedAt(new Date().toISOString());
    } catch (err) {
      console.error('Failed to respond to quote:', err);
      setError('Something went wrong sending your response. Please try again.');
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

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center space-y-4">
        {!decided ? (
          <p className="text-sm text-slate-600">
            Please accept or decline this quote using the buttons below.
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-[#C72B3D] bg-[#FFF0F2] border border-[#C72B3D]/20 rounded-xl p-2 text-center">
            {error}
          </p>
        ) : null}
        <div className="flex gap-3 justify-center flex-wrap">
          <QcButton
            variant="primary"
            size="lg"
            onClick={() => setConfirmAction('accept')}
            disabled={loading || decided}
          >
            Accept Quote
          </QcButton>
          {middleAction}
          <QcButton
            variant="ghost"
            size="lg"
            onClick={() => setConfirmAction('decline')}
            disabled={loading || decided}
            className="text-[#C72B3D]"
          >
            Decline Quote
          </QcButton>
          {secondaryAction}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmAction && (
        <div className="fixed inset-0 backdrop-blur-sm bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm mx-4 space-y-4 shadow-xl">
            <h3 className={`text-lg font-semibold ${confirmAction === 'accept' ? 'text-slate-900' : 'text-[#C72B3D]'}`}>
              {confirmAction === 'accept' ? 'Accept this quote?' : 'Decline this quote?'}
            </h3>
            <p className="text-sm text-slate-600">
              {confirmAction === 'accept'
                ? 'By accepting, you confirm that you agree to the quoted work and pricing.'
                : 'Are you sure you want to decline this quote? The company will be notified.'}
            </p>
            <div className="flex gap-3 justify-end">
              <QcButton
                variant="ghost"
                onClick={() => setConfirmAction(null)}
                disabled={loading}
              >
                Cancel
              </QcButton>
              <QcButton
                variant={confirmAction === 'accept' ? 'primary' : 'danger'}
                onClick={() => handleRespond(confirmAction)}
                disabled={loading}
                pending={loading}
              >
                {loading ? 'Processing...' : confirmAction === 'accept' ? 'Confirm Accept' : 'Confirm Decline'}
              </QcButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
