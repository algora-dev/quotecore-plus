import { redirect } from 'next/navigation';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadQuote, loadQuoteRoofAreas, loadQuoteComponents, loadCustomerQuoteLines, loadCustomerQuoteTemplates } from '../../actions';
import { loadQuoteTaxes, loadCompanyTaxes } from '@/app/lib/taxes/actions';
import { loadComponentCollections, loadComponentLibrary } from '../../../components/actions';
import { CustomerQuoteEditor } from '../customer-edit/CustomerQuoteEditor';
import { getEffectiveCurrency } from '@/app/lib/currency/currencies';

/**
 * /quotes/[id]/blank-build — dedicated builder screen for quotes whose
 * `entry_mode` is `'blank'`.
 *
 * We now render the standard CustomerQuoteEditor with empty roofAreas +
 * components arrays. This gives blank quotes the same look, feel, and
 * line-editing experience as the customer quote editor — no separate
 * BlankQuoteBuilder component needed. The underlying data (customer_quote_lines,
 * saveCustomerQuoteLines) is identical.
 */
export default async function BlankBuildPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  await requireCompanyContext();

  const [quote, savedLines, templates, quoteTaxes, companyTaxes, collections, companyComponents] =
    await Promise.all([
      loadQuote(id),
      loadCustomerQuoteLines(id),
      loadCustomerQuoteTemplates(),
      loadQuoteTaxes(id),
      loadCompanyTaxes(),
      loadComponentCollections(),
      loadComponentLibrary(),
    ]);

  // Route-guard: only blank-mode quotes belong here.
  if (quote.entry_mode !== 'blank') {
    if (quote.entry_mode === 'digital') {
      redirect(`/${workspaceSlug}/quotes/${id}/build?step=roof-areas`);
    }
    redirect(`/${workspaceSlug}/quotes/${id}`);
  }

  const supabase = await createSupabaseServerClient();

  const { data: company } = await supabase
    .from('companies')
    .select('default_currency')
    .eq('id', quote.company_id)
    .single();
  const companyDefaultCurrency = company?.default_currency || 'NZD';
  const effectiveCurrency = getEffectiveCurrency(quote.currency, companyDefaultCurrency);

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

  // Load catalogs for Add Line modal
  const { data: profileData } = await supabase.from('users').select('company_id').single();
  const { data: catalogList } = await supabase
    .from('catalogs')
    .select('id, name')
    .eq('company_id', profileData?.company_id ?? quote.company_id)
    .order('name');

  return (
    <CustomerQuoteEditor
      quote={quote}
      // Blank quotes have no roof areas or components — the editor initialises
      // to the savedLines (or empty if none yet), matching the user's expectation.
      roofAreas={[]}
      components={[]}
      savedLines={savedLines}
      templates={templates}
      workspaceSlug={workspaceSlug}
      currency={effectiveCurrency}
      defaultLogoUrl={companyLogoUrl}
      initialTaxes={quoteTaxes}
      companyTaxes={companyTaxes.map((t) => ({
        id: t.id,
        name: t.name,
        rate_percent: Number(t.rate_percent),
      }))}
      taxAudience="quote"
      collections={(collections ?? []).map((c) => ({ id: c.id, name: c.name }))}
      componentLibrary={(companyComponents ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        collection_id: (c.collection_id as string | null) ?? null,
      }))}
      catalogs={(catalogList ?? []).map((c) => ({ id: c.id, name: c.name }))}
      editorTitle="Blank Quote"
      previewTitle="Quote Preview"
    />
  );
}
