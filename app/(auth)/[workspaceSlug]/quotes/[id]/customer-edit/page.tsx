import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadCustomerQuoteLines, loadCustomerQuoteTemplates } from '../../actions';
import { CustomerQuoteEditor } from './CustomerQuoteEditor';
import { getEffectiveCurrency } from '@/app/lib/currency/currencies';

export default async function CustomerQuoteEditPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  await requireCompanyContext();

  const [quote, roofAreas, components, savedLines, templates] = await Promise.all([
    loadQuote(id),
    loadQuoteRoofAreas(id),
    loadQuoteComponents(id),
    loadCustomerQuoteLines(id),
    loadCustomerQuoteTemplates(),
  ]);
  
  // Load company default currency
  const supabase = await createSupabaseServerClient();
  const { data: company } = await supabase
    .from('companies')
    .select('default_currency')
    .eq('id', quote.company_id)
    .single();
  const companyDefaultCurrency = company?.default_currency || 'NZD';
  const effectiveCurrency = getEffectiveCurrency(quote.currency, companyDefaultCurrency);

  return (
    <CustomerQuoteEditor
      quote={quote}
      roofAreas={roofAreas}
      components={components}
      savedLines={savedLines}
      templates={templates}
      workspaceSlug={workspaceSlug}
      currency={effectiveCurrency}
    />
  );
}
