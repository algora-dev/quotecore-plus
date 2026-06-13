'use client';

import { useState, useTransition } from 'react';
import { updateAssistantEnabled } from './actions';

type Props = {
  initialEnabled: boolean;
};

/**
 * Toggle for showing/hiding the Q chat assistant (launcher + panel) for this
 * user. Mirrors the old Copilot on/off control. Purely a UX preference - the
 * feature flag and API guards remain authoritative server-side.
 */
export function AssistantSection({ initialEnabled }: Props) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (next: boolean) => {
    setError(null);
    setEnabled(next); // optimistic
    startTransition(async () => {
      try {
        await updateAssistantEnabled(next);
      } catch (err) {
        setEnabled(!next);
        setError(err instanceof Error ? err.message : 'Failed to update preference');
      }
    });
  };

  return (
    <div className="flex items-start justify-between p-4 bg-slate-50 rounded-xl gap-4">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">Show the Chat Assistant (Q)</p>
        <p className="text-sm text-slate-500 mt-1">
          Q is the in-app helper that answers questions and can guide you through tasks. Turn this off to
          completely hide it &mdash; the floating button and chat window won&apos;t appear anywhere in the app.
        </p>
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={isPending}
        onClick={() => handleToggle(!enabled)}
        title={enabled ? 'Chat Assistant on. Click to hide.' : 'Chat Assistant hidden. Click to show.'}
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
