'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeSuppression } from './actions';

interface Entry {
  id: string;
  companyId: string;
  companyName: string;
  email: string;
  reason: string | null;
  createdAt: string;
}

interface Props {
  entries: Entry[];
}

export function SuppressionsTable({ entries }: Props) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  // Optimistic-hide pattern (same as ScheduledMessagesList / SentMessagesList):
  // the row vanishes the instant the user clicks Remove and only reappears
  // if the server action fails. router.refresh() takes the canonical state
  // after the roundtrip completes. Without this, the deleted row stayed
  // visible until the page was hard-reloaded, which made users think the
  // Remove click had silently failed.
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<Set<string>>(new Set());

  const visibleEntries = useMemo(
    () => entries.filter((e) => !optimisticHiddenIds.has(e.id)),
    [entries, optimisticHiddenIds],
  );
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleEntries;
    return visibleEntries.filter(
      (e) => e.email.toLowerCase().includes(q) || e.companyName.toLowerCase().includes(q),
    );
  }, [visibleEntries, search]);

  function handleRemove(id: string) {
    setPendingId(id);
    setErrorById((prev) => ({ ...prev, [id]: '' }));
    // Hide immediately; restore on failure so the user can retry.
    setOptimisticHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    startTransition(async () => {
      const result = await removeSuppression(id);
      if (!result.ok) {
        setOptimisticHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setErrorById((prev) => ({ ...prev, [id]: result.error }));
      } else {
        // Pull canonical state from the server so the row stays gone
        // even if the user reloads or navigates away and back.
        router.refresh();
      }
      setPendingId(null);
    });
  }

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
        <p className="text-sm text-slate-500">No suppressions on record.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by company or email…"
        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
      />

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="text-left px-4 py-2 font-medium">Company</th>
              <th className="text-left px-4 py-2 font-medium">Email</th>
              <th className="text-left px-4 py-2 font-medium">Reason</th>
              <th className="text-left px-4 py-2 font-medium">Date</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} className="border-t border-slate-100">
                <td className="px-4 py-3 text-slate-900">{e.companyName}</td>
                <td className="px-4 py-3 text-slate-700 font-mono text-xs">{e.email}</td>
                <td className="px-4 py-3 text-slate-500 text-xs max-w-xs truncate" title={e.reason ?? ''}>
                  {e.reason ?? '—'}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                  {new Date(e.createdAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleRemove(e.id)}
                    disabled={isPending && pendingId === e.id}
                    className="px-3 py-1 text-xs font-medium rounded-full border border-slate-300 text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  >
                    {isPending && pendingId === e.id ? 'Removing…' : 'Remove'}
                  </button>
                  {errorById[e.id] ? (
                    <p className="mt-1 text-[10px] text-rose-600">{errorById[e.id]}</p>
                  ) : null}
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  No matches for &ldquo;{search}&rdquo;.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        Showing the most recent 500 suppressions. Removing an entry allows future messages
        from that company to reach that email again.
      </p>
    </div>
  );
}
