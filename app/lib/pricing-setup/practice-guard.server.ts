import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Immutable quote-component snapshots identify practice pricing even if the
 * originating library component was later edited, verified or deleted.
 * The DB also blocks activation of public acceptance tokens, as defence in depth.
 */
export async function assertQuoteHasNoPracticePricing(
  db: SupabaseClient,
  quoteId: string,
): Promise<void> {
  if (process.env.NEXT_PUBLIC_PRICING_SETUP_ENABLED !== 'true') return;
  const { data, error } = await db.from('quote_components')
    .select('id').eq('quote_id', quoteId)
    .eq('pricing_setup_practice_snapshot', true).limit(1);
  if (error) throw new Error('Could not verify quote pricing status; customer sending is unavailable.');
  if (data?.length) throw new Error('This quote uses example pricing and is for practice only. Verify the components and create a new quote before sharing it with a customer.');
}
