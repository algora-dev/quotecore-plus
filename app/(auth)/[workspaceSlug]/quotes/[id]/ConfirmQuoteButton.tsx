import { confirmQuoteAndRedirect, saveConfirmedQuoteAndRedirect } from '../actions';
import type { QuoteStatus } from '@/app/lib/types';

interface Props {
  quoteId: string;
  workspaceSlug: string;
  quoteStatus: QuoteStatus;
}

export function ConfirmQuoteButton({ quoteId, workspaceSlug, quoteStatus }: Props) {
  // If draft, confirm then redirect; if already confirmed, just redirect
  const action = quoteStatus === 'draft' 
    ? confirmQuoteAndRedirect.bind(null, quoteId, workspaceSlug)
    : saveConfirmedQuoteAndRedirect.bind(null, quoteId, workspaceSlug);

  const buttonText = quoteStatus === 'draft' ? 'Confirm Quote →' : 'Save Changes →';

  return (
    <form action={action}>
      <button
        type="submit"
        data-copilot="quote-confirm"
        className="px-6 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        {buttonText}
      </button>
    </form>
  );
}
