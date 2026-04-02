import { redirect } from 'next/navigation';
import { confirmQuote } from '../actions';

interface Props {
  quoteId: string;
  workspaceSlug: string;
}

export function ConfirmQuoteButton({ quoteId, workspaceSlug }: Props) {
  return (
    <form
      action={async () => {
        'use server';
        await confirmQuote(quoteId);
        redirect(`/${workspaceSlug}/quotes/${quoteId}/summary`);
      }}
    >
      <button
        type="submit"
        className="px-6 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
      >
        Confirm Quote →
      </button>
    </form>
  );
}
