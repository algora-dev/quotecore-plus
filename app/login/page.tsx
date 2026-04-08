
'use client';

import { useState, useTransition } from 'react';
import { loginAction } from './actions';

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <main className="max-w-md mx-auto my-10 px-4">
      <div className="text-center mb-6">
        <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block" />
      </div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Log in to QuoteCore</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          const formData = new FormData(e.currentTarget);

          startTransition(async () => {
            try {
              await loginAction(formData);
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Login failed');
            }
          });
        }}
      >
        <div className="grid gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Email</span>
            <input 
              name="email" 
              type="email" 
              required 
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="you@example.com"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Password</span>
            <input 
              name="password" 
              type="password" 
              required 
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="••••••••"
            />
          </label>

          <button 
            type="submit" 
            disabled={isPending}
            className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? 'Logging in...' : 'Log in'}
          </button>

          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Don't have an account?{' '}
        <a href="/signup" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">
          Sign up
        </a>
      </p>
    </main>
  );
}
