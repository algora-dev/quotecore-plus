import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadCustomerQuoteLines, loadCustomerQuoteTemplates } from '../../actions';
import { loadQuoteTaxes } from '@/app/lib/taxes/actions';
import { CustomerQuoteEditor } from './CustomerQuoteEditor';
import { getEffectiveCurrency } from '@/app/lib/currency/currencies';

export default async function CustomerQuoteEditPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  await requireCompanyContext();

  const [quote, roofAreas, components, savedLines, templates, quoteTaxes] = await Promise.all([
    loadQuote(id),
    loadQuoteRoofAreas(id),
    loadQuoteComponents(id),
    loadCustomerQuoteLines(id),
    loadCustomerQuoteTemplates(),
    loadQuoteTaxes(id),
  ]);
  
  const supabase = await createSupabaseServerClient();
  
  // Load company default currency
  const { data: company } = await supabase
    .from('companies')
    .select('default_currency')
    .eq('id', quote.company_id)
    .single();
  const companyDefaultCurrency = company?.default_currency || 'NZD';
  const effectiveCurrency = getEffectiveCurrency(quote.currency, companyDefaultCurrency);
  
  // Load company logo (if exists)
  let companyLogoUrl: string | null = null;
  if (!quote.cq_company_logo_url) {
    const { data: logoFile } = await supabase
      .from('quote_files')
      .select('storage_path')
      .eq('company_id', quote.company_id)
      .eq('file_type', 'logo')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (logoFile) {
      const { data: urlData } = supabase.storage
        .from('company-logos')
        .getPublicUrl(logoFile.storage_path);
      companyLogoUrl = urlData.publicUrl;
    }
  }

  return (
    <CustomerQuoteEditor
      quote={quote}
      roofAreas={roofAreas}
      components={components}
      savedLines={savedLines}
      templates={templates}
      workspaceSlug={workspaceSlug}
      currency={effectiveCurrency}
      defaultLogoUrl={companyLogoUrl}
      initialTaxes={quoteTaxes}
      taxAudience="quote"
    />
  );
}
