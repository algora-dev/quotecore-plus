'use client';

/**
 * Internal panel shown on the quote summary listing pending revision requests
 * submitted by the customer via the public acceptance URL. Each request shows
 * the customer's notes, when it arrived, contact info (if provided), and a
 * "Mark Resolved" button. Resolved requests collapse into a count.
 *
 * Replying: instead of forcing a `mailto:` button (which opens whichever
 * email client the OS thinks is default), we show the customer's email
 * address inline alongside a Copy-to-clipboard button. Most users prefer to
 * paste the address into their own browser-based mail client.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { resolveRevisionRequest } from '@/app/accept/[token]/actions';
import { AlertModal } from '@/app/components/AlertModal';

export interface RevisionRequest {
  id: string;
  notes: string;
  customer_name: string | null;
  customer_email: string | null;
  source_state: 'active' | 'expired' | 'responded' | 'withdrawn';
  created_at: string;
  resolved_at: string | null;
}

interface Props {
  requests: RevisionRequest[];
  /** Customer name from the quote, used as a fallback when the request didn't include one. */
  fallbackCustomerName: string;
  /** Quote number kept on the props for future use (e.g. richer reply UX). Currently unused. */
  quoteNumber: number | null;
}

const STATE_BADGE: Record<RevisionRequest['source_state'], { label: string; cls: string }> = {
  active: { label: 'Active quote', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  responded: { label: 'After response', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
  expired: { label: 'Expired link', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  withdrawn: { label: 'After withdrawal', cls: 'bg-purple-50 text-purple-700 border-purple-200' },
};

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function RevisionRequestsPanel({ requests, fallbackCustomerName, quoteNumber: _quoteNumber }: Props) {
  const pending = requests.filter((r) => !r.resolved_at);
  const resolved = requests.filter((r) => r.resolved_at);

  // Default-open when there's something to act on, default-closed when only
  // resolved history remains.
  const [expanded, setExpanded] = useState(pending.length > 0);
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  /** Per-request "Copied!" feedback timeout. */
  const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null);
  /** App-style alert state replaces native alert() in this panel. */
  const [alertState, setAlertState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    variant?: 'info' | 'success' | 'error';
  }>({ open: false, title: '' });
  const closeAlert = () => setAlertState((s) => ({ ...s, open: false }));
  const [, startTransition] = useTransition();
  const router = useRouter();

  // Don't render anything if there's no history at all — keeps the summary clean.
  if (requests.length === 0) return null;

  async function copyEmail(req: RevisionRequest) {
    if (!req.customer_email) return;
    try {
      await navigator.clipboard.writeText(req.customer_email);
      setCopiedRequestId(req.id);
      // Reset the "Copied!" feedback after 1.5s so the button returns to normal.
      window.setTimeout(() => setCopiedRequestId((cur) => (cur === req.id ? null : cur)), 1500);
    } catch {
      // Clipboard can fail in non-secure contexts — fall back to a modal so
      // the user can still grab the address.
      setAlertState({
        open: true,
        title: 'Could not copy',
        description: `Couldn't reach the clipboard. The email is:\n\n${req.customer_email}`,
        variant: 'info',
      });
    }
  }

  function handleResolve(id: string) {
    setResolvingId(id);
    startTransition(async () => {
      try {
        await resolveRevisionRequest(id);
        router.refresh();
      } catch (err) {
        console.error('[resolveRevisionRequest] failed:', err);
        setAlertState({
          open: true,
          title: 'Failed to resolve request',
          description: err instanceof Error ? err.message : 'Unknown error',
          variant: 'error',
        });
      } finally {
        setResolvingId(null);
      }
    });
  }

  return (
    <div className={`rounded-2xl border ${pending.length > 0 ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200 bg-white'} p-4`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center ${pending.length > 0 ? 'bg-orange-100' : 'bg-slate-100'}`}>
            <svg className={`w-5 h-5 ${pending.length > 0 ? 'text-orange-600' : 'text-slate-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {pending.length > 0
                ? `${pending.length} re-quote ${pending.length === 1 ? 'request' : 'requests'} pending`
                : `Re-quote requests (${resolved.length} resolved)`}
            </p>
            <p className="text-xs text-slate-500">
              Customer-submitted via the acceptance link.
            </p>
          </div>
        </div>
        <svg className={`w-4 h-4 text-slate-500 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-4 space-y-3">
          {pending.map((req) => {
            const badge = STATE_BADGE[req.source_state];
            return (
              <div key={req.id} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <p className="text-sm font-medium text-slate-900">
                      {req.customer_name || fallbackCustomerName || 'Customer'}
                    </p>
                    <p className="text-xs text-slate-500">{formatTimestamp(req.created_at)}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg px-3 py-2">
                  {req.notes}
                </p>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Email + Copy: show the actual customer email inline so the user
                      can grab it into whichever mail client they use, instead of being
                      forced through a `mailto:` handler. */}
                  {req.customer_email ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 pl-3 pr-1 py-1 text-xs text-slate-700">
                      <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      <span className="select-all font-medium break-all">{req.customer_email}</span>
                      <button
                        type="button"
                        onClick={() => copyEmail(req)}
                        className="ml-1 rounded-full bg-white border border-slate-300 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 flex-shrink-0"
                        title="Copy email address to clipboard"
                      >
                        {copiedRequestId === req.id ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No email provided</span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleResolve(req.id)}
                    disabled={resolvingId === req.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {resolvingId === req.id ? 'Resolving...' : 'Mark resolved'}
                  </button>
                </div>
              </div>
            );
          })}

          {resolved.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowResolved((v) => !v)}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
              >
                {showResolved ? 'Hide' : 'Show'} {resolved.length} resolved
              </button>
              {showResolved && (
                <div className="mt-2 space-y-2">
                  {resolved.map((req) => (
                    <div key={req.id} className="rounded-lg border border-slate-200 bg-white p-3 opacity-75">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div>
                          <p className="text-xs font-medium text-slate-700">
                            {req.customer_name || fallbackCustomerName || 'Customer'}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            Submitted {formatTimestamp(req.created_at)} · Resolved {req.resolved_at ? formatTimestamp(req.resolved_at) : ''}
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{req.notes}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <AlertModal
        open={alertState.open}
        title={alertState.title}
        description={alertState.description}
        variant={alertState.variant}
        onClose={closeAlert}
      />
    </div>
  );
}
