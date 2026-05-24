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
 * email-change confirmations) are NOT controlled by this setting - they always
 * send. The copy reflects that distinction.
 */
export function NotificationsSection({ initialEnabled, userEmail }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (next: boolean) => {
    setError(null);
    // Optimistic update - rolled back on error.
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
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={() => handleToggle(!enabled)}
        title={enabled ? 'Email alerts on. Click to turn off.' : 'Email alerts off. Click to turn on.'}
        className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
          enabled ? 'bg-orange-500' : 'bg-slate-300'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
