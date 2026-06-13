'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resolveInvoiceDispute } from '@/app/(auth)/[workspaceSlug]/invoices/actions';
import { AlertModal } from '@/app/components/AlertModal';

/**
 * "Unresolved" tab body for the invoice Activity card.
 *
 * Invoice disputes carry a real `resolved_at` flag (mirrors quote
 * revision requests), so this panel lists open disputes with a
 * "Mark resolved" action and a collapsible drawer of resolved ones.
 * Optimistic resolve with rollback on error, matching the quote
 * RevisionRequestsPanel UX at a lighter weight.
 */

export interface InvoiceDispute {
  id: string;
  reason: string;
  message: string;
  recipient_name: string;
  recipient_email: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface Props {
  disputes: InvoiceDispute[];
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function InvoiceDisputesPanel({ disputes }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [showResolved, setShowResolved] = useState(false);
  const [optimisticResolved, setOptimisticResolved] = useState<Set<string>>(new Set());
  const [alertState, setAlertState] = useState<{
    open: boolean;
    title: string;
    description?: string;
  }>({ open: false, title: '' });

  const pending = disputes.filter(
    (d) => !d.resolved_at && !optimisticResolved.has(d.id),
  );
  const resolved = [
    ...disputes.filter((d) => d.resolved_at),
    ...disputes
      .filter((d) => !d.resolved_at && optimisticResolved.has(d.id))
      .map((d) => ({ ...d, resolved_at: new Date().toISOString() })),
  ];

  function handleResolve(id: string) {
    setResolvingId(id);
    setOptimisticResolved((prev) => new Set(prev).add(id));
    startTransition(async () => {
      const result = await resolveInvoiceDispute(id);
      if (result.ok) {
        router.refresh();
      } else {
        // Roll back.
        setOptimisticResolved((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setAlertState({
          open: true,
          title: 'Failed to resolve dispute',
          description: result.error,
        });
      }
      setResolvingId(null);
    });
  }

  if (disputes.length === 0) {
    return (
      <div className="px-1 py-6 text-center text-xs text-slate-500">
        No disputes raised. If a customer disputes this invoice it&apos;ll show
        up here for you to action.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pending.map((d) => (
        <div key={d.id} className="rounded-xl border border-orange-200 bg-orange-50/40 p-4 space-y-2">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="text-sm font-medium text-slate-900">
                {d.recipient_name || 'Customer'}
                {d.reason ? (
                  <span className="ml-2 inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                    {d.reason}
                  </span>
                ) : null}
              </p>
              <p className="text-xs text-slate-500">{formatTimestamp(d.created_at)}</p>
            </div>
            <button
              type="button"
              onClick={() => handleResolve(d.id)}
              disabled={resolvingId === d.id}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {resolvingId === d.id ? 'Resolving\u2026' : 'Mark resolved'}
            </button>
          </div>
          {d.message ? (
            <p className="text-sm text-slate-700 whitespace-pre-wrap bg-white rounded-lg px-3 py-2 border border-slate-100">
              {d.message}
            </p>
          ) : null}
          {d.recipient_email ? (
            <p className="text-xs text-slate-500">
              <span className="font-medium select-all">{d.recipient_email}</span>
            </p>
          ) : null}
        </div>
      ))}

      {resolved.length > 0 ? (
        <div>
          <button
            type="button"
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs text-slate-500 hover:text-slate-700 underline"
          >
            {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
          </button>
          {showResolved ? (
            <div className="mt-2 space-y-2">
              {resolved.map((d) => (
                <div key={d.id} className="rounded-lg border border-slate-200 bg-white p-3 opacity-75">
                  <p className="text-xs font-medium text-slate-700">
                    {d.recipient_name || 'Customer'}
                    {d.reason ? ` \u00b7 ${d.reason}` : ''}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Raised {formatTimestamp(d.created_at)}
                    {d.resolved_at ? ` \u00b7 Resolved ${formatTimestamp(d.resolved_at)}` : ''}
                  </p>
                  {d.message ? (
                    <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{d.message}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <AlertModal
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        variant="error"
        onClose={() => setAlertState((s) => ({ ...s, open: false }))}
      />
    </div>
  );
}
