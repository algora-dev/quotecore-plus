'use server';

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireAdmin } from '@/app/lib/supabase/server';

export type SupplierProfile = {
  id: string;
  company_id: string | null;
  supplier_name: string;
  slug: string;
  status: string;
  master_email: string | null;
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
  company_email?: string;
};

export async function getSuppliers(): Promise<SupplierProfile[]> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
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
      company_email: undefined,
    } as SupplierProfile;
  });
}

export async function createSupplier(input: {
  company_id?: string;
  supplier_name: string;
  master_email?: string;
  website_url?: string;
  service_areas?: string[];
  roofing_types?: string[];
  product_categories?: string[];
  brands?: string[];
  keywords?: string[];
  description?: string;
}): Promise<SupplierProfile> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  // Generate slug from supplier_name
  const slug = input.supplier_name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const { data, error } = await supabase
    .from('supplier_profiles')
    .insert({
      company_id: input.company_id || null,
      supplier_name: input.supplier_name,
      slug,
      status: 'approved',
      master_email: input.master_email || null,
      website_url: input.website_url || null,
      service_areas: input.service_areas || [],
      roofing_types: input.roofing_types || [],
      product_categories: input.product_categories || [],
      brands: input.brands || [],
      keywords: input.keywords || [],
      description: input.description || null,
      approved_at: new Date().toISOString(),
      approved_by: 'admin',
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  // Set is_supplier flag on the company if one was linked
  if (input.company_id) {
    await supabase
      .from('companies')
      .update({ is_supplier: true })
      .eq('id', input.company_id);
  }

  revalidatePath('/admin/suppliers');
  return data as SupplierProfile;
}

export async function updateSupplier(
  id: string,
  input: Partial<{
    supplier_name: string;
    master_email: string | null;
    website_url: string | null;
    service_areas: string[];
    roofing_types: string[];
    product_categories: string[];
    brands: string[];
    keywords: string[];
    description: string | null;
  }>
): Promise<SupplierProfile> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

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
  if (input.website_url !== undefined) update.website_url = input.website_url;
  if (input.service_areas !== undefined) update.service_areas = input.service_areas;
  if (input.roofing_types !== undefined) update.roofing_types = input.roofing_types;
  if (input.product_categories !== undefined) update.product_categories = input.product_categories;
  if (input.brands !== undefined) update.brands = input.brands;
  if (input.keywords !== undefined) update.keywords = input.keywords;
  if (input.description !== undefined) update.description = input.description;

  const { data, error } = await supabase
    .from('supplier_profiles')
    .update(update)
    .eq('id', id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/admin/suppliers');
  return data as SupplierProfile;
}

export async function setSupplierStatus(
  id: string,
  status: 'pending' | 'approved' | 'suspended' | 'revoked'
): Promise<void> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const update: Record<string, unknown> = { status };
  if (status === 'approved') {
    update.approved_at = new Date().toISOString();
    update.approved_by = 'admin';
  }

  const { error } = await supabase
    .from('supplier_profiles')
    .update(update)
    .eq('id', id);

  if (error) throw new Error(error.message);

  // Update is_supplier flag on company
  const { data: profile } = await supabase
    .from('supplier_profiles')
    .select('company_id')
    .eq('id', id)
    .single();

  if (profile && profile.company_id) {
    await supabase
      .from('companies')
      .update({ is_supplier: status === 'approved' })
      .eq('id', profile.company_id);
  }

  revalidatePath('/admin/suppliers');
}

export async function searchCompanies(query: string): Promise<
  { id: string; name: string; email: string; type: 'company' | 'user' }[]
> {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();

  const results: { id: string; name: string; email: string; type: 'company' | 'user' }[] = [];

  // Search companies by name
  const { data: companies, error: companyError } = await supabase
    .from('companies')
    .select('id, name, slug')
    .ilike('name', `%${query}%`)
    .limit(5);

  if (companyError) throw new Error(companyError.message);

  for (const c of companies ?? []) {
    results.push({ id: c.id, name: c.name, email: c.slug || '', type: 'company' });
  }

  // Search users by email
  const { data: users, error: userError } = await supabase
    .from('users')
    .select('id, email, full_name, company_id')
    .ilike('email', `%${query}%`)
    .limit(5);

  if (userError) throw new Error(userError.message);

  for (const u of users ?? []) {
    // Look up company name if user has one
    let companyName = u.full_name || u.email;
    let companyId = u.company_id;
    if (u.company_id) {
      const { data: company } = await supabase
        .from('companies')
        .select('name')
        .eq('id', u.company_id)
        .maybeSingle();
      if (company) companyName = company.name;
    }
    if (companyId) {
      results.push({ id: companyId, name: companyName, email: u.email, type: 'user' });
    }
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return results.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
