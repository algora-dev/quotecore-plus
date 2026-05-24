'use client';

import { useState, useTransition, useEffect } from 'react';
import { requestEmailChange, getEmailChangeStatus, type EmailChangeResult } from './email-change-actions';

type Props = {
  currentEmail: string;
  authProvider: string;
};

/**
 * UI for self-service email change.
 *
 * Three visible states:
 *  - normal: button "Change email" → opens modal with new email + password
 *  - cooldown: shows the date a new change becomes available, button disabled
 *  - oauth_only: explains the user's email is managed by their identity provider
 *
 * The modal explicitly tells the user that BOTH inboxes (old + new) need to
 * be checked to complete the change - that's the secure-email-change flow we
 * have configured at the Supabase project level.
 */
export function EmailChangeSection({ currentEmail, authProvider }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{
    isOAuthOnly: boolean;
    cooldownEndsAt: string | null;
    requiresAal2: boolean;
  } | null>(null);

  // Load gating status on mount so we can render the right CTA.
  useEffect(() => {
    let active = true;
    void getEmailChangeStatus().then((s) => {
      if (active) setStatus(s);
    });
    return () => {
      active = false;
    };
  }, []);

  const isOAuthOnly = status?.isOAuthOnly ?? authProvider === 'google';
  const cooldownEndsAt = status?.cooldownEndsAt ?? null;
  // Reading Date.now() during render is technically impure, but the cost
  // here is "the cooldown banner might flicker by a few milliseconds on a
  // double-render at the exact end of the 7-day window" - acceptable.
  // Surfacing a real-time countdown would require a 1s ticker; not worth
  // the extra renders for a state that only changes once per week.
  // eslint-disable-next-line react-hooks/purity
  const inCooldown = !!cooldownEndsAt && new Date(cooldownEndsAt).getTime() > Date.now();

  function reset() {
    setNewEmail('');
    setPassword('');
    setError(null);
  }
  function handleClose() {
    setIsOpen(false);
    reset();
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res: EmailChangeResult = await requestEmailChange(newEmail, password);
      if (res.ok) {
        setSuccess(
          `We've sent confirmation links to both your current email (${currentEmail}) and your new email (${newEmail}). You must click the link in BOTH messages to complete the change.`
        );
        handleClose();
      } else {
        setError(res.message);
      }
    });
  }

  // ---- OAuth-only branch ---------------------------------------------------
  if (isOAuthOnly) {
    return (
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
        <div>
          <p className="text-sm font-medium text-slate-900">Change Email</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Your email is managed by Google. Change it in your Google account; QuoteCore+ will pick it up next time you sign in.
          </p>
        </div>
        <a
          href="https://myaccount.google.com/email"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-1.5 text-xs font-medium rounded-full bg-white text-slate-700 border border-slate-300 hover:bg-slate-100 transition-all"
        >
          Manage in Google
        </a>
      </div>
    );
  }

  // ---- Normal/cooldown branch ----------------------------------------------
  return (
    <>
      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
        <div>
          <p className="text-sm font-medium text-slate-900">Change Email</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Current: <span className="font-medium text-slate-700">{currentEmail}</span>
          </p>
          {inCooldown && cooldownEndsAt && (
            <p className="text-xs text-amber-600 mt-1">
              You can change your email again on{' '}
              <span className="font-medium">{new Date(cooldownEndsAt).toLocaleDateString()}</span>.
            </p>
          )}
          {success && <p className="text-xs text-emerald-600 mt-1 font-medium">{success}</p>}
        </div>
        <button
          type="button"
          onClick={() => {
            setSuccess(null);
            setIsOpen(true);
          }}
          disabled={inCooldown}
          className="px-4 py-1.5 text-xs font-medium rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Change Email
        </button>
      </div>

      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl">
            <h3 className="text-base font-semibold text-slate-900">Change your email</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">
              We&apos;ll send a confirmation link to both your current and new email. You must click both to complete the change.
            </p>

            {status?.requiresAal2 && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2 mb-4">
                ℹ️ 2FA is enabled on your account. If your current session isn&apos;t already 2FA-verified, you&apos;ll be asked to verify when you submit this form.
              </p>
            )}

            <form onSubmit={handleSubmit} className="grid gap-4">
              <label className="block">
                <span className="block text-xs font-medium text-slate-700 mb-1">New email</span>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </label>

              <label className="block">
                <span className="block text-xs font-medium text-slate-700 mb-1">Current password</span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-3 py-2 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                />
              </label>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex gap-2 justify-end mt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isPending}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-slate-300 hover:bg-slate-50 disabled:opacity-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !newEmail || !password}
                  className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 transition-all"
                >
                  {isPending ? 'Sending…' : 'Send confirmation links'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
