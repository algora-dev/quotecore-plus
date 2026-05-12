'use client';

import { useState, useTransition } from 'react';
import { submitOrderResponse } from './actions';

type Action = 'confirm' | 'request_changes' | 'question';

interface Props {
  token: string;
  alreadyResponded: boolean;
}

/**
 * Supplier response form on `/orders/[token]`. Free-text-only by design;
 * line-by-line change requests can be added in a future phase if
 * suppliers actually ask for it.
 *
 * The form stays visible even after the supplier has already responded
 * once (alreadyResponded=true) so they can send a follow-up message if
 * needed. Multiple responses are stored as separate rows and the latest
 * drives the inline status banner above.
 */
const ACTION_DEFS: Record<Action, { label: string; tone: 'pos' | 'warn' | 'neutral' }> = {
  confirm: { label: 'Confirm order', tone: 'pos' },
  request_changes: { label: 'Request changes', tone: 'warn' },
  question: { label: 'Ask a question', tone: 'neutral' },
};

export function OrderResponseForm({ token, alreadyResponded }: Props) {
  const [action, setAction] = useState<Action | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!action) {
      setError('Please choose an option.');
      return;
    }
    if ((action === 'request_changes' || action === 'question') && !body.trim()) {
      setError('Please add a message describing what you need.');
      return;
    }
    startTransition(async () => {
      const result = await submitOrderResponse({
        token,
        action,
        body: body.trim() || null,
      });
      if (result.ok) {
        setSuccess(true);
      } else {
        setError(result.error);
      }
    });
  }

  if (success) {
    return (
      <div className="bg-white border border-emerald-200 bg-emerald-50/40 rounded-2xl p-6 text-center">
        <h2 className="text-base font-semibold text-emerald-900">Response sent</h2>
        <p className="mt-2 text-sm text-emerald-800">
          We&apos;ve let the sender know.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-900 mb-2">
          {alreadyResponded ? 'Send an additional message' : 'Respond to this order'}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {(Object.keys(ACTION_DEFS) as Action[]).map((a) => {
            const def = ACTION_DEFS[a];
            const selected = action === a;
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition ${selectedToneClasses(def.tone, selected)}`}
              >
                {def.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-slate-900 mb-1">
          Add a message {action === 'confirm' ? '(optional)' : ''}
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={8000}
          placeholder={action === 'confirm' ? 'Anything to add about delivery, lead time, etc?' : 'What would you like to say?'}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </label>

      {error ? <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">{error}</p> : null}

      <button
        type="submit"
        disabled={isPending || !action}
        className="w-full px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {isPending ? 'Sending\u2026' : 'Send response'}
      </button>
    </form>
  );
}

function selectedToneClasses(tone: 'pos' | 'warn' | 'neutral', selected: boolean): string {
  if (selected) {
    switch (tone) {
      case 'pos':
        return 'bg-emerald-600 text-white border-emerald-600';
      case 'warn':
        return 'bg-amber-500 text-white border-amber-500';
      case 'neutral':
      default:
        return 'bg-slate-900 text-white border-slate-900';
    }
  }
  switch (tone) {
    case 'pos':
      return 'bg-white text-emerald-700 border-emerald-200 hover:bg-emerald-50';
    case 'warn':
      return 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50';
    case 'neutral':
    default:
      return 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
  }
}
