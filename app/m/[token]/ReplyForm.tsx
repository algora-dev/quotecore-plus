'use client';

import { useState, useTransition } from 'react';
import { submitMessageReply } from './actions';

type Action = 'accept' | 'decline' | 'request_changes' | 'question';

interface Props {
  token: string;
  recipientName: string | null;
  messageKind: 'quote_send' | 'order_send' | 'followup' | 'decline_response' | 'custom';
  relatedQuoteId: string | null;
  relatedOrderId: string | null;
}

/**
 * Recipient response form. The action set adapts slightly to the message
 * kind \u2014 a quote_send shows Accept/Decline/Request changes/Question,
 * an order_send drops Accept/Decline (no quote to accept) and shows
 * Confirm/Question/Request changes, etc.
 */
const ACTION_DEFS: Record<Action, { label: string; tone: 'pos' | 'neg' | 'neutral' | 'warn' }> = {
  accept: { label: 'Accept', tone: 'pos' },
  decline: { label: 'Decline', tone: 'neg' },
  request_changes: { label: 'Request changes', tone: 'warn' },
  question: { label: 'Ask a question', tone: 'neutral' },
};

function actionsForKind(kind: Props['messageKind']): Action[] {
  switch (kind) {
    case 'quote_send':
    case 'followup':
      return ['accept', 'decline', 'request_changes', 'question'];
    case 'order_send':
      // No accept/decline semantics for an order send; the supplier
      // typically confirms or has a question. Map "Confirm" to accept so
      // the alert stream reads cleanly.
      return ['accept', 'request_changes', 'question'];
    case 'decline_response':
    case 'custom':
    default:
      return ['question', 'request_changes'];
  }
}

export function ReplyForm({ token, recipientName, messageKind }: Props) {
  const [action, setAction] = useState<Action | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const actions = actionsForKind(messageKind);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!action) {
      setError('Please choose a response option.');
      return;
    }
    // For "question" require a body; the others can be a one-click response.
    if (action === 'question' && !body.trim()) {
      setError('Please type your question before submitting.');
      return;
    }
    startTransition(async () => {
      const result = await submitMessageReply({
        token,
        action,
        body: body.trim() ? body.trim() : null,
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
          Thanks{recipientName ? `, ${recipientName}` : ''}. We&apos;ve let the sender know.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
      <div>
        <p className="text-sm font-medium text-slate-900 mb-2">How would you like to respond?</p>
        <div className="grid grid-cols-2 gap-2">
          {actions.map((a) => {
            const def = ACTION_DEFS[a];
            const selected = action === a;
            const toneClasses = selectedToneClasses(def.tone, selected);
            return (
              <button
                key={a}
                type="button"
                onClick={() => setAction(a)}
                className={`px-3 py-2.5 rounded-lg text-sm font-medium border transition ${toneClasses}`}
              >
                {def.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="block">
        <span className="block text-sm font-medium text-slate-900 mb-1">
          Add a message {action === 'question' ? '' : '(optional)'}
        </span>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          maxLength={8000}
          placeholder={action === 'question' ? 'Type your question here\u2026' : 'Anything you\u2019d like to add?'}
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </label>

      {error ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
          {error}
        </p>
      ) : null}

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

function selectedToneClasses(tone: 'pos' | 'neg' | 'neutral' | 'warn', selected: boolean): string {
  if (selected) {
    switch (tone) {
      case 'pos':
        return 'bg-emerald-600 text-white border-emerald-600';
      case 'neg':
        return 'bg-rose-600 text-white border-rose-600';
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
    case 'neg':
      return 'bg-white text-rose-700 border-rose-200 hover:bg-rose-50';
    case 'warn':
      return 'bg-white text-amber-700 border-amber-200 hover:bg-amber-50';
    case 'neutral':
    default:
      return 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50';
  }
}
