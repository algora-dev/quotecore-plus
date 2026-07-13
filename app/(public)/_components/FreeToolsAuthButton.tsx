'use client';

import { useFreeToolsAuth } from './FreeToolsAuthProvider';

export function FreeToolsAuthButton({ compact = false }: { compact?: boolean }) {
  const { user, loading, signOut, openAuthModal } = useFreeToolsAuth();

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
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
