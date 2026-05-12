'use client';

import { useState, useTransition } from 'react';
import { submitOrderResponse } from './actions';

type Action = 'confirm' | 'request_changes' | 'question';

interface Props {
  token: string;
  alreadyResponded: boolean;
  /**
   * Optional Download button rendered alongside the action buttons. This
   * is kept in the same row as Confirm / Request changes / Ask a question
   * for visual parity with the public quote page.
   */
  downloadAction?: React.ReactNode;
}

/**
 * Supplier response form on `/orders/[token]`. Free-text-only by design
 * (line-by-line change requests are Phase 2 if suppliers actually ask).
 *
 * 2026-05-12 styling pass: buttons match the public quote accept page so
 * the supplier-facing surface reads consistently with the customer-facing
 * one. Confirm = filled green (like Accept), Request changes = orange
 * outline (warning tone), Ask a question = neutral outline, Download =
 * blue outline.
 *
 * The form stays visible even after the supplier has already responded
 * once (alreadyResponded=true) so they can send a follow-up message if
 * needed. Multiple responses stack chronologically and only the latest
 * action drives the inline status banner above the form.
 */
export function OrderResponseForm({ token, alreadyResponded, downloadAction }: Props) {
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
      <div className="bg-emerald-50 rounded-xl p-6 border border-emerald-200 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-emerald-100 flex items-center justify-center">
          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-emerald-800">Response sent</h3>
        <p className="text-sm text-emerald-600 mt-1">We&apos;ve let the sender know.</p>
        {downloadAction ? <div className="mt-4 flex justify-center">{downloadAction}</div> : null}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200 text-center space-y-4">
      <p className="text-sm text-slate-600">
        {alreadyResponded
          ? 'Send an additional message about this order using the buttons below.'
          : 'Please respond to this order using the buttons below.'}
      </p>

      {/* Action row \u2014 matches the public quote page's pattern of putting
          all the recipient's options on a single horizontal row. */}
      <div className="flex gap-3 justify-center flex-wrap">
        <button
          type="button"
          onClick={() => setAction('confirm')}
          className={`px-6 py-2.5 text-sm font-semibold rounded-full transition-all ${
            action === 'confirm'
              ? 'bg-emerald-600 text-white hover:bg-emerald-700 hover:shadow-[0_0_12px_rgba(16,185,129,0.4)]'
              : 'bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50'
          }`}
        >
          Confirm order
        </button>
        <button
          type="button"
          onClick={() => setAction('request_changes')}
          className={`px-6 py-2.5 text-sm font-semibold rounded-full transition-all ${
            action === 'request_changes'
              ? 'bg-amber-500 text-white hover:bg-amber-600 hover:shadow-[0_0_12px_rgba(251,191,36,0.4)]'
              : 'bg-white text-amber-700 border border-amber-300 hover:bg-amber-50'
          }`}
        >
          Request changes
        </button>
        <button
          type="button"
          onClick={() => setAction('question')}
          className={`px-6 py-2.5 text-sm font-semibold rounded-full transition-all ${
            action === 'question'
              ? 'bg-slate-900 text-white hover:bg-slate-800'
              : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
          }`}
        >
          Ask a question
        </button>
        {downloadAction}
      </div>

      {/* Optional message body \u2014 always visible so the supplier can flip
          their chosen action without losing what they've typed. */}
      <div className="text-left">
        <label className="block text-sm font-medium text-slate-700 mb-1">
          Add a message {action === 'confirm' || action === null ? '(optional)' : ''}
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          maxLength={8000}
          placeholder={
            action === 'confirm'
              ? 'Anything to add about delivery, lead time, etc?'
              : action === 'request_changes'
                ? 'What needs to change?'
                : action === 'question'
                  ? 'What would you like to know?'
                  : 'Anything you\u2019d like to add?'
          }
          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
        />
      </div>

      {error ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2 text-left">{error}</p>
      ) : null}

      <button
        type="button"
        onClick={(e) => submit(e as unknown as React.FormEvent)}
        disabled={isPending || !action}
        className="w-full px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-full hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
      >
        {isPending ? 'Sending\u2026' : 'Send response'}
      </button>
    </div>
  );
}
