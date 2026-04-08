'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { ComponentLibraryInsert } from '@/app/lib/types';

export async function loadComponentLibrary() {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please ensure you are logged in and have a company workspace.');
  }
  
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('component_library')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('name');
  
  if (error) {
    console.error('Database error loading components:', error);
    throw new Error(`Failed to load components: ${error.message}`);
  }
  
  // Note: After migration 022, database uses 'lineal' (no transform needed)
  return data;
}

export async function createComponent(input: ComponentLibraryInsert) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[createComponent] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  console.log('[createComponent] Creating component for company:', profile.company_id);
  console.log('[createComponent] Input data:', input);

  // Note: After migration 022, database accepts 'lineal' directly (no transform needed)
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('component_library')
    .insert({ ...input, company_id: profile.company_id })
    .select()
    .single();
  
  if (error) {
    console.error('[createComponent] Database error:', error);
    throw new Error(`Failed to create component: ${error.message} (Code: ${error.code})`);
  }
  
  console.log('[createComponent] Component created successfully:', data.id);
  revalidatePath('/components');
  return data;
}

export async function updateComponent(id: string, input: Partial<ComponentLibraryInsert>) {
  const profile = await requireCompanyContext();
  
  // Note: After migration 022, database accepts 'lineal' directly (no transform needed)
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('component_library')
    .update(input)
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .select()
    .single();
  
  if (error) throw new Error(error.message);
  revalidatePath('/components');
  return data;
}

export async function deleteComponent(id: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('component_library')
    .delete()
    .eq('id', id)
    .eq('company_id', profile.company_id);
  if (error) throw new Error(error.message);
  revalidatePath('/components');
}
