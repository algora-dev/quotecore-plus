'use client';

/**
 * Withdraw the active acceptance URL for a quote.
 *
 * Shown next to "Send Quote" when:
 *   - the quote has an active acceptance_token
 *   - the quote hasn't been accepted/declined
 *   - the quote isn't already withdrawn
 *
 * Withdrawal stops the public link from working and surfaces the
 * "request a fresh quote" CTA on the customer's view, exactly the same UX
 * as an expired link. The user can then mint a new link via Send Quote
 * (which generates a fresh token) when they're ready to re-engage.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { withdrawQuote } from '../../actions';

interface Props {
  quoteId: string;
  hasActiveToken: boolean;
  isAlreadyWithdrawn: boolean;
  acceptedAt: string | null;
  declinedAt: string | null;
}

export function WithdrawQuoteButton({ quoteId, hasActiveToken, isAlreadyWithdrawn, acceptedAt, declinedAt }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // Final states get a non-clickable status badge in place of the action,
  // styled to match the rest of the action row.
  if (acceptedAt) {
    return (
      <span
        title="The customer has accepted this quote."
        className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white cursor-not-allowed select-none"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Accepted
      </span>
    );
  }
  if (declinedAt) {
    return (
      <span
        title="The customer has declined this quote."
        className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-5 py-2 text-sm font-semibold text-slate-700 cursor-not-allowed select-none"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        Declined
      </span>
    );
  }

  // Nothing live and no withdrawal history — the quote was never sent, so
  // there's nothing for this button to control. Hide entirely.
  if (!hasActiveToken && !isAlreadyWithdrawn) return null;

  // Withdrawn but not yet re-sent: show a dimmed badge instead of an action
  // button so the user knows the link is dead but doesn't get a no-op action.
  if (isAlreadyWithdrawn) {
    return (
      <span
        title="The acceptance link has been withdrawn. Use Send Quote to create a new one."
        className="inline-flex items-center gap-1.5 rounded-full border border-purple-200 bg-purple-50 px-5 py-2 text-sm font-semibold text-purple-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        Withdrawn
      </span>
    );
  }

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        await withdrawQuote(quoteId);
        setConfirming(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to withdraw quote.');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title="Withdraw the active acceptance link so it can no longer be used"
        className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-all hover:shadow-[0_0_12px_rgba(220,38,38,0.4)]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
        </svg>
        Withdraw Quote
      </button>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">Withdraw acceptance link?</h3>
            <p className="text-sm text-slate-600">
              The active link will stop working immediately. Anyone who visits it will see a
              &quot;Quote No Longer Valid&quot; message with the option to request a fresh quote.
            </p>
            <p className="text-sm text-slate-600">
              You can create a new link any time via <span className="font-medium">Send Quote</span>.
            </p>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => { setConfirming(false); setError(null); }}
                disabled={pending}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="px-4 py-2 text-sm font-semibold rounded-full bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {pending ? 'Withdrawing...' : 'Withdraw link'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
