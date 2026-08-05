/**
 * Published Takeoff Library Service
 *
 * Loads published, takeoff-ready supplier component collections.
 * This is the V2 data source that replaces the old flat supplier-component lookup.
 *
 * Key difference from getSupplierDefaultComponents():
 * - V1: loads ALL supplier components, keeps only the FIRST per slot
 * - V2: loads from a specific published collection, returns ALL options per slot
 */

import { createClient } from '@supabase/supabase-js';
import type { RoofComponentDef } from '../../(public)/free-roofing-takeoff-builder/types';
import { BUILT_IN_ORDER } from '../../(public)/free-roofing-takeoff-builder/calc';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

function getSupabase() {
  return createClient(supabaseUrl, supabaseKey);
}

export interface PublishedTakeoffComponent extends RoofComponentDef {
  takeoff_slot: string;
  sku: string | null;
  is_takeoff_default: boolean;
}

export interface PublishedTakeoffLibrary {
  collectionId: string;
  collectionName: string;
  publicSlug: string;
  publishedVersion: number;
  currency: string;
  unitSystem: 'metric' | 'imperial' | 'squares';
  supplierId: string;
  supplierName: string;
  supplierSlug: string;
  supplierCountry: string | null;
  enquiriesEnabled: boolean;
  enquiryEmail: string | null;
  taxTreatment: string | null;
  taxName: string | null;
  taxRate: number | null;
  components: PublishedTakeoffComponent[];
  slotMap: Record<string, string | null>; // slot -> default component ID
  slotOptions: Record<string, PublishedTakeoffComponent[]>; // slot -> all options
}

/**
 * Load a published takeoff library by collection ID.
 * Returns all component options per slot, plus explicit defaults.
 */
export async function loadPublishedTakeoffLibrary(
  collectionId: string,
  version?: number,
): Promise<PublishedTakeoffLibrary | null> {
  const sb = getSupabase();

  // Load collection
  const { data: collection, error: colError } = await sb
    .from('component_collections')
    .select(`
      id, name, public_slug, published_version, currency, unit_system,
      supplier_profile_id, takeoff_enabled, publication_status
    `)
    .eq('id', collectionId)
    .single();

  if (colError || !collection || !collection.takeoff_enabled || collection.publication_status !== 'published') {
    return null;
  }

  // Load supplier
  const { data: supplier, error: supError } = await sb
    .from('supplier_profiles')
    .select('id, supplier_name, slug, status, country, currency, enquiries_enabled, enquiry_email, tax_treatment, tax_name, tax_rate')
    .eq('id', collection.supplier_profile_id)
    .eq('status', 'approved')
    .single();

  if (supError || !supplier) return null;

  // Load components from snapshot if version specified, otherwise from live
  let components: PublishedTakeoffComponent[];

  if (version) {
    // Load from immutable snapshot
    const { data: snapshot, error: snapError } = await sb
      .from('supplier_takeoff_library_snapshots')
      .select('components_json')
      .eq('collection_id', collectionId)
      .eq('published_version', version)
      .single();

    if (snapError || !snapshot) return null;
    components = (snapshot.components_json as unknown[]).map((raw: any) => ({
      id: raw.id,
      component_kind: raw.takeoff_slot,
      name: raw.name,
      description: null,
      unit: (raw.takeoff_slot === 'roof_area' || raw.takeoff_slot === 'underlay' || raw.takeoff_slot === 'fixings')
        ? (collection.unit_system === 'imperial' ? 'sqft' : collection.unit_system === 'squares' ? 'squares' : 'm2')
        : (collection.unit_system === 'imperial' ? 'ft' : 'm'),
      price_per_unit: Number(raw.default_material_rate) || 0,
      pricing_strategy: raw.pricing_strategy || 'per_unit',
      pack_size: raw.pack_size ? Number(raw.pack_size) : null,
      pack_price: raw.pack_price ? Number(raw.pack_price) : null,
      labour_rate: Number(raw.default_labour_rate) || 0,
      labour_unit: 'per_unit',
      suggested_waste_percent: Number(raw.default_waste_percent) ?? (raw.takeoff_slot === 'roof_area' ? 10 : 5),
      pitch_type: raw.default_pitch_type || 'none',
      is_active: raw.is_active,
      sort_order: raw.sort_order ?? 0,
      takeoff_slot: raw.takeoff_slot,
      sku: raw.sku,
      is_takeoff_default: raw.is_takeoff_default ?? false,
    }));
  } else {
    // Load from live components
    const { data: rawComps, error: compError } = await sb
      .from('component_library')
      .select('id, name, takeoff_slot, sku, pricing_strategy, default_material_rate, pack_size, pack_price, default_labour_rate, default_waste_percent, default_pitch_type, is_active, sort_order, is_takeoff_default, notes')
      .eq('collection_id', collectionId)
      .not('takeoff_slot', 'is', null)
      .eq('is_active', true)
      .order('sort_order');

    if (compError || !rawComps) return null;

    components = rawComps.map((comp: any) => ({
      id: comp.id,
      component_kind: comp.takeoff_slot,
      name: comp.name,
      description: comp.notes,
      unit: (comp.takeoff_slot === 'roof_area' || comp.takeoff_slot === 'underlay' || comp.takeoff_slot === 'fixings')
        ? (collection.unit_system === 'imperial' ? 'sqft' : collection.unit_system === 'squares' ? 'squares' : 'm2')
        : (collection.unit_system === 'imperial' ? 'ft' : 'm'),
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
      is_takeoff_default: comp.is_takeoff_default ?? false,
    }));
  }

  if (components.length === 0) return null;

  // Build slot map (default component per slot) and slot options (all components per slot)
  const slotMap: Record<string, string | null> = {};
  const slotOptions: Record<string, PublishedTakeoffComponent[]> = {};

  for (const slot of BUILT_IN_ORDER) {
    slotMap[slot] = null;
    slotOptions[slot] = [];
  }

  for (const comp of components) {
    const slot = comp.takeoff_slot;
    if (!slot || !BUILT_IN_ORDER.includes(slot as any)) continue;

    if (!slotOptions[slot]) slotOptions[slot] = [];
    slotOptions[slot].push(comp);

    // Set default: explicit is_takeoff_default first, otherwise first component in slot
    if (comp.is_takeoff_default) {
      slotMap[slot] = comp.id;
    } else if (slotMap[slot] === null && slotOptions[slot].length === 1) {
      slotMap[slot] = comp.id;
    }
  }

  // Override: if no explicit default, use first in each slot
  for (const slot of BUILT_IN_ORDER) {
    if (slotMap[slot] === null && slotOptions[slot].length > 0) {
      slotMap[slot] = slotOptions[slot][0].id;
    }
  }

  return {
    collectionId: collection.id,
    collectionName: collection.name,
    publicSlug: collection.public_slug,
    publishedVersion: collection.published_version,
    currency: collection.currency || supplier.currency,
    unitSystem: (collection.unit_system as 'metric' | 'imperial' | 'squares') || 'metric',
    supplierId: supplier.id,
    supplierName: supplier.supplier_name,
    supplierSlug: supplier.slug,
    supplierCountry: supplier.country,
    enquiriesEnabled: supplier.enquiries_enabled ?? false,
    enquiryEmail: supplier.enquiry_email ?? null,
    taxTreatment: supplier.tax_treatment ?? null,
    taxName: supplier.tax_name ?? null,
    taxRate: supplier.tax_rate ?? null,
    components,
    slotMap,
    slotOptions,
  };
}

/**
 * Load a published takeoff library by supplier slug.
 * Uses the supplier's default takeoff collection.
 */
export async function loadPublishedTakeoffLibraryBySlug(
  supplierSlug: string,
): Promise<PublishedTakeoffLibrary | null> {
  const sb = getSupabase();

  const { data: supplier, error: supError } = await sb
    .from('supplier_profiles')
    .select('id, default_takeoff_collection_id')
    .eq('slug', supplierSlug)
    .eq('status', 'approved')
    .single();

  if (supError || !supplier || !supplier.default_takeoff_collection_id) return null;

  return loadPublishedTakeoffLibrary(supplier.default_takeoff_collection_id);
}

/**
 * List all ready, published takeoff libraries.
 * Returns collection-level search results.
 */
export async function listReadyTakeoffLibraries(): Promise<{
  supplierId: string;
  supplierName: string;
  supplierSlug: string;
  country: string | null;
  currency: string;
  unitSystem: 'metric' | 'imperial' | 'squares';
  collectionId: string;
  collectionName: string;
  publicSlug: string;
  branchCity: string | null;
  branchRegion: string | null;
  branchCountry: string | null;
  nationalCoverage: boolean;
  deliveryCoverage: string[] | null;
  instantPricingAvailable: boolean;
  enquiriesEnabled: boolean;
  enquiryEmail: string | null;
  description: string | null;
  serviceAreas: string[];
  roofingTypes: string[];
  productCategories: string[];
  brands: string[];
  keywords: string[];
}[]> {
  const sb = getSupabase();

  const { data, error } = await sb
    .from('component_collections')
    .select(`
      id, name, public_slug, currency, unit_system,
      supplier_profile_id,
      supplier_profiles!component_collections_supplier_profile_id_fkey!inner(
        id, supplier_name, slug, status, country, currency,
        branch_city, branch_region, branch_country,
        national_coverage, delivery_coverage,
        instant_pricing_available, enquiries_enabled, enquiry_email,
        description, service_areas, roofing_types
      ),
      public_title, public_description,
      roofing_types, product_categories, brands, keywords
    `)
    .eq('takeoff_enabled', true)
    .eq('publication_status', 'published')
    .eq('supplier_profiles.status', 'approved')
    .order('name');

  if (error || !data) return [];

  return data.map((col: any) => ({
    supplierId: col.supplier_profiles.id,
    supplierName: col.supplier_profiles.supplier_name,
    supplierSlug: col.supplier_profiles.slug,
    country: col.supplier_profiles.country,
    currency: col.currency || col.supplier_profiles.currency,
    unitSystem: (col.unit_system as 'metric' | 'imperial' | 'squares') || 'metric',
    collectionId: col.id,
    collectionName: col.public_title || col.name,
    publicSlug: col.public_slug,
    branchCity: col.supplier_profiles.branch_city,
    branchRegion: col.supplier_profiles.branch_region,
    branchCountry: col.supplier_profiles.branch_country,
    nationalCoverage: col.supplier_profiles.national_coverage,
    deliveryCoverage: col.supplier_profiles.delivery_coverage,
    instantPricingAvailable: col.supplier_profiles.instant_pricing_available,
    enquiriesEnabled: col.supplier_profiles.enquiries_enabled,
    enquiryEmail: col.supplier_profiles.enquiry_email,
    description: col.public_description || col.supplier_profiles.description,
    serviceAreas: col.supplier_profiles.service_areas || [],
    roofingTypes: col.roofing_types || col.supplier_profiles.roofing_types || [],
    productCategories: col.product_categories || [],
    brands: col.brands || [],
    keywords: col.keywords || [],
  }));
}
