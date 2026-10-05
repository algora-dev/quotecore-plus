import { QuoteIndexPage } from '@/app/components/workspace/QuoteIndexPage';

/** Existing Quotes route, tabs, actions and creation flow are unchanged. */
export default function QuotesPage({ params }: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  return <QuoteIndexPage params={params} />;
}
