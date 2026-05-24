'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { deleteSentMessage } from './sent-message-delete-actions';

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
  /**
   * Suppression context. When `status === 'suppressed'` and a matching
   * `message_suppressions` row exists, these surface the reason / when
   * the suppression was added so the row can explain why the send was
   * blocked. Without this Shaun has no visible signal that a send was
   * dropped - the row just sits there.
   */
  suppressionReason?: string | null;
  suppressionAt?: string | null;
  /**
   * When the parent panel is in multi-select mode, the row replaces
   * its inline delete affordance with a checkbox and clicking the row
   * toggles selection instead of expanding the reply detail. The
   * default behaviour (selectMode omitted/false) preserves the
   * original single-row UX so callers that don't need bulk delete
   * (e.g. future surfaces) don't have to wire selection.
   */
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
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
  id,
  subject,
  recipientEmail,
  recipientName,
  status,
  sentAt,
  createdAt,
  repliedAt,
  replies,
  suppressionReason = null,
  suppressionAt = null,
  selectMode = false,
  selected = false,
  onToggleSelect,
}: Props) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasReplies = replies.length > 0;

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteSentMessage(id);
      if (result.ok) {
        router.refresh();
      } else {
        setDeleteError(result.error);
        setConfirmDelete(false);
      }
    });
  }

  return (
    <li className="py-2.5 group">
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (selectMode) {
            onToggleSelect?.();
          } else {
            setExpanded((v) => !v);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (selectMode) {
              onToggleSelect?.();
            } else {
              setExpanded((v) => !v);
            }
          }
        }}
        className={`w-full flex items-center justify-between gap-4 text-left -mx-2 px-2 py-1 rounded transition cursor-pointer ${
          selectMode && selected ? 'bg-slate-100' : 'hover:bg-slate-50'
        }`}
      >
        {selectMode ? (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect?.()}
            onClick={(e) => e.stopPropagation()}
            aria-label="Select message"
            className="shrink-0 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
          />
        ) : null}
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
          {/* Hover-revealed delete affordance. Hidden while the panel
              is in multi-select mode - the parent bulk action bar owns
              deletion in that case. Two-click confirm to avoid
              accidental removal of a long alert thread. */}
          {selectMode ? null : confirmDelete ? (
            <>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="px-2 py-0.5 text-[11px] font-medium rounded-full bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isPending ? 'Removing…' : 'Confirm delete'}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setConfirmDelete(false); }}
                disabled={isPending}
                className="px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
              title="Delete this message"
              aria-label="Delete this message"
              data-message-id={id}
              className="p-1 rounded-full text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition opacity-0 group-hover:opacity-100"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
      {deleteError ? (
        <p className="mt-1 ml-1 text-[11px] text-rose-600">{deleteError}</p>
      ) : null}

      {status === 'suppressed' ? (
        <SuppressionBanner reason={suppressionReason} suppressedAt={suppressionAt} />
      ) : null}

      {expanded && !selectMode ? (
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

function SuppressionBanner({
  reason,
  suppressedAt,
}: {
  reason: string | null;
  suppressedAt: string | null;
}) {
  return (
    <div className="mt-2 ml-1 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] leading-relaxed text-amber-900">
      <svg
        className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-600"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
      <div className="min-w-0">
        <p className="font-medium">Not sent - recipient is on your suppression list.</p>
        <p className="mt-0.5 text-amber-800">
          {reason ? <>Reason: {reason}. </> : <>No reason recorded. </>}
          {suppressedAt ? (
            <>Suppressed on {formatDate(suppressedAt)}.</>
          ) : null}{' '}
          Remove from <span className="font-medium">Admin › Suppressions</span> to re-enable
          sends.
        </p>
      </div>
    </div>
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
