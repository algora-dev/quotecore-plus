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
  contact_email: string | null;
  phone_number: string | null;
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
  location?: string;
  limit?: number;
}): Promise<DirectoryLibrary[]> {
  const supabase = await createSupabaseServerClient();
  const { query, roofingType, brand, productCategory, location, limit = 50 } = params;

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
      supplier_profiles!component_collections_supplier_profile_id_fkey!inner (
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
    console.error('[searchSupplierLibraries] Error:', error.message, error.code, error.details);
    return [];
  }

  if (!collections || collections.length === 0) return [];

  // Get component counts for these collections
  const collectionIds = collections.map(c => c.id);
  const { data: counts, error: countError } = await supabase
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

  // Apply location filter - match against supplier service_areas
  if (location && location.trim()) {
    const loc = location.toLowerCase().trim();
    // Get suppliers whose service_areas match the location
    const { data: locationSuppliers } = await supabase
      .from('supplier_profiles')
      .select('id, service_areas')
      .eq('status', 'approved');
    const matchingSupplierIds = new Set<string>();
    for (const sp of locationSuppliers ?? []) {
      const areas = (sp.service_areas ?? []) as string[];
      if (areas.some(a => a.toLowerCase().includes(loc))) {
        matchingSupplierIds.add(sp.id);
      }
    }
    // Filter libraries to only those from suppliers in the location
    // Also keep libraries that have the location in their own roofing_types or brands
    results = results.filter(l => {
      // Check if supplier_profile_id is in matching suppliers
      // We need to look up the supplier_profile_id for each library
      return true; // We'll filter below after getting supplier info
    });
    // Actually, we need to filter by supplier_profile_id. Let's get the supplier_profile_ids for the libraries
    const libSupplierMap = new Map<string, string>();
    for (const c of collections ?? []) {
      if (c.supplier_profile_id) {
        libSupplierMap.set(c.id, c.supplier_profile_id as string);
      }
    }
    results = results.filter(l => {
      const spId = libSupplierMap.get(l.id);
      return spId && matchingSupplierIds.has(spId);
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
      contact_email,
      phone_number,
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
      contact_email: s.contact_email,
      phone_number: s.phone_number,
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
    .select('id, supplier_name, slug, description, logo_url, website_url, contact_email, phone_number, roofing_types, product_categories, brands, service_areas, status')
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
      contact_email: supplier.contact_email,
      phone_number: supplier.phone_number,
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
    .select('id, visibility, published_version, supplier_profiles!component_collections_supplier_profile_id_fkey!inner(id, status)')
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
  alertsEnabled?: boolean;
}): Promise<ImportResult> {
  const { sourceLibraryId, targetCollectionId, componentIds, alertsEnabled = true } = params;

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
    .select('id, visibility, published_version, supplier_profiles!component_collections_supplier_profile_id_fkey!inner(id, status)')
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

  // 9. Upsert alert subscription (only after successful import)
  await supabase
    .from('supplier_library_subscriptions')
    .upsert({
      company_id: profile.company_id,
      source_library_id: sourceLibraryId,
      alerts_enabled: alertsEnabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id,source_library_id' });

  revalidatePath('/[workspaceSlug]/components', 'page');

  return {
    ok: true,
    imported: toImport.length,
    skipped: skippedCount,
    errors: [],
  };
}

// ─── Phase 9: Controlled publishing + change notifications ───

export type ChangeNotification = {
  id: string;
  supplier_library_id: string;
  component_id: string | null;
  change_type: 'added' | 'modified' | 'removed' | 'price_changed';
  old_snapshot: Record<string, unknown> | null;
  new_snapshot: Record<string, unknown> | null;
  version_from: number;
  version_to: number;
  created_at: string;
};

export type PendingUpdate = {
  notification_id: string;
  source_library_id: string;
  source_library_name: string;
  supplier_name: string;
  component_id: string;
  imported_component_id: string;
  imported_component_name: string;
  change_type: string;
  version_from: number;
  version_to: number;
  created_at: string;
  new_snapshot: Record<string, unknown> | null;
  old_snapshot: Record<string, unknown> | null;
  local_values: Record<string, unknown> | null;
  changed_fields: string[];
};

/**
 * Supplier action: publish an update to a library.
 * Uses atomic RPC `supplier_publish_update` for durable snapshots + version bump.
 * Baseline (v1) creates a publication without notifications.
 * No-change publishes don't bump the version.
 */
export async function publishLibraryUpdate(libraryId: string): Promise<{
  ok: boolean;
  newVersion?: number;
  changesRecorded?: number;
  message?: string;
}> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return { ok: false, message: 'Authentication required.' };
  }

  const supabase = await createSupabaseServerClient();

  // 1. Verify ownership and supplier status
  const { data: lib } = await supabase
    .from('component_collections')
    .select('id, name, visibility, published_version, supplier_profile_id, company_id')
    .eq('id', libraryId)
    .single();

  if (!lib || lib.company_id !== profile.company_id) {
    return { ok: false, message: 'Library not found.' };
  }

  if (lib.visibility !== 'published') {
    return { ok: false, message: 'Library must be published first.' };
  }

  // 2. Fetch current active components with all canonical sync fields
  const { data: currentComponents, error: fetchError } = await supabase
    .from('component_library')
    .select(`
      id, name, component_type, measurement_type, sku, takeoff_slot, notes,
      default_material_rate, default_labour_rate,
      default_waste_type, default_waste_percent, default_waste_fixed,
      default_pitch_type, waste_unit,
      pack_price, pack_size, pack_coverage_m2,
      pricing_strategy, show_price_default, show_dimensions_default,
      eligible_for_orders, height_value_mm, depth_value_mm
    `)
    .eq('collection_id', libraryId)
    .eq('is_active', true)
    .order('name');

  if (fetchError) {
    return { ok: false, message: fetchError.message };
  }

  // 3. Build snapshot array using shared sync-field constants
  const { buildSnapshotArray } = await import('@/app/lib/supabase/sync-fields');
  const snapshot = buildSnapshotArray(currentComponents ?? []);

  // 4. Call the atomic RPC
  const { data: rpcResult, error: rpcError } = await supabase
    .rpc('supplier_publish_update', {
      p_library_id: libraryId,
      p_snapshot: snapshot as unknown as import('@/app/lib/supabase/database.types').Json,
      p_publishing_user: profile.id,
    });

  if (rpcError) {
    console.error('[publishLibraryUpdate] RPC error:', rpcError);
    return { ok: false, message: rpcError.message };
  }

  // RPC returns a table with one row
  const row = rpcResult?.[0];
  if (!row) {
    return { ok: false, message: 'Publish failed: no result from database.' };
  }

  // 5. If changes were recorded, insert inbox alerts for all subscribed companies
  // Use admin client (service role) to bypass RLS - the supplier is inserting alerts
  // for OTHER companies (the importers), which RLS would block with user-scoped client.
  if (row.ok && row.changes_recorded > 0) {
    try {
      // Find all companies with alerts_enabled subscriptions to this library
      const { data: subscribers } = await supabase
        .from('supplier_library_subscriptions')
        .select('company_id')
        .eq('source_library_id', libraryId)
        .eq('alerts_enabled', true);

      if (subscribers && subscribers.length > 0) {
        // Get library name + supplier name for the alert text
        const { data: libInfo } = await supabase
          .from('component_collections')
          .select('name, supplier_profiles!component_collections_supplier_profile_id_fkey!inner(supplier_name)')
          .eq('id', libraryId)
          .single();

        const supplierName = (libInfo?.supplier_profiles as unknown as { supplier_name: string })?.supplier_name ?? 'A supplier';
        const libName = libInfo?.name ?? 'library';

        const alertRows = subscribers.map(s => ({
          company_id: s.company_id,
          alert_type: 'supplier_update',
          title: `${supplierName} updated ${libName}`,
          message: `${row.changes_recorded} component change${row.changes_recorded !== 1 ? 's' : ''} published. Review and apply to your imported components.`,
        }));

        const { createAdminClient } = await import('@/app/lib/supabase/admin');
        const admin = createAdminClient();
        await admin.from('alerts').insert(alertRows);
      }
    } catch (err) {
      console.error('[publishLibraryUpdate] Alert insert failed:', err);
      // Don't fail the publish if alerts fail
    }
  }

  revalidatePath('/components');
  revalidatePath('/[workspaceSlug]/supplier-directory', 'page');

  return {
    ok: row.ok,
    newVersion: row.new_version,
    changesRecorded: row.changes_recorded,
    message: row.message,
  };
}

/**
 * Get pending updates for a user's imported supplier components.
 * Batched, subscription-aware, resolution-aware.
 * Only returns updates where: subscription exists + alerts_enabled, notification unresolved,
 * notification version > component's applied source_version.
 */
export async function getPendingSupplierUpdates(): Promise<PendingUpdate[]> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // 1. Get all imported components for this company with source tracking
  const { data: imported } = await supabase
    .from('component_library')
    .select(`
      id, name, source_component_id, source_library_id, source_version,
      default_material_rate, default_labour_rate, pack_price, pack_size,
      default_waste_percent, default_waste_fixed, pack_coverage_m2,
      pricing_strategy, component_type, measurement_type, sku, takeoff_slot, notes,
      default_waste_type, default_pitch_type, waste_unit,
      show_price_default, show_dimensions_default, eligible_for_orders,
      height_value_mm, depth_value_mm
    `)
    .eq('company_id', profile.company_id)
    .not('source_component_id', 'is', null)
    .not('source_library_id', 'is', null);

  if (!imported || imported.length === 0) return [];

  // 2. Get subscriptions for the libraries this company has imported from
  const sourceLibraryIds = [...new Set(imported.map(i => i.source_library_id).filter(Boolean))] as string[];
  let { data: subscriptions } = await supabase
    .from('supplier_library_subscriptions')
    .select('source_library_id, alerts_enabled, field_preferences')
    .eq('company_id', profile.company_id)
    .in('source_library_id', sourceLibraryIds);

  // Auto-backfill: if a company has imported components but no subscription exists,
  // create one with alerts_enabled = true (covers imports done before subscription table existed)
  const subscribedLibIds = new Set((subscriptions ?? []).map(s => s.source_library_id));
  const missingSubs = sourceLibraryIds.filter(id => !subscribedLibIds.has(id));
  if (missingSubs.length > 0) {
    const newSubs = missingSubs.map(libId => ({
      company_id: profile.company_id,
      source_library_id: libId,
      alerts_enabled: true,
    }));
    await supabase.from('supplier_library_subscriptions').upsert(newSubs, { onConflict: 'company_id,source_library_id' });
    // Re-query to include the new subscriptions
    const { data: refreshedSubs } = await supabase
      .from('supplier_library_subscriptions')
      .select('source_library_id, alerts_enabled, field_preferences')
      .eq('company_id', profile.company_id)
      .in('source_library_id', sourceLibraryIds);
    subscriptions = refreshedSubs ?? [];
  }

  // Bell/inbox alert backfill: create alert rows for unresolved change notifications
  // that have no corresponding alert yet. This covers libraries where the supplier
  // published updates before the subscription existed (so no alert was inserted at publish time).
  // Runs every page load but is idempotent - checks if alert already exists before creating.
  try {
    // Build map of max source_version per library from imported components
    const importsByLib = new Map<string, number>();
    for (const imp of imported) {
      const libId = imp.source_library_id as string;
      const sv = imp.source_version ?? 0;
      importsByLib.set(libId, Math.max(importsByLib.get(libId) ?? 0, sv));
    }

    // Get all notifications for ALL source libraries the user has imported from
    const { data: allNotifs } = await supabase
      .from('supplier_change_notifications')
      .select('id, supplier_library_id, version_to')
      .in('supplier_library_id', sourceLibraryIds);

    if (allNotifs && allNotifs.length > 0) {
      // Filter to truly unresolved (version_to > max source_version)
      const trulyUnresolved = allNotifs.filter(n => {
        const maxSV = importsByLib.get(n.supplier_library_id) ?? 0;
        return n.version_to > maxSV;
      });

      if (trulyUnresolved.length > 0) {
        // Check which libraries already have an unread supplier_update alert
        const { data: existingAlerts } = await supabase
          .from('alerts')
          .select('title')
          .eq('company_id', profile.company_id)
          .eq('alert_type', 'supplier_update')
          .is('bell_cleared_at', null);

        // Get supplier + library names
        const { data: libInfo } = await supabase
          .from('component_collections')
          .select('id, name, supplier_profiles!component_collections_supplier_profile_id_fkey!inner(supplier_name)')
          .in('id', sourceLibraryIds);

        const libMap = new Map((libInfo ?? []).map(l => [l.id, {
          name: l.name,
          supplierName: (l.supplier_profiles as unknown as { supplier_name: string })?.supplier_name ?? 'A supplier',
        }]));

        // Build set of existing alert titles to avoid duplicates
        const existingTitles = new Set((existingAlerts ?? []).map(a => a.title));

        // Group unresolved by library
        const byLib = new Map<string, number>();
        for (const n of trulyUnresolved) {
          byLib.set(n.supplier_library_id, (byLib.get(n.supplier_library_id) ?? 0) + 1);
        }

        const alertRows = [...byLib.entries()].map(([libId, count]) => {
          const info = libMap.get(libId);
          const supplierName = info?.supplierName ?? 'A supplier';
          const libName = info?.name ?? 'library';
          const title = `${supplierName} updated ${libName}`;
          return {
            company_id: profile.company_id,
            alert_type: 'supplier_update',
            title,
            message: `${count} component change${count !== 1 ? 's' : ''} available for review.`,
          };
        }).filter(r => !existingTitles.has(r.title)); // Skip if alert already exists

        if (alertRows.length > 0) {
          const { createAdminClient } = await import('@/app/lib/supabase/admin');
          const admin = createAdminClient();
          await admin.from('alerts').insert(alertRows);
        }
      }
    }
  } catch (err) {
    console.error('[getPendingSupplierUpdates] Alert backfill failed:', err);
  }

  // Build subscription map: library_id -> { enabled, fieldPrefs, notifyNewComponents }
  const subMap = new Map<string, { enabled: boolean; fieldPrefs: Set<string> | null; notifyNewComponents: boolean }>();
  for (const s of subscriptions ?? []) {
    if (s.alerts_enabled) {
      let fieldPrefs: Set<string> | null = null;
      const prefs = s.field_preferences as Record<string, boolean> | null;
      let notifyNewComponents = true; // default ON
      if (prefs) {
        // If prefs exist, only include fields explicitly set to true
        const enabledFields = Object.entries(prefs).filter(([, v]) => v === true).map(([k]) => k);
        fieldPrefs = enabledFields.length > 0 ? new Set(enabledFields) : null; // null = all fields (if all false, treat as all)
        // Check new_components preference (default ON if not explicitly set to false)
        notifyNewComponents = prefs['new_components'] !== false;
      }
      subMap.set(s.source_library_id, { enabled: true, fieldPrefs, notifyNewComponents });
    }
  }

  const alertLibIds = new Set(subMap.keys());
  if (alertLibIds.size === 0) return [];

  // Filter imported components to only those from alert-enabled libraries
  const relevantImports = imported.filter(i => i.source_library_id && alertLibIds.has(i.source_library_id));
  if (relevantImports.length === 0) return [];

  // 3. Get library + supplier info for relevant libraries (batched)
  const { data: libs } = await supabase
    .from('component_collections')
    .select('id, name, supplier_profiles!component_collections_supplier_profile_id_fkey!inner(supplier_name)')
    .in('id', sourceLibraryIds);

  const libMap = new Map<string, { name: string; supplier_name: string }>();
  for (const lib of libs ?? []) {
    const sp = lib.supplier_profiles as unknown as { supplier_name: string };
    libMap.set(lib.id, { name: lib.name, supplier_name: sp.supplier_name });
  }

  // 4. Get all unresolved notification IDs for this company (batched)
  // First get resolved notification IDs
  const { data: resolutions } = await supabase
    .from('supplier_update_resolutions')
    .select('notification_id, imported_component_id, status')
    .eq('company_id', profile.company_id);

  // Build resolved set: notification_id + imported_component_id -> status
  const resolvedMap = new Map<string, string>();
  for (const r of resolutions ?? []) {
    const key = `${r.notification_id}:${r.imported_component_id ?? 'null'}`;
    resolvedMap.set(key, r.status);
  }

  // 5. Batch query: get all notifications for relevant libraries where version > component's source_version
  // We need to query per library because the version filter depends on each component's source_version
  // But we can batch by library
  const results: PendingUpdate[] = [];
  const { diffSnapshots } = await import('@/app/lib/supabase/sync-fields');

  // Group imports by source library
  const importsByLib = new Map<string, typeof relevantImports>();
  for (const imp of relevantImports) {
    const libId = imp.source_library_id!;
    if (!importsByLib.has(libId)) importsByLib.set(libId, []);
    importsByLib.get(libId)!.push(imp);
  }

  for (const [sourceLibId, imports] of importsByLib) {
    const libInfo = libMap.get(sourceLibId);
    if (!libInfo) continue;

    // Get the max source_version across all imports from this library
    // We query all notifications newer than the MIN source_version, then filter per-component
    const minSourceVersion = Math.min(...imports.map(i => i.source_version ?? 0));

    const { data: notifs } = await supabase
      .from('supplier_change_notifications')
      .select('*')
      .eq('supplier_library_id', sourceLibId)
      .gt('version_to', minSourceVersion)
      .order('created_at', { ascending: false });

    if (!notifs || notifs.length === 0) continue;

    // For each import, find the latest relevant notification
    for (const imp of imports) {
      if (!imp.source_component_id || imp.source_version === null) continue;

      const relevantNotif = notifs.find(n =>
        n.component_id === imp.source_component_id &&
        n.version_to > (imp.source_version ?? 0)
      );

      if (!relevantNotif) continue;

      // Check if this notification is already resolved for this company + component
      const resKey = `${relevantNotif.id}:${imp.id}`;
      const nullResKey = `${relevantNotif.id}:null`;
      if (resolvedMap.has(resKey) || resolvedMap.has(nullResKey)) continue;

      // Build local values snapshot from the imported component
      const localValues: Record<string, unknown> = {
        name: imp.name,
        default_material_rate: imp.default_material_rate,
        default_labour_rate: imp.default_labour_rate,
        pack_price: imp.pack_price,
        pack_size: imp.pack_size,
        pricing_strategy: imp.pricing_strategy,
        component_type: imp.component_type,
        measurement_type: imp.measurement_type,
        sku: imp.sku,
        takeoff_slot: imp.takeoff_slot,
        notes: imp.notes,
        default_waste_percent: imp.default_waste_percent,
        default_waste_fixed: imp.default_waste_fixed,
        pack_coverage_m2: imp.pack_coverage_m2,
        default_waste_type: imp.default_waste_type,
        default_pitch_type: imp.default_pitch_type,
        waste_unit: imp.waste_unit,
        show_price_default: imp.show_price_default,
        show_dimensions_default: imp.show_dimensions_default,
        eligible_for_orders: imp.eligible_for_orders,
        height_value_mm: imp.height_value_mm,
        depth_value_mm: imp.depth_value_mm,
      };

      const newSnap = relevantNotif.new_snapshot as Record<string, unknown> | null;
      const oldSnap = relevantNotif.old_snapshot as Record<string, unknown> | null;

      // Compute changed fields (old vs new from supplier)
      let changedFields: string[] = [];
      if (oldSnap && newSnap) {
        changedFields = diffSnapshots(oldSnap, newSnap).map(c => c.field);
      } else if (newSnap && relevantNotif.change_type === 'added') {
        changedFields = Object.keys(newSnap).filter(k => k !== 'id');
      }

      // Filter by field preferences for this subscription
      const sub = subMap.get(sourceLibId);
      if (sub?.fieldPrefs) {
        changedFields = changedFields.filter(f => sub.fieldPrefs!.has(f));
      }

      // If no fields remain after filtering, skip this notification
      if (changedFields.length === 0 && relevantNotif.change_type !== 'removed') continue;

      results.push({
        notification_id: relevantNotif.id,
        source_library_id: sourceLibId,
        source_library_name: libInfo.name,
        supplier_name: libInfo.supplier_name,
        component_id: imp.source_component_id,
        imported_component_id: imp.id,
        imported_component_name: imp.name,
        change_type: relevantNotif.change_type,
        version_from: relevantNotif.version_from,
        version_to: relevantNotif.version_to,
        created_at: relevantNotif.created_at,
        new_snapshot: newSnap,
        old_snapshot: oldSnap,
        local_values: localValues,
        changed_fields: changedFields,
      });
    }

    // Check for 'added' notifications (new components the supplier added that the user hasn't imported)
    const subInfo = subMap.get(sourceLibId);
    if (subInfo?.notifyNewComponents) {
      // Get all 'added' notifications for this library
      const { data: addedNotifs } = await supabase
        .from('supplier_change_notifications')
        .select('*')
        .eq('supplier_library_id', sourceLibId)
        .eq('change_type', 'added')
        .gt('version_to', minSourceVersion)
        .order('created_at', { ascending: false });

      if (addedNotifs && addedNotifs.length > 0) {
        // Get the user's existing source_component_ids to filter out already-imported ones
        const existingSourceIds = new Set(imports.map(i => i.source_component_id));

        for (const notif of addedNotifs) {
          // Skip if already resolved
          const resKey = `${notif.id}:null`;
          if (resolvedMap.has(resKey)) continue;
          // Skip if user already imported this component
          if (existingSourceIds.has(notif.component_id)) continue;

          const newSnap = notif.new_snapshot as Record<string, unknown> | null;
          const changedFields: string[] = newSnap ? Object.keys(newSnap).filter(k => k !== 'id') : [];

          results.push({
            notification_id: notif.id,
            source_library_id: sourceLibId,
            source_library_name: libInfo.name,
            supplier_name: libInfo.supplier_name,
            component_id: notif.component_id ?? '',
            imported_component_id: '', // no imported component yet
            imported_component_name: (newSnap?.name as string) ?? 'New component',
            change_type: 'added',
            version_from: notif.version_from,
            version_to: notif.version_to,
            created_at: notif.created_at,
            new_snapshot: newSnap,
            old_snapshot: null,
            local_values: null,
            changed_fields: changedFields,
          });
        }
      }
    }
  }

  return results;
}

/**
 * Update a user's imported component with the latest from the supplier.
 * Syncs the component fields from the supplier's latest published version.
 */
export async function updateImportedComponent(
  importedComponentId: string,
  notificationId: string,
): Promise<{ ok: boolean; message?: string }> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return { ok: false, message: 'Authentication required.' };
  }

  const supabase = await createSupabaseServerClient();

  // 1. Get the imported component
  const { data: comp } = await supabase
    .from('component_library')
    .select('id, source_component_id, source_library_id, source_version, company_id')
    .eq('id', importedComponentId)
    .single();

  if (!comp || comp.company_id !== profile.company_id) {
    return { ok: false, message: 'Component not found.' };
  }

  // 2. Get the notification
  const { data: notif } = await supabase
    .from('supplier_change_notifications')
    .select('*')
    .eq('id', notificationId)
    .single();

  if (!notif) {
    return { ok: false, message: 'Notification not found.' };
  }

  if (notif.change_type === 'removed') {
    // Source component was removed - don't auto-delete, just inform user
    return { ok: false, message: 'The source component has been removed by the supplier. Your imported copy is preserved.' };
  }

  // 3. Apply the new snapshot to the imported component
  const snapshot = notif.new_snapshot as Record<string, unknown> | null;
  if (!snapshot) {
    return { ok: false, message: 'No update data available.' };
  }

  const update: Record<string, unknown> = {};
  if (snapshot.name !== undefined) update.name = snapshot.name;
  if (snapshot.default_material_rate !== undefined) update.default_material_rate = snapshot.default_material_rate;
  if (snapshot.default_labour_rate !== undefined) update.default_labour_rate = snapshot.default_labour_rate;
  if (snapshot.pack_price !== undefined) update.pack_price = snapshot.pack_price;
  if (snapshot.pack_size !== undefined) update.pack_size = snapshot.pack_size;
  if (snapshot.pack_coverage_m2 !== undefined) update.pack_coverage_m2 = snapshot.pack_coverage_m2;
  if (snapshot.pricing_strategy !== undefined) update.pricing_strategy = snapshot.pricing_strategy;
  if (snapshot.component_type !== undefined) update.component_type = snapshot.component_type;
  if (snapshot.measurement_type !== undefined) update.measurement_type = snapshot.measurement_type;
  if (snapshot.sku !== undefined) update.sku = snapshot.sku;
  if (snapshot.takeoff_slot !== undefined) update.takeoff_slot = snapshot.takeoff_slot;
  if (snapshot.notes !== undefined) update.notes = snapshot.notes;
  if (snapshot.default_waste_percent !== undefined) update.default_waste_percent = snapshot.default_waste_percent;
  if (snapshot.default_waste_fixed !== undefined) update.default_waste_fixed = snapshot.default_waste_fixed;
  // Update source version to the notification's version_to
  update.source_version = notif.version_to;

  const { error } = await supabase
    .from('component_library')
    .update(update)
    .eq('id', importedComponentId)
    .eq('company_id', profile.company_id);

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath('/[workspaceSlug]/components', 'page');

  return { ok: true };
}

// ─── Phase 1f: Safe server actions for selective apply + resolution ───

/**
 * Apply selected supplier updates to imported components.
 * Reloads authoritative data, verifies ownership + source matching,
 * applies only selected changed fields, persists resolution.
 */
export async function applySupplierUpdates(selections: Array<{
  notificationId: string;
  importedComponentId: string;
  fields: string[];
}>): Promise<Record<string, { ok: boolean; message?: string }>> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return {};
  }

  const supabase = await createSupabaseServerClient();
  const { SYNC_FIELDS } = await import('@/app/lib/supabase/sync-fields');
  const results: Record<string, { ok: boolean; message?: string }> = {};

  for (const sel of selections) {
    const key = `${sel.notificationId}:${sel.importedComponentId}`;

    // 1. Get the imported component and verify ownership
    const { data: comp } = await supabase
      .from('component_library')
      .select('id, source_component_id, source_library_id, source_version, company_id')
      .eq('id', sel.importedComponentId)
      .single();

    if (!comp || comp.company_id !== profile.company_id) {
      results[key] = { ok: false, message: 'Component not found.' };
      continue;
    }

    // 2. Get the notification
    const { data: notif } = await supabase
      .from('supplier_change_notifications')
      .select('*')
      .eq('id', sel.notificationId)
      .single();

    if (!notif) {
      results[key] = { ok: false, message: 'Notification not found.' };
      continue;
    }

    // 3. Verify source matching
    if (notif.supplier_library_id !== comp.source_library_id ||
        notif.component_id !== comp.source_component_id) {
      results[key] = { ok: false, message: 'Notification does not match this component.' };
      continue;
    }

    // 4. Verify notification is newer than applied version
    if (notif.version_to <= (comp.source_version ?? 0)) {
      results[key] = { ok: false, message: 'Update already applied.' };
      continue;
    }

    // 5. Apply only selected fields (validate against SYNC_FIELDS allowlist)
    const snapshot = notif.new_snapshot as Record<string, unknown> | null;
    if (!snapshot) {
      results[key] = { ok: false, message: 'No update data available.' };
      continue;
    }

    const update: Record<string, unknown> = {};
    const validFields: string[] = [];
    for (const field of sel.fields) {
      if (SYNC_FIELDS.includes(field as never) && field in snapshot) {
        update[field] = snapshot[field];
        validFields.push(field);
      }
    }

    if (validFields.length === 0) {
      results[key] = { ok: false, message: 'No valid fields selected.' };
      continue;
    }

    // Update source_version to the notification's version_to
    update.source_version = notif.version_to;

    const { error } = await supabase
      .from('component_library')
      .update(update)
      .eq('id', sel.importedComponentId)
      .eq('company_id', profile.company_id);

    if (error) {
      results[key] = { ok: false, message: error.message };
      continue;
    }

    // 6. Persist resolution
    await supabase
      .from('supplier_update_resolutions')
      .upsert({
        company_id: profile.company_id,
        notification_id: sel.notificationId,
        imported_component_id: sel.importedComponentId,
        status: 'applied',
        applied_fields: validFields,
        resolved_by: profile.id,
        resolved_at: new Date().toISOString(),
      }, { onConflict: 'company_id,notification_id,imported_component_id' });

    results[key] = { ok: true };
  }

  revalidatePath('/[workspaceSlug]/components', 'page');
  return results;
}

/**
 * Resolve a supplier update notification without applying it.
 * status: 'dismissed' | 'kept_local' | 'archived'
 */
export async function resolveSupplierUpdate(params: {
  notificationId: string;
  importedComponentId?: string;
  status: 'dismissed' | 'kept_local' | 'archived';
}): Promise<{ ok: boolean; message?: string }> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return { ok: false, message: 'Authentication required.' };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('supplier_update_resolutions')
    .upsert({
      company_id: profile.company_id,
      notification_id: params.notificationId,
      imported_component_id: params.importedComponentId ?? null,
      status: params.status,
      resolved_by: profile.id,
      resolved_at: new Date().toISOString(),
    }, {
      onConflict: params.importedComponentId
        ? 'company_id,notification_id,imported_component_id'
        : 'company_id,notification_id',
    });

  if (error) {
    return { ok: false, message: error.message };
  }

  revalidatePath('/[workspaceSlug]/components', 'page');
  return { ok: true };
}

/**
 * Update the alert preference for a supplier library.
 * If fieldPreferences is provided, stores per-field alert toggles.
 * If fieldPreferences is null, clears field preferences (alert on all fields).
 */
export async function updateSupplierAlertPreference(
  sourceLibraryId: string,
  enabled: boolean,
  fieldPreferences?: Record<string, boolean> | null,
): Promise<{ ok: boolean; message?: string }> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return { ok: false, message: 'Authentication required.' };
  }

  const supabase = await createSupabaseServerClient();

  const update: {
    company_id: string;
    source_library_id: string;
    alerts_enabled: boolean;
    updated_at: string;
    field_preferences?: Record<string, boolean> | null;
  } = {
    company_id: profile.company_id,
    source_library_id: sourceLibraryId,
    alerts_enabled: enabled,
    updated_at: new Date().toISOString(),
  };

  if (fieldPreferences !== undefined) {
    update.field_preferences = fieldPreferences;
  }

  const { error } = await supabase
    .from('supplier_library_subscriptions')
    .upsert(update, { onConflict: 'company_id,source_library_id' });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

/**
 * Get all supplier library subscriptions for the current company.
 * Used by the subscription settings UI.
 */
export async function getSupplierSubscriptions(): Promise<Array<{
  id: string;
  source_library_id: string;
  library_name: string;
  supplier_name: string;
  alerts_enabled: boolean;
  field_preferences: Record<string, boolean> | null;
  created_at: string;
}>> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  const { data: subs } = await supabase
    .from('supplier_library_subscriptions')
    .select(`
      id, source_library_id, alerts_enabled, field_preferences, created_at
    `)
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false });

  if (!subs || subs.length === 0) return [];

  // Batch fetch library + supplier names
  const libIds = subs.map(s => s.source_library_id);
  const { data: libs } = await supabase
    .from('component_collections')
    .select('id, name, supplier_profiles!component_collections_supplier_profile_id_fkey!inner(supplier_name)')
    .in('id', libIds);

  const libMap = new Map<string, { name: string; supplier_name: string }>();
  for (const lib of libs ?? []) {
    const sp = lib.supplier_profiles as unknown as { supplier_name: string };
    libMap.set(lib.id, { name: lib.name, supplier_name: sp.supplier_name });
  }

  return subs.map(s => {
    const info = libMap.get(s.source_library_id);
    return {
      id: s.id,
      source_library_id: s.source_library_id,
      library_name: info?.name ?? 'Unknown library',
      supplier_name: info?.supplier_name ?? 'Unknown supplier',
      alerts_enabled: s.alerts_enabled,
      field_preferences: s.field_preferences as Record<string, boolean> | null,
      created_at: s.created_at,
    };
  });
}

// ---------------------------------------------------------------------------
// Supplier Catalogue Directory
// ---------------------------------------------------------------------------

export type DirectoryCatalog = {
  id: string;
  name: string;
  public_title: string | null;
  public_description: string | null;
  visibility: string;
  published_at: string | null;
  published_version: number;
  row_count: number;
  original_filename: string | null;
  roofing_types: string[] | null;
  brands: string[] | null;
  keywords: string[] | null;
  service_areas: string[] | null;
  supplier_name: string;
  supplier_slug: string;
  supplier_logo_url: string | null;
};

/**
 * Search published supplier catalogues by text query, roofing type, brand, or location.
 */
export async function searchSupplierCatalogs(params: {
  query?: string;
  roofingType?: string;
  brand?: string;
  location?: string;
  limit?: number;
}): Promise<DirectoryCatalog[]> {
  const supabase = await createSupabaseServerClient();
  const { query, roofingType, brand, location, limit = 50 } = params;

  const { data: catalogs, error } = await supabase
    .from('catalogs')
    .select(`
      id, name, public_title, public_description, visibility,
      published_at, published_version, row_count, original_filename,
      roofing_types, brands, keywords, service_areas,
      supplier_profile_id,
      supplier_profiles!component_collections_supplier_profile_id_fkey!inner (
        id, supplier_name, slug, logo_url, status, service_areas
      )
    `)
    .eq('visibility', 'published')
    .eq('publication_status', 'published')
    .eq('supplier_profiles.status', 'approved')
    .not('supplier_profile_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[searchSupplierCatalogs] Error:', error.message);
    return [];
  }

  if (!catalogs || catalogs.length === 0) return [];

  let results: DirectoryCatalog[] = catalogs.map(c => {
    const sp = c.supplier_profiles as unknown as { supplier_name: string; slug: string; logo_url: string | null; status: string; service_areas: string[] };
    return {
      id: c.id,
      name: c.name,
      public_title: c.public_title,
      public_description: c.public_description,
      visibility: c.visibility,
      published_at: c.published_at,
      published_version: c.published_version,
      row_count: c.row_count,
      original_filename: c.original_filename,
      roofing_types: c.roofing_types,
      brands: c.brands,
      keywords: c.keywords,
      service_areas: c.service_areas,
      supplier_name: sp.supplier_name,
      supplier_slug: sp.slug,
      supplier_logo_url: sp.logo_url,
    };
  });

  // Text search filter
  if (query && query.trim()) {
    const q = query.toLowerCase().trim();
    results = results.filter(c => {
      const haystack = [
        c.name, c.public_title, c.public_description,
        c.supplier_name,
        ...(c.roofing_types ?? []), ...(c.brands ?? []),
        ...(c.keywords ?? []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  // Roofing type filter
  if (roofingType && roofingType !== 'All Roofing') {
    results = results.filter(c => (c.roofing_types ?? []).includes(roofingType));
  }

  // Brand filter
  if (brand) {
    results = results.filter(c => (c.brands ?? []).some(b => b.toLowerCase() === brand.toLowerCase()));
  }

  // Location filter - check both catalogue service_areas and supplier service_areas
  if (location && location.trim()) {
    const loc = location.toLowerCase().trim();
    results = results.filter(c => {
      const catAreas = c.service_areas ?? [];
      if (catAreas.some(a => a.toLowerCase().includes(loc))) return true;
      const sp = catalogs.find(cat => cat.id === c.id)?.supplier_profiles as unknown as { service_areas: string[] } | null;
      const spAreas = sp?.service_areas ?? [];
      return spAreas.some(a => a.toLowerCase().includes(loc));
    });
  }

  return results;
}

/**
 * Save a supplier catalogue to the user's own account.
 * Copies metadata + rows, tracks source for update notifications.
 */
export async function saveSupplierCatalog(catalogId: string): Promise<
  { ok: true; newCatalogId: string } | { ok: false; message: string }
> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    // Fetch the source catalog (must be published)
    const { data: source, error: srcError } = await supabase
      .from('catalogs')
      .select(`
        id, name, column_mapping, headers, row_count, data_bytes,
        public_title, published_version, supplier_profile_id
      `)
      .eq('id', catalogId)
      .eq('visibility', 'published')
      .eq('publication_status', 'published')
      .maybeSingle();

    if (srcError || !source) {
      return { ok: false, message: 'Catalogue not found or not published.' };
    }

    // Check if already saved
    const { data: existing } = await supabase
      .from('catalogs')
      .select('id')
      .eq('source_catalog_id', catalogId)
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (existing) {
      return { ok: false, message: 'You already have this catalogue in your account.' };
    }

    // Create a reference row - NO row copy. The user's catalog points to
    // the supplier's catalog via source_catalog_id. Searches follow the
    // reference to read the supplier's catalog_rows (RLS allows this for
    // published supplier catalogs).
    const { data: newCat, error: insertError } = await supabase
      .from('catalogs')
      .insert({
        company_id: profile.company_id,
        name: source.name,
        column_mapping: source.column_mapping,
        headers: source.headers,
        row_count: source.row_count,
        data_bytes: 0, // No local rows - data lives on the supplier's catalog
        status: 'ready',
        source_catalog_id: catalogId,
        source_version: source.published_version,
        imported_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (insertError || !newCat) {
      return { ok: false, message: insertError?.message ?? 'Failed to add catalogue.' };
    }

    return { ok: true, newCatalogId: newCat.id };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}
