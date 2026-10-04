import { getActiveDemoContext } from '@/app/lib/demo/context';
import { QuotePreview } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/QuotePreview';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadQuote, loadCustomerQuoteLines } from '../../actions';
import { loadQuoteTaxes } from '@/app/lib/taxes/actions';
import { computeTaxLines } from '@/app/lib/taxes/types';
import Link from 'next/link';
import { getEffectiveCurrency } from '@/app/lib/currency/currencies';
import { DownloadPDFButton } from './DownloadPDFButton';

export default async function CustomerQuotePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  const profile = await requireCompanyContext();
  const demo = await getActiveDemoContext(profile.company_id);

  const [quote, savedLines, quoteTaxes] = await Promise.all([
    loadQuote(id),
    loadCustomerQuoteLines(id),
    loadQuoteTaxes(id),
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

  // Display: only visible lines
  const visibleLines = savedLines.filter(l => l.is_visible);
  
  // Total: ALL lines where "Add $" is checked (regardless of visibility)
  const subtotal = savedLines.filter(l => l.include_in_total).reduce((sum, l) => sum + (l.custom_amount || 0), 0);
  const { lines: taxLines, total: taxTotal } = computeTaxLines(quoteTaxes, subtotal, 'quote');
  const total = subtotal + taxTotal;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-3 sm:p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <Link
            href={`/${workspaceSlug}/quotes/${id}/summary`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </Link>
          <div className="flex items-center gap-3">
            {!demo && <DownloadPDFButton 
              quoteNumber={quote.quote_number}
              customerName={quote.customer_name}
            />}
            <Link
              href={`/${workspaceSlug}/quotes/${id}/customer-edit`}
              className="px-3 py-1.5 text-sm font-medium text-slate-700 border border-slate-300 rounded-full hover:bg-slate-50 pill-shimmer"
            >
              Edit Customer Quote
            </Link>
          </div>
        </div>

        {/* Quote Document */}
        <div data-pdf-content className="qc-recipient-paper bg-white border border-slate-200 shadow-sm">
          {demo && <div className="border-b-2 border-orange-500 bg-orange-50 p-4 font-bold text-orange-900">DEMO - NOT A REAL QUOTE</div>}
          <QuotePreview quote={quote} lines={visibleLines.map(line => ({
            id: line.id, text: line.custom_text || '', quantityText: line.quantity_text,
            amount: line.custom_amount || 0, showPrice: line.show_price, showUnits: line.show_units ?? true,
            qty: (line as { qty?: number }).qty, unitPrice: (line as { unit_price?: number | null }).unit_price,
          }))} subtotal={subtotal} taxLines={taxLines} taxTotal={taxTotal} total={total}
            companyName={quote.cq_company_name || ''} companyAddress={quote.cq_company_address || ''}
            companyPhone={quote.cq_company_phone || ''} companyEmail={quote.cq_company_email || ''}
            companyLogoUrl={quote.cq_company_logo_url || ''} footerText={quote.cq_footer_text || ''}
            currency={effectiveCurrency} showEditButtons={false}
            showQuantityColumn={!!(quote as { show_quantity_column?: boolean }).show_quantity_column}
            hideLinePrices={!!(quote as { hide_line_prices?: boolean }).hide_line_prices}
            hideTotals={!!(quote as { hide_totals?: boolean }).hide_totals}
            
          />
        </div>

      </div>
    </div>
  );
}
