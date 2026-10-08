import { QuotePreview } from '@/app/(auth)/[workspaceSlug]/quotes/[id]/customer-edit/QuotePreview';
import { headers } from 'next/headers';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { getEffectiveCurrency } from '@/app/lib/currency/currencies';
import { AcceptDeclineButtons } from './AcceptDeclineButtons';
import { RequestRequoteButton } from './RequestRequoteButton';
import { DownloadQuoteButton } from './DownloadQuoteButton';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { loadQuoteTaxesByQuoteId } from '@/app/lib/taxes/actions';
import { computeTaxLines } from '@/app/lib/taxes/types';
import { AttachmentsCard } from '@/app/components/public/AttachmentsCard';
import { StampRecipientView } from '@/app/lib/recipient/StampRecipientView';

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
      {/* Recipient-view stamping via idempotent POST server action (not GET). */}
      <StampRecipientView kind="quote" token={token} />
      <div className="max-w-4xl mx-auto p-3 sm:p-8 space-y-6">
        {/*
          Quote Document - exact same format as internal Customer Quote
          preview. The id is used by the DownloadQuoteButton's print-mode
          CSS to single this element out for print-to-PDF.
        */}
        <div id="public-quote-document" className="qc-recipient-paper bg-white border border-slate-200 shadow-sm">
          <QuotePreview quote={quote} lines={visibleLines.map((line) => ({
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
            metadataExtra={<> {quote.acceptance_token_expires_at && (() => {
                    const expiry = new Date(quote.acceptance_token_expires_at);
                    const remaining = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const expiryLabel = expiry.toLocaleDateString('en-NZ', { day: '2-digit', month: 'long', year: 'numeric' });
                    return remaining > 0 ? (
                      <p className="text-base text-black">
                        <span className="font-semibold">Valid until:</span> {expiryLabel}
                        <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 border border-orange-200">
                          {remaining} day{remaining !== 1 ? 's' : ''} remaining
                        </span>
                      </p>
                    ) : null;
                  })()} </>}
          />
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
