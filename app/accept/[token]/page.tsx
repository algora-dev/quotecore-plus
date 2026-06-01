import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { formatCurrency, getEffectiveCurrency } from '@/app/lib/currency/currencies';
import { AcceptDeclineButtons } from './AcceptDeclineButtons';
import { RequestRequoteButton } from './RequestRequoteButton';
import { DownloadQuoteButton } from './DownloadQuoteButton';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { loadQuoteTaxesByQuoteId } from '@/app/lib/taxes/actions';
import { computeTaxLines } from '@/app/lib/taxes/types';
import { AttachmentsCard } from '@/app/components/public/AttachmentsCard';
import { displayLineText } from '@/app/lib/quotes/lineText';

/**
 * Validate token format up front so a malformed URL fails fast without
 * hitting the DB. Mirrors the regex used in `app/accept/[token]/actions.ts`.
 */
function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export default async function AcceptQuotePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Reject obviously-bad tokens before any DB or rate-limiter work.
  if (!token || !isValidUUID(token)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-lg">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Quote Not Found</h1>
          <p className="text-sm text-slate-500">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  // Rate limit: 20 attempts per IP per hour
  const hdrs = await headers();
  const ip = getClientIP(hdrs);
  if (!(await checkRateLimit(`accept:${ip}`, 20, 60 * 60 * 1000))) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg border border-slate-200 p-8 max-w-md text-center">
          <h1 className="text-xl font-bold text-slate-900 mb-2">Too Many Requests</h1>
          <p className="text-sm text-slate-600">Please try again later.</p>
        </div>
      </div>
    );
  }

  const supabase = createAdminClient();

  // Load quote by acceptance token (public - no auth required)
  const { data: quote, error } = await supabase
    .from('quotes')
    .select('*')
    .eq('acceptance_token', token)
    .single();

  if (error || !quote) {
    // No quote at all - we can't show a re-quote button because we have no
    // company to route the request to. Show the original generic message.
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="bg-white rounded-xl p-8 max-w-md text-center shadow-lg">
          <h1 className="text-xl font-semibold text-slate-900 mb-2">Quote Not Found</h1>
          <p className="text-sm text-slate-500">This link may be invalid or expired.</p>
        </div>
      </div>
    );
  }

  // Withdrawn by the sender - same UI as expired, since from the customer's
  // perspective both states mean "this quote is no longer valid". We don't
  // distinguish them in the customer-facing copy because the user might have
  // withdrawn for any number of reasons.
  if ((quote as any).withdrawn_at) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-lg">
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Quote No Longer Valid</h1>
            <p className="text-sm text-slate-500">
              This quote is no longer valid. You can request a fresh quote below or contact the sender directly.
            </p>
          </div>
          <RequestRequoteButton
            token={token}
            variant="expired"
            defaultCustomerName={quote.customer_name ?? null}
            defaultCustomerEmail={quote.customer_email ?? null}
          />
        </div>
      </div>
    );
  }

  // Check token expiry - we still surface the re-quote CTA so an aged-out
  // link becomes an inbound lead instead of a dead end.
  if (quote.acceptance_token_expires_at && new Date(quote.acceptance_token_expires_at) < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-lg">
          <div className="text-center mb-6">
            <h1 className="text-xl font-semibold text-slate-900 mb-2">Link Expired</h1>
            <p className="text-sm text-slate-500">
              This quote link has expired. You can request a fresh quote below or contact the sender directly.
            </p>
          </div>
          <RequestRequoteButton
            token={token}
            variant="expired"
            defaultCustomerName={quote.customer_name ?? null}
            defaultCustomerEmail={quote.customer_email ?? null}
          />
        </div>
      </div>
    );
  }

  // NOTE (fix #4): we intentionally NO LONGER short-circuit when the quote has
  // been accepted/declined. The full document, attachments, and action bar are
  // always rendered; the action bar shows a status banner + disabled
  // Accept/Decline while Request Changes stays live. This keeps the token URL
  // a durable surface so follow-up / auto-fire messages that link to the SAME
  // URL (and carry their own attachments) remain reachable after a decision.
  const decision: { status: 'accepted' | 'declined'; decidedAt: string } | null =
    quote.accepted_at
      ? { status: 'accepted', decidedAt: quote.accepted_at }
      : quote.declined_at
        ? { status: 'declined', decidedAt: quote.declined_at }
        : null;

  // Load company info for currency
  const { data: company } = await supabase
    .from('companies')
    .select('name, default_currency')
    .eq('id', quote.company_id)
    .single();

  const companyDefaultCurrency = company?.default_currency || 'NZD';
  const effectiveCurrency = getEffectiveCurrency(quote.currency, companyDefaultCurrency);

  // Load saved customer quote lines
  const { data: savedLines } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', quote.id)
    .order('sort_order');

  const allLines = savedLines || [];
  const visibleLines = allLines.filter((l: any) => l.is_visible);
  const subtotal = allLines.filter((l: any) => l.include_in_total).reduce((sum: number, l: any) => sum + (l.custom_amount || 0), 0);

  // Use the multi-tax engine so the customer sees the same totals as the
  // internal summary/customer pages. Token validation above has already
  // proved access to this quote, so the public-safe loader is appropriate.
  const quoteTaxes = await loadQuoteTaxesByQuoteId(quote.id);
  let taxLines: { id: string; name: string; rate_percent: number; amount: number }[] = [];
  let taxTotal = 0;
  if (quoteTaxes.length > 0) {
    const computed = computeTaxLines(quoteTaxes, subtotal, 'quote');
    taxLines = computed.lines;
    taxTotal = computed.total;
  } else if ((quote.tax_rate || 0) > 0) {
    // LEGACY FALLBACK: pre-multi-tax quotes never had `quote_taxes` rows seeded.
    // We honour the legacy single-rate column so historical quotes still total
    // correctly. New quotes will always have rows and skip this branch.
    const legacyAmount = subtotal * ((quote.tax_rate || 0) / 100);
    taxLines = [{ id: 'legacy', name: 'Tax', rate_percent: quote.tax_rate, amount: legacyAmount }];
    taxTotal = legacyAmount;
  }
  const total = subtotal + taxTotal;

  // Hosted attachments for this quote (Option B). Token validation above has
  // already proved access. Per-file Download hits the gated route, which
  // re-validates this same token before minting any signed URL.
  const { data: attachmentRows } = await supabase
    .from('message_attachments')
    .select('id, display_name')
    .eq('quote_id', quote.id)
    .order('created_at', { ascending: true });
  const attachments = (attachmentRows ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
  }));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto p-8 space-y-6">
        {/*
          Quote Document - exact same format as internal Customer Quote
          preview. The id is used by the DownloadQuoteButton's print-mode
          CSS to single this element out for print-to-PDF.
        */}
        <div id="public-quote-document" className="bg-white rounded-xl border border-black p-12 space-y-8">
          {/* Quote Header */}
          <div className="border-b-2 border-black pb-6 mb-6">
            {/* Logo (Top Right) */}
            <div className="flex justify-end mb-6">
              {quote.cq_company_logo_url ? (
                <img src={quote.cq_company_logo_url} alt="Company Logo" className="h-16 object-contain" />
              ) : (
                <div className="w-32 h-16 border-2 border-dashed border-black rounded flex items-center justify-center bg-white">
                  <span className="text-xs text-black">Logo</span>
                </div>
              )}
            </div>

            {/* Quote Info + Company Details (Side by Side) */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold text-black mb-4">
                  QUOTE #{quote.quote_number || 'DRAFT'}
                </h1>
                <div className="space-y-2">
                  <p className="text-base text-black">
                    <span className="font-semibold">Client:</span> {quote.customer_name}
                  </p>
                  {quote.job_name && (
                    <p className="text-base text-black">
                      <span className="font-semibold">Job:</span> {quote.job_name}
                    </p>
                  )}
                  {quote.site_address && (
                    <p className="text-base text-black">
                      <span className="font-semibold">Site:</span> {quote.site_address}
                    </p>
                  )}
                  <p className="text-base text-black">
                    <span className="font-semibold">Date:</span> {new Date(quote.created_at).toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>
              
              {/* Company Details */}
              {(quote.cq_company_name || quote.cq_company_address || quote.cq_company_phone || quote.cq_company_email) && (
                <div className="text-right space-y-1">
                  {quote.cq_company_name && (
                    <p className="font-semibold text-base text-black">{quote.cq_company_name}</p>
                  )}
                  {quote.cq_company_address && (
                    <p className="text-sm text-black">{quote.cq_company_address}</p>
                  )}
                  {quote.cq_company_phone && (
                    <p className="text-sm text-black">{quote.cq_company_phone}</p>
                  )}
                  {quote.cq_company_email && (
                    <p className="text-sm text-black">{quote.cq_company_email}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            {visibleLines.length === 0 ? (
              <p className="text-black italic text-center py-8">
                No items in this quote.
              </p>
            ) : (
              visibleLines.map((line: any) => (
                <div
                  key={line.id}
                  className="flex items-start justify-between py-3 border-b border-black"
                >
                  <div className="flex-1">
                    <p className="text-black">
                      {displayLineText(line.custom_text, line.quantity_text, line.show_units)}
                    </p>
                  </div>
                  {line.show_price && (
                    <div className="ml-4">
                      <p className="text-black font-medium whitespace-nowrap">
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
            <div className="space-y-3 pt-4 border-t-2 border-black">
              <div className="flex justify-between text-base">
                <span className="text-black">Subtotal</span>
                <span className="font-medium text-black">{formatCurrency(subtotal, effectiveCurrency)}</span>
              </div>
              {taxLines.length > 0 && (
                <>
                  {taxLines.map((tl) => (
                    <div key={tl.id} className="flex justify-between text-base">
                      <span className="text-black">{tl.name} ({tl.rate_percent}%)</span>
                      <span className="font-medium text-black">{formatCurrency(tl.amount, effectiveCurrency)}</span>
                    </div>
                  ))}
                  {taxLines.length > 1 && (
                    <div className="flex justify-between text-base border-t border-black pt-2">
                      <span className="text-black">Tax total</span>
                      <span className="font-medium text-black">{formatCurrency(taxTotal, effectiveCurrency)}</span>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between text-xl font-bold border-t-2 border-black pt-3">
                <span className="text-black">Total</span>
                <span className="text-black">{formatCurrency(total, effectiveCurrency)}</span>
              </div>
            </div>
          )}

          {/* Footer */}
          {quote.cq_footer_text && (
            <div className="pt-6 border-t border-black">
              <p className="text-sm text-black italic whitespace-pre-wrap">{quote.cq_footer_text}</p>
            </div>
          )}
        </div>

        {/* Accept / Request Changes / Decline / Download rendered as a single
            button row so the four options read as siblings of the same
            decision surface. Download is passed via `secondaryAction` so it
            also stays visible after the user accepts or declines. */}
        <AcceptDeclineButtons
          token={token}
          initialDecision={decision}
          middleAction={
            <RequestRequoteButton
              token={token}
              variant="active"
              defaultCustomerName={quote.customer_name ?? null}
              defaultCustomerEmail={quote.customer_email ?? null}
            />
          }
          secondaryAction={<DownloadQuoteButton printTargetId="public-quote-document" />}
        />

        <AttachmentsCard token={token} files={attachments} />
      </div>
    </div>
  );
}
