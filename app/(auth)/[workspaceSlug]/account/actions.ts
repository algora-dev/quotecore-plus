'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { MeasurementSystem } from '@/app/lib/types';

export async function updateCompanyMeasurementSystem(system: MeasurementSystem) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from('companies')
    .update({ default_measurement_system: system })
    .eq('id', profile.company_id);
    
  if (error) throw new Error(error.message);
  
  revalidatePath('/account');
  return { success: true };
}
