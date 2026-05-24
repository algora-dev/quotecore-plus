'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { adminLoginAction } from './actions';
import { PasswordField } from '@/app/components/ui/PasswordField';

interface Props {
  redirectTo: string;
}

/**
 * Admin-specific login form. Calls a server action that signs the user
 * in AND verifies they're flagged is_admin before allowing them to
 * proceed. The server action is the single trust boundary; the form is
 * a thin shell around it.
 */
export function AdminLoginForm({ redirectTo }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formData = new FormData();
    formData.set('email', email);
    formData.set('password', password);

    startTransition(async () => {
      const result = await adminLoginAction(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm space-y-4">
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </label>
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">Password</span>
        <PasswordField
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          inputClassName="w-full px-3 py-2 pr-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </label>

      {error ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition disabled:opacity-50"
      >
        {isPending ? 'Signing in…' : 'Sign in to admin'}
      </button>
    </form>
  );
}
