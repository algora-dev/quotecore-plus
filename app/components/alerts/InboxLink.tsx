'use client';

import Link from 'next/link';

interface Props {
  workspaceSlug: string;
  unreadCount: number;
}

/**
 * Envelope icon in the top nav that opens the Message Center (/inbox).
 * Sits next to the alert bell. Shows an unread badge mirroring the bell's
 * count (same alerts table). Heroicons outline envelope, 24x24.
 */
export function InboxLink({ workspaceSlug, unreadCount }: Props) {
  return (
    <Link
      href={`/${workspaceSlug}/inbox`}
      prefetch={false}
      aria-label="Message Center"
      title="Message Center"
      className="relative inline-flex items-center justify-center rounded-full p-2 hover:bg-slate-100 transition"
    >
      <svg
        className={`w-5 h-5 ${unreadCount > 0 ? 'text-orange-500' : 'text-slate-500'}`}
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
      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </Link>
  );
}
