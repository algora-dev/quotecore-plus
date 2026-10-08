'use client';

/**
 * Client panel for the admin support-ticket detail page: reply box,
 * status pills and priority pills. Server actions live in ./actions.
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  replyToSupportTicket,
  setSupportTicketStatus,
  setSupportTicketPriority,
} from './actions';

interface Props {
  ticketId: string;
  status: string;
  priority: string;
}

const STATUSES = [
  { value: 'open', label: 'Open' },
  { value: 'pending', label: 'Pending' },
  { value: 'resolved', label: 'Resolved' },
] as const;

const PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;

const PRIORITY_TONE: Record<string, string> = {
  urgent: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  normal: 'bg-slate-100 text-slate-700 border-slate-200',
  low: 'bg-slate-50 text-slate-500 border-slate-200',
};

export default function TicketDetailPanel({ ticketId, status, priority }: Props) {
  const router = useRouter();
  const [reply, setReply] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [sending, setSending] = useState(false);

  async function handleReply() {
    const trimmed = reply.trim();
    if (trimmed.length < 2) {
      setError('Reply is empty.');
      return;
    }
    setError(null);
    setNotice(null);
    setSending(true);
    const result = await replyToSupportTicket(ticketId, trimmed);
    setSending(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReply('');
    setNotice('Reply sent — user emailed a copy.');
    startTransition(() => router.refresh());
  }

  function handleStatus(next: string) {
    if (next === status) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setSupportTicketStatus(ticketId, next);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  function handlePriority(next: string) {
    if (next === priority) return;
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await setSupportTicketPriority(ticketId, next);
      if (!result.ok) setError(result.error);
      else router.refresh();
    });
  }

  const busy = pending || sending;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Status</p>
            <div className="flex items-center gap-2 mt-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  disabled={busy}
                  onClick={() => handleStatus(s.value)}
                  className={[
                    'px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
                    s.value === status
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400',
                  ].join(' ')}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Priority</p>
            <div className="flex items-center gap-2 mt-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={busy}
                  onClick={() => handlePriority(p)}
                  className={[
                    'px-3 py-1.5 rounded-full border text-xs font-medium capitalize transition-colors',
                    p === priority
                      ? 'bg-slate-900 text-white border-slate-900'
                      : PRIORITY_TONE[p],
                  ].join(' ')}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
        <label htmlFor="admin-reply" className="text-sm font-medium text-slate-900">
          Reply to user
        </label>
        <textarea
          id="admin-reply"
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={5}
          maxLength={8000}
          disabled={busy}
          placeholder="Type your reply. The user gets it in the app and by email."
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none resize-y disabled:bg-slate-50"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400">{reply.trim().length.toLocaleString()} / 8,000</p>
          <button
            type="button"
            onClick={handleReply}
            disabled={busy}
            className="px-5 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      </div>

      {error ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          {notice}
        </p>
      ) : null}
    </div>
  );
}
