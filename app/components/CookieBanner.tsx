'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Cookie consent banner.
 *
 * QuoteCore+ only sets strictly-necessary cookies today (Supabase auth
 * cookies + the short-lived `qcp_recovery` token used by the lost-email
 * recovery flow). Under the ePrivacy Directive, strictly-necessary cookies
 * are exempt from prior consent - but users still need to be informed that
 * cookies are in use. So this is a NOTICE, not a consent gate: dismissible
 * with a single click, no "reject" button needed because nothing is set
 * conditionally.
 *
 * The moment we add anything non-essential (analytics, advertising,
 * preference cookies set before the user authenticates), this component
 * MUST be upgraded to a full Accept-All / Reject-All / Customize banner
 * AND those non-essential cookies must NOT be set until the user accepts.
 *
 * State storage:
 *   - localStorage key `qcp_cookie_notice_dismissed_v1`
 *   - The `_v1` suffix is a manual cache-bust handle: if the cookie list
 *     materially changes we bump the version and the banner reappears.
 *   - We don't write to the DB. The user's "I've seen this" acknowledgement
 *     is per-browser, not per-account, which is the right shape for an
 *     informational notice that pre-dates authentication.
 */
const STORAGE_KEY = 'qcp_cookie_notice_dismissed_v1';

export function CookieBanner() {
  // Two-stage visibility:
  //   - `mounted` becomes true after the first client render so SSR HTML
  //     and the first paint never show the banner (avoids a flash).
  //   - `dismissed` is read from localStorage during that same effect; if
  //     the user has already acknowledged the notice we keep the banner
  //     hidden forever, regardless of how many times they log in/out.
  // This pattern is deliberately defensive: a single `useState(false)` +
  // `useEffect` toggle was previously firing a visible flash on slow
  // hydration paths, which read as "the banner keeps coming back".
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  // Classic hydration-marker pattern: set `mounted` once the client has
  // taken over so the banner never flashes during SSR/hydration mismatch.
  // React 19's set-state-in-effect rule flags this; the alternative
  // (`useSyncExternalStore`) is overkill for a single read.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
    try {
      const value = window.localStorage.getItem(STORAGE_KEY);
       
      setDismissed(Boolean(value));
    } catch {
      // localStorage can throw in private mode; fall back to showing.
       
      setDismissed(false);
    }
  }, []);

  const visible = mounted && !dismissed;

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* swallow - best-effort */
    }
    setDismissed(true);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50"
    >
      <div className="border-l-[3px] border-[#1D58B3] bg-[#EEF5FF] rounded-xl shadow-[0_10px_32px_rgba(25,27,32,0.12),0_2px_8px_rgba(25,27,32,0.06)] p-4 space-y-3">
        <div className="flex items-start gap-3">
          {/*
            Inline shield/lock SVG instead of an emoji. Stroke 1.6 keeps it
            visually balanced with the body text. We ship the icon inline so
            there's no extra HTTP request and no icon-library dependency.
          */}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.6}
            className="w-5 h-5 mt-0.5 flex-shrink-0 text-[#1D58B3]"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 5-3.4 8.5-8 9-4.6-.5-8-4-8-9V7l8-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.5l1.8 1.8 3.7-3.7" />
          </svg>
          <div className="text-sm text-[#191B20] leading-relaxed">
            QuoteCore<span className="text-[#FF6B35]">+</span> uses{' '}
            <strong>strictly-necessary cookies</strong> for sign-in and
            security. We don&apos;t use tracking or advertising cookies.
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/cookies"
            className="text-xs text-[#B63D0A] hover:text-[#8A2F08] underline transition-colors duration-150"
          >
            Read our cookie policy
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex items-center justify-center min-h-8 px-4 py-1.5 text-xs font-semibold rounded-full bg-[#191B20] text-white hover:bg-black hover:shadow-[0_4px_14px_rgba(255,107,53,0.2)] transition-all duration-150 ease-[cubic-bezier(0.2,0,0,1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#B63D0A]"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
