'use client';

import { confirmQuoteAndRedirect, saveConfirmedQuoteAndRedirect } from '../actions';
import type { QuoteStatus } from '@/app/lib/types';
import { useRef, useState } from 'react';
import { QcButton } from '@/app/components/ui/v2/QcButton';

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
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action}>
      <QcButton
        type="submit"
        data-copilot="quote-confirm"
        disabled={pending}
        onClick={onBeforeSubmit ? handleClick : undefined}
        variant="primary" pending={pending}
      >
        {pending ? 'Saving…' : buttonText}
      </QcButton>
    </form>
  );
}
