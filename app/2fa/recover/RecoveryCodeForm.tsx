'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';
import {
  consumeRecoveryCode,
  clearTotpFactorsForCurrentUser,
} from '@/app/(auth)/[workspaceSlug]/settings/recovery-actions';

interface Props {
  redirectTo?: string;
}

/**
 * Recovery-code form. On success:
 *
 *   1. consumeRecoveryCode marks the supplied code as used (or rejects it).
 *   2. clearTotpFactorsForCurrentUser deletes the user's TOTP factors via
 *      the service-role auth.admin API so they can no longer log in with the
 *      lost authenticator and are forced to re-enrol a fresh one.
 *   3. We refresh the local Supabase session so getAuthenticatorAssuranceLevel()
 *      reports nextLevel='aal1' and the middleware stops gating routes on /2fa.
 *   4. We redirect into the app, where the user can go back to Settings to enrol.
 */
export function RecoveryCodeForm({ redirectTo }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const ok = await consumeRecoveryCode(code);
        if (!ok) {
          setError('That code is invalid or has already been used.');
          return;
        }

        await clearTotpFactorsForCurrentUser();

        // Force the local session to re-fetch its claims so the JWT no longer
        // advertises a verified factor. Without this, getAuthenticatorAssuranceLevel
        // can still report nextLevel=aal2 from cached state and the middleware
        // would punt the user back to /2fa.
        await supabase.auth.refreshSession();

        const target =
          redirectTo && redirectTo.startsWith('/') ? redirectTo : '/?recovered=1';
        router.replace(target);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Recovery failed');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Recovery code</label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
          required
          autoFocus
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          placeholder="ABCD-EFGH-IJKL"
          maxLength={20}
          className="w-full px-4 py-3 text-center text-lg font-mono tracking-[0.2em] uppercase border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
        />
      </div>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      <button
        type="submit"
        disabled={pending || code.replace(/[^a-zA-Z0-9]/g, '').length < 8}
        className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
      >
        {pending ? 'Verifying...' : 'Use recovery code'}
      </button>

      <a
        href={`/2fa${redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`}
        className="block text-center text-sm text-slate-500 hover:text-slate-700 underline"
      >
        Back to authenticator code
      </a>
    </form>
  );
}
