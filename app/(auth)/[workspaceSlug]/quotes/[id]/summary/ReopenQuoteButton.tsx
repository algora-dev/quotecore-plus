'use client';

/**
 * Reopen a quote that's in a terminal state (accepted / declined /
 * withdrawn).
 *
 * Renders a small "Reopen" pill next to the existing terminal-state
 * badge from WithdrawQuoteButton so the user has a one-click escape
 * hatch. Click \u2192 confirmation modal \u2192 server action clears the
 * terminal markers and the acceptance token. The user can then click
 * "Send Quote" to mint a fresh link.
 *
 * The button is hidden when the quote is live (no accepted_at /
 * declined_at / withdrawn_at) \u2014 reopening a live quote would be a
 * no-op. The parent decides when to render it.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { reopenQuote } from '../../actions';

interface Props {
  quoteId: string;
  /** Drives the confirmation copy. Required so the modal can show the
   *  user exactly what state they're rolling back. */
  state: 'accepted' | 'declined' | 'withdrawn';
}

const COPY: Record<Props['state'], { title: string; body: string; buttonLabel: string }> = {
  accepted: {
    title: 'Reopen this accepted quote?',
    body:
      'This will clear the accepted status, invalidate the existing acceptance link, and roll the quote back to unsent. ' +
      'Use this when the customer wants to revise terms or the scope of work has changed.',
    buttonLabel: 'Yes, reopen quote',
  },
  declined: {
    title: 'Reopen this declined quote?',
    body:
      'This will clear the declined status, invalidate the existing acceptance link, and roll the quote back to unsent. ' +
      'After reopening you can edit the quote (e.g. adjust pricing) and send a fresh link to try again.',
    buttonLabel: 'Yes, reopen quote',
  },
  withdrawn: {
    title: 'Reopen this withdrawn quote?',
    body:
      'This will clear the withdrawn flag and invalidate the previous acceptance token. ' +
      'After reopening you can send a fresh link via Send Quote.',
    buttonLabel: 'Yes, reopen quote',
  },
};

export function ReopenQuoteButton({ quoteId, state }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await reopenQuote(quoteId);
      if (result.ok) {
        setOpen(false);
        router.refresh();
      } else {
        setError(result.error);
      }
    });
  }

  const copy = COPY[state];

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Reopen this quote so you can send a fresh link"
        className="inline-flex items-center gap-1.5 rounded-full border border-orange-300 bg-white px-4 py-2 text-sm font-medium text-orange-700 hover:bg-orange-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.3)]"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        Reopen
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <h3 className="text-lg font-semibold text-slate-900">{copy.title}</h3>
            <p className="text-sm text-slate-600">{copy.body}</p>
            <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-3">
              Any still-pending scheduled follow-ups for this quote will be auto-cancelled so they
              don&apos;t fire against the reopened version with stale context.
            </p>
            {error ? (
              <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
                {error}
              </p>
            ) : null}
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={pending}
                className="px-4 py-2 text-sm font-medium rounded-full bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                {pending ? 'Reopening\u2026' : copy.buttonLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
