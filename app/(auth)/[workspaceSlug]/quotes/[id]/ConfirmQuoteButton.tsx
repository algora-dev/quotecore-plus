'use client';

import { confirmQuoteAndRedirect, saveConfirmedQuoteAndRedirect } from '../actions';
import type { QuoteStatus } from '@/app/lib/types';
import { useRef, useState } from 'react';

interface Props {
  quoteId: string;
  workspaceSlug: string;
  quoteStatus: QuoteStatus;
  /** Optional async hook called before the server action fires (e.g. save margins). */
  onBeforeSubmit?: () => Promise<void>;
}

export function ConfirmQuoteButton({ quoteId, workspaceSlug, quoteStatus, onBeforeSubmit }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);

  const action = quoteStatus === 'draft'
    ? confirmQuoteAndRedirect.bind(null, quoteId, workspaceSlug)
    : saveConfirmedQuoteAndRedirect.bind(null, quoteId, workspaceSlug);

  const buttonText = quoteStatus === 'draft' ? 'Confirm Quote →' : 'Save Changes →';

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (!onBeforeSubmit) return; // let the form submit naturally
    e.preventDefault();
    setPending(true);
    try {
      await onBeforeSubmit();
    } catch {
      // non-fatal: margins failed to save but we still proceed
    }
    setPending(false);
    formRef.current?.submit();
  }

  return (
    <form ref={formRef} action={action}>
      <button
        type="submit"
        data-copilot="quote-confirm"
        disabled={pending}
        onClick={onBeforeSubmit ? handleClick : undefined}
        className="px-6 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)] disabled:opacity-60"
      >
        {pending ? 'Saving…' : buttonText}
      </button>
    </form>
  );
}
