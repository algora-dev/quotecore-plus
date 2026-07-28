'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Props {
  workspaceSlug: string;
  unreadCount?: number;
}

const INBOX_SEEN_KEY = 'quotecore:inbox-seen';

/**
 * Envelope icon in the top nav that opens the Message Center (/inbox).
 * Shows an orange glow + unread badge when there are unread messages,
 * matching the AlertBell's visual treatment.
 *
 * Badge clears on click (like the bell) using a localStorage "seen" flag.
 * The server still tracks is_read independently in the Message Center.
 * Heroicons outline envelope, 24x24.
 */
export function InboxLink({ workspaceSlug, unreadCount = 0 }: Props) {
  const [dismissed, setDismissed] = useState(false);

  // On mount, check if the user has already acknowledged the current batch.
  useEffect(() => {
    if (unreadCount > 0) {
      const seen = localStorage.getItem(INBOX_SEEN_KEY);
      // If we've seen this exact count before, stay dismissed.
      if (seen === String(unreadCount)) {
        setDismissed(true);
      } else {
        setDismissed(false);
      }
    } else {
      setDismissed(false);
    }
  }, [unreadCount]);

  function handleClick() {
    // Mark as acknowledged immediately so the glow/badge disappears on click.
    if (unreadCount > 0) {
      localStorage.setItem(INBOX_SEEN_KEY, String(unreadCount));
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
