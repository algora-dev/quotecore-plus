'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

interface OnboardingData {
  currency: string;
  language: string;
  measurement: 'metric' | 'imperial';
}

export async function completeOnboarding(companyId: string, data: OnboardingData) {
  const profile = await requireCompanyContext({ skipOnboardingCheck: true });
  
  // Security: ensure user owns this company
  if (profile.company_id !== companyId) {
    console.error('[completeOnboarding] Unauthorized:', { profileCompanyId: profile.company_id, requestedCompanyId: companyId });
    throw new Error('Unauthorized');
  }

  const supabase = await createSupabaseServerClient();
  
  console.log('[completeOnboarding] Updating company:', {
    companyId,
    currency: data.currency,
    language: data.language,
    measurement: data.measurement,
  });
  
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
    console.error('[completeOnboarding] Database error:', error);
    throw new Error(error.message);
  }

  console.log('[completeOnboarding] Success! Onboarding completed.');

  revalidatePath('/onboarding');
  revalidatePath('/');
}
