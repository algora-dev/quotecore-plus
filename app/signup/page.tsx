'use client';

import { QcJourney } from '@/app/components/ui/v2/QcJourney';
import { useState, useTransition, Suspense, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { setHandoffCookie } from '@/app/(public)/shared/appOrigin';
import { FreeToolsWelcomeModal } from '@/app/(public)/shared/FreeToolsWelcomeModal';
import { sendSignupLinkAction } from './actions';
import { GoogleSignInButton } from '@/app/components/auth/GoogleSignInButton';
import { PublicFooter } from '@/app/components/PublicFooter';

export default function SignupPage() {
  return (
    <QcJourney><Suspense fallback={<SignupFallback />}>
      <SignupForm />
    </Suspense></QcJourney>
  );
}

function SignupFallback() {
  return (
    <main className="qc-flow-auth flex flex-col px-4">
      <div className="w-full max-w-md mx-auto my-auto py-10">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block" />
        </div>
        <div className="qc-flow-auth-card animate-pulse">
          <div className="h-8 bg-slate-100 rounded w-2/3 mx-auto mb-4" />
          <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto mb-8" />
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
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const refSlug = searchParams.get('ref');
  const draftId = searchParams.get('draft');

  // Persist draft context in cookies IMMEDIATELY (not just on email-form
  // submit) so the Google OAuth path inherits it too - the OAuth redirect
  // leaves this page before any submit handler runs. Cross-subdomain
  // cookies so the context survives the marketing - app domain hops.
  useEffect(() => {
    if (refSlug) setHandoffCookie('qcp_signup_ref', refSlug);
    if (draftId) setHandoffCookie('qcp_signup_draft', draftId);
  }, [refSlug, draftId]);

  // Contextual message based on where they came from
  const refLabel = refSlug === 'free-roofing-calculator' ? 'Roofing Calculator'
    : refSlug === 'free-birds-mouth-calculator' ? "Bird's Mouth Calculator"
    : refSlug === 'free-construction-calculator' ? 'Construction Calculator'
    : refSlug === 'free-concrete-calculator' ? 'Concrete Calculator'
    : refSlug === 'free-landscaping-calculator' ? 'Landscaping Calculator'
    : refSlug === 'free-quote-generator' ? 'Quote Generator'
    : refSlug === 'free-invoice-generator' ? 'Invoice Generator'
    : refSlug === 'free-purchase-order-generator' ? 'Purchase Order Generator'
    : refSlug === 'free-order-generator' ? 'Purchase Order Generator'
    : refSlug ? 'Free Tool' : null;

  return (
    <QcJourney><main className="qc-flow-auth flex flex-col px-4">
      <FreeToolsWelcomeModal refSlug={refSlug || ''} hasDraft={!!draftId} />
      <div className="w-full max-w-md mx-auto my-auto py-10">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block" />
        </div>

        <div className="qc-flow-auth-card">
          <h1 className="text-2xl font-semibold text-slate-900 mb-2 text-center">Create your free workspace</h1>
          <p className="qc-flow-auth-note">Free to use, no card needed. Enter your email and we&apos;ll send you a link that opens your workspace.</p>

          {/* Draft context banner */}
          {refLabel && draftId && (
            <div className="mt-6 rounded-xl bg-orange-50/60 border border-orange-100 p-4">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#FF6B35] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-slate-900">Your {refLabel} draft is saved</p>
                  <p className="text-xs text-slate-600 mt-1">
                    We saved your {refLabel} draft. When you open your workspace,
                    we&apos;ll restore it ready to edit, send, and manage.
                  </p>
                </div>
              </div>
            </div>
          )}

          <GoogleSignInButton />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-slate-400">or use your email</span>
            </div>
          </div>

          {sentTo ? (
            <div className="text-center">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-left">
                <p className="text-sm font-semibold text-emerald-900">Check your inbox</p>
                <p className="text-xs text-emerald-800 mt-1">
                  We sent a link to <span className="font-semibold">{sentTo}</span>. Click it to open your
                  free workspace. If the email is new, your workspace is created the moment you click.
                </p>
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Can&apos;t find it? Check your spam folder, or{' '}
                <Link href="/login" className="qc-flow-link">log in with a password or Google</Link>.
              </p>
              <button
                type="button"
                onClick={() => { setSentTo(null); setError(null); }}
                className="qc-flow-control mt-4 text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setError(null);
                const email = String(new FormData(e.currentTarget).get('email') || '');
                startTransition(async () => {
                  const result = await sendSignupLinkAction(email);
                  if (result.ok) {
                    setSentTo(email.trim().toLowerCase());
                  } else {
                    setError(result.error);
                  }
                });
              }}
            >
              <div className="grid gap-4">
                <label className="qc-flow-label block">
                  <span className="block text-sm font-medium text-slate-700 mb-1">Email</span>
                  <input
                    aria-label="Email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    className="qc-input w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                    placeholder="you@example.com"
                  />
                </label>

                <button
                  data-qc-variant="primary"
                  type="submit"
                  disabled={isPending}
                  className="qc-flow-control qc-button w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-2"
                >
                  {isPending ? 'Sending your link...' : 'Send my workspace link'}
                </button>

                {error && <p className="text-red-600 text-sm text-center">{error}</p>}
              </div>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="qc-flow-link text-orange-600 font-medium hover:text-orange-700 transition-colors">
            Log in
          </Link>
        </p>
      </div>
      <PublicFooter />
    </main></QcJourney>
  );
}
