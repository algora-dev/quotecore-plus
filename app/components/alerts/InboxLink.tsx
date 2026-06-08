'use client';

import Link from 'next/link';

interface Props {
  workspaceSlug: string;
}

/**
 * Envelope icon in the top nav that opens the Message Center (/inbox).
 * Deliberately does NOT show an unread count — that's the bell's job (quick
 * recent alerts). This is just a clean, always-orange envelope with a hover
 * effect and a tooltip. Heroicons outline envelope, 24x24.
 */
export function InboxLink({ workspaceSlug }: Props) {
  return (
    <Link
      href={`/${workspaceSlug}/inbox`}
      prefetch={false}
      aria-label="Open your message center"
      title="Open your message center"
      data-assistant-id="nav-inbox"
      data-copilot="nav-inbox"
      className="group inline-flex items-center justify-center rounded-full p-2 transition-all hover:bg-orange-50 hover:shadow-[0_0_10px_rgba(255,107,53,0.35)]"
    >
      <svg
        className="w-5 h-5 text-orange-500 transition-transform group-hover:scale-110"
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
    </Link>
  );
}
