'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteAllSentMessagesForQuote } from './sent-message-delete-actions';

interface Props {
  quoteId: string;
  messageCount: number;
}

/**
 * "Delete all" button on the Sent Messages panel header. Two-click
 * confirm (no separate modal) because this is destructive and irreversible
 * but doesn't warrant a full modal flow.
 */
export function DeleteAllMessagesButton({ quoteId, messageCount }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await deleteAllSentMessagesForQuote(quoteId);
      if (result.ok) {
        router.refresh();
      } else {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="text-xs text-slate-400 hover:text-rose-600 underline-offset-2 hover:underline transition"
        title={`Delete all ${messageCount} message${messageCount === 1 ? '' : 's'}`}
      >
        Delete all
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-600">Delete all {messageCount}?</span>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isPending}
        className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
      >
        {isPending ? 'Removing\u2026' : 'Confirm'}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={isPending}
        className="text-[11px] text-slate-500 hover:text-slate-700"
      >
        Cancel
      </button>
      {error ? <span className="text-[11px] text-rose-600">{error}</span> : null}
    </div>
  );
}
