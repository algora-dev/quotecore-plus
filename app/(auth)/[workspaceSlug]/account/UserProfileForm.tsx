'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { updateUserProfile } from './actions';

type Props = {
  userId: string;
  currentFullName: string;
  currentEmail: string;
};

/**
 * Inline editable name + read-only email block on the /account index page.
 *
 * Keeps a single field (full name) for now to stay focused. We deliberately
 * render email as read-only here because changing it goes through the
 * dedicated EmailChangeSection (with re-auth, AAL2, cooldown, etc.) - letting
 * the user type a new email into a normal text input would skip every
 * security gate.
 */
export function UserProfileForm({ userId, currentFullName, currentEmail }: Props) {
  const [fullName, setFullName] = useState(currentFullName);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const isDirty = fullName.trim() !== currentFullName.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName.trim()) {
      setError('Please enter your name.');
      return;
    }
    startTransition(async () => {
      try {
        await updateUserProfile(userId, { full_name: fullName.trim() });
        setSavedAt(Date.now());
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update profile.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">Full name</span>
        <input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          maxLength={120}
          className="w-full px-4 py-2.5 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
        />
      </label>

      <div className="block">
        <span className="block text-sm font-medium text-slate-700 mb-1">Email</span>
        <div className="w-full px-4 py-2.5 border-2 border-slate-200 bg-slate-50 rounded-lg text-slate-600 select-all">
          {currentEmail || <span className="text-slate-400 italic">Not set</span>}
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Use the &quot;Sign-in email&quot; section below to change this.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending || !isDirty}
          className="px-4 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
        >
          {isPending ? 'Saving…' : 'Save changes'}
        </button>
        {savedAt && !isDirty && (
          <span className="text-xs text-emerald-600 font-medium">✓ Saved</span>
        )}
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </form>
  );
}
