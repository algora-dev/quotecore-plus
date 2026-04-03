import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadAllEntriesForQuote, loadAllRoofAreaEntriesForQuote } from '../actions';
import { loadComponentLibrary } from '../../components/actions';
import { QuoteBuilder } from './quote-builder';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

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
  
  // Load company default currency
  const supabase = await createSupabaseServerClient();
  const { data: company } = await supabase
    .from('companies')
    .select('default_currency')
    .eq('id', quote.company_id)
    .single();
  const companyDefaultCurrency = company?.default_currency || 'NZD';

  return (
    <QuoteBuilder
      quote={quote}
      initialRoofAreas={roofAreas}
      initialRoofAreaEntries={roofAreaEntries}
      initialComponents={components}
      initialEntries={entries}
      libraryComponents={libraryComponents}
      workspaceSlug={workspaceSlug}
      companyDefaultCurrency={companyDefaultCurrency}
    />
  );
}
