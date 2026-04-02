import { confirmQuoteAndRedirect } from '../actions';

interface Props {
  quoteId: string;
  workspaceSlug: string;
}

export function ConfirmQuoteButton({ quoteId, workspaceSlug }: Props) {
  return (
    <form action={confirmQuoteAndRedirect.bind(null, quoteId, workspaceSlug)}>
      <button
        type="submit"
        className="px-6 py-2 text-sm font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700"
      >
        Confirm Quote →
      </button>
    </form>
  );
}
