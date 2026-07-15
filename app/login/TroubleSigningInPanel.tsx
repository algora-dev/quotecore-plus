'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/client';

/**
 * Inline expandable card on the login page that branches into two recovery
 * paths:
 *
 *   1. Forgot password - user still has email access; we send a reset link to
 *      the email they enter. Reuses Supabase's built-in resetPasswordForEmail
 *      and the branded recovery template we already configured.
 *
 *   2. Lost email access - user can't reach their old inbox. We send them to
 *      /login/recover where the multi-step security-question flow lives.
 *
 * The card stays inline (no modal) so on mobile the user never loses context;
 * the form is small enough to fit naturally below the main login fields.
 */
export function TroubleSigningInPanel() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'menu' | 'forgot'>('menu');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [isPending, startTransition] = useTransition();

  function reset() {
    setMode('menu');
    setEmail('');
    setStatus('idle');
    setErrorMessage('');
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    setErrorMessage('');
    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/reset-password`,
        });
        if (error) {
          setStatus('error');
          // Generic error - don't surface enumeration cues if Supabase ever
          // says "user not found" (it shouldn't, but defensive).
          setErrorMessage("We couldn't send a reset email. Please try again.");
        } else {
          setStatus('sent');
        }
      } catch {
        setStatus('error');
        setErrorMessage('Something went wrong. Please try again.');
      }
    });
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-slate-500 hover:text-orange-600 transition-colors"
        >
          Trouble signing in?
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-900">Trouble signing in?</p>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="text-xs text-slate-400 hover:text-slate-700 transition"
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      {mode === 'menu' && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setMode('forgot')}
            className="w-full text-left p-3 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 transition"
          >
            <p className="text-sm font-medium text-slate-900">🔑 Forgot password</p>
            <p className="text-xs text-slate-500 mt-0.5">I just need a new password - I still have my email.</p>
          </button>
          <Link
            href="/login/recover"
            className="block w-full text-left p-3 rounded-lg border border-slate-200 bg-white hover:border-orange-300 hover:bg-orange-50/40 transition"
          >
            <p className="text-sm font-medium text-slate-900">📧 Lost access to my email</p>
            <p className="text-xs text-slate-500 mt-0.5">I can&apos;t get into the inbox on my account.</p>
          </Link>
        </div>
      )}

      {mode === 'forgot' && status !== 'sent' && (
        <form onSubmit={handleForgotPassword} className="space-y-3">
          <button
            type="button"
            onClick={() => reset()}
            className="text-xs text-slate-500 hover:text-slate-700 transition"
          >
            ← Back
          </button>
          <p className="text-xs text-slate-600">
            Enter the email on your account. If we recognise it, we&apos;ll send a reset link.
          </p>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors text-sm"
          />
          {errorMessage && <p className="text-xs text-red-600">{errorMessage}</p>}
          <button
            type="submit"
            disabled={isPending || !email}
            className="w-full px-4 py-2 text-sm font-semibold bg-black text-white rounded-lg hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 transition-all"
          >
            {status === 'sending' ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}

      {mode === 'forgot' && status === 'sent' && (
        <div className="space-y-2">
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
            ✓ If that email is on a QuoteCore+ account, a password reset link is on its way. Check your inbox (and spam folder).
          </p>
          <button
            type="button"
            onClick={() => {
              reset();
              setOpen(false);
            }}
            className="w-full text-xs text-slate-500 hover:text-slate-700 transition py-1"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
