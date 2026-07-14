'use client';

import { useFreeToolsEmail } from './useFreeToolsEmail';

/**
 * Notification-style signup banner for free tool generator pages.
 * Must be rendered INSIDE <FreeToolsAuthProvider> so it can access the
 * auth context (openAuthModal, user, tierInfo, etc).
 *
 * - Not logged in: orange banner with signup CTA
 * - Logged in: shows email + tier limits + log out
 * - Loading: shows the signup CTA (never blank)
 */
export function FreeToolsSignupBanner() {
  const { email, isAuthed, clearLocalEmail, loadingEmail, openAuthModal, limitsLine } = useFreeToolsEmail();

  if (!loadingEmail && isAuthed) {
    return (
      <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 mb-6 print:hidden">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-700">✓ {email}</p>
            <p className="mt-1 text-xs text-slate-500">{limitsLine}</p>
          </div>
          <button onClick={clearLocalEmail} className="text-xs font-medium text-slate-400 hover:text-slate-600 transition">
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-orange-200 bg-orange-50/60 p-4 mb-6 print:hidden">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-700">
          Sign up with 1 click for higher daily limits and watermark removal for all tools
        </p>
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
