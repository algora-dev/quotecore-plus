'use client';

import { useState, useTransition } from 'react';
import { submitOrderResponse } from './actions';

interface Props {
  token: string;
  alreadyResponded: boolean;
  /**
   * Server-truth decision state. When the order was already accepted or
   * declined, Accept/Decline render DISABLED with a status banner, while
   * Request Info stays live (the supplier can still ask something).
   */
  initialDecision?: {
    status: 'accepted' | 'declined';
    decidedAt: string;
  } | null;
  downloadAction?: React.ReactNode;
}

function formatDecisionDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Supplier response form on `/orders/[token]`.
 *
 * Mirrors the public QUOTE accept page UX:
 *  - Accept / Decline are SINGLE-ACTION buttons -> confirmation modal -> submit.
 *    No message required.
 *  - Request Info is the only action that reveals a (required) message box.
 */
export function OrderResponseForm({
  token,
  alreadyResponded,
  initialDecision = null,
  downloadAction,
}: Props) {
  const [status, setStatus] = useState<'pending' | 'accepted' | 'declined'>(
    initialDecision ? initialDecision.status : 'pending',
  );
  const [decidedAt, setDecidedAt] = useState<string | null>(
    initialDecision ? initialDecision.decidedAt : null,
  );
  const [confirmAction, setConfirmAction] = useState<'accept' | 'decline' | null>(null);
  const [showInfo, setShowInfo] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [infoSent, setInfoSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  const decided = status !== 'pending';

  function runAcceptDecline(action: 'accept' | 'decline') {
    setError(null);
    startTransition(async () => {
      const result = await submitOrderResponse({ token, action, body: null });
      if (result.ok) {
        setStatus(action === 'accept' ? 'accepted' : 'declined');
        setDecidedAt(new Date().toISOString());
        setConfirmAction(null);
      } else {
        setError(result.error);
        setConfirmAction(null);
      }
    });
  }

  function sendInfoRequest() {
    setError(null);
    if (!body.trim()) {
      setError('Please add a message describing what you need.');
      return;
    }
    startTransition(async () => {
      const result = await submitOrderResponse({ token, action: 'request_info', body: body.trim() });
      if (result.ok) {
        setInfoSent(true);
        setShowInfo(false);
        setBody('');
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <>
      {/* Decision banner (server-truth): explains why Accept/Decline are off. */}
      {decided ? (
        <div
          className={`rounded-xl p-4 border text-center ${
            status === 'accepted' ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              status === 'accepted' ? 'text-emerald-800' : 'text-rose-800'
            }`}
          >
            You {status} this order{decidedAt ? ` on ${formatDecisionDate(decidedAt)}` : ''}.
          </p>
          <p
            className={`text-xs mt-1 ${
              status === 'accepted' ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            The sender has been notified. You can still request info below.
          </p>
        </div>
      ) : null}

      <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-center space-y-4">
        {!decided && !infoSent ? (
          <p className="text-sm text-slate-600">
            {alreadyResponded
              ? 'You can respond again using the buttons below.'
              : 'Please respond to this order using the buttons below.'}
          </p>
        ) : null}

        {infoSent ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Your request was sent — we&apos;ve let the sender know.
          </div>
        ) : null}

        <div className="flex gap-3 justify-center flex-wrap">
          <button
            type="button"
            onClick={() => setConfirmAction('accept')}
            disabled={isPending || decided}
            className="px-6 py-2.5 text-sm font-semibold rounded-full bg-emerald-600 text-white hover:bg-emerald-700 transition-all hover:shadow-[0_0_12px_rgba(16,185,129,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => setConfirmAction('decline')}
            disabled={isPending || decided}
            className="px-6 py-2.5 text-sm font-semibold rounded-full bg-white text-rose-600 border border-rose-300 hover:bg-rose-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => {
              setShowInfo((v) => !v);
              setInfoSent(false);
              setError(null);
            }}
            className={`px-6 py-2.5 text-sm font-semibold rounded-full transition-all ${
              showInfo
                ? 'bg-slate-900 text-white hover:bg-slate-800'
                : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
            }`}
          >
            Request Info
          </button>
          {downloadAction}
        </div>

        {/* Request Info is the ONLY action with a message box, and it's required. */}
        {showInfo ? (
          <div className="text-left space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              What information do you need?
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={8000}
              placeholder="e.g. Can you confirm the delivery date and quantity for line 3?"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
            <button
              type="button"
              onClick={sendInfoRequest}
              disabled={isPending || !body.trim()}
              className="w-full px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {isPending ? 'Sending…' : 'Send request'}
            </button>
          </div>
        ) : null}

        {error ? (
          <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 text-left">
            {error}
          </p>
        ) : null}
      </div>

      {/* Accept / Decline confirmation modal (matches the quote page). */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-sm mx-4 space-y-4">
            <h3
              className={`text-lg font-semibold ${
                confirmAction === 'accept' ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {confirmAction === 'accept' ? 'Accept this order?' : 'Decline this order?'}
            </h3>
            <p className="text-sm text-slate-600">
              {confirmAction === 'accept'
                ? 'By accepting, you confirm you can fulfil this order as listed.'
                : 'Are you sure you want to decline this order? The sender will be notified.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={isPending}
                className="px-4 py-2 text-sm rounded-full border border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => runAcceptDecline(confirmAction)}
                disabled={isPending}
                className={`px-4 py-2 text-sm font-medium rounded-full text-white disabled:opacity-50 ${
                  confirmAction === 'accept'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {isPending
                  ? 'Processing…'
                  : confirmAction === 'accept'
                    ? 'Confirm Accept'
                    : 'Confirm Decline'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
