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
};

/**
 * Supplier action: publish an update to a library.
 * Bumps published_version, diffs current components against the last published snapshot,
 * and records change notifications for each changed component.
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

  const currentVersion = lib.published_version ?? 0;
  const newVersion = currentVersion + 1;

  // 2. Get current components in the library
  const { data: currentComponents } = await supabase
    .from('component_library')
    .select('*')
    .eq('collection_id', libraryId)
    .eq('is_active', true)
    .order('name');

  // 3. Get the last published snapshot (components as they were when last published)
  // We use the change_notifications table to find the last known state,
  // or if no notifications exist yet, everything is 'added'.
  const { data: lastNotifs } = await supabase
    .from('supplier_change_notifications')
    .select('component_id, new_snapshot, change_type')
    .eq('supplier_library_id', libraryId)
    .in('change_type', ['added', 'modified', 'price_changed'])
    .order('created_at', { ascending: false });

  // Build a map of last-known published state by component_id
  const lastPublishedMap = new Map<string, Record<string, unknown>>();
  for (const n of lastNotifs ?? []) {
    if (n.component_id && n.new_snapshot && !lastPublishedMap.has(n.component_id)) {
      lastPublishedMap.set(n.component_id, n.new_snapshot as Record<string, unknown>);
    }
  }

  // Also check for 'removed' notifications to know what was removed
  const removedIds = new Set(
    (lastNotifs ?? []).filter(n => n.change_type === 'removed' && n.component_id).map(n => n.component_id!)
  );

  const currentIds = new Set((currentComponents ?? []).map(c => c.id));
  const changes: Array<{
    component_id: string | null;
    change_type: 'added' | 'modified' | 'removed' | 'price_changed';
    old_snapshot: Record<string, unknown> | null;
    new_snapshot: Record<string, unknown> | null;
  }> = [];

  // Detect added and modified components
  for (const comp of currentComponents ?? []) {
    const snapshot: Record<string, unknown> = {
      name: comp.name,
      default_material_rate: comp.default_material_rate,
      default_labour_rate: comp.default_labour_rate,
      pack_price: comp.pack_price,
      pack_size: comp.pack_size,
      pricing_strategy: comp.pricing_strategy,
      component_type: comp.component_type,
      measurement_type: comp.measurement_type,
      sku: comp.sku,
      takeoff_slot: comp.takeoff_slot,
      notes: comp.notes,
      default_waste_percent: comp.default_waste_percent,
      default_waste_fixed: comp.default_waste_fixed,
      pack_coverage_m2: comp.pack_coverage_m2,
    };

    const prev = lastPublishedMap.get(comp.id);
    if (!prev && !removedIds.has(comp.id)) {
      // New component since last publish
      changes.push({
        component_id: comp.id,
        change_type: 'added',
        old_snapshot: null,
        new_snapshot: snapshot,
      });
    } else if (prev) {
      // Compare key fields
      const priceChanged =
        prev.default_material_rate !== comp.default_material_rate ||
        prev.default_labour_rate !== comp.default_labour_rate ||
        prev.pack_price !== comp.pack_price;
      const otherChanged =
        prev.name !== comp.name ||
        prev.pricing_strategy !== comp.pricing_strategy ||
        prev.component_type !== comp.component_type ||
        prev.measurement_type !== comp.measurement_type ||
        prev.sku !== comp.sku ||
        prev.takeoff_slot !== comp.takeoff_slot ||
        prev.notes !== comp.notes ||
        prev.default_waste_percent !== comp.default_waste_percent ||
        prev.default_waste_fixed !== comp.default_waste_fixed ||
        prev.pack_size !== comp.pack_size ||
        prev.pack_coverage_m2 !== comp.pack_coverage_m2;

      if (priceChanged && !otherChanged) {
        changes.push({
          component_id: comp.id,
          change_type: 'price_changed',
          old_snapshot: prev,
          new_snapshot: snapshot,
        });
      } else if (priceChanged || otherChanged) {
        changes.push({
          component_id: comp.id,
          change_type: 'modified',
          old_snapshot: prev,
          new_snapshot: snapshot,
        });
      }
    }
  }

  // Detect removed components (were in last published, not in current)
  for (const [compId, snapshot] of lastPublishedMap) {
    if (!currentIds.has(compId)) {
      changes.push({
        component_id: compId,
        change_type: 'removed',
        old_snapshot: snapshot,
        new_snapshot: null,
      });
    }
  }

  // 4. Insert change notifications
  if (changes.length > 0) {
    const notifRows = changes.map(c => ({
      supplier_library_id: libraryId,
      component_id: c.component_id,
      change_type: c.change_type,
      old_snapshot: c.old_snapshot as unknown as import('@/app/lib/supabase/database.types').Json | null,
      new_snapshot: c.new_snapshot as unknown as import('@/app/lib/supabase/database.types').Json | null,
      version_from: currentVersion,
      version_to: newVersion,
    }));

    const { error: notifError } = await supabase
      .from('supplier_change_notifications')
      .insert(notifRows);

    if (notifError) {
      console.error('[publishLibraryUpdate] Notification insert error:', notifError);
      // Don't fail the whole publish if notifications fail - version bump is the critical part
    }
  }

  // 5. Bump published_version
  const { error: bumpError } = await supabase
    .from('component_collections')
    .update({ published_version: newVersion })
    .eq('id', libraryId);

  if (bumpError) {
    return { ok: false, message: bumpError.message };
  }

  revalidatePath('/components');
  revalidatePath('/[workspaceSlug]/supplier-directory', 'page');

  return {
    ok: true,
    newVersion,
    changesRecorded: changes.length,
  };
}

/**
 * Get pending updates for a user's imported supplier components.
 * Returns notifications where the source component has changed since the user imported it.
 */
export async function getPendingSupplierUpdates(): Promise<PendingUpdate[]> {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return [];
  }

  const supabase = await createSupabaseServerClient();

  // Get all imported components for this company (ones with source_component_id)
  const { data: imported } = await supabase
    .from('component_library')
    .select('id, name, source_component_id, source_library_id, source_version')
    .eq('company_id', profile.company_id)
    .not('source_component_id', 'is', null);

  if (!imported || imported.length === 0) return [];

  // Group by source_library_id to batch query notifications
  const byLibrary = new Map<string, typeof imported>();
  for (const imp of imported) {
    const libId = imp.source_library_id;
    if (!libId) continue;
    if (!byLibrary.has(libId)) byLibrary.set(libId, []);
    byLibrary.get(libId)!.push(imp);
  }

  const results: PendingUpdate[] = [];

  for (const [sourceLibId, imports] of byLibrary) {
    // Get the library + supplier info
    const { data: lib } = await supabase
      .from('component_collections')
      .select('id, name, supplier_profiles!inner(supplier_name)')
      .eq('id', sourceLibId)
      .maybeSingle();

    if (!lib) continue;
    const supplierInfo = lib.supplier_profiles as unknown as { supplier_name: string };

    // Get notifications newer than each import's source_version
    for (const imp of imports) {
      if (!imp.source_component_id || imp.source_version === null) continue;

      const { data: notifs } = await supabase
        .from('supplier_change_notifications')
        .select('*')
        .eq('supplier_library_id', sourceLibId)
        .eq('component_id', imp.source_component_id)
        .gt('version_to', imp.source_version)
        .order('created_at', { ascending: false })
        .limit(1);

      if (notifs && notifs.length > 0) {
        const n = notifs[0];
        results.push({
          notification_id: n.id,
          source_library_id: sourceLibId,
          source_library_name: lib.name,
          supplier_name: supplierInfo.supplier_name,
          component_id: imp.source_component_id,
          imported_component_id: imp.id,
          imported_component_name: imp.name,
          change_type: n.change_type,
          version_from: n.version_from,
          version_to: n.version_to,
          created_at: n.created_at,
          new_snapshot: n.new_snapshot as Record<string, unknown> | null,
        });
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
