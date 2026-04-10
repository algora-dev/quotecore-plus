'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { FlashingLibraryInsert } from '@/app/lib/types';

export async function loadFlashingLibrary() {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please ensure you are logged in and have a company workspace.');
  }
  
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('flashing_library')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('name');
  
  if (error) {
    console.error('Database error loading flashings:', error);
    throw new Error(`Failed to load flashings: ${error.message}`);
  }
  
  return data;
}

export async function createFlashing(input: FlashingLibraryInsert) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[createFlashing] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  console.log('[createFlashing] Creating flashing for company:', profile.company_id);
  console.log('[createFlashing] Input data:', input);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('flashing_library')
    .insert({ ...input, company_id: profile.company_id })
    .select()
    .single();
  
  if (error) {
    console.error('[createFlashing] Database error:', error);
    throw new Error(`Failed to create flashing: ${error.message}`);
  }
  
  revalidatePath('/[workspaceSlug]/flashings');
  return data;
}

export async function updateFlashing(id: string, input: Partial<FlashingLibraryInsert>) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[updateFlashing] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  console.log('[updateFlashing] Updating flashing:', id);

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('flashing_library')
    .update(input)
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .select()
    .single();
  
  if (error) {
    console.error('[updateFlashing] Database error:', error);
    throw new Error(`Failed to update flashing: ${error.message}`);
  }
  
  revalidatePath('/[workspaceSlug]/flashings');
  return data;
}

export async function deleteFlashing(id: string) {
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch (err) {
    console.error('[deleteFlashing] Failed to get company context:', err);
    throw new Error('Account setup incomplete. Please log out and log back in.');
  }

  console.log('[deleteFlashing] Deleting flashing:', id);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('flashing_library')
    .delete()
    .eq('id', id)
    .eq('company_id', profile.company_id);
  
  if (error) {
    console.error('[deleteFlashing] Database error:', error);
    throw new Error(`Failed to delete flashing: ${error.message}`);
  }
  
  revalidatePath('/[workspaceSlug]/flashings');
}
