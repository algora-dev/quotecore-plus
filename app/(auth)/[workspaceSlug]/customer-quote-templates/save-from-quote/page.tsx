import { requireCompanyContext } from '@/app/lib/supabase/server';
import { loadQuote, loadCustomerQuoteLines } from '../../quotes/actions';
import { SaveFromQuote } from './SaveFromQuote';

export default async function SaveFromQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string }>;
  searchParams: Promise<{ quoteId?: string; name?: string }>;
}) {
  const { workspaceSlug } = await params;
  const { quoteId, name } = await searchParams;
  await requireCompanyContext();

  if (!quoteId || !name) {
    throw new Error('Missing quoteId or name');
  }

  const [quote, savedLines] = await Promise.all([
    loadQuote(quoteId),
    loadCustomerQuoteLines(quoteId),
  ]);

  return (
    <SaveFromQuote
      workspaceSlug={workspaceSlug}
      quote={quote}
      savedLines={savedLines}
      templateName={name}
    />
  );
}
