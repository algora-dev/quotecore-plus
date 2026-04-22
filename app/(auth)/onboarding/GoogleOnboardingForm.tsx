'use client';

import { useState, useTransition } from 'react';
import { completeGoogleOnboarding } from './actions';

export function GoogleOnboardingForm({ defaultName }: { defaultName: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const form = new FormData(e.currentTarget);

        startTransition(async () => {
          try {
            await completeGoogleOnboarding(form);
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
            defaultValue={defaultName}
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
  );
}
