'use client';

import { useState } from 'react';

export type MessageReplyAction =
  | 'accept'
  | 'decline'
  | 'request_changes'
  | 'question'
  | 'other';

export interface SentMessageReply {
  id: string;
  action: MessageReplyAction;
  body: string | null;
  created_at: string;
}

interface Props {
  id: string;
  subject: string;
  recipientEmail: string;
  recipientName: string | null;
  status: string;
  sentAt: string | null;
  createdAt: string;
  repliedAt: string | null;
  replies: SentMessageReply[];
}

/**
 * Single row in the SentMessagesPanel. Renders a compact header that
 * matches the server-component visual we shipped on 2026-05-12, but the
 * row is now clickable to expand and show the full reply detail (action
 * pill + body + timestamp).
 *
 * If there are no replies (the recipient hasn't responded yet), clicking
 * the row is still allowed but shows the recipient address detail only \u2014
 * useful for confirming what was sent.
 */
const ACTION_LABELS: Record<MessageReplyAction, string> = {
  accept: 'Accepted',
  decline: 'Declined',
  request_changes: 'Requested changes',
  question: 'Asked a question',
  other: 'Responded',
};

const ACTION_TONE: Record<MessageReplyAction, string> = {
  accept: 'bg-emerald-100 text-emerald-700',
  decline: 'bg-rose-100 text-rose-700',
  request_changes: 'bg-amber-100 text-amber-700',
  question: 'bg-blue-100 text-blue-700',
  other: 'bg-slate-100 text-slate-700',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SentMessageRow({
  subject,
  recipientEmail,
  recipientName,
  status,
  sentAt,
  createdAt,
  repliedAt,
  replies,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const hasReplies = replies.length > 0;

  return (
    <li className="py-2.5">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-4 text-left hover:bg-slate-50 -mx-2 px-2 py-1 rounded transition"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-900 truncate">{subject}</p>
          <p className="text-xs text-slate-500 truncate">
            To {recipientName ? `${recipientName} <${recipientEmail}>` : recipientEmail}
            {' \u00b7 '}
            {new Date(sentAt ?? createdAt).toLocaleDateString('en-GB', {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={status} replied={!!repliedAt} />
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {expanded ? (
        <div className="mt-2 ml-1 pl-3 border-l-2 border-slate-200 space-y-3">
          {!hasReplies ? (
            <p className="text-xs text-slate-500 italic">
              No response yet. We&apos;ll alert you here when the recipient replies.
            </p>
          ) : (
            replies.map((reply) => (
              <div key={reply.id} className="text-xs space-y-1.5">
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide font-medium ${ACTION_TONE[reply.action]}`}
                  >
                    {ACTION_LABELS[reply.action]}
                  </span>
                  <span className="text-slate-400">{formatDate(reply.created_at)}</span>
                </div>
                {reply.body ? (
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{reply.body}</p>
                ) : (
                  <p className="text-xs text-slate-400 italic">No message added by recipient.</p>
                )}
              </div>
            ))
          )}
        </div>
      ) : null}
    </li>
  );
}

function StatusPill({ status, replied }: { status: string; replied: boolean }) {
  if (replied) {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 whitespace-nowrap">
        Replied
      </span>
    );
  }
  if (status === 'sent') {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 whitespace-nowrap">
        Sent
      </span>
    );
  }
  if (status === 'suppressed') {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 whitespace-nowrap">
        Suppressed
      </span>
    );
  }
  if (status === 'failed') {
    return (
      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 whitespace-nowrap">
        Failed
      </span>
    );
  }
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
      {status}
    </span>
  );
}
