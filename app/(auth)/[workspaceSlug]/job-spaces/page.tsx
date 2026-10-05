import { QuoteIndexPage } from '@/app/components/workspace/QuoteIndexPage';

/** Additional index of existing quote records, not a new job entity. */
export default function JobSpacesPage({ params }: {
  params: Promise<{ workspaceSlug: string }>;
}) {
  return <QuoteIndexPage params={params} view="job-spaces" />;
}
