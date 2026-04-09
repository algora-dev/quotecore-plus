import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadQuote, loadCustomerQuoteLines } from '../../actions';
import Link from 'next/link';
import { formatCurrency, getEffectiveCurrency } from '@/app/lib/currency/currencies';
import { DownloadPDFButton } from './DownloadPDFButton';

export default async function CustomerQuotePage({
  params,
}: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const { workspaceSlug, id } = await params;
  await requireCompanyContext();

  const [quote, savedLines] = await Promise.all([
    loadQuote(id),
    loadCustomerQuoteLines(id),
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

  // Calculate totals from visible lines
  const visibleLines = savedLines.filter(l => l.is_visible);
  const subtotal = visibleLines.reduce((sum, l) => sum + (l.custom_amount || 0), 0);
  const tax = subtotal * (quote.tax_rate / 100);
  const total = subtotal + tax;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <Link
            href={`/${workspaceSlug}/quotes/${id}/summary`}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Back to Summary
          </Link>
          <div className="flex items-center gap-3">
            <DownloadPDFButton 
              quoteNumber={quote.quote_number}
              customerName={quote.customer_name}
            />
            <Link
              href={`/${workspaceSlug}/quotes/${id}/customer-edit`}
              className="px-3 py-1.5 text-sm font-medium text-purple-600 border border-purple-200 rounded-full hover:bg-purple-50"
            >
              Edit Customer Quote
            </Link>
          </div>
        </div>

        {/* Quote Document */}
        <div data-pdf-content className="bg-white rounded-xl shadow-lg border border-slate-200 p-8 space-y-6">
          {/* Quote Header */}
          <div className="border-b pb-6">
            {/* Logo (Top Right) - Always show placeholder or image */}
            <div className="flex justify-end mb-3">
              {quote.cq_company_logo_url ? (
                <img src={quote.cq_company_logo_url} alt="Company Logo" className="h-16 object-contain" />
              ) : (
                <div className="w-32 h-16 border-2 border-dashed border-slate-300 rounded flex items-center justify-center bg-slate-50">
                  <span className="text-xs text-slate-400">Logo</span>
                </div>
              )}
            </div>

            {/* Quote Info + Company Details (Side by Side) */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  QUOTE #{quote.quote_number || 'DRAFT'}
                </h1>
                <div className="mt-2 space-y-1">
                  <p className="text-base text-slate-900">
                    <span className="font-semibold">Client:</span> {quote.customer_name}
                  </p>
                  {quote.job_name && (
                    <p className="text-base text-slate-900">
                      <span className="font-semibold">Job:</span> {quote.job_name}
                    </p>
                  )}
                  {quote.site_address && (
                    <p className="text-base text-slate-900">
                      <span className="font-semibold">Site:</span> {quote.site_address}
                    </p>
                  )}
                  <p className="text-base text-slate-900">
                    <span className="font-semibold">Date:</span> {new Date(quote.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              
              {/* Company Details */}
              {(quote.cq_company_name || quote.cq_company_address || quote.cq_company_phone || quote.cq_company_email) && (
                <div className="text-right space-y-1">
                  {quote.cq_company_name && (
                    <p className="font-semibold text-base text-slate-900">{quote.cq_company_name}</p>
                  )}
                  {quote.cq_company_address && (
                    <p className="text-sm text-slate-600">{quote.cq_company_address}</p>
                  )}
                  {quote.cq_company_phone && (
                    <p className="text-sm text-slate-600">{quote.cq_company_phone}</p>
                  )}
                  {quote.cq_company_email && (
                    <p className="text-sm text-slate-600">{quote.cq_company_email}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            {visibleLines.length === 0 ? (
              <p className="text-slate-400 italic text-center py-8">
                No items in this quote. Edit the customer quote to add items.
              </p>
            ) : (
              visibleLines.map((line, idx) => (
                <div
                  key={line.id}
                  className="flex items-start justify-between py-3 border-b border-slate-100"
                >
                  <div className="flex-1">
                    <p className="text-slate-900">{line.custom_text}</p>
                  </div>
                  {line.show_price && (
                    <div className="ml-4">
                      <p className="text-slate-900 font-medium whitespace-nowrap">
                        {formatCurrency(line.custom_amount || 0, effectiveCurrency)}
                      </p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Totals */}
          {visibleLines.length > 0 && (
            <div className="space-y-3 pt-4 border-t-2 border-slate-300">
              <div className="flex justify-between text-base">
                <span className="text-slate-700">Subtotal</span>
                <span className="font-medium text-slate-900">{formatCurrency(subtotal, effectiveCurrency)}</span>
              </div>
              {quote.tax_rate > 0 && (
                <div className="flex justify-between text-base">
                  <span className="text-slate-700">Tax ({quote.tax_rate}%)</span>
                  <span className="font-medium text-slate-900">{formatCurrency(tax, effectiveCurrency)}</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-bold border-t-2 border-slate-300 pt-3">
                <span className="text-slate-900">Total</span>
                <span className="text-slate-900">{formatCurrency(total, effectiveCurrency)}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          {quote.cq_footer_text && (
            <div className="pt-6 border-t">
              <p className="text-sm text-slate-600 italic whitespace-pre-wrap">{quote.cq_footer_text}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
