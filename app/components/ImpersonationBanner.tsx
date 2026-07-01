'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { endImpersonation } from '@/app/admin/(dashboard)/users/[userId]/actions';

/**
 * Persistent banner shown when an admin is impersonating a user.
 * Renders at the top of every page via the workspace layout.
 *
 * Gerald H-01: the admin's real Supabase auth session is never modified.
 * This banner is the visual safety indicator. If it fails to render,
 * the admin can still navigate to /admin to exit.
 */
export function ImpersonationBanner({
  adminEmail,
  targetEmail,
}: {
  adminEmail: string | null;
  targetEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function exit() {
    startTransition(async () => {
      const res = await endImpersonation();
      if (res.ok && res.redirect) {
        router.push(res.redirect);
      }
    });
  }

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span>
          <strong>Impersonating</strong> {targetEmail}
          {adminEmail && <span className="opacity-80"> (as {adminEmail})</span>}
        </span>
      </div>
      <button
        type="button"
        onClick={exit}
        disabled={pending}
        className="flex-shrink-0 rounded-full bg-white/20 hover:bg-white/30 px-4 py-1 text-xs font-semibold transition disabled:opacity-50"
      >
        {pending ? 'Exiting…' : 'Exit impersonation'}
      </button>
    </div>
  );
}
