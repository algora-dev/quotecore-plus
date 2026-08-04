'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminAny = any;

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
  allow_custom_pricing: boolean;
  takeoff_builder_enabled: boolean;
  default_takeoff_collection_id: string | null;
  enquiry_email: string | null;
  enquiries_enabled: boolean;
  currency: string;
  branch_city: string | null;
  branch_region: string | null;
  branch_country: string | null;
  national_coverage: boolean;
  delivery_coverage: string | null;
  instant_pricing_available: boolean;
  // G1 visibility/publication fields
  public_page_enabled: boolean;
  search_indexing_enabled: boolean;
  public_catalogue_enabled: boolean;
  public_price_visibility: 'hidden' | 'web_only' | 'full';
  public_contact_visibility: 'hidden' | 'page_only' | 'full';
  publication_state: 'unready' | 'ready' | 'published' | 'unlisted' | 'suspended';
  publication_updated_at: string | null;
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
  is_default_takeoff_library: boolean | null;
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
    .select('id, supplier_name, slug, status, website_url, contact_email, phone_number, description, service_areas, roofing_types, product_categories, brands, keywords, logo_url, approved_at, allow_custom_pricing, takeoff_builder_enabled, default_takeoff_collection_id, enquiry_email, enquiries_enabled, currency, branch_city, branch_region, branch_country, national_coverage, delivery_coverage, instant_pricing_available, public_page_enabled, search_indexing_enabled, public_catalogue_enabled, public_price_visibility, public_contact_visibility, publication_state, publication_updated_at')
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
      brands,
      is_default_takeoff_library
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
    allow_custom_pricing: boolean;
    takeoff_builder_enabled: boolean;
    default_takeoff_collection_id: string | null;
    enquiry_email: string | null;
    enquiries_enabled: boolean;
    instant_pricing_available: boolean;
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
    if (input.allow_custom_pricing !== undefined) update.allow_custom_pricing = input.allow_custom_pricing;
    if (input.takeoff_builder_enabled !== undefined) update.takeoff_builder_enabled = input.takeoff_builder_enabled;
    if (input.default_takeoff_collection_id !== undefined) update.default_takeoff_collection_id = input.default_takeoff_collection_id;
    if (input.enquiry_email !== undefined) update.enquiry_email = input.enquiry_email || null;
    if (input.enquiries_enabled !== undefined) update.enquiries_enabled = input.enquiries_enabled;
    if (input.instant_pricing_available !== undefined) update.instant_pricing_available = input.instant_pricing_available;

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

// ---------------------------------------------------------------------------
// Supplier Catalogues
// ---------------------------------------------------------------------------

export type SupplierCatalogData = {
  id: string;
  name: string;
  original_filename: string | null;
  row_count: number;
  data_bytes: number;
  status: string;
  visibility: string;
  publication_status: string;
  published_version: number;
  published_at: string | null;
  public_title: string | null;
  public_description: string | null;
  roofing_types: string[] | null;
  brands: string[] | null;
  keywords: string[] | null;
  service_areas: string[] | null;
  created_at: string;
  updated_at: string;
};

/**
 * Load catalogues belonging to the current supplier company.
 */
export async function loadSupplierCatalogs(): Promise<SupplierCatalogData[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('catalogs')
    .select(`
      id, name, original_filename, row_count, data_bytes, status,
      visibility, publication_status, published_version, published_at,
      public_title, public_description, roofing_types, brands, keywords,
      service_areas, created_at, updated_at
    `)
    .eq('company_id', profile.company_id)
    .order('status', { ascending: true })
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as SupplierCatalogData[];
}

/**
 * Update catalogue visibility / publication settings.
 */
export async function updateCatalogVisibility(
  catalogId: string,
  settings: {
    visibility: 'private' | 'unlisted' | 'published';
    public_title?: string | null;
    public_description?: string | null;
    roofing_types?: string[];
    brands?: string[];
    keywords?: string[];
    service_areas?: string[];
  }
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    // Verify ownership
    const { data: catalog } = await admin
      .from('catalogs')
      .select('id, supplier_profile_id')
      .eq('id', catalogId)
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!catalog) return { ok: false, message: 'Catalogue not found.' };

    // Get supplier profile
    const { data: supplier } = await admin
      .from('supplier_profiles')
      .select('id, status')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!supplier || supplier.status !== 'approved') {
      return { ok: false, message: 'Only approved suppliers can publish catalogues.' };
    }

    const update: Record<string, unknown> = {
      visibility: settings.visibility,
      public_title: settings.public_title ?? null,
      public_description: settings.public_description ?? null,
      roofing_types: settings.roofing_types ?? null,
      brands: settings.brands ?? null,
      keywords: settings.keywords ?? null,
      service_areas: settings.service_areas ?? null,
      supplier_profile_id: supplier.id,
    };

    if (settings.visibility === 'published') {
      update.publication_status = 'published';
      update.published_at = new Date().toISOString();
      update.published_version = (catalog.published_version ?? 0) + 1;
    } else if (settings.visibility === 'private') {
      update.publication_status = 'draft';
    }

    const { error } = await admin
      .from('catalogs')
      .update(update)
      .eq('id', catalogId);

    if (error) return { ok: false, message: error.message };

    revalidatePath('/[workspaceSlug]/supplier', 'page');
    revalidatePath('/[workspaceSlug]/supplier-directory', 'page');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Publish a catalogue update (bump version, notify users who saved it).
 */
export async function publishCatalogUpdate(
  catalogId: string
): Promise<{ ok: true; newVersion: number } | { ok: false; message: string }> {
  try {
    const profile = await requireCompanyContext();
    const admin = createAdminClient() as AdminAny;

    const { data: catalog } = await admin
      .from('catalogs')
      .select('id, published_version, supplier_profile_id, visibility')
      .eq('id', catalogId)
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!catalog) return { ok: false, message: 'Catalogue not found.' };
    if (catalog.visibility !== 'published') {
      return { ok: false, message: 'Catalogue must be published first.' };
    }

    const newVersion = (catalog.published_version ?? 0) + 1;

    const { error } = await admin
      .from('catalogs')
      .update({
        published_version: newVersion,
        published_at: new Date().toISOString(),
      })
      .eq('id', catalogId);

    if (error) return { ok: false, message: error.message };

    // Create alerts for companies that saved this catalogue
    const { data: savedBy } = await admin
      .from('catalogs')
      .select('company_id, name')
      .eq('source_catalog_id', catalogId)
      .neq('company_id', profile.company_id);

    if (savedBy && savedBy.length > 0) {
      const alerts = savedBy.map((row: { company_id: string; name: string }) => ({
        company_id: row.company_id,
        alert_type: 'supplier_catalog_update',
        title: 'Supplier catalogue updated',
        message: `"${row.name}" has been updated by the supplier. Review the latest version.`,
        is_read: false,
        status: 'active',
      }));

      await admin.from('alerts').insert(alerts);
    }

    revalidatePath('/[workspaceSlug]/supplier', 'page');
    return { ok: true, newVersion };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Update takeoff builder settings from the supplier dashboard.
 * Lets the supplier opt in/out, choose their component library, and configure enquiry settings.
 */
export async function updateTakeoffBuilderSettings(input: {
  takeoff_builder_enabled: boolean;
  default_takeoff_collection_id: string | null;
  enquiry_email: string | null;
  enquiries_enabled: boolean;
  instant_pricing_available: boolean;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { data: supplier } = await supabase
      .from('supplier_profiles')
      .select('id, status')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!supplier) return { ok: false, message: 'No supplier profile found for this company.' };
    if (supplier.status !== 'approved') return { ok: false, message: 'Only approved suppliers can configure the takeoff builder.' };

    // If enabling, verify the selected collection belongs to this company
    if (input.takeoff_builder_enabled && input.default_takeoff_collection_id) {
      const { data: coll } = await supabase
        .from('component_collections')
        .select('id')
        .eq('id', input.default_takeoff_collection_id)
        .eq('company_id', profile.company_id)
        .maybeSingle();

      if (!coll) return { ok: false, message: 'Selected component library not found.' };
    }

    // Update supplier profile
    const { error: profileErr } = await supabase
      .from('supplier_profiles')
      .update({
        takeoff_builder_enabled: input.takeoff_builder_enabled,
        default_takeoff_collection_id: input.default_takeoff_collection_id,
        enquiry_email: input.enquiry_email,
        enquiries_enabled: input.enquiries_enabled,
        instant_pricing_available: input.instant_pricing_available,
      })
      .eq('id', supplier.id);

    if (profileErr) return { ok: false, message: profileErr.message };

    // Update is_default_takeoff_library flag on collections
    // Clear all defaults for this supplier first
    const admin = createAdminClient() as AdminAny;
    await admin
      .from('component_collections')
      .update({ is_default_takeoff_library: false })
      .eq('supplier_profile_id', supplier.id)
      .eq('is_default_takeoff_library', true);

    // Set new default if specified
    if (input.default_takeoff_collection_id) {
      await admin
        .from('component_collections')
        .update({ is_default_takeoff_library: true })
        .eq('id', input.default_takeoff_collection_id)
        .eq('company_id', profile.company_id);
    }

    revalidatePath('/[workspaceSlug]/supplier', 'page');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Check if a supplier profile is ready for publication.
 * Returns a checklist with pass/fail for each requirement.
 */
export async function checkPublicationReadiness(): Promise<{
  ready: boolean;
  checks: { label: string; passed: boolean; detail?: string }[];
}> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { data: supplier } = await supabase
      .from('supplier_profiles')
      .select('*')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!supplier) return { ready: false, checks: [{ label: 'Supplier profile exists', passed: false }] };

    const checks = [
      { label: 'Admin approved', passed: supplier.status === 'approved', detail: supplier.status !== 'approved' ? `Current status: ${supplier.status}` : undefined },
      { label: 'Supplier name set', passed: !!supplier.supplier_name?.trim() },
      { label: 'Description set', passed: !!supplier.description?.trim() },
      { label: 'Contact email set', passed: !!supplier.contact_email?.trim() },
      { label: 'At least one service area', passed: (supplier.service_areas?.length ?? 0) > 0 },
      { label: 'At least one roofing type', passed: (supplier.roofing_types?.length ?? 0) > 0 },
      { label: 'Branch location set', passed: !!supplier.branch_city?.trim() },
      { label: 'Default takeoff collection selected', passed: !!supplier.default_takeoff_collection_id, detail: !supplier.default_takeoff_collection_id ? 'Select a component library in the Takeoff Builder tab' : undefined },
      { label: 'Takeoff builder enabled', passed: supplier.takeoff_builder_enabled === true },
    ];

    return { ready: checks.every(c => c.passed), checks };
  } catch (err) {
    return { ready: false, checks: [{ label: 'Error checking readiness', passed: false, detail: err instanceof Error ? err.message : 'Unknown error' }] };
  }
}

/**
 * Update supplier visibility/publication settings.
 * Only the supplier themselves can change these (after admin approval).
 */
export async function updateSupplierVisibility(input: {
  public_page_enabled: boolean;
  search_indexing_enabled: boolean;
  public_catalogue_enabled: boolean;
  public_price_visibility: 'hidden' | 'web_only' | 'full';
  public_contact_visibility: 'hidden' | 'page_only' | 'full';
  publication_state: 'unready' | 'ready' | 'published' | 'unlisted';
}): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { data: supplier } = await supabase
      .from('supplier_profiles')
      .select('id, status, publication_state')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!supplier) return { ok: false, message: 'No supplier profile found.' };
    if (supplier.status !== 'approved') return { ok: false, message: 'Only approved suppliers can manage visibility.' };
    if (supplier.publication_state === 'suspended') return { ok: false, message: 'Publication is admin-suspended. Contact support.' };

    // If trying to publish, verify readiness
    if (input.publication_state === 'published') {
      const readiness = await checkPublicationReadiness();
      if (!readiness.ready) {
        const failed = readiness.checks.filter(c => !c.passed).map(c => c.label).join(', ');
        return { ok: false, message: `Not ready to publish. Missing: ${failed}` };
      }
    }

    const { error } = await supabase
      .from('supplier_profiles')
      .update({
        public_page_enabled: input.public_page_enabled,
        search_indexing_enabled: input.search_indexing_enabled,
        public_catalogue_enabled: input.public_catalogue_enabled,
        public_price_visibility: input.public_price_visibility,
        public_contact_visibility: input.public_contact_visibility,
        publication_state: input.publication_state,
        publication_updated_by: profile.id,
      })
      .eq('id', supplier.id);

    if (error) return { ok: false, message: error.message };

    revalidatePath('/[workspaceSlug]/supplier', 'page');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Get the public supplier read model for preview.
 * Lets the supplier see exactly what the public will see before publishing.
 */
export async function previewPublicProfile(): Promise<{
  ok: true;
  data: unknown;
} | {
  ok: false;
  message: string;
}> {
  try {
    const profile = await requireCompanyContext();
    const supabase = await createSupabaseServerClient();

    const { data: supplier } = await supabase
      .from('supplier_profiles')
      .select('slug')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (!supplier) return { ok: false, message: 'No supplier profile found.' };

    const admin = createAdminClient() as AdminAny;
    const { data, error } = await admin.rpc('public_supplier_read', { p_slug: supplier.slug });

    if (error) return { ok: false, message: error.message };

    return { ok: true, data };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : 'Unknown error' };
  }
}
