'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Props {
  workspaceSlug: string;
  /** Stable per-session key so the banner reappears on each fresh login. */
  sessionTag: string;
}

const DISMISS_PREFIX = 'qcp-trialfree-dismissed:';

/**
 * Dismissible banner shown after a trial rolls into the Free tier.
 *
 * Server decides WHETHER to render this (only when the company is on Free via an
 * expired trial). This client wrapper handles the "close" + "show again each
 * login" behaviour: we remember dismissal in sessionStorage (cleared when the
 * browser session ends / they log in fresh), so it pops once per session and
 * stays gone for the rest of that session once closed.
 */
export function TrialRolledToFreeBanner({ workspaceSlug, sessionTag }: Props) {
  const [open, setOpen] = useState(false);
  const key = DISMISS_PREFIX + sessionTag;

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(key) !== 'yes') setOpen(true);
    } catch {
      setOpen(true);
    }
  }, [key]);

  if (!open) return null;

  function dismiss() {
    setOpen(false);
    try {
      window.sessionStorage.setItem(key, 'yes');
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="border-b border-amber-300 bg-amber-50 text-amber-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          <span className="font-semibold">You&apos;re now on the Free plan.</span>{' '}
          <span className="opacity-90">
            Your 14-day trial has ended and your account rolled into Free - you can still create up to
            5 quotes a month and send by link. Upgrade any time to unlock the full toolkit.
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/${workspaceSlug}/account?tab=billing`}
            prefetch={false}
            className="inline-flex items-center justify-center whitespace-nowrap rounded-full bg-black px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          >
            See plans
          </Link>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss"
            className="rounded-full p-1.5 text-amber-700 hover:bg-amber-100 hover:text-amber-900"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
