'use client';

import { useState, useTransition } from 'react';
import { updateEmailNotificationsEnabled } from './actions';

type Props = {
  initialEnabled: boolean;
  userEmail: string;
};

/**
 * Toggle for receiving in-app alerts via email.
 *
 * Note: security emails (password change, recovery code login, 2FA changes,
 * email-change confirmations) are NOT controlled by this setting — they always
 * send. The copy reflects that distinction.
 */
export function NotificationsSection({ initialEnabled, userEmail }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (next: boolean) => {
    setError(null);
    // Optimistic update — rolled back on error.
    setEnabled(next);
    startTransition(async () => {
      try {
        await updateEmailNotificationsEnabled(next);
      } catch (err) {
        setEnabled(!next);
        setError(err instanceof Error ? err.message : 'Failed to update preference');
      }
    });
  };

  return (
    <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">Email me when in-app alerts fire</p>
        <p className="text-sm text-slate-500 mt-1">
          We&apos;ll send <span className="font-medium text-slate-700">{userEmail || 'your email'}</span> a copy of
          alerts like Quote Accepted, Quote Declined and Re-quote Requested.
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Security emails (password changes, 2FA changes, recovery code logins) are always sent regardless of this setting.
        </p>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={isPending}
          onClick={() => handleToggle(!enabled)}
          title={enabled ? 'Email alerts on. Click to turn off.' : 'Email alerts off. Click to turn on.'}
          className={`relative w-12 h-6 rounded-full border transition-all disabled:opacity-50 cursor-pointer hover:ring-2 hover:ring-orange-200 hover:ring-offset-1 ${
            enabled ? 'bg-orange-500 border-orange-600' : 'bg-slate-200 border-slate-300'
          }`}
        >
          <span
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md ring-1 ring-black/5 transition-transform ${
              enabled ? 'translate-x-[1.625rem]' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="text-xs text-slate-400 select-none">{enabled ? 'On' : 'Off'}</span>
      </div>
    </div>
  );
}
