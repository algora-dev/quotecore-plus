'use client';

import { useState, useTransition } from 'react';
import { updateQuoteExpiry } from '../../actions';

interface Props {
  quoteId: string;
  /** ISO timestamp of current expiry, or null if no expiry is set. */
  expiresAt: string | null;
  /** Whether the quote has already been accepted or declined (no editing). */
  isFinalised: boolean;
}

function daysUntil(iso: string): number {
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function QuoteExpiryEditor({ quoteId, expiresAt, isFinalised }: Props) {
  const [editing, setEditing] = useState(false);
  const [days, setDays] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!expiresAt) return null;

  const expiryDate = new Date(expiresAt);
  const remaining = daysUntil(expiresAt);
  const isExpired = remaining <= 0;

  const expiryLabel = expiryDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  function handleSave() {
    setError(null);
    startTransition(async () => {
      try {
        await updateQuoteExpiry(quoteId, days);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      }
    });
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isExpired ? (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-slate-100 text-slate-500 border border-slate-300">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
          Expired {expiryLabel}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs bg-orange-50 text-orange-700 border border-orange-200">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          Valid for {remaining} more day{remaining !== 1 ? 's' : ''} — expires {expiryLabel}
        </span>
      )}

      {!isFinalised && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
        >
          Edit
        </button>
      )}

      {editing && (
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="px-2 py-1 text-xs border border-slate-300 rounded-lg bg-white"
            disabled={isPending}
          >
            <option value={7}>7 days from now</option>
            <option value={14}>14 days from now</option>
            <option value={30}>30 days from now</option>
            <option value={60}>60 days from now</option>
            <option value={90}>90 days from now</option>
            <option value={180}>180 days from now</option>
          </select>
          <button
            onClick={handleSave}
            disabled={isPending}
            className="px-3 py-1 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 disabled:opacity-50 transition-all hover:shadow-[0_0_8px_rgba(255,107,53,0.3)]"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setError(null); }}
            disabled={isPending}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            Cancel
          </button>
          {error && <span className="text-xs text-rose-600">{error}</span>}
        </div>
      )}
    </div>
  );
}
