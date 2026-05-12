import {  } from 'next/navigation';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadCustomerQuoteTemplates } from '../../actions';
import { loadLaborSheetLines } from './actions';
import { loadQuoteTaxes, loadCompanyTaxes } from '@/app/lib/taxes/actions';

import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { LaborSheetEditorWrapper } from './LaborSheetEditorWrapper';

export default async function LaborSheetPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  
  const quote = await loadQuote(id);
  const roofAreas = await loadQuoteRoofAreas(id);
  const components = await loadQuoteComponents(id);
  // Load saved lines for labor sheet (separate from customer quote lines)
  const savedLines = await loadLaborSheetLines(id);
  const templates = await loadCustomerQuoteTemplates();
  const initialTaxes = await loadQuoteTaxes(id);
  const companyTaxes = await loadCompanyTaxes();
  
  const supabase = await createSupabaseServerClient();

  // There is no `companies.default_logo_url` column — the original lookup
  // here was dead code that always resolved to null. Per-quote logos live
  // on `quotes.cq_company_logo_url`; if we ever introduce a true company-
  // wide default, add the column and revisit this path.
  const defaultLogoUrl: string | null = null;

  // Use company's default currency
  const { data: companyData } = await supabase
    .from('companies')
    .select('default_currency')
    .eq('id', quote.company_id)
    .single();
  const currency = quote.currency || companyData?.default_currency || 'NZD';
  
  return (
    <LaborSheetEditorWrapper
      quote={quote}
      roofAreas={roofAreas}
      components={components}
      savedLines={savedLines}
      templates={templates}
      workspaceSlug={workspaceSlug}
      currency={currency}
      defaultLogoUrl={defaultLogoUrl}
      initialTaxes={initialTaxes}
      companyTaxes={companyTaxes.map((t) => ({
        id: t.id,
        name: t.name,
        rate_percent: Number(t.rate_percent),
      }))}
    />
  );
}
