/**
 * Seed a freshly-created company with starter component collections.
 *
 * Seeds two collections:
 *   - "Roofing" — roofing starter components
 *   - "Generic" — generic construction starter components
 *
 * Sourced from static data in starterComponentsData.ts (fetched from
 * secarter23@gmail.com's libraries). To update the seed data, edit the
 * libraries in the app account and ask Gavin to regenerate starterComponentsData.ts.
 *
 * IMPORTANT: Seeding runs ONCE at company creation. Existing companies are
 * never touched — users can safely edit their components without risk of
 * being overwritten.
 *
 * Failure is non-fatal: signup must not be blocked if seeding fails.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/app/lib/supabase/server';
import {
  ROOFING_STARTER_COMPONENTS,
  GENERIC_STARTER_COMPONENTS,
  type StarterComponent,
} from './starterComponentsData';

/**
 * Legacy constant kept for backwards compatibility with any external callers.
 * The new seeder no longer reads from a template company; data is static.
 */
export const TEMPLATE_COMPANY_ID = 'a1f017e5-cd0b-4f01-97cf-105372fe5674';

type Admin = SupabaseClient<Database>;

/** Create (or find) a named collection for a company, returning its id. */
async function ensureCollection(
  admin: Admin,
  companyId: string,
  name: string,
): Promise<string | null> {
  const { data: existing } = await admin
    .from('component_collections')
    .select('id')
    .eq('company_id', companyId)
    .eq('name', name)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: created } = await admin
    .from('component_collections')
    .insert({ company_id: companyId, name, is_bootstrap: false })
    .select('id')
    .single();
  return created?.id ?? null;
}

/** Insert component rows for one collection. Returns count seeded. */
async function seedCollection(
  admin: Admin,
  companyId: string,
  collectionId: string | null,
  components: StarterComponent[],
): Promise<number> {
  const rows = components.map((c, i) => ({
    company_id: companyId,
    name: c.name,
    component_type: c.component_type as TablesInsert<'component_library'>['component_type'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    measurement_type: c.measurement_type as any,
    default_material_rate: c.default_material_rate,
    default_labour_rate: c.default_labour_rate,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default_waste_type: c.default_waste_type as any,
    default_waste_percent: c.default_waste_percent,
    default_waste_fixed: c.default_waste_fixed,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    default_pitch_type: c.default_pitch_type as any,
    eligible_for_orders: c.eligible_for_orders,
    flashing_ids: null,
    is_active: true,
    sort_order: i,
    // Phase 6.5 columns (stale database.types.ts — cast as any):
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    pricing_strategy: c.pricing_strategy as any,
    pack_price: c.pack_price,
    pack_size: c.pack_size,
    pack_coverage_m2: c.pack_coverage_m2,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    height_value_mm: c.height_value_mm as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    depth_value_mm: c.depth_value_mm as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    waste_unit: c.waste_unit as any,
    notes: c.notes,
    ...(collectionId ? { collection_id: collectionId } : {}),
  })) as TablesInsert<'component_library'>[];

  const { error } = await admin.from('component_library').insert(rows);
  if (error) {
    console.error(
      `[seedTemplateComponents] insert failed for collection "${collectionId}":`,
      error,
    );
    return 0;
  }
  return rows.length;
}

export async function seedTemplateComponents(
  admin: Admin,
  newCompanyId: string,
  /**
   * Legacy param: ignored in the new static-seed implementation.
   * Kept for backwards compatibility with the signup action caller.
   */
  _legacyCollectionId?: string | null,
): Promise<{ seeded: number; error: string | null }> {
  try {
    let totalSeeded = 0;

    // Seed Roofing collection
    const roofingCollId = await ensureCollection(admin, newCompanyId, 'Roofing');
    const roofingCount = await seedCollection(
      admin,
      newCompanyId,
      roofingCollId,
      ROOFING_STARTER_COMPONENTS,
    );
    totalSeeded += roofingCount;

    // Seed Generic collection
    const genericCollId = await ensureCollection(admin, newCompanyId, 'Generic');
    const genericCount = await seedCollection(
      admin,
      newCompanyId,
      genericCollId,
      GENERIC_STARTER_COMPONENTS,
    );
    totalSeeded += genericCount;

    console.log(
      `[seedTemplateComponents] seeded ${totalSeeded} components into company ${newCompanyId}` +
      ` (Roofing: ${roofingCount}, Generic: ${genericCount})`,
    );
    return { seeded: totalSeeded, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[seedTemplateComponents] threw:', message);
    return { seeded: 0, error: message };
  }
}
