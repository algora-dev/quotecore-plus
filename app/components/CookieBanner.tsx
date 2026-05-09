'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Cookie consent banner.
 *
 * QuoteCore+ only sets strictly-necessary cookies today (Supabase auth
 * cookies + the short-lived `qcp_recovery` token used by the lost-email
 * recovery flow). Under the ePrivacy Directive, strictly-necessary cookies
 * are exempt from prior consent — but users still need to be informed that
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
  // Start hidden so SSR + first paint don't flash the banner; we'll show it
  // on the client once we've checked localStorage.
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY);
      if (!dismissed) setVisible(true);
    } catch {
      // localStorage can throw in private mode / SSR; default to showing.
      setVisible(true);
    }
  }, []);

  function dismiss() {
    try {
      window.localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    } catch {
      /* swallow — best-effort */
    }
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50"
    >
      <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-4 space-y-3">
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
            className="w-5 h-5 mt-0.5 flex-shrink-0 text-slate-500"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v5c0 5-3.4 8.5-8 9-4.6-.5-8-4-8-9V7l8-4z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.5 12.5l1.8 1.8 3.7-3.7" />
          </svg>
          <div className="text-sm text-slate-700 leading-relaxed">
            QuoteCore<span className="text-orange-500">+</span> uses{' '}
            <strong>strictly-necessary cookies</strong> for sign-in and
            security. We don&apos;t use tracking or advertising cookies.
          </div>
        </div>
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/cookies"
            className="text-xs text-slate-500 hover:text-orange-600 underline transition-colors"
          >
            Read our cookie policy
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="px-4 py-1.5 text-xs font-semibold rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
