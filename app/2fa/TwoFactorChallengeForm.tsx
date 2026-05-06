'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/lib/supabase/client';

interface Props {
  factorId: string;
  redirectTo?: string;
}

/**
 * Verifies a TOTP code against the user's enrolled factor and upgrades the
 * session to AAL2. Runs entirely client-side because the Supabase MFA helpers
 * track challenge state on the local GoTrueClient instance.
 */
export function TwoFactorChallengeForm({ factorId, redirectTo }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const challengeRes = await supabase.auth.mfa.challenge({ factorId });
      if (challengeRes.error) {
        setError(challengeRes.error.message);
        return;
      }

      const verifyRes = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeRes.data.id,
        code: code.trim(),
      });
      if (verifyRes.error) {
        setError(verifyRes.error.message);
        return;
      }

      // Session is now AAL2. Send the user where they were going.
      const target = redirectTo && redirectTo.startsWith('/') ? redirectTo : '/';
      router.replace(target);
      router.refresh();
    });
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.replace('/login');
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Verification code</label>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          autoFocus
          placeholder="123456"
          className="w-full px-4 py-3 text-center text-2xl font-mono tracking-[0.5em] border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
        />
      </div>

      {error && <p className="text-sm text-red-600 text-center">{error}</p>}

      <button
        type="submit"
        disabled={pending || code.length !== 6}
        className="w-full px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
      >
        {pending ? 'Verifying...' : 'Verify'}
      </button>

      <button
        type="button"
        onClick={handleSignOut}
        className="w-full text-sm text-slate-500 hover:text-slate-700 underline"
      >
        Sign in as a different user
      </button>
    </form>
  );
}
