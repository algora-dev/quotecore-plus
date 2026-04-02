'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { ComponentLibraryInsert } from '@/app/lib/types';

export async function loadComponentLibrary() {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('component_library')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('name');
  if (error) throw new Error(error.message);
  return data;
}

export async function createComponent(input: ComponentLibraryInsert) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('component_library')
    .insert({ ...input, company_id: profile.company_id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  revalidatePath('/components');
  return data;
}

export async function updateComponent(id: string, input: Partial<ComponentLibraryInsert>) {
  const profile = await requireCompanyContext();
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
