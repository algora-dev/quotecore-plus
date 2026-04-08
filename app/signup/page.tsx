
'use client';

import { useState, useTransition } from 'react';
import { signupWithCompany } from './actions';

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <main className="max-w-md mx-auto my-10 px-4">
      <div className="text-center mb-6">
        <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block" />
      </div>
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">Create your QuoteCore account</h1>
      <p className="text-slate-600 mb-6">Create your company and owner account in one step.</p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);

          const form = new FormData(e.currentTarget);
          const companyName = String(form.get('companyName') || '');
          const fullName = String(form.get('fullName') || '');
          const email = String(form.get('email') || '');
          const password = String(form.get('password') || '');

          startTransition(async () => {
            const result = await signupWithCompany({
              companyName,
              fullName,
              email,
              password,
            });

            if (!result?.ok) {
              setError(result?.error ?? 'Something went wrong.');
            }
          });
        }}
      >
        <div className="grid gap-4">
          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Company name</span>
            <input 
              name="companyName" 
              type="text" 
              required 
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="Your Company Ltd"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-slate-700 mb-1">Full name</span>
            <input 
              name="fullName" 
              type="text" 
              required 
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="John Smith"
            />
          </label>

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
              minLength={8} 
              required 
              className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
              placeholder="••••••••"
            />
            <p className="text-xs text-slate-500 mt-1">At least 8 characters</p>
          </label>

          <button 
            type="submit" 
            disabled={isPending}
            className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
          >
            {isPending ? 'Creating account...' : 'Create account'}
          </button>

          {error ? <p className="text-red-600 text-sm">{error}</p> : null}
        </div>
      </form>

      <p className="mt-6 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <a href="/login" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">
          Log in
        </a>
      </p>
    </main>
  );
}
