/**
 * Generic Trades Phase 3 - bootstrap collection helper.
 *
 * Returns the company's "My Components" bootstrap collection id, creating
 * it idempotently and concurrency-safely under a per-company advisory
 * lock + partial unique index. The actual locking + insert lives in the
 * SECURITY DEFINER PostgreSQL function `ensure_company_has_collection(uuid)`
 * created in `20260520120010_generic_trades_phase_2_dark_schema.sql`.
 *
 * Round-3 H-02 means this is the ONLY path that can create or modify a
 * bootstrap collection - authenticated users are RLS-blocked from touching
 * `is_bootstrap` at all.
 *
 * Call this:
 *   - At the last step of company creation (`completeGoogleOnboarding`,
 *     `signupWithCompany`).
 *   - From the one-off `scripts/backfill-component-collections.mjs` backfill.
 *   - As a defensive fallback before any code path that needs a collection
 *     for a company that may not have been bootstrapped yet (rare; current
 *     flows bootstrap on signup).
 *
 * Must be called via the admin client. The RPC has `REVOKE ALL FROM public,
 * anon, authenticated` and `GRANT EXECUTE TO service_role`, so user-context
 * supabase clients will get a 42501 permission error.
 */

import { createAdminClient } from '@/app/lib/supabase/admin';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/database.types';

type Admin = SupabaseClient<Database>;

/**
 * Return the company's bootstrap collection id, creating it if absent.
 *
 * @param companyId - the company to bootstrap.
 * @param admin - optional admin client to reuse an existing connection.
 *                If omitted, a fresh admin client is constructed.
 * @returns the uuid of the bootstrap `component_collections` row.
 * @throws  if the RPC fails for any reason other than benign idempotency.
 */
export async function ensureCompanyHasCollection(
  companyId: string,
  admin?: Admin,
): Promise<string> {
  const client = admin ?? createAdminClient();

  // database.types.ts has not been regenerated yet (typegen will run when
  // Phase 4 lands the create_quote_atomic changes), so the RPC name is not
  // in the typed catalog. Cast at the boundary; runtime value is correct.
  const { data, error } = await (client as unknown as {
    rpc: (
      name: string,
      args: { p_company_id: string },
    ) => Promise<{ data: string | null; error: Error | null }>;
  }).rpc('ensure_company_has_collection', { p_company_id: companyId });

  if (error) {
    console.error('[ensureCompanyHasCollection] RPC error:', error);
    throw new Error(
      `ensure_company_has_collection(${companyId}) failed: ${error.message}`,
    );
  }
  if (!data) {
    throw new Error(
      `ensure_company_has_collection(${companyId}) returned no id`,
    );
  }

  console.log(
    `[ensureCompanyHasCollection] company=${companyId} -> collection=${data}`,
  );
  return data;
}
