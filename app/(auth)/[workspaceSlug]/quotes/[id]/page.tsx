import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadAllEntriesForQuote, loadAllRoofAreaEntriesForQuote } from '../actions';
import { loadComponentLibrary } from '../../components/actions';
import { QuoteBuilder } from './quote-builder';

export default async function QuoteBuilderPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const [quote, roofAreas, roofAreaEntries, components, libraryComponents, entries] = await Promise.all([
    loadQuote(id),
    loadQuoteRoofAreas(id),
    loadAllRoofAreaEntriesForQuote(id),
    loadQuoteComponents(id),
    loadComponentLibrary(),
    loadAllEntriesForQuote(id),
  ]);

  return (
    <QuoteBuilder
      quote={quote}
      initialRoofAreas={roofAreas}
      initialRoofAreaEntries={roofAreaEntries}
      initialComponents={components}
      initialEntries={entries}
      libraryComponents={libraryComponents}
      workspaceSlug={workspaceSlug}
    />
  );
}
