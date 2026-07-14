'use client';

import { useFreeToolsAuth } from './FreeToolsAuthProvider';

export function FreeToolsAuthButton({ compact = false }: { compact?: boolean }) {
  const { user, loading, signOut, openAuthModal, tierInfo } = useFreeToolsAuth();

  if (loading) {
    // Skeleton placeholder — never render an empty header slot
    return (
      <div className="flex items-center gap-2" aria-hidden="true">
        <div className="h-7 w-14 rounded-full bg-slate-100 animate-pulse" />
        <div className="h-7 w-20 rounded-full bg-slate-100 animate-pulse" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        {tierInfo?.hasAppAccount && (
          <span className="hidden sm:inline rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-[#FF6B35]">App account</span>
        )}
        <span className="text-xs text-slate-500 hidden sm:inline max-w-[120px] truncate">{user.email}</span>
        <button
          onClick={signOut}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900 transition-colors"
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
        className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
      >
        Log in
      </button>
      <button
        onClick={() => openAuthModal('signup')}
        className="rounded-full bg-[#FF6B35] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        {compact ? 'Sign up' : 'Sign up free'}
      </button>
    </div>
  );
}
