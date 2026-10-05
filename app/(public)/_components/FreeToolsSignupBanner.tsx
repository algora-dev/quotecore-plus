'use client';

import { useFreeToolsEmail } from './useFreeToolsEmail';

/**
 * Notification-style signup banner for free tool generator pages.
 * Must be rendered INSIDE <FreeToolsAuthProvider> so it can access the
 * auth context (openAuthModal, user, tierInfo, etc).
 *
 * v2.14 (2026-10-05): dark charcoal feature banner - orange gradient glow,
 * glint CTA. Copy + behaviour unchanged.
 *
 * - Not logged in: charcoal banner with signup CTA
 * - Logged in: shows email + tier limits + log out
 * - Loading: shows the signup CTA (never blank)
 */
export function FreeToolsSignupBanner() {
  const { email, isAuthed, clearLocalEmail, loadingEmail, openAuthModal, limitsLine, signOut } = useFreeToolsEmail();

  if (!loadingEmail && isAuthed) {
    return (
      <div className="print:hidden relative mb-6 overflow-hidden rounded-2xl bg-zinc-900 bg-gradient-to-br from-zinc-900 via-zinc-900 to-[#2b1a10] p-4 shadow-[0_16px_36px_rgba(9,9,11,0.24)]">
        <div aria-hidden className="pointer-events-none absolute -right-14 -top-16 h-36 w-36 rounded-full bg-[#FF6B35]/20 blur-3xl" />
        <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium text-white">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF6B35]" />
              {email}
            </p>
            <p className="mt-1 text-xs text-zinc-400">{limitsLine}</p>
          </div>
          <button
            onClick={() => { void signOut(); clearLocalEmail(); }}
            className="shrink-0 self-start rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white sm:self-auto"
          >
            Log out
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="print:hidden relative mb-6 overflow-hidden rounded-2xl bg-zinc-900 bg-gradient-to-br from-zinc-900 via-zinc-900 to-[#2b1a10] p-5 shadow-[0_16px_36px_rgba(9,9,11,0.24)]">
      <div aria-hidden className="pointer-events-none absolute -right-14 -top-16 h-36 w-36 rounded-full bg-[#FF6B35]/20 blur-3xl" />
      <div className="relative flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="text-sm text-zinc-200">
          <span className="font-semibold text-white">Save your work into QuoteCore+</span>
          <span className="mt-1 block text-xs text-zinc-400">Plans from $19/mo with a 30-day money-back guarantee</span>
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => openAuthModal('signup')}
            className="qc-glint rounded-full bg-[#FF6B35] bg-gradient-to-r from-[#FF6B35] to-[#FF8C1F] px-4 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(255,107,53,0.3)] transition-all hover:shadow-[0_14px_30px_rgba(255,107,53,0.42)] hover:brightness-105"
          >
            Sign up
          </button>
          <button
            onClick={() => openAuthModal('signin')}
            className="rounded-full border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}
