'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

interface OnboardingData {
  currency: string;
  language: string;
  measurement: 'metric' | 'imperial';
}

export async function completeOnboarding(companyId: string, data: OnboardingData) {
  const profile = await requireCompanyContext();
  
  // Security: ensure user owns this company
  if (profile.company_id !== companyId) {
    throw new Error('Unauthorized');
  }

  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase
    .from('companies')
    .update({
      default_currency: data.currency,
      default_language: data.language,
      default_measurement_system: data.measurement,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq('id', companyId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/onboarding');
  revalidatePath('/');
}
