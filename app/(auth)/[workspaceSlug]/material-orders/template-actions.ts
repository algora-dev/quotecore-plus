'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { pickFields } from '@/app/lib/security/pickFields';
import type { MaterialOrderTemplateInsert } from '@/app/lib/types';

/**
 * Columns updatable from the client. Gerald audit M-03: keep `id`,
 * `company_id`, `created_at`, `updated_at` out of the surface.
 */
const UPDATABLE_ORDER_TEMPLATE_FIELDS = [
  'name',
  'description',
  'default_supplier_name',
  'default_reference',
  'default_order_type',
  'default_colours',
  'default_delivery_address',
  'default_header_notes',
  'default_logo_url',
  'default_from_company',
  'default_contact_person',
  'default_contact_details',
  'default_supplier_contact',
  'default_supplier_phone',
  'default_supplier_email',
  'is_active',
  'sort_order',
] as const;

export async function loadOrderTemplates() {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[loadOrderTemplates] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please ensure you are logged in and have a company workspace.');
  }
  
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('material_order_templates')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('sort_order')
    .order('name');
  
  if (error) {
    console.error('[loadOrderTemplates] Database error:', error);
    throw new Error(`Failed to load templates: ${error.message}`);
  }
  
  return data || [];
}

export async function createOrderTemplate(input: MaterialOrderTemplateInsert) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[createOrderTemplate] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('material_order_templates')
    .insert({ ...input, company_id: profile.company_id })
    .select()
    .single();
  
  if (error) {
    console.error('[createOrderTemplate] Database error:', error);
    throw new Error(`Failed to create template: ${error.message}`);
  }

  revalidatePath('/[workspaceSlug]/material-orders');
  return data;
}

export async function updateOrderTemplate(id: string, input: Partial<MaterialOrderTemplateInsert>) {
  // Whitelist before passing to the DB; see pickFields.ts.
  const update = pickFields(input as Record<string, unknown>, UPDATABLE_ORDER_TEMPLATE_FIELDS);
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[updateOrderTemplate] Failed to get company context:', err);
    throw new Error('Account setup incomplete.');
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('material_order_templates')
    // Cast safe: `update` is a strict subset of
    // Partial<MaterialOrderTemplateInsert> by construction.
    .update(update as Partial<MaterialOrderTemplateInsert>)
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .select()
    .single();
  
  if (error) {
    console.error('[updateOrderTemplate] Database error:', error);
    throw new Error(`Failed to update template: ${error.message}`);
  }

  revalidatePath('/[workspaceSlug]/material-orders');
  return data;
}

export async function deleteOrderTemplate(id: string) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[deleteOrderTemplate] Failed to get company context:', err);
    throw new Error('Account setup incomplete.');
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('material_order_templates')
    .delete()
    .eq('id', id)
    .eq('company_id', profile.company_id);
  
  if (error) {
    console.error('[deleteOrderTemplate] Database error:', error);
    throw new Error(`Failed to delete template: ${error.message}`);
  }

  revalidatePath('/[workspaceSlug]/material-orders');
}
