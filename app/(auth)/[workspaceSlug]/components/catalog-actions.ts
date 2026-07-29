'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminAny = any;

export type UserCatalogSummary = {
  id: string;
  name: string;
  row_count: number;
  original_filename: string | null;
  created_at: string;
  headers: string[];
};

/**
 * List all catalogs belonging to the current user's company.
 */
export async function listUserCatalogs(): Promise<UserCatalogSummary[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('catalogs')
    .select('id, name, row_count, original_filename, created_at, headers')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false });

  if (error || !data) return [];

  return data.map((c: Record<string, unknown>) => ({
    id: c.id as string,
    name: c.name as string,
    row_count: c.row_count as number,
    original_filename: c.original_filename as string | null,
    created_at: c.created_at as string,
    headers: (c.headers as string[]) ?? [],
  }));
}

export type PublicCatalogSummary = {
  id: string;
  name: string;
  public_title: string | null;
  public_description: string | null;
  row_count: number;
  roofing_types: string[] | null;
  brands: string[] | null;
  keywords: string[] | null;
  service_areas: string[] | null;
  supplier_name: string;
  supplier_slug: string;
  supplier_logo_url: string | null;
  headers: string[];
};

/**
 * Search publicly published supplier catalogs.
 */
export async function searchPublicCatalogs(params: {
  query?: string;
  limit?: number;
}): Promise<PublicCatalogSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { query, limit = 50 } = params;

  const { data: catalogs, error } = await supabase
    .from('catalogs')
    .select(`
      id, name, public_title, public_description, row_count,
      roofing_types, brands, keywords, service_areas, headers,
      supplier_profiles!inner (
        id, supplier_name, slug, logo_url, status
      )
    `)
    .eq('visibility', 'published')
    .eq('publication_status', 'published')
    .eq('supplier_profiles.status', 'approved')
    .not('supplier_profile_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error || !catalogs) return [];

  let results: PublicCatalogSummary[] = catalogs.map((c: Record<string, any>) => {
    const sp = c.supplier_profiles as unknown as Record<string, any>;
    return {
      id: c.id,
      name: c.name,
      public_title: c.public_title,
      public_description: c.public_description,
      row_count: c.row_count,
      roofing_types: c.roofing_types,
      brands: c.brands,
      keywords: c.keywords,
      service_areas: c.service_areas,
      supplier_name: sp.supplier_name,
      supplier_slug: sp.slug,
      supplier_logo_url: sp.logo_url,
      headers: (c.headers as string[]) ?? [],
    };
  });

  // Client-side text filter
  if (query) {
    const q = query.toLowerCase();
    results = results.filter(c => {
      const haystack = [
        c.name, c.public_title, c.public_description,
        ...(c.keywords ?? []), ...(c.brands ?? []),
        ...(c.service_areas ?? []), ...(c.roofing_types ?? []),
        c.supplier_name,
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }

  return results;
}

export type CatalogRowsResult = {
  ok: boolean;
  headers?: string[];
  rows?: Record<string, string>[];
  error?: string;
};

/**
 * Fetch rows from a catalog. Works for both user's own catalogs and public supplier catalogs.
 * For public catalogs, follows source_catalog_id to read the original rows.
 */
export async function fetchCatalogRows(catalogId: string, limit = 30000): Promise<CatalogRowsResult> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    const { data: catalog } = await admin
      .from('catalogs')
      .select('id, name, headers, company_id, source_catalog_id, visibility, publication_status, supplier_profile_id')
      .eq('id', catalogId)
      .maybeSingle();

    if (!catalog) {
      return { ok: false, error: 'Catalog not found.' };
    }

    // Access check: user owns it OR it's a published supplier catalog
    const ownsIt = catalog.company_id === profile.company_id;
    const isPublic = catalog.visibility === 'published' && catalog.publication_status === 'published';
    if (!ownsIt && !isPublic) {
      return { ok: false, error: 'You do not have access to this catalog.' };
    }

    // Follow source_catalog_id if present (imported copy points to original)
    const rowsCatalogId = catalog.source_catalog_id || catalogId;

    const { data: rows, error } = await admin
      .from('catalog_rows')
      .select('raw_row, row_index')
      .eq('catalog_id', rowsCatalogId)
      .order('row_index', { ascending: true })
      .limit(limit);

    if (error) throw new Error(error.message);

    return {
      ok: true,
      headers: catalog.headers as string[],
      rows: (rows ?? []).map((r: { raw_row: Record<string, string> }) => r.raw_row),
    };
  } catch (err) {
    console.error('[fetchCatalogRows]', err);
    return { ok: false, error: err instanceof Error ? err.message : 'Unexpected error' };
  }
}

export type ConvertFromCatalogResult = {
  ok: boolean;
  created?: number;
  errors?: string[];
};

/**
 * Convert selected catalog rows into components, reusing the existing logic
 * from catalogue-actions.ts but with a 20-row cap.
 */
export async function convertCatalogRowsToComponents(params: {
  targetCollectionId: string;
  newLibraryName?: string;
  selectedRows: Record<string, string>[];
  columnMapping: Record<string, string[]>;
}): Promise<ConvertFromCatalogResult> {
  const { targetCollectionId, newLibraryName, selectedRows, columnMapping } = params;

  // Hard cap at 20 rows
  if (selectedRows.length > 20) {
    return { ok: false, errors: ['Maximum 20 rows can be converted at once.'] };
  }

  if (!selectedRows.length) {
    return { ok: false, errors: ['No rows selected.'] };
  }

  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return { ok: false, errors: ['Authentication required.'] };
  }

  const supabase = await createSupabaseServerClient();

  // Determine target collection: existing or create new
  let finalCollectionId = targetCollectionId;

  if (newLibraryName && !targetCollectionId) {
    // Create new library
    const { data: newCol, error: colErr } = await supabase
      .from('component_collections')
      .insert({
        company_id: profile.company_id,
        name: newLibraryName,
        is_bootstrap: false,
        visibility: 'private',
      })
      .select('id')
      .single();

    if (colErr || !newCol) {
      return { ok: false, errors: ['Failed to create new library: ' + (colErr?.message ?? 'Unknown error')] };
    }
    finalCollectionId = newCol.id;
  } else {
    // Verify existing collection belongs to user's company
    const { data: targetCol } = await supabase
      .from('component_collections')
      .select('id, company_id')
      .eq('id', targetCollectionId)
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!targetCol) {
      return { ok: false, errors: ['Target library not found.'] };
    }
  }

  // Check tier limit
  try {
    const { loadCompanyEntitlements, requireComponentSlot, ComponentLimitReachedError, SubscriptionInactiveError, isBillingError } = await import('@/app/lib/billing/entitlements');
    await requireComponentSlot(profile.company_id);
    if (selectedRows.length > 1) {
      const ent = await loadCompanyEntitlements(profile.company_id);
      if (ent.componentLimit !== null && ent.componentCount + selectedRows.length > ent.componentLimit) {
        return {
          ok: false,
          errors: [`Importing ${selectedRows.length} components would exceed your plan limit (${ent.componentCount}/${ent.componentLimit} on ${ent.effectivePlanCode} plan).`],
        };
      }
    }
  } catch (err) {
    const { ComponentLimitReachedError, SubscriptionInactiveError, isBillingError } = await import('@/app/lib/billing/entitlements');
    if (err instanceof ComponentLimitReachedError) {
      return { ok: false, errors: [`Component limit reached (${err.used}/${err.limit} on ${err.planCode} plan).`] };
    }
    if (err instanceof SubscriptionInactiveError) {
      return { ok: false, errors: ['Subscription inactive.'] };
    }
    if (isBillingError(err)) {
      return { ok: false, errors: [err.message] };
    }
    throw err;
  }

  // Get current max sort_order
  const { data: maxSort } = await supabase
    .from('component_library')
    .select('sort_order')
    .eq('company_id', profile.company_id)
    .eq('collection_id', finalCollectionId)
    .order('sort_order', { ascending: false })
    .limit(1);

  let nextSort = (maxSort && maxSort.length > 0 ? maxSort[0].sort_order : 0) + 1;

  // Build reverse map: field -> header (first header that maps to this field)
  const fieldToHeader: Record<string, string> = {};
  for (const [header, fields] of Object.entries(columnMapping)) {
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      if (field && !fieldToHeader[field]) {
        fieldToHeader[field] = header;
      }
    }
  }

  // Map product type to slot + measurement type
  function mapProductType(pt: string): { slot: string; mType: 'area' | 'linear' | 'quantity' } {
    const p = pt.toLowerCase().trim();
    if (!p) return { slot: 'custom', mType: 'quantity' };
    if (p.includes('area') || p.includes('roof') || p.includes('sheet') || p.includes('tile') || p.includes('shingle')) return { slot: 'roof_area', mType: 'area' };
    if (p.includes('ridge')) return { slot: 'ridge', mType: 'linear' };
    if (p.includes('hip')) return { slot: 'hip', mType: 'linear' };
    if (p.includes('valley')) return { slot: 'valley', mType: 'linear' };
    if (p.includes('barge')) return { slot: 'barge', mType: 'linear' };
    if (p.includes('spout') || p.includes('gutter')) return { slot: 'spouting', mType: 'linear' };
    if (p.includes('underlay') || p.includes('underlayment') || p.includes('membrane')) return { slot: 'underlay', mType: 'area' };
    if (p.includes('fixing') || p.includes('screw') || p.includes('nail') || p.includes('bolt')) return { slot: 'fixings', mType: 'quantity' };
    return { slot: 'custom', mType: 'quantity' };
  }

  const NAME_CHAR_LIMIT = 60;

  const insertRows = selectedRows.map(row => {
    const sku = fieldToHeader.sku ? (row[fieldToHeader.sku] ?? '').trim() : '';
    const fullName = fieldToHeader.name ? (row[fieldToHeader.name] ?? '').trim() : '';
    const name = fullName.substring(0, NAME_CHAR_LIMIT) || 'Unnamed';
    const priceStr = fieldToHeader.price ? (row[fieldToHeader.price] ?? '0') : '0';
    const price = parseFloat(priceStr.replace(/[^0-9.\-]/g, '')) || 0;
    const notes = fieldToHeader.notes ? (row[fieldToHeader.notes] ?? '').trim() : '';

    const { slot, mType } = mapProductType('');

    return {
      company_id: profile.company_id,
      collection_id: finalCollectionId,
      name: name || 'Unnamed',
      component_type: 'main' as const,
      measurement_type: mType,
      default_material_rate: price,
      default_labour_rate: 0,
      default_waste_type: 'percent' as const,
      default_waste_percent: 0,
      default_waste_fixed: 0,
      default_pitch_type: 'none' as const,
      pack_price: null,
      pack_size: null,
      pack_coverage_m2: null,
      pricing_strategy: 'per_unit' as const,
      waste_unit: 'percent' as const,
      show_price_default: true,
      show_dimensions_default: false,
      eligible_for_orders: false,
      height_value_mm: null,
      depth_value_mm: null,
      notes: notes || null,
      sku: sku || null,
      takeoff_slot: slot,
      sort_order: nextSort++,
      is_active: true,
      is_system: false,
    };
  });

  const { error: insertError } = await supabase
    .from('component_library')
    .insert(insertRows);

  if (insertError) {
    console.error('[convertCatalogRowsToComponents] Insert error:', insertError);
    return { ok: false, errors: [insertError.message] };
  }

  const { revalidatePath } = await import('next/cache');
  revalidatePath('/[workspaceSlug]/components', 'page');

  return { ok: true, created: insertRows.length, errors: [] };
}
