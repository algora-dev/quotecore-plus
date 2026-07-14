'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { createFreeToolsClient } from '@/app/lib/supabase/free-client';

export interface FreeToolsTierInfo {
  tier: 1 | 2 | 3;
  hasAppAccount: boolean;
  limits: { imagePerDay: number; textPerDay: number; label: string };
}

interface FreeToolsAuthState {
  user: User | null;
  loading: boolean;
  /** Free-tools Supabase access token — sent to parse APIs for tiered limits */
  accessToken: string | null;
  /** Resolved tier info (null until fetched) */
  tierInfo: FreeToolsTierInfo | null;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  // Modal control — any component can open the auth modal
  isAuthModalOpen: boolean;
  openAuthModal: (mode?: 'signup' | 'signin') => void;
  closeAuthModal: () => void;
}

const FreeToolsAuthContext = createContext<FreeToolsAuthState>({
  user: null,
  loading: true,
  accessToken: null,
  tierInfo: null,
  signInWithGoogle: async () => {},
  signInWithEmail: async () => ({ error: null }),
  signUpWithEmail: async () => ({ error: null, needsConfirmation: false }),
  signOut: async () => {},
  isAuthModalOpen: false,
  openAuthModal: () => {},
  closeAuthModal: () => {},
});

export function FreeToolsAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [tierInfo, setTierInfo] = useState<FreeToolsTierInfo | null>(null);
  const [supabase] = useState(() => createFreeToolsClient());
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'signup' | 'signin'>('signup');

  useEffect(() => {
    let cancelled = false;

    // Hard timeout: if getSession() hangs (e.g. env vars missing at build
    // time → placeholder Supabase URL), render the unauthed UI instead of
    // an invisible loading state forever.
    const timeout = setTimeout(() => {
      if (!cancelled) setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      setLoading(false);
      clearTimeout(timeout);
    }).catch(() => {
      if (cancelled) return;
      setLoading(false);
      clearTimeout(timeout);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      setUser(session?.user ?? null);
      setAccessToken(session?.access_token ?? null);
      setLoading(false);
    });

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [supabase]);

  // Fetch tier info whenever the access token changes (login/logout/refresh)
  useEffect(() => {
    let cancelled = false;
    if (!accessToken) {
      setTierInfo(null);
      return;
    }
    fetch('/api/free-tools/account-status', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.tier) {
          setTierInfo({ tier: data.tier, hasAppAccount: data.hasAppAccount, limits: data.limits });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [accessToken]);

  const signInWithGoogle = async () => {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
  };

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) setIsAuthModalOpen(false);
    return { error: error?.message ?? null };
  };

  const signUpWithEmail = async (email: string, password: string) => {
    const redirectTo = typeof window !== 'undefined' ? window.location.origin + window.location.pathname : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirectTo },
    });
    return {
      error: error?.message ?? null,
      needsConfirmation: !error && !data.session,
    };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const openAuthModal = (mode: 'signup' | 'signin' = 'signup') => {
    setModalMode(mode);
    setIsAuthModalOpen(true);
  };

  const closeAuthModal = () => setIsAuthModalOpen(false);

  return (
    <FreeToolsAuthContext.Provider
      value={{
        user,
        loading,
        accessToken,
        tierInfo,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOut,
        isAuthModalOpen,
        openAuthModal,
        closeAuthModal,
      }}
    >
      {children}
      {isAuthModalOpen && (
        <FreeToolsAuthModal
          mode={modalMode}
          onClose={closeAuthModal}
          onModeChange={setModalMode}
          signInWithGoogle={signInWithGoogle}
          signInWithEmail={signInWithEmail}
          signUpWithEmail={signUpWithEmail}
        />
      )}
    </FreeToolsAuthContext.Provider>
  );
}

/** The modal is rendered at the provider level — no parent transform/blur can break fixed positioning. */
function FreeToolsAuthModal({
  mode,
  onClose,
  onModeChange,
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
}: {
  mode: 'signup' | 'signin';
  onClose: () => void;
  onModeChange: (mode: 'signup' | 'signin') => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
}) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-semibold text-slate-900">
            {mode === 'signup' ? 'Create your free account' : 'Log in'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {mode === 'signup'
            ? 'Get full access to all tools, remove watermarks, and save your work.'
            : 'Welcome back. Log in to access your saved tools.'}
        </p>

        {/* Google sign-in */}
        <button
          onClick={signInWithGoogle}
          className="mt-4 w-full flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">or</span>
          <div className="h-px flex-1 bg-slate-200" />
        </div>

        {/* Email form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setError('');
            setSuccess('');
            if (mode === 'signup') {
              const { error, needsConfirmation } = await signUpWithEmail(email, password);
              if (error) setError(error);
              else if (needsConfirmation) {
                setSuccess('Check your email - click the confirmation link to activate your account.');
                setEmail('');
                setPassword('');
              }
            } else {
              const { error } = await signInWithEmail(email, password);
              if (error) setError(error);
            }
          }}
          className="space-y-3"
        >
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#FF6B35] focus:outline-none"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={6}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-[#FF6B35] focus:outline-none"
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          {success && <p className="text-xs text-green-600">{success}</p>}
          <button
            type="submit"
            className="w-full rounded-full bg-[#FF6B35] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#ff5722] transition-colors"
          >
            {mode === 'signup' ? 'Create account' : 'Log in'}
          </button>
        </form>

        {/* Toggle mode */}
        <p className="mt-4 text-center text-xs text-slate-500">
          {mode === 'signup' ? (
            <>
              Already have an account?{' '}
              <button
                onClick={() => { onModeChange('signin'); setError(''); setSuccess(''); }}
                className="font-medium text-[#FF6B35] hover:text-[#ff5722]"
              >
                Log in
              </button>
            </>
          ) : (
            <>
              No account yet?{' '}
              <button
                onClick={() => { onModeChange('signup'); setError(''); setSuccess(''); }}
                className="font-medium text-[#FF6B35] hover:text-[#ff5722]"
              >
                Sign up free
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export function useFreeToolsAuth() {
  return useContext(FreeToolsAuthContext);
}
