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
        className="px-6 py-2 text-sm font-medium rounded-full bg-black text-white hover:bg-slate-800 transition-all hover:shadow-[0_0_12px_rgba(255,107,53,0.4)]"
      >
        Confirm Quote →
      </button>
    </form>
  );
}
