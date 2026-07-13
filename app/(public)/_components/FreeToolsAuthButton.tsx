'use client';

import { useState } from 'react';
import { useFreeToolsAuth } from './FreeToolsAuthProvider';

export function FreeToolsAuthButton({ compact = false }: { compact?: boolean }) {
  const { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut } = useFreeToolsAuth();
  const [showModal, setShowModal] = useState(false);
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500 hidden sm:inline max-w-[120px] truncate">{user.email}</span>
        <button
          onClick={signOut}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
        >
          Log out
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setMode('signin'); setError(''); setSuccess(''); setShowModal(true); }}
          className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors"
          title="Log in to your free tools account"
        >
          Log in
        </button>
        <button
          onClick={() => { setMode('signup'); setError(''); setSuccess(''); setShowModal(true); }}
          className="rounded-full bg-[#FF6B35] px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[#ff5722] hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
          title="Sign up free - get full access to all tools, remove watermarks, and save your work"
        >
          {compact ? 'Sign up' : 'Sign up free'}
        </button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-slate-900">
              {mode === 'signup' ? 'Create your free account' : 'Log in'}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
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
                  else setShowModal(false);
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
                    onClick={() => { setMode('signin'); setError(''); setSuccess(''); }}
                    className="font-medium text-[#FF6B35] hover:text-[#ff5722]"
                  >
                    Log in
                  </button>
                </>
              ) : (
                <>
                  No account yet?{' '}
                  <button
                    onClick={() => { setMode('signup'); setError(''); setSuccess(''); }}
                    className="font-medium text-[#FF6B35] hover:text-[#ff5722]"
                  >
                    Sign up free
                  </button>
                </>
              )}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
