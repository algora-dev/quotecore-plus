'use server';

import { createSupabaseServerClient } from '@/app/lib/supabase/server';

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
 */
export async function getLibraryComponents(libraryId: string): Promise<{
  id: string;
  name: string;
  component_type: string;
  measurement_type: string;
  default_material_rate: number;
  default_labour_rate: number;
  pack_price: number | null;
  pack_size: number | null;
  pricing_strategy: string;
  sku: string | null;
  takeoff_slot: string | null;
}[]> {
  const supabase = await createSupabaseServerClient();

  // First verify the library is published and from an approved supplier
  const { data: lib } = await supabase
    .from('component_collections')
    .select('id, visibility, supplier_profiles!inner(status)')
    .eq('id', libraryId)
    .maybeSingle();

  if (!lib || lib.visibility !== 'published') return [];

  const supplier = lib.supplier_profiles as unknown as { status: string };
  if (supplier.status !== 'approved') return [];

  const { data, error } = await supabase
    .from('component_library')
    .select('id, name, component_type, measurement_type, default_material_rate, default_labour_rate, pack_price, pack_size, pricing_strategy, sku, takeoff_slot')
    .eq('collection_id', libraryId)
    .eq('is_active', true)
    .order('name');

  if (error || !data) return [];
  return data;
}
