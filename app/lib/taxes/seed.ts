import 'server-only';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';

/**
 * Snapshot the company's current tax library onto a freshly-created quote.
 *
 * Best-effort: any failure here is logged to console.error and swallowed so
 * the quote-creation flow itself never breaks because of taxes. Callers
 * should `await` this immediately after creating the quote row.
 *
 * Used by every quote-creation path:
 *  - createQuoteFromTemplate
 *  - cloneQuote
 *  - createQuoteWithDetails (new-quote form, blank branch)
 *  - any future creation path
 *
 * Keeping this in one place means we cannot accidentally introduce a
 * creation path that produces a quote with no `quote_taxes` rows
 * (which previously caused the public accept page to silently fall back
 * to the legacy single-rate `quote.tax_rate` column).
 */
export async function seedQuoteTaxesOnCreate(quoteId: string, companyId: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: defaults } = await supabase
      .from('company_taxes')
      .select('id, name, rate_percent, sort_order')
      .eq('company_id', companyId)
      .is('archived_at', null)
      .order('sort_order', { ascending: true });

    if (!defaults || defaults.length === 0) return;

    const rows = defaults.map((d) => ({
      quote_id: quoteId,
      source_tax_id: d.id,
      name: d.name,
      rate_percent: d.rate_percent,
      sort_order: d.sort_order,
      include_in_quote: true,
      include_in_labor: true,
    }));
    await supabase.from('quote_taxes').insert(rows);
  } catch (err) {
    console.error('[seedQuoteTaxesOnCreate] failed:', err);
  }
}
