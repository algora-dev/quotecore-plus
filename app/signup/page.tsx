
'use client';

import { useState, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { signupWithCompany } from './actions';
import { GoogleSignInButton } from '@/app/components/auth/GoogleSignInButton';
import { PublicFooter } from '@/app/components/PublicFooter';
import { PasswordField } from '@/app/components/ui/PasswordField';

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupFallback />}>
      <SignupForm />
    </Suspense>
  );
}

function SignupFallback() {
  return (
    <main className="min-h-screen flex flex-col bg-slate-50 px-4">
      <div className="w-full max-w-md mx-auto my-auto py-10">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block" />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-2/3 mx-auto mb-4" />
          <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto mb-8" />
          <div className="h-10 bg-slate-100 rounded mb-4" />
          <div className="h-10 bg-slate-100 rounded mb-4" />
          <div className="h-10 bg-slate-100 rounded mb-4" />
          <div className="h-10 bg-slate-100 rounded mb-4" />
          <div className="h-10 bg-slate-100 rounded" />
        </div>
      </div>
      <PublicFooter />
    </main>
  );
}

function SignupForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const refSlug = searchParams.get('ref');
  const draftId = searchParams.get('draft');

  // Contextual message based on where they came from
  const refLabel = refSlug === 'free-roofing-calculator' ? 'Roofing Calculator'
    : refSlug === 'free-birds-mouth-calculator' ? "Bird's Mouth Calculator"
    : refSlug === 'free-construction-calculator' ? 'Construction Calculator'
    : refSlug === 'free-concrete-calculator' ? 'Concrete Calculator'
    : refSlug === 'free-landscaping-calculator' ? 'Landscaping Calculator'
    : refSlug ? 'Free Calculator' : null;

  return (
    <main className="min-h-screen flex flex-col bg-slate-50 px-4">
      <div className="w-full max-w-md mx-auto my-auto py-10">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2 text-center">Create your account</h1>
          <p className="text-slate-500 text-sm mb-6 text-center">Get started with QuoteCore in seconds</p>

          {/* Draft context banner */}
          {refLabel && draftId && (
            <div className="mb-6 rounded-xl bg-orange-50/60 border border-orange-100 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-900">Your calculator work is saved</p>
                  <p className="text-xs text-slate-600 mt-1">
                    We saved your {refLabel} draft on this device. After you create your account,
                    we&apos;ll restore it as a reusable Smart Component in your workspace.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Google Sign-Up */}
          <GoogleSignInButton />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-slate-400">or sign up with email</span>
            </div>
          </div>

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
                // Persist draft context in cookies so it survives email confirmation
                if (refSlug) {
                  document.cookie = `qcp_signup_ref=${refSlug}; path=/; max-age=${60*60*24*7}; SameSite=Lax`;
                }
                if (draftId) {
                  document.cookie = `qcp_signup_draft=${draftId}; path=/; max-age=${60*60*24*7}; SameSite=Lax`;
                }

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
                <PasswordField
                  name="password"
                  minLength={8}
                  required
                  inputClassName="w-full px-4 py-3 pr-12 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
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

              {error && <p className="text-red-600 text-sm text-center">{error}</p>}
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">
            Log in
          </Link>
        </p>
      </div>
      <PublicFooter />
    </main>
  );
}
