'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  cancelScheduledMessage,
  forceRunScheduledMessage,
} from '@/app/lib/messages/scheduled';
import type {
  ScheduledStatus,
  ScheduledTriggerEvent,
} from '@/app/lib/messages/scheduled-types';

export interface ScheduledRowDisplay {
  id: string;
  templateName: string | null;
  recipientEmail: string;
  recipientName: string | null;
  triggerEvent: ScheduledTriggerEvent;
  fireAt: string;
  status: ScheduledStatus;
  firedAt: string | null;
  cancelledReason: string | null;
  failedError: string | null;
}

interface Props {
  rows: ScheduledRowDisplay[];
}

const TRIGGER_LABEL: Record<ScheduledTriggerEvent, string> = {
  quote_sent: 'After quote was sent',
  quote_accepted: 'After acceptance',
  quote_declined: 'After decline',
  quote_revision_requested: 'After revision request',
  manual: 'Starting now',
};

const STATUS_BADGE: Record<ScheduledStatus, { label: string; cls: string }> = {
  scheduled: { label: 'Scheduled', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  sent: { label: 'Sent', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  cancelled: { label: 'Cancelled', cls: 'bg-slate-50 text-slate-700 border-slate-200' },
  suppressed: { label: 'Suppressed', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  failed: { label: 'Failed', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
};

/** Sentinel year used by pending-event scheduled rows (year 9999).
 *  Detect via getUTCFullYear() so a real future row in 2026/2027 still
 *  renders normally. */
function isPendingEventFireAt(iso: string): boolean {
  const d = new Date(iso);
  return d.getUTCFullYear() >= 9000;
}

function formatFireTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * One per-row outcome banner shown briefly after the user clicks
 * "Send now" or "Cancel". Replaces the previous silent flip-and-hope
 * UX where the user had to scan small grey text on the row to figure
 * out what happened.
 *
 * `kind='success'` for completed sends, `kind='warning'` for
 * dispatcher auto-cancels (the safety net caught the customer
 * already responded), `kind='error'` for failed sends.
 */
interface RowOutcome {
  kind: 'success' | 'warning' | 'error' | 'info';
  text: string;
}

const OUTCOME_STYLES: Record<RowOutcome['kind'], string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  warning: 'border-amber-200 bg-amber-50 text-amber-800',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-slate-200 bg-slate-50 text-slate-700',
};

/**
 * "Scheduled" subsection above the Sent Messages list.
 *
 * Splits rows into two groups:
 *   - Active (status='scheduled'): rendered prominently with Send now
 *     and Cancel actions.
 *   - History (anything else): collapsed by default; toggleable via a
 *     "Show N past follow-ups" link so the panel doesn't get cluttered
 *     once a quote has accumulated several runs.
 *
 * Inline action feedback: clicking Send now or Cancel shows a short
 * outcome banner on the row instead of silently flipping status.
 * The banner stays until the user takes another action so they can
 * read what happened.
 */
export function ScheduledMessagesList({ rows }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [outcomeByRow, setOutcomeByRow] = useState<Record<string, RowOutcome>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [, startTransition] = useTransition();

  // Optimistic-hide set for rows the user just cancelled. The server
  // call is fast but router.refresh() can take 300-800ms to re-render
  // the parent server component, so we hide the row IMMEDIATELY and
  // let the refresh deliver the canonical state. If the cancel fails
  // we remove the id from this set so the row reappears with an
  // error banner. Same idea for the inline Cancel + Send now paths.
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<Set<string>>(new Set());

  if (rows.length === 0) return null;

  const activeRows = rows.filter((r) => r.status === 'scheduled' && !optimisticHiddenIds.has(r.id));
  const historyRows = rows.filter((r) => r.status !== 'scheduled');

  function pickCancelTone(reason: string | null): RowOutcome['kind'] {
    if (!reason) return 'info';
    if (reason === 'cancelled_by_user') return 'info';
    return 'warning'; // dispatcher-decided cancels (accepted/declined/etc)
  }

  function handleCancel(id: string) {
    setPendingId(id);
    setOutcomeByRow((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
    // Hide the row immediately so the user sees the cancel land
    // instantly. Refresh delivers the canonical state behind the
    // scenes; on success the history rows surface the cancellation
    // and the optimistic hide is irrelevant. On failure we unhide.
    setOptimisticHiddenIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    startTransition(async () => {
      const result = await cancelScheduledMessage(id);
      if (result.ok) {
        router.refresh();
      } else {
        // Unhide so the user can see the row + the error banner.
        setOptimisticHiddenIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        setOutcomeByRow((prev) => ({
          ...prev,
          [id]: { kind: 'error', text: result.error },
        }));
      }
      setPendingId(null);
    });
  }

  function handleForceRun(id: string) {
    setPendingId(id);
    setOutcomeByRow((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
    startTransition(async () => {
      const result = await forceRunScheduledMessage(id);
      if (result.ok) {
        // The server-side dispatcher decides between sent / cancelled
        // / failed / suppressed. We don't know which here, so we
        // refresh and let the row's new status drive a follow-up
        // outcome message on the next render (see syncOutcomeFromRow
        // call below).
        router.refresh();
        // Optimistic friendly message; replaced once the refresh
        // lands a real status on the row.
        setOutcomeByRow((prev) => ({
          ...prev,
          [id]: { kind: 'info', text: 'Sending now\u2026' },
        }));
      } else {
        setOutcomeByRow((prev) => ({
          ...prev,
          [id]: { kind: 'error', text: result.error },
        }));
      }
      setPendingId(null);
    });
  }

  /**
   * After a router.refresh() the row prop arrives with its final
   * status. We translate that into a banner so the user immediately
   * sees what happened. Only fires when there's a pending optimistic
   * banner already (i.e. the user actually pressed a button) so we
   * don't spam outcomes on every page render.
   */
  function syncOutcomeFromRow(row: ScheduledRowDisplay) {
    const current = outcomeByRow[row.id];
    if (!current) return null;

    // Skip if the row is still pending another action.
    if (pendingId === row.id) return current;

    // Status->outcome mapping. We only auto-derive an outcome when
    // the optimistic banner is the placeholder \"Sending now\u2026\"; if
    // the user just cancelled we keep that banner verbatim.
    if (current.text !== 'Sending now\u2026') return current;

    switch (row.status) {
      case 'sent':
        return { kind: 'success' as const, text: 'Sent. The email is on its way.' };
      case 'cancelled':
        return {
          kind: 'warning' as const,
          text: row.cancelledReason
            ? `Not sent. ${row.cancelledReason} You ticked the safety toggle; untick it on a new schedule if you want to send anyway.`
            : 'Not sent. The dispatcher cancelled this follow-up.',
        };
      case 'failed':
        return {
          kind: 'error' as const,
          text: row.failedError ? `Failed: ${row.failedError}` : 'Send failed. Check the logs.',
        };
      case 'suppressed':
        return {
          kind: 'warning' as const,
          text: 'Suppressed. The recipient is on your suppression list and was not emailed.',
        };
      default:
        return current;
    }
  }

  function renderRow(row: ScheduledRowDisplay, opts: { actionable: boolean }) {
    const badge = STATUS_BADGE[row.status];
    const outcome = syncOutcomeFromRow(row);
    return (
      <li
        key={row.id}
        className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs"
      >
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${badge.cls}`}>
                {badge.label}
              </span>
              <span className="text-slate-700 font-medium">
                {row.templateName ?? 'Email template'}
              </span>
            </div>
            <p className="text-slate-500 mt-0.5">
              To{' '}
              {row.recipientName
                ? `${row.recipientName} <${row.recipientEmail}>`
                : row.recipientEmail}
            </p>
            <p className="text-slate-500">
              {row.status === 'scheduled' && isPendingEventFireAt(row.fireAt) ? (
                <>
                  <span className="text-slate-700 font-medium">
                    Waiting for {row.triggerEvent === 'quote_accepted' ? 'acceptance' : row.triggerEvent === 'quote_declined' ? 'decline' : 'event'}
                  </span>
                  <span className="text-slate-400">{' \u00b7 '}{TRIGGER_LABEL[row.triggerEvent]}</span>
                </>
              ) : (
                <>
                  {row.status === 'scheduled'
                    ? 'Sends '
                    : row.status === 'sent'
                      ? 'Sent '
                      : 'Was due '}
                  <span className="text-slate-700 font-medium">{formatFireTime(row.fireAt)}</span>
                  <span className="text-slate-400">{' \u00b7 '}{TRIGGER_LABEL[row.triggerEvent]}</span>
                </>
              )}
            </p>
            {/* Inline reason copy stays for history rows so the user can
                always see WHY a row ended up cancelled / failed without
                relying on the transient outcome banner. */}
            {row.status === 'cancelled' && row.cancelledReason && row.cancelledReason !== 'cancelled_by_user' ? (
              <p className="text-slate-400 italic mt-0.5">{row.cancelledReason}</p>
            ) : null}
            {row.status === 'failed' && row.failedError ? (
              <p className="text-rose-600 italic mt-0.5">{row.failedError}</p>
            ) : null}
          </div>
          {opts.actionable && row.status === 'scheduled' ? (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => handleForceRun(row.id)}
                disabled={pendingId === row.id}
                title="Send this scheduled message right now instead of waiting for the next cron tick"
                className="px-3 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                {pendingId === row.id ? 'Sending\u2026' : 'Send now'}
              </button>
              <button
                type="button"
                onClick={() => handleCancel(row.id)}
                disabled={pendingId === row.id}
                className="px-3 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
              >
                {pendingId === row.id ? 'Cancelling\u2026' : 'Cancel'}
              </button>
            </div>
          ) : null}
        </div>
        {/* Action outcome banner. Stays until the next action on this
            row clears it, so the user has time to read what happened. */}
        {outcome ? (
          <div
            className={`mt-2 rounded-md border px-2 py-1.5 text-[11px] flex items-start justify-between gap-2 ${OUTCOME_STYLES[outcome.kind]}`}
          >
            <span className="flex-1">{outcome.text}</span>
            <button
              type="button"
              onClick={() =>
                setOutcomeByRow((prev) => {
                  const { [row.id]: _drop, ...rest } = prev;
                  return rest;
                })
              }
              className="opacity-60 hover:opacity-100"
              aria-label="Dismiss"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : null}
      </li>
    );
  }

  return (
    <div className="space-y-2 pb-3 border-b border-slate-100">
      <div className="flex items-center gap-2">
        <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Scheduled
        </h3>
        {activeRows.length === 0 ? (
          <span className="text-[10px] text-slate-400">none active</span>
        ) : null}
      </div>

      {activeRows.length > 0 ? (
        <ul className="space-y-1.5">
          {activeRows.map((row) => renderRow(row, { actionable: true }))}
        </ul>
      ) : null}

      {historyRows.length > 0 ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="text-[11px] text-slate-500 hover:text-slate-700 underline"
          >
            {showHistory ? 'Hide' : 'Show'} {historyRows.length} past follow-up{historyRows.length === 1 ? '' : 's'}
          </button>
          {showHistory ? (
            <ul className="space-y-1.5 mt-2 opacity-90">
              {historyRows.map((row) => renderRow(row, { actionable: false }))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
