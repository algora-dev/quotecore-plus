'use client';

import { useState, useTransition } from 'react';
import { completeOnboarding } from './actions';

export default function OnboardingPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2 text-center">Welcome to QuoteCore!</h1>
          <p className="text-slate-500 text-sm mb-6 text-center">
            Just a couple of details to set up your workspace.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              const form = new FormData(e.currentTarget);

              startTransition(async () => {
                try {
                  await completeOnboarding(form);
                } catch (err) {
                  setError(err instanceof Error ? err.message : 'Something went wrong');
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
                <span className="block text-sm font-medium text-slate-700 mb-1">Your name</span>
                <input
                  name="fullName"
                  type="text"
                  required
                  className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="John Smith"
                />
              </label>

              <button
                type="submit"
                disabled={isPending}
                className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
              >
                {isPending ? 'Setting up...' : 'Get Started'}
              </button>

              {error && <p className="text-red-600 text-sm text-center">{error}</p>}
            </div>
          </form>
        </div>
      </div>
    </main>
  );
}
