'use client';

import { useFreeToolsAuth } from './FreeToolsAuthProvider';

export function FreeToolsAuthButton({ compact = false }: { compact?: boolean }) {
  const { user, loading, signOut, openAuthModal, tierInfo } = useFreeToolsAuth();

  if (loading) {
    // Skeleton placeholder - never render an empty header slot
    return (
      <div className="flex items-center gap-2" aria-hidden="true">
        <div className="h-7 w-14 rounded-xl bg-zinc-100 animate-pulse" />
        <div className="h-7 w-20 rounded-xl bg-zinc-100 animate-pulse" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {tierInfo?.hasAppAccount && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-[#BD4A1A]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#FF6B35]" />
            App account
          </span>
        )}
        <span className="hidden sm:inline max-w-[120px] truncate rounded-full border border-zinc-200 bg-white/70 px-2.5 py-1 text-xs text-zinc-600">
          {user.email}
        </span>
        <button
          onClick={signOut}
          className="qc-glint rounded-xl border border-zinc-300 bg-white/70 px-3 py-2 text-xs font-medium text-zinc-900 transition-colors hover:border-[#FF6B35]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B63D0A] focus-visible:ring-offset-2"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => openAuthModal('signin')}
        className="qc-glint rounded-xl border border-zinc-300 bg-white/70 px-3 py-2 text-xs font-medium text-zinc-900 transition-colors hover:border-[#FF6B35]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B63D0A] focus-visible:ring-offset-2"
      >
        Tool login
      </button>
      <button
        onClick={() => openAuthModal('signup')}
        className="qc-glint rounded-xl border border-zinc-300 bg-white/70 px-3.5 py-2 text-xs font-semibold text-zinc-900 transition-colors hover:border-[#FF6B35]/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#B63D0A] focus-visible:ring-offset-2"
      >
        {compact ? 'Tool account' : 'Free tools account'}
      </button>
    </div>
  );
}
