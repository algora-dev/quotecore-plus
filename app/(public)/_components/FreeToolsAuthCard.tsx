'use client';

import { useFreeToolsEmail } from './useFreeToolsEmail';

/**
 * Auth status card for free tool pages.
 * - Not authed: shows "Sign up free" + "Log in" buttons (opens shared auth modal)
 * - Authed: shows email + logout
 * - No loading state — always shows content immediately.
 */
export function FreeToolsAuthCard() {
  const { email, isAuthed, signOut, openAuthModal, limitsLine } = useFreeToolsEmail();

  if (isAuthed && email) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-700">✓ {email}</p>
            <p className="mt-1 text-xs text-slate-400">{limitsLine}</p>
          </div>
          <button
            onClick={signOut}
            className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 mb-6 print:hidden">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-700">
            Sign up free to remove QuoteCore+ branding &amp; get more daily generations
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Image upload: 3/day · Text parse: 5/day · Manual: Unlimited
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => openAuthModal('signup')}
            className="rounded-full bg-[#FF6B35] px-4 py-2 text-xs font-semibold text-white hover:bg-[#ff5722] transition whitespace-nowrap"
          >
            Sign up free
          </button>
          <button
            onClick={() => openAuthModal('signin')}
            className="text-xs font-medium text-slate-500 hover:text-slate-900 transition whitespace-nowrap"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}
