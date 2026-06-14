import { redirect } from 'next/navigation';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadQuote, loadCustomerQuoteLines, loadCustomerQuoteTemplates } from '../../actions';
import { loadQuoteTaxes, loadCompanyTaxes } from '@/app/lib/taxes/actions';
import { loadComponentCollections, loadComponentLibrary } from '../../../components/actions';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { BlankQuoteBuilder } from './BlankQuoteBuilder';
import { getEffectiveCurrency } from '@/app/lib/currency/currencies';

/**
 * /quotes/[id]/blank-build - dedicated builder screen for quotes whose
 * `entry_mode` is `'blank'`.
 *
 * For blank quotes, the line items the user enters here ARE the master
 * data for the quote. There is no separate "quote builder" (Areas /
 * Components / Extras / Review) for this mode. The data still lives in
 * `customer_quote_lines` so the rest of the app (Summary totals, Send
 * Quote, Clone, Withdraw, Download) just works.
 *
 * If a user accidentally hits this route for a non-blank quote we send
 * them back to the appropriate builder for their entry_mode rather than
 * showing them the wrong UI.
 */
export default async function BlankBuildPage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  await requireCompanyContext();

  const admin = createAdminClient();
  const [quote, savedLines, templates, quoteTaxes, companyTaxes, collections, companyComponents] = await Promise.all([
    loadQuote(id),
    loadCustomerQuoteLines(id),
    loadCustomerQuoteTemplates(),
    loadQuoteTaxes(id),
    loadCompanyTaxes(),
    loadComponentCollections(),
    loadComponentLibrary(),
  ]);

  // Route-guard: only blank-mode quotes belong here. Anything else gets
  // routed back to where it should be edited from.
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

  // Logo: prefer the per-quote branding url; fall back to the company's
  // current saved logo so the header doesn't look empty on a fresh quote.
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
  const { data: catalogList } = await admin
    .from('catalogs')
    .select('id, name')
    .eq('company_id', quote.company_id)
    .order('name');

  return (
    <BlankQuoteBuilder
      quote={quote}
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
      collections={(collections ?? []).map((c) => ({ id: c.id, name: c.name }))}
      componentLibrary={(companyComponents ?? []).map((c) => ({
        id: c.id as string,
        name: c.name as string,
        collection_id: (c.collection_id as string | null) ?? null,
      }))}
      catalogs={(catalogList ?? []).map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
