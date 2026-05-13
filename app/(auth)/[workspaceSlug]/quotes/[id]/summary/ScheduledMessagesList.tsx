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
  isAdmin: boolean;
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
 * Renders the "Scheduled" subsection above the Sent Messages list.
 * Shows up to 10 most-recent rows for the quote. Each scheduled-state
 * row has a Cancel button; admin users also see a "Send now" button
 * for force-running the dispatcher locally.
 *
 * Non-scheduled rows (sent/cancelled/suppressed/failed) render as
 * compact history entries so the user can see "we tried to send X on
 * Y but the customer had already accepted" without spelunking through
 * the audit log.
 */
export function ScheduledMessagesList({ rows }: Props) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errorByRow, setErrorByRow] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();

  if (rows.length === 0) return null;

  function handleCancel(id: string) {
    setPendingId(id);
    setErrorByRow((prev) => ({ ...prev, [id]: '' }));
    startTransition(async () => {
      const result = await cancelScheduledMessage(id);
      if (result.ok) {
        router.refresh();
      } else {
        setErrorByRow((prev) => ({ ...prev, [id]: result.error }));
      }
      setPendingId(null);
    });
  }

  function handleForceRun(id: string) {
    setPendingId(id);
    setErrorByRow((prev) => ({ ...prev, [id]: '' }));
    startTransition(async () => {
      const result = await forceRunScheduledMessage(id);
      if (result.ok) {
        router.refresh();
      } else {
        setErrorByRow((prev) => ({ ...prev, [id]: result.error }));
      }
      setPendingId(null);
    });
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
      </div>
      <ul className="space-y-1.5">
        {rows.map((row) => {
          const badge = STATUS_BADGE[row.status];
          const rowError = errorByRow[row.id];
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
                    {row.status === 'scheduled' ? 'Sends ' : row.status === 'sent' ? 'Sent ' : 'Was due '}
                    <span className="text-slate-700 font-medium">{formatFireTime(row.fireAt)}</span>
                    <span className="text-slate-400">{' · '}{TRIGGER_LABEL[row.triggerEvent]}</span>
                  </p>
                  {row.status === 'cancelled' && row.cancelledReason ? (
                    <p className="text-slate-400 italic mt-0.5">{row.cancelledReason}</p>
                  ) : null}
                  {row.status === 'failed' && row.failedError ? (
                    <p className="text-rose-600 italic mt-0.5">{row.failedError}</p>
                  ) : null}
                  {rowError ? (
                    <p className="text-rose-600 mt-1">{rowError}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {row.status === 'scheduled' ? (
                    <>
                      {row.isAdmin ? (
                        <button
                          type="button"
                          onClick={() => handleForceRun(row.id)}
                          disabled={pendingId === row.id}
                          title="Force-run this scheduled message now (admin only)"
                          className="px-3 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                        >
                          Send now
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => handleCancel(row.id)}
                        disabled={pendingId === row.id}
                        className="px-3 py-1 text-xs font-medium rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 disabled:opacity-50 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
                      >
                        {pendingId === row.id ? 'Cancelling\u2026' : 'Cancel'}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
