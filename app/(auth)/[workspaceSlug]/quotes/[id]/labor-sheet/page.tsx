import { redirect } from 'next/navigation';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadCustomerQuoteTemplates } from '../../actions';
import { loadLaborSheetLines } from './actions';
import { loadQuoteTaxes } from '@/app/lib/taxes/actions';

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
  
  const supabase = await createSupabaseServerClient();
  
  // Load company default logo
  const { data: company } = await supabase
    .from('companies')
    .select('default_logo_url')
    .eq('id', quote.company_id)
    .single();
  
  const defaultLogoUrl = company?.default_logo_url || null;
  
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
    />
  );
}
