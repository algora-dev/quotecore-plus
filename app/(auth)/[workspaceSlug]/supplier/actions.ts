'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export type SupplierProfileData = {
  id: string;
  supplier_name: string;
  slug: string;
  status: string;
  website_url: string | null;
  contact_email: string | null;
  phone_number: string | null;
  description: string | null;
  service_areas: string[];
  roofing_types: string[];
  product_categories: string[];
  brands: string[];
  keywords: string[];
  logo_url: string | null;
  approved_at: string | null;
};

export type SupplierLibraryData = {
  id: string;
  name: string;
  is_bootstrap: boolean;
  visibility: string | null;
  publication_status: string | null;
  published_at: string | null;
  published_version: number | null;
  public_title: string | null;
  public_description: string | null;
  component_count: number;
  roofing_types: string[] | null;
  product_categories: string[] | null;
  brands: string[] | null;
};

/**
 * Load the supplier profile for the current company.
 * Returns null if the company is not a supplier.
 */
export async function loadSupplierProfile(): Promise<SupplierProfileData | null> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('supplier_profiles')
    .select('id, supplier_name, slug, status, website_url, contact_email, phone_number, description, service_areas, roofing_types, product_categories, brands, keywords, logo_url, approved_at')
    .eq('company_id', profile.company_id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as SupplierProfileData | null;
}

/**
 * Load all libraries for the current company with component counts.
 */
export async function loadSupplierLibraries(): Promise<SupplierLibraryData[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: collections, error } = await supabase
    .from('component_collections')
    .select(`
      id,
      name,
      is_bootstrap,
      visibility,
      publication_status,
      published_at,
      published_version,
      public_title,
      public_description,
      roofing_types,
      product_categories,
      brands
    `)
    .eq('company_id', profile.company_id)
    .order('is_bootstrap', { ascending: false })
    .order('name');

  if (error) throw new Error(error.message);

  // Get component counts per collection
  const { data: counts, error: countError } = await supabase
    .from('component_library')
    .select('collection_id')
    .eq('company_id', profile.company_id)
    .eq('is_active', true);

  if (countError) throw new Error(countError.message);

  const countMap = new Map<string, number>();
  for (const row of counts ?? []) {
    const cid = row.collection_id as string;
    countMap.set(cid, (countMap.get(cid) ?? 0) + 1);
  }

  return (collections ?? []).map(c => ({
    ...c,
    component_count: countMap.get(c.id) ?? 0,
  })) as SupplierLibraryData[];
}

/**
 * Update the supplier profile (website, description, service areas, etc.)
 */
export async function updateSupplierProfile(
  input: Partial<{
    website_url: string | null;
    contact_email: string | null;
    phone_number: string | null;
    description: string | null;
    service_areas: string[];
    roofing_types: string[];
    product_categories: string[];
    brands: string[];
    keywords: string[];
  }>
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { data: supplier } = await supabase
      .from('supplier_profiles')
      .select('id')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!supplier) return { ok: false, message: 'No supplier profile found for this company.' };

    const update: Record<string, unknown> = {};
    if (input.website_url !== undefined) update.website_url = input.website_url;
    if (input.contact_email !== undefined) update.contact_email = input.contact_email;
    if (input.phone_number !== undefined) update.phone_number = input.phone_number;
    if (input.description !== undefined) update.description = input.description;
    if (input.service_areas !== undefined) update.service_areas = input.service_areas;
    if (input.roofing_types !== undefined) update.roofing_types = input.roofing_types;
    if (input.product_categories !== undefined) update.product_categories = input.product_categories;
    if (input.brands !== undefined) update.brands = input.brands;
    if (input.keywords !== undefined) update.keywords = input.keywords;

    const { error } = await supabase
      .from('supplier_profiles')
      .update(update)
      .eq('id', supplier.id);

    if (error) return { ok: false, message: error.message };

    revalidatePath('/[workspaceSlug]/supplier', 'page');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}
