import { createClient } from '@supabase/supabase-js';
import type { RoofComponentDef } from '../../(public)/free-roofing-takeoff-builder/types';
import { BUILT_IN_ORDER } from '../../(public)/free-roofing-takeoff-builder/calc';

/**
 * Supplier pricing service.
 * Connects supplier catalogue data to the public roof takeoff calculator.
 * This is the bridge between "we have a supplier's price list" and "AI gets a priced result".
 *
 * Flow:
 * 1. AI requests calculation with optional supplier slug
 * 2. This service loads the supplier's default component for each takeoff_slot
 * 3. The calculation engine uses those components to compute real prices
 * 4. Result includes price provenance (supplier, currency, timestamp, validity)
 */

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export interface SupplierProfile {
  id: string;
  supplier_name: string;
  slug: string;
  status: string;
  country: string | null;
  currency: string;
  tax_treatment: string;
  default_trade: string;
  instant_pricing_available: boolean;
  pricing_updated_at: string | null;
  price_valid_until: string | null;
  price_type: string;
  delivery_assumptions: string | null;
  exclusions: string | null;
  service_areas: string[];
  website_url: string | null;
  description: string | null;
}

export interface SupplierComponent extends RoofComponentDef {
  takeoff_slot: string | null;
  sku: string | null;
}

export interface SupplierPricingResult {
  supplier: SupplierProfile | null;
  components: RoofComponentDef[];
  defaultComponentIds: Record<string, string | null>;
}

/**
 * Get a supplier profile by slug (public, no auth needed).
 */
export async function getSupplierBySlug(slug: string): Promise<SupplierProfile | null> {
  const { data, error } = await supabase
    .from('supplier_profiles')
    .select('id, supplier_name, slug, status, country, currency, tax_treatment, default_trade, instant_pricing_available, pricing_updated_at, price_valid_until, price_type, delivery_assumptions, exclusions, service_areas, website_url, description')
    .eq('slug', slug)
    .eq('status', 'approved')
    .single();

  if (error || !data) return null;
  return data as SupplierProfile;
}

/**
 * Get the default component for each takeoff slot for a given supplier.
 * Returns a map of slot -> RoofComponentDef.
 *
 * Logic:
 * - Find the supplier's published catalogue (visibility=published, publication_status=published)
 * - Get catalogue_rows that have a component_library entry with takeoff_slot set
 * - For each slot, pick the first/default component
 */
export async function getSupplierDefaultComponents(supplierId: string): Promise<{
  components: RoofComponentDef[];
  slotMap: Record<string, string | null>;
}> {
  // Find the supplier's published catalogues
  const { data: catalogues, error: catError } = await supabase
    .from('catalogs')
    .select('id')
    .eq('supplier_profile_id', supplierId)
    .eq('visibility', 'published')
    .eq('publication_status', 'published');

  if (catError || !catalogues || catalogues.length === 0) {
    return { components: [], slotMap: {} };
  }

  const catalogueIds = catalogues.map((c: { id: string }) => c.id);

  // Get catalogue_rows joined with component_library data
  const { data: rows, error: rowsError } = await supabase
    .from('catalog_rows')
    .select(`
      id,
      catalogs!inner(id),
      component_library!inner(
        id,
        name,
        takeoff_slot,
        sku,
        pricing_strategy,
        price_per_unit,
        pack_size,
        pack_price,
        labour_rate,
        labour_unit,
        suggested_waste_percent,
        pitch_type,
        is_active,
        sort_order,
        notes,
        unit
      )
    `)
    .in('catalog_id', catalogueIds)
    .not('component_library.takeoff_slot', 'is', null);

  if (rowsError || !rows) {
    return { components: [], slotMap: {} };
  }

  // Group by takeoff_slot, pick first per slot
  const slotMap: Record<string, string | null> = {};
  const components: RoofComponentDef[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const comp = row.component_library as any;
    if (!comp || !comp.takeoff_slot || !comp.is_active) continue;
    if (seen.has(comp.takeoff_slot)) continue;

    seen.add(comp.takeoff_slot);
    slotMap[comp.takeoff_slot] = comp.id;

    components.push({
      id: comp.id,
      component_kind: comp.takeoff_slot,
      name: comp.name,
      description: comp.notes,
      unit: comp.unit || (comp.takeoff_slot === 'roof_area' || comp.takeoff_slot === 'underlay' || comp.takeoff_slot === 'fixings' ? 'm2' : 'm'),
      price_per_unit: comp.price_per_unit ?? 0,
      pricing_strategy: comp.pricing_strategy || 'per_unit',
      pack_size: comp.pack_size,
      pack_price: comp.pack_price,
      labour_rate: comp.labour_rate ?? 0,
      labour_unit: comp.labour_unit || 'per_unit',
      suggested_waste_percent: comp.suggested_waste_percent ?? (comp.takeoff_slot === 'roof_area' ? 10 : 5),
      pitch_type: comp.pitch_type || 'none',
      is_active: comp.is_active,
      sort_order: comp.sort_order ?? 0,
    } as RoofComponentDef);
  }

  // Ensure every built-in slot has an entry in slotMap (null if no component)
  for (const slot of BUILT_IN_ORDER) {
    if (!(slot in slotMap)) slotMap[slot] = null;
  }

  return { components, slotMap };
}

/**
 * Get all approved suppliers with instant pricing, optionally filtered by country.
 */
export async function searchSuppliers(params: {
  country?: string;
  trade?: string;
  capability?: string;
}): Promise<SupplierProfile[]> {
  let query = supabase
    .from('supplier_profiles')
    .select('id, supplier_name, slug, status, country, currency, tax_treatment, default_trade, instant_pricing_available, pricing_updated_at, price_valid_until, price_type, delivery_assumptions, exclusions, service_areas, website_url, description')
    .eq('status', 'approved');

  if (params.country) {
    query = query.eq('country', params.country.toUpperCase());
  }
  if (params.trade) {
    query = query.eq('default_trade', params.trade);
  }
  if (params.capability === 'live_pricing') {
    query = query.eq('instant_pricing_available', true);
  }

  const { data, error } = await query.order('supplier_name');
  if (error || !data) return [];
  return data as SupplierProfile[];
}
