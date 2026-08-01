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
 * - Query component_library where supplier_profile_id matches and takeoff_slot is not null
 * - Pick the first active component for each slot (lowest sort_order)
 */
export async function getSupplierDefaultComponents(supplierId: string): Promise<{
  components: RoofComponentDef[];
  slotMap: Record<string, string | null>;
}> {
  const { data: components, error } = await supabase
    .from('component_library')
    .select('id, name, takeoff_slot, sku, pricing_strategy, default_material_rate, pack_size, pack_price, default_labour_rate, default_waste_percent, default_pitch_type, is_active, sort_order, notes')
    .eq('supplier_profile_id', supplierId)
    .not('takeoff_slot', 'is', null)
    .eq('is_active', true)
    .order('sort_order');

  if (error || !components) {
    return { components: [], slotMap: {} };
  }

  // Group by takeoff_slot, pick first per slot
  const slotMap: Record<string, string | null> = {};
  const resultComponents: RoofComponentDef[] = [];
  const seen = new Set<string>();

  for (const comp of components) {
    if (!comp.takeoff_slot || !comp.is_active) continue;
    if (seen.has(comp.takeoff_slot)) continue;

    seen.add(comp.takeoff_slot);
    slotMap[comp.takeoff_slot] = comp.id;

    resultComponents.push({
      id: comp.id,
      component_kind: comp.takeoff_slot,
      name: comp.name,
      description: comp.notes,
      unit: comp.takeoff_slot === 'roof_area' || comp.takeoff_slot === 'underlay' || comp.takeoff_slot === 'fixings' ? 'm2' : 'm',
      price_per_unit: Number(comp.default_material_rate) || 0,
      pricing_strategy: comp.pricing_strategy || 'per_unit',
      pack_size: comp.pack_size ? Number(comp.pack_size) : null,
      pack_price: comp.pack_price ? Number(comp.pack_price) : null,
      labour_rate: Number(comp.default_labour_rate) || 0,
      labour_unit: 'per_unit',
      suggested_waste_percent: Number(comp.default_waste_percent) ?? (comp.takeoff_slot === 'roof_area' ? 10 : 5),
      pitch_type: comp.default_pitch_type || 'none',
      is_active: comp.is_active,
      sort_order: comp.sort_order ?? 0,
      takeoff_slot: comp.takeoff_slot,
      sku: comp.sku,
    } as any);
  }

  // Ensure every built-in slot has an entry in slotMap (null if no component)
  for (const slot of BUILT_IN_ORDER) {
    if (!(slot in slotMap)) slotMap[slot] = null;
  }

  return { components: resultComponents, slotMap };
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
