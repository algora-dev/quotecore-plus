/**
 * Seed a freshly-created company with its starter components.
 *
 * TRADE-AWARE (2026-06-08): we seed ONLY the components for the company's
 * selected default trade - Roofing (8) or Generic (9) - into the company's
 * default collection, not both. This matches user expectation ("components
 * based on the trade I picked") and keeps the count under the Starter/trial
 * component cap (10).
 *
 * CAP BYPASS (2026-06-08): seeding goes through the SECURITY DEFINER RPC
 * `seed_starter_components`, which sets a transaction-local flag so the per-row
 * tier-cap trigger (require_component_slot) is skipped for the system seed.
 * Previously a direct bulk insert tripped the cap and rolled back the WHOLE
 * batch, leaving new companies with ZERO components - the "no test components
 * on signup" bug. Normal user inserts are still capped as before.
 *
 * Sourced from static data in starterComponentsData.ts. To update the seed
 * data, edit the libraries in the app account and regenerate the file.
 *
 * Seeding runs ONCE at company creation. Existing companies are never touched.
 * Failure is non-fatal to signup, but is returned (and logged) clearly so we
 * never silently ship zero components again.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/app/lib/supabase/server';
import {
  ROOFING_STARTER_COMPONENTS,
  GENERIC_STARTER_COMPONENTS,
  type StarterComponent,
} from './starterComponentsData';

/**
 * Legacy constant kept for backwards compatibility with any external callers.
 */
export const TEMPLATE_COMPANY_ID = 'a1f017e5-cd0b-4f01-97cf-105372fe5674';

type Admin = SupabaseClient<Database>;

/** Roofing is the only "roofing" trade; anything else seeds the generic set. */
function starterSetForTrade(trade: string | null | undefined): {
  label: string;
  components: StarterComponent[];
} {
  if ((trade ?? 'roofing') === 'roofing') {
    return { label: 'Roofing', components: ROOFING_STARTER_COMPONENTS };
  }
  return { label: 'Generic', components: GENERIC_STARTER_COMPONENTS };
}

/**
 * Seed the selected trade's starter components into the company via the
 * cap-bypassing RPC.
 *
 * @param admin        service-role client
 * @param newCompanyId the new company id
 * @param trade        the company's selected default trade ('roofing' | other)
 * @param collectionId the default ("My Components") collection id, or null
 */
export async function seedTemplateComponents(
  admin: Admin,
  newCompanyId: string,
  trade?: string | null,
  collectionId?: string | null,
): Promise<{ seeded: number; error: string | null }> {
  const { label, components } = starterSetForTrade(trade);

  // Shape rows to match the RPC's expected JSONB keys (column names).
  const rows = components.map((c, i) => ({
    name: c.name,
    component_type: c.component_type,
    measurement_type: c.measurement_type,
    default_material_rate: c.default_material_rate,
    default_labour_rate: c.default_labour_rate,
    default_waste_type: c.default_waste_type,
    default_waste_percent: c.default_waste_percent,
    default_waste_fixed: c.default_waste_fixed,
    default_pitch_type: c.default_pitch_type,
    eligible_for_orders: c.eligible_for_orders,
    sort_order: i,
    pricing_strategy: c.pricing_strategy,
    pack_price: c.pack_price,
    pack_size: c.pack_size,
    pack_coverage_m2: c.pack_coverage_m2,
    height_value_mm: c.height_value_mm,
    depth_value_mm: c.depth_value_mm,
    waste_unit: c.waste_unit,
    notes: c.notes,
  }));

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc('seed_starter_components', {
      p_company_id: newCompanyId,
      p_collection_id: collectionId ?? null,
      p_rows: rows,
    });

    if (error) {
      console.error(
        `[seedTemplateComponents] RPC failed for company ${newCompanyId} (${label}):`,
        error.message ?? error,
      );
      return { seeded: 0, error: error.message ?? String(error) };
    }

    const seeded = typeof data === 'number' ? data : Number(data) || 0;
    console.log(
      `[seedTemplateComponents] seeded ${seeded} ${label} components into company ${newCompanyId}`,
    );
    return { seeded, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[seedTemplateComponents] threw:', message);
    return { seeded: 0, error: message };
  }
}
