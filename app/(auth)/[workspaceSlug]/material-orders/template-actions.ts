'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { MaterialOrderTemplateInsert } from '@/app/lib/types';

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
    .update(input)
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
