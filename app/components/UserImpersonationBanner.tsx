'use client';

/**
 * Banner shown to the REAL user when an admin is actively impersonating them.
 * Unlike the admin's ImpersonationBanner, this is informational only —
 * the user cannot exit it. It disappears once the admin ends the session
 * (ended_at is set) or the 30-minute TTL expires.
 */
export function UserImpersonationBanner() {
  return (
    <div className="bg-blue-600 text-white px-4 py-2 flex items-center gap-2 text-sm">
      <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>
        A QuoteCore+ team member is currently viewing your account. Please avoid making changes until they're done.
      </span>
    </div>
  );
}
