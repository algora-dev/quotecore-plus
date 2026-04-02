'use server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateCompanyMeasurementSystem(system: 'metric' | 'imperial') {
  const supabase = await createSupabaseServerClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: profile } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id) throw new Error('No company found');

  const { error } = await supabase
    .from('companies')
    .update({ default_measurement_system: system })
    .eq('id', profile.company_id);

  if (error) throw error;

  revalidatePath('/[workspaceSlug]/account');
}
