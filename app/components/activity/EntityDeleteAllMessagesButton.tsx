'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteAllSentMessagesForOrder,
  deleteAllSentMessagesForInvoice,
} from '@/app/(auth)/[workspaceSlug]/quotes/[id]/summary/sent-message-delete-actions';

/**
 * "Delete all" header button for the order / invoice Activity cards.
 * Two-click confirm. Sibling of the quote-only DeleteAllMessagesButton;
 * routes to the per-entity delete-all action by `kind`.
 */
interface Props {
  kind: 'order' | 'invoice';
  entityId: string;
  messageCount: number;
}

export function EntityDeleteAllMessagesButton({ kind, entityId, messageCount }: Props) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result =
        kind === 'order'
          ? await deleteAllSentMessagesForOrder(entityId)
          : await deleteAllSentMessagesForInvoice(entityId);
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
