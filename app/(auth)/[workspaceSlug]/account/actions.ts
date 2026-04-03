'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

interface CompanySettings {
  name: string;
  default_tax_rate: number;
  default_currency: string;
}

interface UserProfile {
  full_name: string;
}

export async function updateCompanySettings(companyId: string, settings: CompanySettings) {
  const profile = await requireCompanyContext();
  
  // Security: ensure user owns this company
  if (profile.company_id !== companyId) {
    throw new Error('Unauthorized');
  }

  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from('companies')
    .update({
      name: settings.name,
      default_tax_rate: settings.default_tax_rate,
      default_currency: settings.default_currency,
    })
    .eq('id', companyId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/account');
}

export async function updateUserProfile(userId: string, data: UserProfile) {
  const profile = await requireCompanyContext();
  
  // Security: ensure user can only update their own profile
  if (profile.id !== userId) {
    throw new Error('Unauthorized');
  }

  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from('users')
    .update({
      full_name: data.full_name,
    })
    .eq('id', userId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/account');
}

export async function updateDefaultMeasurementSystem(system: 'metric' | 'imperial') {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from('companies')
    .update({ default_measurement_system: system })
    .eq('id', profile.company_id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/account');
}
