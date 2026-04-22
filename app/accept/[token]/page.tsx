import { createAdminClient } from '@/app/lib/supabase/admin';
import { formatCurrency, getEffectiveCurrency } from '@/app/lib/currency/currencies';
import { AcceptDeclineButtons } from './AcceptDeclineButtons';

export default async function AcceptQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createAdminClient();

  // Load quote by acceptance token (public - no auth required)
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('id, customer_name, job_name, quote_number, company_id, currency, tax_rate, accepted_at, declined_at, acceptance_token')
    .eq('acceptance_token', token)
    .single();

  if (error || !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-lg">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Quote Not Found</h1>
          <p className="text-sm text-slate-500">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  // Check if already responded
  if (quote.accepted_at || quote.declined_at) {
    const wasAccepted = !!quote.accepted_at;
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-lg">
          <div className={`w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center ${wasAccepted ? 'bg-emerald-100' : 'bg-red-100'}`}>
            {wasAccepted ? (
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </div>
          <h1 className="text-xl font-semibold text-slate-900 mb-2">
            Quote Already {wasAccepted ? 'Accepted' : 'Declined'}
          </h1>
          <p className="text-sm text-slate-500">
            This quote was {wasAccepted ? 'accepted' : 'declined'} on{' '}
            {new Date(wasAccepted ? quote.accepted_at! : quote.declined_at!).toLocaleDateString('en-NZ', {
              day: '2-digit', month: 'short', year: 'numeric',
            })}.
          </p>
        </div>
      </div>
    );
  }

  // Load company info for branding
  const { data: company } = await supabase
    .from('companies')
    .select('name, default_currency')
    .eq('id', quote.company_id)
    .single();

  const companyDefaultCurrency = company?.default_currency || 'NZD';
  const effectiveCurrency = getEffectiveCurrency(quote.currency, companyDefaultCurrency);

  // Load saved customer quote lines
  const { data: customerLines } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', quote.id)
    .eq('is_visible', true)
    .order('sort_order');

  const visibleLines = customerLines || [];
  const totalLines = visibleLines.filter(l => l.include_in_total);
  const subtotal = totalLines.reduce((sum, l) => sum + (l.custom_amount || l.amount || 0), 0);
  const tax = subtotal * ((quote.tax_rate || 0) / 100);
  const grandTotal = subtotal + tax;

  // Load company branding from quote
  const { data: brandingQuote } = await supabase
    .from('quotes')
    .select('cq_company_name, cq_company_address, cq_company_phone, cq_company_email, cq_company_logo_url, cq_footer_text')
    .eq('id', quote.id)
    .single();

  const branding = brandingQuote || {} as any;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Company Header */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-start justify-between">
            <div>
              {branding.cq_company_logo_url && (
                <img
                  src={branding.cq_company_logo_url}
                  alt="Company Logo"
                  className="h-12 mb-3"
                />
              )}
              <h2 className="text-lg font-semibold text-slate-900">
                {branding.cq_company_name || company?.name || 'Company'}
              </h2>
              {branding.cq_company_address && (
                <p className="text-sm text-slate-500">{branding.cq_company_address}</p>
              )}
              {branding.cq_company_phone && (
                <p className="text-sm text-slate-500">{branding.cq_company_phone}</p>
              )}
              {branding.cq_company_email && (
                <p className="text-sm text-slate-500">{branding.cq_company_email}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-slate-900">Quote #{quote.quote_number}</p>
              <p className="text-sm text-slate-500">{quote.customer_name}</p>
              {quote.job_name && <p className="text-xs text-slate-400">{quote.job_name}</p>}
            </div>
          </div>
        </div>

        {/* Quote Lines */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h3 className="text-base font-semibold text-slate-900 mb-4">Quote Details</h3>
          
          {visibleLines.length > 0 ? (
            <div className="space-y-2">
              {visibleLines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0"
                >
                  <span className="text-sm text-slate-700">
                    {line.custom_text || line.label || 'Item'}
                  </span>
                  {line.include_in_total && (
                    <span className="text-sm font-medium text-slate-900">
                      {formatCurrency(line.custom_amount || line.amount || 0, effectiveCurrency)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No items listed.</p>
          )}

          {/* Totals */}
          <div className="mt-6 pt-4 border-t border-slate-200 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="text-slate-900">{formatCurrency(subtotal, effectiveCurrency)}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Tax ({quote.tax_rate}%)</span>
                <span className="text-slate-900">{formatCurrency(tax, effectiveCurrency)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-slate-200">
              <span className="text-slate-900">Total</span>
              <span className="text-slate-900">{formatCurrency(grandTotal, effectiveCurrency)}</span>
            </div>
          </div>
        </div>

        {/* Footer text */}
        {branding.cq_footer_text && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <p className="text-xs text-slate-500 whitespace-pre-wrap">{branding.cq_footer_text}</p>
          </div>
        )}

        {/* Accept/Decline */}
        <AcceptDeclineButtons token={token} />
      </div>
    </div>
  );
}
