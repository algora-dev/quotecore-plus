'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import {
  requireComponentSlot,
  ComponentLimitReachedError,
  SubscriptionInactiveError,
  isBillingError,
} from '@/app/lib/billing/entitlements';

export type UserCollection = {
  id: string;
  name: string;
  is_bootstrap: boolean;
  component_count: number;
};

/**
 * Get the current user's component collections (libraries) for the import target selector.
 */
export async function getUserCollections(): Promise<UserCollection[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: collections } = await supabase
    .from('component_collections')
    .select('id, name, is_bootstrap')
    .eq('company_id', profile.company_id)
    .order('is_bootstrap', { ascending: false })
    .order('name');

  if (!collections) return [];

  // Get component counts per collection
  const collectionIds = collections.map(c => c.id);
  const { data: counts } = await supabase
    .from('component_library')
    .select('collection_id')
    .in('collection_id', collectionIds)
    .eq('is_active', true)
    .eq('company_id', profile.company_id);

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    const cid = row.collection_id as string;
    countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
  }

  return collections.map(c => ({
    id: c.id,
    name: c.name,
    is_bootstrap: c.is_bootstrap,
    component_count: countMap.get(c.id) ?? 0,
  }));
}

/**
 * Check which component IDs from a supplier library have already been imported
 * by the current user's company. Returns a Set of source_component_id values.
 */
export async function getAlreadyImportedIds(sourceComponentIds: string[]): Promise<Set<string>> {
  if (!sourceComponentIds.length) return new Set();
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data } = await supabase
    .from('component_library')
    .select('source_component_id')
    .eq('company_id', profile.company_id)
    .in('source_component_id', sourceComponentIds)
    .not('source_component_id', 'is', null);

  return new Set((data ?? []).map(r => r.source_component_id as string));
}

export type DirectorySupplier = {
  id: string;
  supplier_name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  roofing_types: string[];
  product_categories: string[];
  brands: string[];
  service_areas: string[];
  library_count: number;
};

export type DirectoryLibrary = {
  id: string;
  name: string;
  public_title: string | null;
  public_description: string | null;
  visibility: string;
  published_at: string | null;
  roofing_types: string[] | null;
  product_categories: string[] | null;
  brands: string[] | null;
  supplier_name: string;
  supplier_slug: string;
  supplier_logo_url: string | null;
  component_count: number;
};

/**
 * Search published supplier libraries by text query, roofing type, brand, or product category.
 * Returns libraries from approved suppliers with visibility = 'published'.
 */
export async function searchSupplierLibraries(params: {
  query?: string;
  roofingType?: string;
  brand?: string;
  productCategory?: string;
  limit?: number;
}): Promise<DirectoryLibrary[]> {
  const supabase = await createSupabaseServerClient();
  const { query, roofingType, brand, productCategory, limit = 50 } = params;

  let dbQuery = supabase
    .from('component_collections')
    .select(`
      id,
      name,
      public_title,
      public_description,
      visibility,
      published_at,
      roofing_types,
      product_categories,
      brands,
      supplier_profile_id,
      supplier_profiles!inner (
        id,
        supplier_name,
        slug,
        logo_url,
        status
      )
    `)
    .eq('visibility', 'published')
    .eq('supplier_profiles.status', 'approved')
    .not('supplier_profile_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  const { data: collections, error } = await dbQuery;

  if (error) {
    console.error('[searchSupplierLibraries] Error:', error.message);
    return [];
  }

  if (!collections || collections.length === 0) return [];

  // Get component counts for these collections
  const collectionIds = collections.map(c => c.id);
  const { data: counts } = await supabase
    .from('component_library')
    .select('collection_id')
    .in('collection_id', collectionIds)
    .eq('is_active', true);

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    const cid = row.collection_id as string;
    countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
  }

  // Filter by text query using the search_tsv (client-side fallback for simplicity)
  // The GIN index + tsvector is available for server-side full-text if needed
  let results: DirectoryLibrary[] = collections.map(c => {
    const sp = c.supplier_profiles as unknown as { supplier_name: string; slug: string; logo_url: string | null; status: string };
    return {
      id: c.id,
      name: c.name,
      public_title: c.public_title,
      public_description: c.public_description,
      visibility: c.visibility,
      published_at: c.published_at,
      roofing_types: c.roofing_types,
      product_categories: c.product_categories,
      brands: c.brands,
      supplier_name: sp.supplier_name,
      supplier_slug: sp.slug,
      supplier_logo_url: sp.logo_url,
      component_count: countMap.get(c.id) ?? 0,
    };
  });

  // Apply text search filter (client-side, since we can't easily do tsvector via Supabase JS client)
  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    results = results.filter(l => {
      const haystack = [
        l.name, l.public_title, l.public_description,
        l.supplier_name,
        ...(l.roofing_types ?? []), ...(l.brands ?? []),
        ...(l.product_categories ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  // Apply roofing type filter
  if (roofingType && roofingType !== 'All Roofing') {
    results = results.filter(l => (l.roofing_types ?? []).includes(roofingType));
  }

  // Apply brand filter
  if (brand) {
    results = results.filter(l => (l.brands ?? []).some(b => b.toLowerCase() === brand.toLowerCase()));
  }

  // Apply product category filter
  if (productCategory) {
    results = results.filter(l => (l.product_categories ?? []).some(pc => pc.toLowerCase() === productCategory.toLowerCase()));
  }

  // Filter out libraries with 0 components (nothing to import)
  return results.filter(l => l.component_count > 0);
}

/**
 * List all approved suppliers with published libraries.
 */
export async function listDirectorySuppliers(): Promise<DirectorySupplier[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('supplier_profiles')
    .select(`
      id,
      supplier_name,
      slug,
      description,
      logo_url,
      website_url,
      roofing_types,
      product_categories,
      brands,
      service_areas,
      status
    `)
    .eq('status', 'approved')
    .order('supplier_name');

  if (error || !data) return [];

  // Count published libraries per supplier
  const supplierIds = data.map(s => s.id);
  const { data: libCounts } = await supabase
    .from('component_collections')
    .select('supplier_profile_id')
    .in('supplier_profile_id', supplierIds)
    .eq('visibility', 'published');

  const countMap = new Map<string, number>();
  for (const row of libCounts ?? []) {
    const sid = row.supplier_profile_id as string;
    countMap.set(sid, (countMap.get(sid) ?? 0) + 1);
  }

  return data
    .filter(s => (countMap.get(s.id) ?? 0) > 0)
    .map(s => ({
      id: s.id,
      supplier_name: s.supplier_name,
      slug: s.slug,
      description: s.description,
      logo_url: s.logo_url,
      website_url: s.website_url,
      roofing_types: s.roofing_types ?? [],
      product_categories: s.product_categories ?? [],
      brands: s.brands ?? [],
      service_areas: s.service_areas ?? [],
      library_count: countMap.get(s.id) ?? 0,
    }));
}

/**
 * Get detailed info about a specific supplier's published libraries.
 */
export async function getSupplierPublishedLibraries(supplierSlug: string): Promise<{
  supplier: DirectorySupplier | null;
  libraries: DirectoryLibrary[];
}> {
  const supabase = await createSupabaseServerClient();

  const { data: supplier } = await supabase
    .from('supplier_profiles')
    .select('id, supplier_name, slug, description, logo_url, website_url, roofing_types, product_categories, brands, service_areas, status')
    .eq('slug', supplierSlug)
    .eq('status', 'approved')
    .maybeSingle();

  if (!supplier) return { supplier: null, libraries: [] };

  const { data: collections } = await supabase
    .from('component_collections')
    .select('id, name, public_title, public_description, visibility, published_at, roofing_types, product_categories, brands')
    .eq('supplier_profile_id', supplier.id)
    .eq('visibility', 'published')
    .order('published_at', { ascending: false });

  // Get component counts
  const collectionIds = (collections ?? []).map(c => c.id);
  let countMap = new Map<string, number>();
  if (collectionIds.length > 0) {
    const { data: counts } = await supabase
      .from('component_library')
      .select('collection_id')
      .in('collection_id', collectionIds)
      .eq('is_active', true);
    for (const row of counts ?? []) {
      const cid = row.collection_id as string;
      countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
    }
  }

  const libraries: DirectoryLibrary[] = (collections ?? [])
    .filter(c => (countMap.get(c.id) ?? 0) > 0)
    .map(c => ({
      id: c.id,
      name: c.name,
      public_title: c.public_title,
      public_description: c.public_description,
      visibility: c.visibility,
      published_at: c.published_at,
      roofing_types: c.roofing_types,
      product_categories: c.product_categories,
      brands: c.brands,
      supplier_name: supplier.supplier_name,
      supplier_slug: supplier.slug,
      supplier_logo_url: supplier.logo_url,
      component_count: countMap.get(c.id) ?? 0,
    }));

  return {
    supplier: {
      id: supplier.id,
      supplier_name: supplier.supplier_name,
      slug: supplier.slug,
      description: supplier.description,
      logo_url: supplier.logo_url,
      website_url: supplier.website_url,
      roofing_types: supplier.roofing_types ?? [],
      product_categories: supplier.product_categories ?? [],
      brands: supplier.brands ?? [],
      service_areas: supplier.service_areas ?? [],
      library_count: libraries.length,
    },
    libraries,
  };
}

/**
 * Get the components inside a specific published library (for preview before import).
 * Returns all fields needed for both display and import copy.
 */
export async function getLibraryComponents(libraryId: string): Promise<{
  id: string;
  name: string;
  component_type: string;
  measurement_type: string;
  default_material_rate: number;
  default_labour_rate: number;
  default_waste_type: string;
  default_waste_percent: number;
  default_waste_fixed: number;
  default_pitch_type: string;
  pack_price: number | null;
  pack_size: number | null;
  pack_coverage_m2: number | null;
  pricing_strategy: string;
  waste_unit: string;
  show_price_default: boolean;
  show_dimensions_default: boolean;
  eligible_for_orders: boolean | null;
  height_value_mm: number | null;
  depth_value_mm: number | null;
  notes: string | null;
  sku: string | null;
  takeoff_slot: string | null;
  sort_order: number;
}[]> {
  const supabase = await createSupabaseServerClient();

  // First verify the library is published and from an approved supplier
  const { data: lib } = await supabase
    .from('component_collections')
    .select('id, visibility, published_version, supplier_profiles!inner(id, status)')
    .eq('id', libraryId)
    .maybeSingle();

  if (!lib || lib.visibility !== 'published') return [];

  const supplier = lib.supplier_profiles as unknown as { id: string; status: string };
  if (supplier.status !== 'approved') return [];

  const { data, error } = await supabase
    .from('component_library')
    .select(`
      id, name, component_type, measurement_type,
      default_material_rate, default_labour_rate,
      default_waste_type, default_waste_percent, default_waste_fixed,
      default_pitch_type,
      pack_price, pack_size, pack_coverage_m2,
      pricing_strategy, waste_unit,
      show_price_default, show_dimensions_default,
      eligible_for_orders,
      height_value_mm, depth_value_mm,
      notes, sku, takeoff_slot, sort_order
    `)
    .eq('collection_id', libraryId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('name');

  if (error || !data) return [];
  return data;
}

export type ImportResult = {
  ok: boolean;
  imported: number;
  skipped: number;
  errors: string[];
};

/**
 * Import selected supplier components into the user's own component library.
 * Copies component data, tracking the source via source_component_id, source_library_id,
 * source_version, imported_at, and supplier_profile_id.
 * Skips duplicates (same source_component_id already imported by this company).
 * Respects tier component limits.
 */
export async function importSupplierComponents(params: {
  sourceLibraryId: string;
  targetCollectionId: string;
  componentIds: string[];
}): Promise<ImportResult> {
  const { sourceLibraryId, targetCollectionId, componentIds } = params;

  if (!componentIds.length) {
    return { ok: false, imported: 0, skipped: 0, errors: ['No components selected.'] };
  }

  // Get company context
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return { ok: false, imported: 0, skipped: 0, errors: ['Authentication required.'] };
  }

  const supabase = await createSupabaseServerClient();

  // 1. Verify source library is published and from approved supplier
  const { data: sourceLib } = await supabase
    .from('component_collections')
    .select('id, visibility, published_version, supplier_profiles!inner(id, status)')
    .eq('id', sourceLibraryId)
    .maybeSingle();

  if (!sourceLib || sourceLib.visibility !== 'published') {
    return { ok: false, imported: 0, skipped: 0, errors: ['Source library is not available.'] };
  }

  const supplierInfo = sourceLib.supplier_profiles as unknown as { id: string; status: string };
  if (supplierInfo.status !== 'approved') {
    return { ok: false, imported: 0, skipped: 0, errors: ['Supplier is not approved.'] };
  }

  const sourceVersion = sourceLib.published_version ?? 1;
  const supplierProfileId = supplierInfo.id;

  // 2. Verify target collection belongs to the user's company
  const { data: targetCol } = await supabase
    .from('component_collections')
    .select('id, company_id')
    .eq('id', targetCollectionId)
    .eq('company_id', profile.company_id)
    .maybeSingle();

  if (!targetCol) {
    return { ok: false, imported: 0, skipped: 0, errors: ['Target library not found.'] };
  }

  // 3. Fetch the selected source components
  const { data: sourceComponents } = await supabase
    .from('component_library')
    .select('*')
    .in('id', componentIds)
    .eq('collection_id', sourceLibraryId)
    .eq('is_active', true);

  if (!sourceComponents || sourceComponents.length === 0) {
    return { ok: false, imported: 0, skipped: 0, errors: ['No valid components found to import.'] };
  }

  // 4. Check for already-imported components (same source_component_id)
  const sourceIds = sourceComponents.map(c => c.id);
  const { data: existing } = await supabase
    .from('component_library')
    .select('id, source_component_id')
    .eq('company_id', profile.company_id)
    .in('source_component_id', sourceIds);

  const alreadyImportedIds = new Set((existing ?? []).map(r => r.source_component_id));
  const toImport = sourceComponents.filter(c => !alreadyImportedIds.has(c.id));
  const skippedCount = sourceComponents.length - toImport.length;

  if (toImport.length === 0) {
    return { ok: true, imported: 0, skipped: skippedCount, errors: [] };
  }

  // 5. Check tier limit - verify room for all components being imported
  try {
    // requireComponentSlot checks one slot at a time; for batch, verify the first
    // then do a manual count check for the remaining
    await requireComponentSlot(profile.company_id);

    // If importing more than 1, also verify total capacity
    if (toImport.length > 1) {
      const { loadCompanyEntitlements } = await import('@/app/lib/billing/entitlements');
      const ent = await loadCompanyEntitlements(profile.company_id);
      if (ent.componentLimit !== null && ent.componentCount + toImport.length > ent.componentLimit) {
        return {
          ok: false,
          imported: 0,
          skipped: skippedCount,
          errors: [`Importing ${toImport.length} components would exceed your plan limit (${ent.componentCount}/${ent.componentLimit} on ${ent.effectivePlanCode} plan). Upgrade to import more.`],
        };
      }
    }
  } catch (err) {
    if (err instanceof ComponentLimitReachedError) {
      return {
        ok: false,
        imported: 0,
        skipped: 0,
        errors: [`Component limit reached (${err.used}/${err.limit} on ${err.planCode} plan). Upgrade to import more components.`],
      };
    }
    if (err instanceof SubscriptionInactiveError) {
      return { ok: false, imported: 0, skipped: 0, errors: ['Subscription inactive. Please reactivate to import components.'] };
    }
    if (isBillingError(err)) {
      return { ok: false, imported: 0, skipped: 0, errors: [err.message] };
    }
    throw err;
  }

  // 6. Get current max sort_order in target collection
  const { data: maxSort } = await supabase
    .from('component_library')
    .select('sort_order')
    .eq('company_id', profile.company_id)
    .eq('collection_id', targetCollectionId)
    .order('sort_order', { ascending: false })
    .limit(1);

  let nextSort = (maxSort && maxSort.length > 0 ? maxSort[0].sort_order : 0) + 1;

  // 7. Build insert rows - copy all relevant fields, set source tracking
  const insertRows = toImport.map(comp => ({
    company_id: profile.company_id,
    collection_id: targetCollectionId,
    name: comp.name,
    component_type: comp.component_type,
    measurement_type: comp.measurement_type,
    default_material_rate: comp.default_material_rate,
    default_labour_rate: comp.default_labour_rate,
    default_waste_type: comp.default_waste_type,
    default_waste_percent: comp.default_waste_percent,
    default_waste_fixed: comp.default_waste_fixed,
    default_pitch_type: comp.default_pitch_type,
    pack_price: comp.pack_price,
    pack_size: comp.pack_size,
    pack_coverage_m2: comp.pack_coverage_m2,
    pricing_strategy: comp.pricing_strategy,
    waste_unit: comp.waste_unit,
    show_price_default: comp.show_price_default,
    show_dimensions_default: comp.show_dimensions_default,
    eligible_for_orders: comp.eligible_for_orders ?? false,
    height_value_mm: comp.height_value_mm,
    depth_value_mm: comp.depth_value_mm,
    notes: comp.notes,
    sku: comp.sku,
    takeoff_slot: comp.takeoff_slot,
    sort_order: nextSort++,
    is_active: true,
    is_system: false,
    // Source tracking
    source_component_id: comp.id,
    source_library_id: sourceLibraryId,
    source_version: sourceVersion,
    imported_at: new Date().toISOString(),
    supplier_profile_id: supplierProfileId,
  }));

  // 8. Insert
  const { error: insertError } = await supabase
    .from('component_library')
    .insert(insertRows);

  if (insertError) {
    console.error('[importSupplierComponents] Insert error:', insertError);
    return { ok: false, imported: 0, skipped: skippedCount, errors: [insertError.message] };
  }

  revalidatePath('/[workspaceSlug]/components', 'page');

  return {
    ok: true,
    imported: toImport.length,
    skipped: skippedCount,
    errors: [],
  };
}
