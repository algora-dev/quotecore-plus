'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

export type SupplierProfile = {
  id: string;
  company_id: string | null;
  supplier_name: string;
  slug: string;
  status: string;
  master_email: string | null;
  contact_email: string | null;
  phone_number: string | null;
  website_url: string | null;
  service_areas: string[];
  roofing_types: string[];
  product_categories: string[];
  brands: string[];
  keywords: string[];
  logo_url: string | null;
  description: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
  company_name?: string;
  // Takeoff builder fields
  enquiry_email: string | null;
  enquiries_enabled: boolean;
  country: string | null;
  currency: string;
  branch_city: string | null;
  branch_region: string | null;
  branch_country: string | null;
  national_coverage: boolean;
  delivery_coverage: string;
  instant_pricing_available: boolean;
  default_takeoff_collection_id: string | null;
};

export type SupplierCollection = {
  id: string;
  name: string;
  status: string;
  is_takeoff_default: boolean;
  component_count: number;
};

export interface SupplierSearchResult {
  id: string;
  email: string;
  fullName: string | null;
  companyId: string;
  companyName: string;
}

export type SupplierSearchResponse =
  | { ok: true; users: SupplierSearchResult[] }
  | { ok: false; error: string };

/**
 * Search users by email or company name - same pattern as Users tab.
 * Used to find existing users to assign as suppliers.
 */
export async function searchSupplierUsers(query: string): Promise<SupplierSearchResponse> {
  await requireAdmin();
  const admin = createAdminClient();
  const q = (query ?? '').trim();

  if (!q) {
    return { ok: false, error: 'Enter a search term.' };
  }

  // Search by email first
  const { data: emailMatches, error: emailErr } = await admin
    .from('users')
    .select('id, email, full_name, company_id')
    .ilike('email', `%${q}%`)
    .order('email', { ascending: true })
    .limit(25);

  if (emailErr) return { ok: false, error: emailErr.message };

  const results: SupplierSearchResult[] = [];
  const companyIds = new Set<string>();

  for (const u of emailMatches ?? []) {
    if (u.company_id) {
      companyIds.add(u.company_id);
      results.push({
        id: u.id,
        email: u.email,
        fullName: u.full_name,
        companyId: u.company_id,
        companyName: '', // filled below
      });
    }
  }

  // Also search by company name
  if (results.length < 25) {
    const { data: coMatches } = await admin
      .from('companies')
      .select('id, name')
      .ilike('name', `%${q}%`)
      .limit(25);

    for (const c of coMatches ?? []) {
      if (!companyIds.has(c.id)) {
        companyIds.add(c.id);
        const { data: coUsers } = await admin
          .from('users')
          .select('id, email, full_name, company_id')
          .eq('company_id', c.id)
          .limit(5);

        for (const u of coUsers ?? []) {
          results.push({
            id: u.id,
            email: u.email,
            fullName: u.full_name,
            companyId: c.id,
            companyName: c.name,
          });
        }
      }
    }
  }

  // Batch-load company names for email matches
  const idsNeedingNames = results.filter(r => !r.companyName).map(r => r.companyId);
  if (idsNeedingNames.length > 0) {
    const { data: companies } = await admin
      .from('companies')
      .select('id, name')
      .in('id', idsNeedingNames);

    const nameMap: Record<string, string> = {};
    for (const c of companies ?? []) {
      nameMap[c.id] = c.name;
    }
    for (const r of results) {
      if (!r.companyName) r.companyName = nameMap[r.companyId] || 'Unknown';
    }
  }

  return { ok: true, users: results.slice(0, 25) };
}

export async function getSuppliers(): Promise<SupplierProfile[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('supplier_profiles')
    .select(`
      *,
      companies!left (
        name,
        slug
      )
    `)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const companies = row.companies as unknown as { name: string; slug: string } | null;
    return {
      ...row,
      company_name: companies?.name,
    } as unknown as SupplierProfile;
  });
}

export async function getSupplierCollections(supplierId: string): Promise<SupplierCollection[]> {
  await requireAdmin();
  const admin = createAdminClient();

  // Get supplier's id directly (supplier_profile_id on collections)
  const { data: supplier } = await admin
    .from('supplier_profiles')
    .select('id')
    .eq('id', supplierId)
    .single();

  if (!supplier?.id) return [];

  const { data, error } = await admin
    .from('component_collections')
    .select(`
      id,
      name,
      publication_status,
      is_default_takeoff_library,
      component_library ( count )
    `)
    .eq('supplier_profile_id', supplierId)
    .order('created_at', { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.publication_status || 'draft',
    is_takeoff_default: row.is_default_takeoff_library ?? false,
    component_count: (row.component_library as unknown as { count: number }[])?.[0]?.count ?? 0,
  }));
}

export async function setDefaultTakeoffCollection(supplierId: string, collectionId: string | null): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  // Clear any existing default on collections for this supplier
  await admin
    .from('component_collections')
    .update({ is_default_takeoff_library: false })
    .eq('supplier_profile_id', supplierId)
    .eq('is_default_takeoff_library', true);

  // Set new default on collection if specified
  if (collectionId) {
    await admin
      .from('component_collections')
      .update({ is_default_takeoff_library: true })
      .eq('id', collectionId)
      .eq('supplier_profile_id', supplierId);
  }

  // Update supplier profile
  await admin
    .from('supplier_profiles')
    .update({ default_takeoff_collection_id: collectionId })
    .eq('id', supplierId);

  revalidatePath('/admin/suppliers');
}

export async function createSupplier(input: {
  company_id?: string;
  supplier_name: string;
  master_email?: string;
  contact_email?: string;
  phone_number?: string;
  website_url?: string;
  service_areas?: string[];
  roofing_types?: string[];
  product_categories?: string[];
  brands?: string[];
  keywords?: string[];
  description?: string;
  enquiry_email?: string;
  enquiries_enabled?: boolean;
  country?: string;
  currency?: string;
  branch_city?: string;
  branch_region?: string;
  branch_country?: string;
  national_coverage?: boolean;
  delivery_coverage?: string;
  instant_pricing_available?: boolean;
}): Promise<SupplierProfile> {
  await requireAdmin();
  const admin = createAdminClient();

  const slug = input.supplier_name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const { data, error } = await admin
    .from('supplier_profiles')
    .insert({
      company_id: input.company_id || null,
      supplier_name: input.supplier_name,
      slug,
      status: 'approved',
      master_email: input.master_email || null,
      contact_email: input.contact_email || null,
      phone_number: input.phone_number || null,
      website_url: input.website_url || null,
      service_areas: input.service_areas || [],
      roofing_types: input.roofing_types || [],
      product_categories: input.product_categories || [],
      brands: input.brands || [],
      keywords: input.keywords || [],
      description: input.description || null,
      enquiry_email: input.enquiry_email || null,
      enquiries_enabled: input.enquiries_enabled ?? false,
      country: input.country || null,
      currency: input.currency || 'NZD',
      branch_city: input.branch_city || null,
      branch_region: input.branch_region || null,
      branch_country: input.branch_country || null,
      national_coverage: input.national_coverage ?? false,
      delivery_coverage: input.delivery_coverage || 'local',
      instant_pricing_available: input.instant_pricing_available ?? false,
      approved_at: new Date().toISOString(),
      approved_by: 'admin',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (input.company_id) {
    await admin
      .from('companies')
      .update({ is_supplier: true })
      .eq('id', input.company_id);
  }

  revalidatePath('/admin/suppliers');
  return data as unknown as SupplierProfile;
}

export async function updateSupplier(
  id: string,
  input: Partial<{
    supplier_name: string;
    master_email: string | null;
    contact_email: string | null;
    phone_number: string | null;
    website_url: string | null;
    service_areas: string[];
    roofing_types: string[];
    product_categories: string[];
    brands: string[];
    keywords: string[];
    description: string | null;
    enquiry_email: string | null;
    enquiries_enabled: boolean;
    country: string | null;
    currency: string;
    branch_city: string | null;
    branch_region: string | null;
    branch_country: string | null;
    national_coverage: boolean;
    delivery_coverage: string;
    instant_pricing_available: boolean;
  }>
): Promise<SupplierProfile> {
  await requireAdmin();
  const admin = createAdminClient();

  const update: Record<string, unknown> = {};
  if (input.supplier_name !== undefined) {
    update.supplier_name = input.supplier_name;
    update.slug = input.supplier_name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
  if (input.master_email !== undefined) update.master_email = input.master_email || null;
  if (input.contact_email !== undefined) update.contact_email = input.contact_email || null;
  if (input.phone_number !== undefined) update.phone_number = input.phone_number || null;
  if (input.website_url !== undefined) update.website_url = input.website_url;
  if (input.service_areas !== undefined) update.service_areas = input.service_areas;
  if (input.roofing_types !== undefined) update.roofing_types = input.roofing_types;
  if (input.product_categories !== undefined) update.product_categories = input.product_categories;
  if (input.brands !== undefined) update.brands = input.brands;
  if (input.keywords !== undefined) update.keywords = input.keywords;
  if (input.description !== undefined) update.description = input.description;
  if (input.enquiry_email !== undefined) update.enquiry_email = input.enquiry_email || null;
  if (input.enquiries_enabled !== undefined) update.enquiries_enabled = input.enquiries_enabled;
  if (input.country !== undefined) update.country = input.country || null;
  if (input.currency !== undefined) update.currency = input.currency;
  if (input.branch_city !== undefined) update.branch_city = input.branch_city || null;
  if (input.branch_region !== undefined) update.branch_region = input.branch_region || null;
  if (input.branch_country !== undefined) update.branch_country = input.branch_country || null;
  if (input.national_coverage !== undefined) update.national_coverage = input.national_coverage;
  if (input.delivery_coverage !== undefined) update.delivery_coverage = input.delivery_coverage;
  if (input.instant_pricing_available !== undefined) update.instant_pricing_available = input.instant_pricing_available;

  const { data, error } = await admin
    .from('supplier_profiles')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/admin/suppliers');
  return data as unknown as SupplierProfile;
}

export async function setSupplierStatus(
  id: string,
  status: 'pending' | 'approved' | 'suspended' | 'revoked'
): Promise<void> {
  await requireAdmin();
  const admin = createAdminClient();

  const update: Record<string, unknown> = { status };
  if (status === 'approved') {
    update.approved_at = new Date().toISOString();
    update.approved_by = 'admin';
  }

  const { error } = await admin
    .from('supplier_profiles')
    .update(update)
    .eq('id', id);

  if (error) throw new Error(error.message);

  const { data: profile } = await admin
    .from('supplier_profiles')
    .select('company_id')
    .eq('id', id)
    .single();

  if (profile && profile.company_id) {
    await admin
      .from('companies')
      .update({ is_supplier: status === 'approved' })
      .eq('id', profile.company_id);
  }

  revalidatePath('/admin/suppliers');
}
