import { redirect } from 'next/navigation';
import { confirmQuoteAndRedirect } from '../actions';
import type { QuoteStatus } from '@/app/lib/types';

interface Props {
  quoteId: string;
  workspaceSlug: string;
  quoteStatus: QuoteStatus;
}

export function ConfirmQuoteButton({ quoteId, workspaceSlug, quoteStatus }: Props) {
  // If quote is already confirmed, just redirect to summary (don't try to confirm again)
  async function handleSaveConfirmed() {
    'use server';
    redirect(`/${workspaceSlug}/quotes/${quoteId}/summary`);
  }

  // If draft, confirm then redirect
  const action = quoteStatus === 'draft' 
    ? confirmQuoteAndRedirect.bind(null, quoteId, workspaceSlug)
    : handleSaveConfirmed;

  const buttonText = quoteStatus === 'draft' ? 'Confirm Quote →' : 'Save Changes →';

  return (
    <form action={action}>
      <button
        type="submit"
        className="px-6 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        {buttonText}
      </button>
    </form>
  );
}
