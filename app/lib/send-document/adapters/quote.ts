'use server';

/**
 * Quote adapter for the unified send-document pipeline.
 *
 * Quotes are the most complex: expiring-commit token strategy (with
 * selectable expiry, body URL rewrite, rotation after withdrawal),
 * CQ branding overrides, customer total computation, margin warning,
 * and both library + entity file attachments.
 */

import crypto from 'node:crypto';
import { formatCurrency } from '@/app/lib/currency/currencies';
import { getEffectiveCurrency } from '@/app/lib/currency/currencies';
import { computeTaxLines } from '@/app/lib/taxes/types';
import { loadQuoteTaxesByQuoteId } from '@/app/lib/taxes/actions';
import { getSiteUrl } from '@/app/lib/email/urls';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DocumentSendAdapter, LoadedEntity, SharedMergeContext } from '../types';

interface QuoteEntity extends LoadedEntity {
  id: string;
  customer_name: string | null;
  job_name: string | null;
  quote_number: number | null;
  currency: string | null;
  tax_rate: number | null;
  acceptance_token: string | null;
  acceptance_token_expires_at: string | null;
  withdrawn_at: string | null;
  status: string;
  accepted_at: string | null;
  declined_at: string | null;
  cq_company_name: string | null;
  cq_company_email: string | null;
  cq_company_phone: string | null;
  cq_company_logo_url: string | null;
}

/**
 * Compute the customer-visible total for a quote as a localised
 * currency string suitable for {{quote_total}} substitution.
 *
 * Mirrors the /accept/<token> calculation: sum of customer_quote_lines
 * where include_in_total = true, plus tax via the multi-tax engine.
 * Returns null when there are no customer-quote lines yet (draft state).
 */
async function computeCustomerTotalString(
  supabase: SupabaseClient,
  quoteId: string,
  legacyTaxRate: number | null,
  storedCurrency: string | null,
  companyDefaultCurrency: string,
): Promise<string | null> {
  const { data: lines } = await supabase
    .from('customer_quote_lines')
    .select('custom_amount, include_in_total')
    .eq('quote_id', quoteId);

  if (!lines || lines.length === 0) return null;

  const subtotal = lines
    .filter((l) => l.include_in_total)
    .reduce((sum, l) => sum + Number(l.custom_amount ?? 0), 0);

  const quoteTaxes = await loadQuoteTaxesByQuoteId(quoteId);
  let taxTotal = 0;
  if (quoteTaxes.length > 0) {
    taxTotal = computeTaxLines(quoteTaxes, subtotal, 'quote').total;
  } else if ((legacyTaxRate ?? 0) > 0) {
    taxTotal = subtotal * Number(legacyTaxRate);
  }

  const total = subtotal + taxTotal;
  const currency = getEffectiveCurrency(storedCurrency, companyDefaultCurrency);
  return formatCurrency(total, currency);
}

export const quoteAdapter: DocumentSendAdapter = {
  kind: 'quote_send',

  async loadEntity(supabase, companyId, id) {
    const { data, error } = await supabase
      .from('quotes')
      .select(
        'id, customer_name, job_name, quote_number, currency, tax_rate, acceptance_token, acceptance_token_expires_at, withdrawn_at, status, accepted_at, declined_at, cq_company_name, cq_company_email, cq_company_phone, cq_company_logo_url',
      )
      .eq('id', id)
      .eq('company_id', companyId)
      .maybeSingle();
    if (error || !data) return null;
    return data as QuoteEntity;
  },

  // No validateSendable — quotes can be sent from any non-draft status.
  // The token logic handles edge cases (accepted/declined/withdrawn).

  async resolveToken(entity, companyId) {
    const quote = entity as QuoteEntity;

    // Reuse a live token if one exists and hasn't been withdrawn or expired.
    if (
      quote.acceptance_token &&
      !quote.withdrawn_at &&
      (!quote.acceptance_token_expires_at ||
        new Date(quote.acceptance_token_expires_at) > new Date())
    ) {
      return quote.acceptance_token;
    }

    // Mint a new token only if the quote is in a sendable state.
    if (!quote.accepted_at && !quote.declined_at && quote.status !== 'draft') {
      // We need a supabase client to write. The adapter interface doesn't
      // pass one to resolveToken, so the orchestrator handles token minting
      // for quotes. Return null here and the orchestrator will mint.
      return null;
    }

    return null;
  },

  async buildMergeContext(entity, shared) {
    const quote = entity as QuoteEntity;
    // Note: quote_total and quote_link are computed/injected by the
    // orchestrator (they need DB queries + token resolution).
    return {
      ...shared,
      job_name: quote.job_name ?? undefined,
      quote_number: quote.quote_number != null ? String(quote.quote_number) : undefined,
      quote_status: quote.status ?? undefined,
      quote_currency: quote.currency ?? undefined,
    };
  },

  resolveBranding(entity, companyName, companyEmail) {
    const quote = entity as QuoteEntity;
    return {
      companyName: quote.cq_company_name || companyName,
      companyEmail: quote.cq_company_email || companyEmail,
      companyPhone: quote.cq_company_phone,
      companyLogoUrl: quote.cq_company_logo_url,
    };
  },

  pipelineExtras(entity, token) {
    const quote = entity as QuoteEntity;
    const siteUrl = getSiteUrl();
    const quoteUrl = token ? `${siteUrl}/accept/${token}` : null;
    return {
      relatedQuoteId: quote.id,
      primaryCta: quoteUrl
        ? { label: 'View Quote', url: quoteUrl }
        : null,
    };
  },

  // No afterSend for quotes (token commit + job_status handled in orchestrator).

  revalidatePaths(workspaceSlug, entityId) {
    return [
      `/${workspaceSlug}/quotes/${entityId}/summary`,
    ];
  },

  // Quotes support both library + entity (quote) files.
  // No filterAttachments — pass through as-is.
};

/**
 * Mint a new acceptance token for a quote (called by the orchestrator
 * when resolveToken returns null for a sendable quote).
 *
 * Mirrors the exact logic from the old sendQuoteMessage action:
 * - 30-day default expiry
 * - Sets job_status = 'sent'
 * - Clears withdrawn_at + withdrawn_by_user_id (re-issue clears prior withdrawal)
 */
export async function ensureQuoteAcceptanceToken(
  supabase: SupabaseClient,
  quoteId: string,
  companyId: string,
): Promise<string | null> {
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);
  const { error } = await supabase
    .from('quotes')
    .update({
      acceptance_token: token,
      acceptance_token_expires_at: expiresAt.toISOString(),
      job_status: 'sent',
      withdrawn_at: null,
      withdrawn_by_user_id: null,
    })
    .eq('id', quoteId)
    .eq('company_id', companyId);
  if (error) return null;
  return token;
}

/**
 * Compute the quote total string for the merge context.
 * Exported for the orchestrator to call after loading the entity.
 */
export async function computeQuoteTotalForMerge(
  supabase: SupabaseClient,
  quoteId: string,
  legacyTaxRate: number | null,
  storedCurrency: string | null,
  companyDefaultCurrency: string,
): Promise<string | null> {
  return computeCustomerTotalString(supabase, quoteId, legacyTaxRate, storedCurrency, companyDefaultCurrency);
}
