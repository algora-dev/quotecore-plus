/**
 * Seed a freshly-created company with the canonical starter components.
 *
 * On signup we copy every row from the `TEMPLATE_COMPANY_ID` company's
 * `component_library` into the new company, preserving every field that
 * makes sense to copy (rates, waste defaults, pitch settings, flashing
 * assignments, etc.) and re-keying `id` / `company_id`.
 *
 * Failure mode is intentionally non-fatal: signup must not be blocked
 * if the template seed errors out. We log and move on; users can still
 * create their own components.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, TablesInsert } from '@/app/lib/supabase/server';

/**
 * Company id for the canonical "templates" account. Owned by
 * templates@gmail.com (fake mailbox - never email it). The 8 starter
 * components live here and are cloned into every new company on signup.
 */
export const TEMPLATE_COMPANY_ID = 'a1f017e5-cd0b-4f01-97cf-105372fe5674';

type Admin = SupabaseClient<Database>;

export async function seedTemplateComponents(
  admin: Admin,
  newCompanyId: string,
  /**
   * Generic Trades Phase 3: when supplied, every seeded row is tagged with
   * this collection id. Required on the live signup flow once Phase 3 ships;
   * remains optional so backwards-compat callers (e.g. legacy scripts) don't
   * break before the column is tightened to NOT NULL in Phase 4.
   */
  collectionId?: string | null,
): Promise<{ seeded: number; error: string | null }> {
  try {
    const { data: templates, error: loadError } = await admin
      .from('component_library')
      .select(
        'name, component_type, measurement_type, default_material_rate, default_labour_rate, default_waste_type, default_waste_percent, default_waste_fixed, default_pitch_type, eligible_for_orders, flashing_ids, is_active, show_dimensions_default, show_price_default, sort_order',
      )
      .eq('company_id', TEMPLATE_COMPANY_ID)
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (loadError) {
      console.error('[seedTemplateComponents] load failed:', loadError);
      return { seeded: 0, error: loadError.message };
    }
    if (!templates || templates.length === 0) {
      console.warn('[seedTemplateComponents] template company has no components; skipping.');
      return { seeded: 0, error: null };
    }

    // NOTE: `flashing_ids` references flashing_library rows in the template
    // company - those ids will NOT exist in the new company. Strip them on
    // copy so the new component just has no flashings attached. Users can
    // add their own flashings later. Same logic applies if/when we ever
    // seed flashings; for now flashing_ids is intentionally cleared.
    const rows: TablesInsert<'component_library'>[] = templates.map((t) => ({
      company_id: newCompanyId,
      name: t.name,
      component_type: t.component_type,
      measurement_type: t.measurement_type,
      default_material_rate: t.default_material_rate,
      default_labour_rate: t.default_labour_rate,
      default_waste_type: t.default_waste_type,
      default_waste_percent: t.default_waste_percent,
      default_waste_fixed: t.default_waste_fixed,
      default_pitch_type: t.default_pitch_type,
      eligible_for_orders: t.eligible_for_orders,
      flashing_ids: null,
      is_active: t.is_active,
      show_dimensions_default: t.show_dimensions_default,
      show_price_default: t.show_price_default,
      sort_order: t.sort_order,
      // Phase 3: tag every seeded row with the bootstrap collection so the
      // FK (company_id, collection_id) -> component_collections is set
      // immediately. Falls back to NULL when no collection id supplied
      // (legacy callers / pre-Phase-3 backfill paths).
      ...(collectionId ? { collection_id: collectionId } : {}),
    }) as TablesInsert<'component_library'>);

    const { error: insertError } = await admin.from('component_library').insert(rows);
    if (insertError) {
      console.error('[seedTemplateComponents] insert failed:', insertError);
      return { seeded: 0, error: insertError.message };
    }

    console.log(`[seedTemplateComponents] seeded ${rows.length} components into company ${newCompanyId}`);
    return { seeded: rows.length, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[seedTemplateComponents] threw:', message);
    return { seeded: 0, error: message };
  }
}
