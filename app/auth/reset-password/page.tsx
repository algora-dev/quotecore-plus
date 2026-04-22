'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setStatus('saving');

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setStatus('error');
        setError(updateError.message);
      } else {
        setStatus('success');
        setTimeout(() => router.push('/login'), 2000);
      }
    } catch {
      setStatus('error');
      setError('Something went wrong. Please try again.');
    }
  }

  if (status === 'success') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Password Updated</h1>
            <p className="text-sm text-slate-500">Redirecting to login...</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2 text-center">Set New Password</h1>
          <p className="text-sm text-slate-500 mb-6 text-center">Enter your new password below</p>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4">
              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">New Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="••••••••"
                />
                <p className="text-xs text-slate-500 mt-1">At least 8 characters</p>
              </label>

              <label className="block">
                <span className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  minLength={8}
                  required
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="••••••••"
                />
              </label>

              {error && <p className="text-red-600 text-sm text-center">{error}</p>}

              <button
                type="submit"
                disabled={status === 'saving'}
                className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
              >
                {status === 'saving' ? 'Saving...' : 'Update Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
