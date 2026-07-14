
'use client';

import { useState, useTransition, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { loginAction, resendConfirmationAction, sendLoginLinkAction, type LoginResult } from './actions';
import { GoogleSignInButton } from '@/app/components/auth/GoogleSignInButton';
import { TroubleSigningInPanel } from './TroubleSigningInPanel';
import { PublicFooter } from '@/app/components/PublicFooter';
import { PasswordField } from '@/app/components/ui/PasswordField';

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const searchParams = useSearchParams();
  const signupPending = searchParams.get('signup') === 'pending';
  const redirectParam = searchParams.get('redirect');

  async function handleResend() {
    if (!pendingEmail) return;
    setResendStatus('sending');
    try {
      const result = await resendConfirmationAction(pendingEmail);
      if (result.ok) {
        setResendStatus('sent');
      } else {
        setResendStatus('error');
      }
    } catch {
      setResendStatus('error');
    }
  }

  return (
    <main className="min-h-screen flex flex-col bg-slate-50 px-4">
      <div className="w-full max-w-md mx-auto my-auto py-10">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="QuoteCore" className="h-12 inline-block" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8">
          <h1 className="text-2xl font-semibold text-slate-900 mb-6 text-center">Log in to QuoteCore</h1>

          {signupPending && (
            <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <p className="text-sm font-medium text-blue-900">Check your email to confirm your account</p>
              <p className="text-xs text-blue-700 mt-1">
                We&apos;ve sent a confirmation link to your email address. Click the link in the email to activate your account and sign in.
              </p>
            </div>
          )}

          {/* Email-not-confirmed banner with resend option */}
          {pendingEmail && (
            <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-medium text-amber-900">Please confirm your email to log in</p>
              <p className="text-xs text-amber-700 mt-1 mb-3">
                We sent a confirmation link to <strong>{pendingEmail}</strong>. Click the button in that email to activate your account, then try logging in again.
              </p>
              {resendStatus === 'sent' ? (
                <p className="text-xs font-medium text-emerald-700">
                  ✓ Confirmation email re-sent. Check your inbox (and spam folder).
                </p>
              ) : (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendStatus === 'sending'}
                  className="text-xs font-semibold text-amber-900 underline underline-offset-2 hover:text-amber-700 disabled:opacity-50"
                >
                  {resendStatus === 'sending' ? 'Sending...' : 'Resend confirmation email'}
                </button>
              )}
              {resendStatus === 'error' && (
                <p className="text-xs text-red-600 mt-1">
                  Could not resend. Try again in a few minutes.
                </p>
              )}
            </div>
          )}

          {/* Google Sign-In */}
          <GoogleSignInButton />

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-4 text-slate-400">or continue with email</span>
            </div>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setError(null);
              setPendingEmail(null);
              setResendStatus('idle');
              const formData = new FormData(e.currentTarget);
              if (redirectParam) {
                formData.set('redirect', redirectParam);
              }

              startTransition(async () => {
                try {
                  const result: LoginResult = await loginAction(formData);

                  // If we get here, loginAction returned (not redirected).
                  // Handle the structured result.
                  if (!result.ok) {
                    if (result.code === 'EMAIL_NOT_CONFIRMED') {
                      setPendingEmail(result.email);
                      return;
                    }
                    setError(result.message);
                    return;
                  }
                  // result.ok === true — the action should have redirected,
                  // but if it didn't, the client won't navigate. This
                  // shouldn't happen in normal flow. If it does, reload.
                  window.location.reload();
                } catch (err) {
                  // Next.js signals a server-action redirect by throwing an
                  // Error whose message starts with "NEXT_REDIRECT". Re-throw
                  // it so the framework can complete the navigation.
                  if (err instanceof Error && (err.message === 'NEXT_REDIRECT' || err.message.startsWith('NEXT_REDIRECT'))) throw err;

                  // Any other thrown error is unexpected.
                  console.error('Login error:', err);
                  setError('An unexpected error occurred. Please try again.');
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
                <PasswordField
                  name="password"
                  required
                  inputClassName="w-full px-4 py-3 pr-12 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                  placeholder="••••••••"
                />
              </label>

              <div className="-mt-2">
                <TroubleSigningInPanel />
              </div>

              <button
                type="submit"
                disabled={isPending}
                className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isPending ? 'Logging in...' : 'Log in'}
              </button>

              {error && <p className="text-red-600 text-sm text-center">{error}</p>}

              {/* Passwordless login — for accounts created via free tools
                  email-link (no password yet) or anyone who prefers a link. */}
              <MagicLinkOption />
            </div>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-orange-600 font-medium hover:text-orange-700 transition-colors">
            Sign up
          </Link>
        </p>
      </div>
      <PublicFooter />
    </main>
  );
}

/**
 * "Email me a login link" — inline passwordless option under the login
 * form. Reads the email from the form above (same page) via the DOM to
 * avoid duplicating state; falls back to prompting if empty.
 */
function MagicLinkOption() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSend() {
    const emailInput = document.querySelector<HTMLInputElement>('input[name="email"]');
    const email = emailInput?.value?.trim() ?? '';
    if (!email) {
      setStatus('error');
      setMessage('Enter your email above first, then click this again.');
      return;
    }
    setStatus('sending');
    setMessage('');
    try {
      const result = await sendLoginLinkAction(email);
      if (result.ok) {
        setStatus('sent');
        setMessage('If that email has an account, a login link is on its way. Check your inbox.');
      } else {
        setStatus('error');
        setMessage(result.error || 'Could not send the link. Please try again.');
      }
    } catch {
      setStatus('error');
      setMessage('Could not send the link. Please try again.');
    }
  }

  return (
    <div className="text-center">
      <button
        type="button"
        onClick={handleSend}
        disabled={status === 'sending'}
        className="text-sm text-slate-500 hover:text-slate-900 underline underline-offset-2 transition-colors disabled:opacity-50"
      >
        {status === 'sending' ? 'Sending link…' : 'No password? Email me a login link'}
      </button>
      {message && (
        <p className={`mt-2 text-xs ${status === 'sent' ? 'text-emerald-600' : 'text-red-600'}`}>{message}</p>
      )}
    </div>
  );
}
