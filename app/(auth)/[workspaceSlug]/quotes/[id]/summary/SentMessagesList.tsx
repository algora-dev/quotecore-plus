'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  SentMessageRow,
  type SentMessageReply,
  type MessageReplyAction,
} from './SentMessageRow';
import { deleteSentMessagesBulk } from './sent-message-delete-actions';

export interface SentMessageListItem {
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
   * When `status === 'suppressed'`, this carries the matching
   * `message_suppressions.reason` (nullable) and the
   * `message_suppressions.created_at`. Used by the row to render an
   * inline amber banner explaining why the send was blocked.
   * Null for non-suppressed messages.
   */
  suppressionReason?: string | null;
  suppressionAt?: string | null;
}

interface Props {
  messages: SentMessageListItem[];
}

/**
 * Client wrapper around the sent-messages list that owns multi-select
 * state and the bulk-delete affordance.
 *
 * Selection model:
 *   - Off by default; row renders the existing inline delete affordance
 *     so a quick single-message delete still works.
 *   - When the user clicks "Select" in the header (rendered by the
 *     server panel) it flips into selection mode, each row shows a
 *     checkbox, and a bulk action bar appears at the bottom.
 *   - "Select all" toggle is in the bulk action bar; ESC / Cancel
 *     leaves selection mode.
 *
 * The bulk delete uses a single round-trip server action so deleting
 * 10 messages costs one network call, not ten.
 */
export function SentMessagesList({ messages }: Props) {
  const router = useRouter();
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  // Optimistic-hide set: rows the user just deleted disappear
  // immediately while the server roundtrip + refresh complete. On
  // failure we unhide so the error banner makes sense.
  const [optimisticHiddenIds, setOptimisticHiddenIds] = useState<Set<string>>(new Set());
  const visibleMessages = messages.filter((m) => !optimisticHiddenIds.has(m.id));

  function exitSelectMode() {
    setSelectMode(false);
    setSelected(new Set());
    setConfirming(false);
    setError(null);
  }

  function toggleSelectMode() {
    if (selectMode) {
      exitSelectMode();
    } else {
      setSelectMode(true);
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(visibleMessages.map((m) => m.id)));
  }

  function clearAll() {
    setSelected(new Set());
  }

  function handleBulkDelete() {
    if (selected.size === 0) return;
    setError(null);
    const ids = Array.from(selected);
    // Hide selected rows IMMEDIATELY — the perceived speedup is the
    // whole point. router.refresh() takes the canonical state.
    setOptimisticHiddenIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      return next;
    });
    exitSelectMode();
    startTransition(async () => {
      const result = await deleteSentMessagesBulk(ids);
      if (result.ok) {
        router.refresh();
      } else {
        // Unhide so the user can retry; surface the error.
        setOptimisticHiddenIds((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
        setError(result.error);
      }
    });
  }

  const allSelected = selected.size === visibleMessages.length && visibleMessages.length > 0;

  return (
    <>
      {/* Toolbar \u2014 selection-mode toggle. Sits above the list and only
          shows when there's more than one message (single message is
          better served by the inline row delete). */}
      {visibleMessages.length > 1 ? (
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={toggleSelectMode}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition"
          >
            {selectMode ? 'Done' : 'Select'}
          </button>
          {selectMode ? (
            <button
              type="button"
              onClick={allSelected ? clearAll : selectAll}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-800 transition"
            >
              {allSelected ? 'Clear all' : 'Select all'}
            </button>
          ) : null}
        </div>
      ) : null}

      <ul className="divide-y divide-slate-100">
        {visibleMessages.map((m) => (
          <SentMessageRow
            key={m.id}
            id={m.id}
            subject={m.subject}
            recipientEmail={m.recipientEmail}
            recipientName={m.recipientName}
            status={m.status}
            sentAt={m.sentAt}
            createdAt={m.createdAt}
            repliedAt={m.repliedAt}
            replies={m.replies}
            suppressionReason={m.suppressionReason ?? null}
            suppressionAt={m.suppressionAt ?? null}
            selectMode={selectMode}
            selected={selected.has(m.id)}
            onToggleSelect={() => toggleOne(m.id)}
          />
        ))}
      </ul>

      {/* Bulk action bar \u2014 pinned bottom of the panel when in select mode. */}
      {selectMode ? (
        <div className="flex items-center justify-between gap-3 pt-3 mt-1 border-t border-slate-100">
          <span className="text-xs text-slate-600">
            {selected.size === 0
              ? 'Select messages to delete'
              : `${selected.size} selected`}
          </span>
          <div className="flex items-center gap-2">
            {error ? <span className="text-[11px] text-rose-600">{error}</span> : null}
            {confirming ? (
              <>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  disabled={isPending}
                  className="px-3 py-1 text-[11px] font-medium rounded-full bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50"
                >
                  {isPending ? 'Removing\u2026' : `Confirm delete ${selected.size}`}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  disabled={isPending}
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
                <button
                  type="button"
                  onClick={() => setConfirming(true)}
                  disabled={selected.size === 0}
                  className="px-3 py-1 text-[11px] font-medium rounded-full bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  Delete selected
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
