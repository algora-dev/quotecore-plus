'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Props {
  workspaceSlug: string;
  userId: string;
  unreadCount?: number;
  /** ID of the newest unread (is_read=false, status=active) alert. */
  latestUnreadAlertId?: string | null;
}

/** Per-user/per-workspace seen marker (scoped like AlertBell's key). */
function inboxSeenKey(workspaceSlug: string, userId: string): string {
  return `quotecore:inbox-seen:${workspaceSlug}:${userId}`;
}

/**
 * Envelope icon in the top nav that opens the Message Center (/inbox).
 * Shows an orange glow + unread badge when there are unread messages,
 * matching the AlertBell's visual treatment.
 *
 * Badge dismissal is keyed to the IDENTITY of the newest unread alert (same
 * model as AlertBell), never the count. The old model stored the unread
 * count, so a repeated count after new mail stayed wrongly dismissed (owner
 * report 2026-10-20: clicked at 2, then 2 new alerts arrived and no badge
 * showed). With identity-keyed dismissal any new mail gets a new newest
 * alert ID and the badge always re-shows. The server still tracks is_read
 * independently in the Message Center. Heroicons outline envelope, 24x24.
 */
export function InboxLink({
  workspaceSlug,
  userId,
  unreadCount = 0,
  latestUnreadAlertId = null,
}: Props) {
  const [dismissed, setDismissed] = useState(false);

  // Dismissed only when the stored marker equals the CURRENT newest unread
  // alert ID. No unread mail (or identity unavailable): never show a stale
  // badge; unknown identity while unread exists: fail open to showing.
  useEffect(() => {
    if (unreadCount <= 0 || !latestUnreadAlertId) {
      setDismissed(false);
      return;
    }
    const seen = localStorage.getItem(inboxSeenKey(workspaceSlug, userId));
    setDismissed(seen === latestUnreadAlertId);
  }, [unreadCount, latestUnreadAlertId, workspaceSlug, userId]);

  function handleClick() {
    // Mark as acknowledged immediately so the glow/badge disappears on click.
    if (unreadCount > 0 && latestUnreadAlertId) {
      localStorage.setItem(inboxSeenKey(workspaceSlug, userId), latestUnreadAlertId);
      setDismissed(true);
    }
  }

  const showBadge = unreadCount > 0 && !dismissed;

  return (
    <Link
      href={`/${workspaceSlug}/inbox`}
      prefetch={false}
      onClick={handleClick}
      aria-label="Open your message center"
      title="Open your message center"
      data-assistant-id="nav-inbox"
      data-copilot="nav-inbox"
      className={`group relative inline-flex items-center justify-center rounded-full p-2 transition-all ${
        showBadge
          ? 'bg-orange-50 shadow-[0_0_10px_rgba(255,107,53,0.35)] hover:bg-orange-100'
          : 'hover:bg-orange-50 hover:shadow-[0_0_10px_rgba(255,107,53,0.35)]'
      }`}
    >
      <svg
        className={`w-5 h-5 transition-all group-hover:scale-110 ${
          showBadge
            ? 'text-orange-500'
            : 'text-slate-900 group-hover:text-orange-500'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
        />
      </svg>

      {/* Unread badge - matches AlertBell's pulsing badge */}
      {showBadge && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-4 w-4 bg-orange-500 items-center justify-center text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        </span>
      )}
    </Link>
  );
}
