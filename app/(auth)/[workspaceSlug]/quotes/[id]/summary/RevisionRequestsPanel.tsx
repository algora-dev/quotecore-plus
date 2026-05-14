'use client';

/**
 * Internal panel shown on the quote summary listing pending revision requests
 * submitted by the customer via the public acceptance URL. Each request shows
 * the customer's notes, when it arrived, contact info (if provided), and a
 * "Mark Resolved" button. Resolved requests collapse into a count.
 *
 * 2026-05-13: brought into parity with the Sent Messages panel. The
 * "Select" / multi-select bar, "Select all" / "Clear all", "Resolve
 * selected" and "Delete selected" affordances now mirror the messages
 * UX exactly so the user only has to learn one pattern. The two
 * domains stay separate underneath (different DB tables, different
 * action semantics) \u2014 a future "Unified inbox" can merge them once
 * the data shapes converge.
 *
 * Replying: instead of forcing a `mailto:` button (which opens whichever
 * email client the OS thinks is default), we show the customer's email
 * address inline alongside a Copy-to-clipboard button. Most users prefer to
 * paste the address into their own browser-based mail client.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  resolveRevisionRequest,
  bulkResolveRevisionRequests,
  bulkDeleteRevisionRequests,
} from '@/app/accept/[token]/actions';
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
  /** When true the panel renders its inner content only (no outer
   *  card, no expand/collapse header) because the ActivityCard parent
   *  hosts the chrome via a tab. Default false preserves every
   *  existing standalone usage. */
  chromeless?: boolean;
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

export function RevisionRequestsPanel({ requests, fallbackCustomerName, quoteNumber: _quoteNumber, chromeless = false }: Props) {
  // Raw partitions — the optimistic-aware versions are computed
  // below once the optimistic state hooks are declared.
  const rawPending = requests.filter((r) => !r.resolved_at);
  const rawResolved = requests.filter((r) => r.resolved_at);

  // Default-open when there's something to act on, default-closed when only
  // resolved history remains.
  const [expanded, setExpanded] = useState(rawPending.length > 0);
  const [showResolved, setShowResolved] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  /** Per-request "Copied!" feedback timeout. */
  const [copiedRequestId, setCopiedRequestId] = useState<string | null>(null);

  // Multi-select state \u2014 mirrors SentMessagesList behaviour.
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmingBulk, setConfirmingBulk] = useState<null | 'resolve' | 'delete'>(null);
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkPending, startBulkTransition] = useTransition();

  // Optimistic UI sets. The server-action + refresh path is ~500ms
  // which feels slow on a quick click-then-click-again flow. We
  // mutate locally first and let the refresh deliver canonical state.
  // Roll back on server error so the user can retry.
  const [optimisticResolvedIds, setOptimisticResolvedIds] = useState<Set<string>>(new Set());
  const [optimisticDeletedIds, setOptimisticDeletedIds] = useState<Set<string>>(new Set());

  // Optimistic-aware partitions used by the rest of the component.
  // A row that's been optimistically deleted disappears entirely; one
  // that's been optimistically resolved moves from pending to
  // resolved. The server refresh later replaces these with canonical
  // state.
  const pending = rawPending.filter(
    (r) => !optimisticDeletedIds.has(r.id) && !optimisticResolvedIds.has(r.id),
  );
  const resolved = [
    ...rawResolved.filter((r) => !optimisticDeletedIds.has(r.id)),
    ...rawPending
      .filter((r) => optimisticResolvedIds.has(r.id) && !optimisticDeletedIds.has(r.id))
      // Synthetic resolved_at so downstream renderers (which check
      // truthiness of resolved_at) treat these as resolved.
      .map((r) => ({ ...r, resolved_at: new Date().toISOString() })),
  ];

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

  // Don't render anything if there's no history at all \u2014 keeps the summary clean.
  if (requests.length === 0 && !chromeless) return null;

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmingBulk(null);
    setBulkError(null);
  }

  function toggleSelectMode() {
    if (selectMode) exitSelectMode();
    else setSelectMode(true);
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Multi-select operates over both pending and resolved — the user
  // might want to delete resolved noise. "Select all" covers every row
  // that's currently visible in the panel (pending always; resolved
  // only if the user has expanded the resolved drawer).
  function visibleIds(): string[] {
    const ids = pending.map((r) => r.id);
    if (showResolved) ids.push(...resolved.map((r) => r.id));
    return ids;
  }

  function selectAllVisible() {
    setSelected(new Set(visibleIds()));
  }

  function clearAll() {
    setSelected(new Set());
  }

  // Single-row delete — used by the inline hover affordance on resolved
  // rows so the user doesn't have to enter select mode just to drop one
  // piece of noise. Mirrors the inline delete on Sent Messages rows.
  const [singleDeletingId, setSingleDeletingId] = useState<string | null>(null);
  const [singleConfirmingId, setSingleConfirmingId] = useState<string | null>(null);
  function handleSingleDelete(id: string) {
    setSingleDeletingId(id);
    // Optimistic remove.
    setOptimisticDeletedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setSingleConfirmingId(null);
    startTransition(async () => {
      const result = await bulkDeleteRevisionRequests([id]);
      if (result.ok) {
        router.refresh();
      } else {
        // Roll back.
        setOptimisticDeletedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setAlertState({
          open: true,
          title: 'Failed to delete request',
          description: result.error,
          variant: 'error',
        });
      }
      setSingleDeletingId(null);
    });
  }

  function runBulk() {
    if (selected.size === 0 || confirmingBulk === null) return;
    setBulkError(null);
    const ids = Array.from(selected);
    const action = confirmingBulk;
    // Optimistic apply.
    if (action === 'resolve') {
      setOptimisticResolvedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
    } else {
      setOptimisticDeletedIds((prev) => {
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
    }
    exitSelectMode();
    startBulkTransition(async () => {
      const result =
        action === 'resolve'
          ? await bulkResolveRevisionRequests(ids)
          : await bulkDeleteRevisionRequests(ids);
      if (result.ok) {
        router.refresh();
      } else {
        // Roll back the optimistic mutation.
        if (action === 'resolve') {
          setOptimisticResolvedIds((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.delete(id);
            return next;
          });
        } else {
          setOptimisticDeletedIds((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.delete(id);
            return next;
          });
        }
        setBulkError(result.error);
      }
    });
  }

  async function copyEmail(req: RevisionRequest) {
    if (!req.customer_email) return;
    try {
      await navigator.clipboard.writeText(req.customer_email);
      setCopiedRequestId(req.id);
      // Reset the "Copied!" feedback after 1.5s so the button returns to normal.
      window.setTimeout(() => setCopiedRequestId((cur) => (cur === req.id ? null : cur)), 1500);
    } catch {
      // Clipboard can fail in non-secure contexts \u2014 fall back to a modal so
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
    // Optimistic resolve.
    setOptimisticResolvedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    startTransition(async () => {
      try {
        await resolveRevisionRequest(id);
        router.refresh();
      } catch (err) {
        // Roll back.
        setOptimisticResolvedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
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

  // "All visible selected" — every row currently in the panel is in
  // the selected set. We use this to flip the Select-all toggle
  // between "Select all" and "Clear all".
  const visibleCount = pending.length + (showResolved ? resolved.length : 0);
  const allVisibleSelected = visibleCount > 0 && selected.size === visibleCount;

  // Bulk bar is rendered both at the top and bottom of the list so it's
  // discoverable the instant the user enters select mode, even when
  // there are zero pending rows and the only thing on screen is the
  // "Show N resolved" toggle.
  const renderBulkBar = (placement: 'top' | 'bottom') => {
    if (!selectMode) return null;
    return (
      <div
        className={`flex items-center justify-between gap-3 flex-wrap ${
          placement === 'top'
            ? 'pb-3 mb-1 border-b border-slate-200'
            : 'pt-3 mt-1 border-t border-slate-200'
        }`}
      >
        <span className="text-xs text-slate-600">
          {selected.size === 0
            ? placement === 'top'
              ? 'Tick the requests you want to action'
              : 'Select requests to action'
            : `${selected.size} selected`}
        </span>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {bulkError ? (
            <span className="text-[11px] text-rose-600">{bulkError}</span>
          ) : null}
          {confirmingBulk !== null ? (
            <>
              <button
                type="button"
                onClick={runBulk}
                disabled={bulkPending}
                className={`px-3 py-1 text-[11px] font-medium rounded-full text-white disabled:opacity-50 ${
                  confirmingBulk === 'delete'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {bulkPending
                  ? 'Working\u2026'
                  : confirmingBulk === 'delete'
                    ? `Confirm delete ${selected.size}`
                    : `Confirm resolve ${selected.size}`}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingBulk(null)}
                disabled={bulkPending}
                className="text-[11px] text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={exitSelectMode}
                className="text-[11px] text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              {pending.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setConfirmingBulk('resolve')}
                  disabled={selected.size === 0}
                  className="px-3 py-1 text-[11px] font-medium rounded-full bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Mark resolved
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setConfirmingBulk('delete')}
                disabled={selected.size === 0}
                className="px-3 py-1 text-[11px] font-medium rounded-full bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                Delete selected
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  // Chromeless empty state so the parent tab shows a friendly
  // "nothing here yet" message instead of the multi-select bar.
  if (chromeless && requests.length === 0) {
    return (
      <div className="px-1 py-6 text-center text-xs text-slate-500">
        No customer change requests yet. They&apos;ll show up here if a
        customer hits &ldquo;Request changes&rdquo; on the acceptance page.
      </div>
    );
  }

  return (
    <div className={chromeless ? "" : `rounded-2xl border ${pending.length > 0 ? 'border-orange-300 bg-orange-50/40' : 'border-slate-200 bg-white'} p-4`}>
      {!chromeless ? (
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
      ) : null}

      {(expanded || chromeless) && (
        <div className={chromeless ? "space-y-3" : "mt-4 space-y-3"}>
          {/* Select toolbar — promoted to a visible pill button so the
              user can find it. Available whenever there's at least one
              row in the panel (resolved-only counts; the user has to
              be able to delete noise). */}
          {requests.length >= 1 && !selectMode ? (
            <div className="flex items-center justify-end">
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Select to delete / resolve
              </button>
            </div>
          ) : null}
          {selectMode ? (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={allVisibleSelected ? clearAll : selectAllVisible}
                className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition"
              >
                {allVisibleSelected ? 'Clear all' : 'Select all'}
              </button>
              <span className="text-[11px] text-slate-400">
                Tap a request to tick it
              </span>
            </div>
          ) : null}

          {renderBulkBar('top')}

          {pending.map((req) => {
            const badge = STATE_BADGE[req.source_state];
            const isSelected = selected.has(req.id);
            return (
              <div
                key={req.id}
                role={selectMode ? 'button' : undefined}
                tabIndex={selectMode ? 0 : undefined}
                onClick={selectMode ? () => toggleOne(req.id) : undefined}
                onKeyDown={
                  selectMode
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleOne(req.id);
                        }
                      }
                    : undefined
                }
                className={`rounded-xl border p-4 space-y-3 ${
                  selectMode && isSelected
                    ? 'border-slate-400 bg-slate-50 cursor-pointer'
                    : selectMode
                      ? 'border-slate-200 bg-white cursor-pointer hover:bg-slate-50'
                      : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3">
                    {selectMode ? (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleOne(req.id)}
                        onClick={(e) => e.stopPropagation()}
                        aria-label="Select request"
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                      />
                    ) : null}
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {req.customer_name || fallbackCustomerName || 'Customer'}
                      </p>
                      <p className="text-xs text-slate-500">{formatTimestamp(req.created_at)}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>

                <p className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 rounded-lg px-3 py-2">
                  {req.notes}
                </p>

                {/* Action row hidden in select mode \u2014 the bulk bar at the
                    bottom owns actions then. */}
                {!selectMode ? (
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
                          onClick={(e) => { e.stopPropagation(); copyEmail(req); }}
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
                      onClick={(e) => { e.stopPropagation(); handleResolve(req.id); }}
                      disabled={resolvingId === req.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {resolvingId === req.id ? 'Resolving...' : 'Mark resolved'}
                    </button>
                  </div>
                ) : null}
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
                  {resolved.map((req) => {
                    const isSelected = selected.has(req.id);
                    return (
                      <div
                        key={req.id}
                        role={selectMode ? 'button' : undefined}
                        tabIndex={selectMode ? 0 : undefined}
                        onClick={selectMode ? () => toggleOne(req.id) : undefined}
                        className={`rounded-lg border p-3 ${
                          selectMode && isSelected
                            ? 'border-slate-400 bg-slate-50 cursor-pointer'
                            : selectMode
                              ? 'border-slate-200 bg-white opacity-75 cursor-pointer hover:bg-slate-50'
                              : 'border-slate-200 bg-white opacity-75'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-start gap-3">
                            {selectMode ? (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleOne(req.id)}
                                onClick={(e) => e.stopPropagation()}
                                aria-label="Select request"
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                              />
                            ) : null}
                            <div>
                              <p className="text-xs font-medium text-slate-700">
                                {req.customer_name || fallbackCustomerName || 'Customer'}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                Submitted {formatTimestamp(req.created_at)}
                                {' \u00b7 '}
                                Resolved {req.resolved_at ? formatTimestamp(req.resolved_at) : ''}
                              </p>
                            </div>
                          </div>
                          {/* Inline single-row delete affordance for
                              resolved rows. Hidden in select mode — the
                              bulk bar owns deletion then. Two-click
                              confirm so a wrong tap doesn't drop history. */}
                          {!selectMode ? (
                            singleConfirmingId === req.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); handleSingleDelete(req.id); }}
                                  disabled={singleDeletingId === req.id}
                                  className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                                >
                                  {singleDeletingId === req.id ? 'Removing\u2026' : 'Confirm'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); setSingleConfirmingId(null); }}
                                  disabled={singleDeletingId === req.id}
                                  className="text-[11px] text-slate-500 hover:text-slate-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setSingleConfirmingId(req.id); }}
                                title="Delete this resolved request"
                                aria-label="Delete this resolved request"
                                className="p-1 rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            )
                          ) : null}
                        </div>
                        <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{req.notes}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Bulk action bar — bottom placement. Top placement is
              rendered above by `renderBulkBar('top')` so the user can
              find actions immediately on entering select mode. */}
          {renderBulkBar('bottom')}
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
