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
  description: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
  company_name?: string;
  // Takeoff builder fields (read-only in admin - display only)
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
};

/**
 * Get all suppliers for the admin list view.
 * Read-only - no editing from admin. Use impersonation to edit supplier details.
 */
export async function getSuppliers(): Promise<SupplierProfile[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from('supplier_profiles')
    .select(`
      id, company_id, supplier_name, slug, status, master_email,
      contact_email, phone_number, website_url, service_areas, roofing_types,
      description, approved_at, created_at, updated_at,
      takeoff_builder_enabled, default_takeoff_collection_id,
      enquiry_email, enquiries_enabled, currency,
      branch_city, branch_region, branch_country,
      national_coverage, delivery_coverage, instant_pricing_available,
      companies!left ( name, slug )
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

/**
 * Approve, suspend, or revoke a supplier.
 * This is the only mutation allowed from admin - everything else
 * is done through impersonation or direct DB access.
 */
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

  // Toggle is_supplier on the company
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
