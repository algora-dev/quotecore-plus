import { redirect } from 'next/navigation';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents } from '../../actions';
import { loadComponentLibrary } from '../../../components/actions';
import { QuoteBuilderV2 } from './QuoteBuilderV2';

export default async function QuoteBuilderV2Page({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const { step = 'roof-areas' } = await searchParams;

  // Load quote data
  const [quote, roofAreas, components, libraryComponents] = await Promise.all([
    loadQuote(id),
    loadQuoteRoofAreas(id),
    loadQuoteComponents(id),
    loadComponentLibrary(),
  ]);

  // Validate entry mode
  if (quote.entry_mode !== 'digital') {
    redirect(`/${workspaceSlug}/quotes/${id}`);
  }

  return (
    <QuoteBuilderV2
      quote={quote}
      roofAreas={roofAreas}
      components={components}
      libraryComponents={libraryComponents}
      workspaceSlug={workspaceSlug}
      initialStep={step}
    />
  );
}
