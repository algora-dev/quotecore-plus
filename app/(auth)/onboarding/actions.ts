'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireUser, requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';

interface OnboardingData {
  currency: string;
  language: string;
  measurement: 'metric' | 'imperial_ft' | 'imperial_rs';
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

  // Don't revalidate here — client handles the copilot intro step transition
  // revalidatePath will cause server to re-render and redirect before copilot step shows
}

export async function completeGoogleOnboarding(formData: FormData) {
  const companyName = String(formData.get('companyName') || '').trim();
  const fullName = String(formData.get('fullName') || '').trim();
  const currency = String(formData.get('currency') || 'NZD').trim();
  const language = String(formData.get('language') || 'en').trim();
  // Validate measurement against the new tri-state. Anything we don't recognise
  // (e.g. an old form posting 'imperial') gets normalised to 'imperial_rs'
  // since that's what the legacy UI produced.
  const rawMeasurement = String(formData.get('measurement') || 'metric').trim();
  const measurement: 'metric' | 'imperial_ft' | 'imperial_rs' =
    rawMeasurement === 'metric' || rawMeasurement === 'imperial_ft' || rawMeasurement === 'imperial_rs'
      ? rawMeasurement
      : 'imperial_rs';

  if (!companyName || !fullName) {
    throw new Error('Company name and your name are required.');
  }

  const supabase = await createSupabaseServerClient();
  const authUser = await requireUser();
  const supabaseAdmin = createAdminClient();

  // Create company
  const slugBase = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 50);

  const companySlug = `${slugBase || 'company'}-${authUser.id.slice(0, 8)}`;

  const { data: company, error: companyError } = await supabaseAdmin
    .from('companies')
    .insert({
      name: companyName,
      slug: companySlug,
      default_currency: currency,
      default_language: language,
      default_measurement_system: measurement,
      default_tax_rate: 15.0,
      onboarding_completed_at: new Date().toISOString(),
    })
    .select('id, slug')
    .single();

  if (companyError || !company) {
    throw new Error(companyError?.message || 'Failed to create company');
  }

  // Check if user profile exists
  const { data: existingProfile } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', authUser.id)
    .single();

  if (existingProfile) {
    await supabaseAdmin
      .from('users')
      .update({ company_id: company.id, full_name: fullName })
      .eq('id', authUser.id);
  } else {
    await supabaseAdmin
      .from('users')
      .insert({
        id: authUser.id,
        company_id: company.id,
        email: authUser.email || '',
        full_name: fullName,
        role: 'owner',
      });
  }

  // Skip redirect if requested (copilot intro step handles navigation)
  const skipRedirect = formData.get('skipRedirect') === 'true';
  if (!skipRedirect) {
    redirect(`/${company.slug}`);
  }
  return { slug: company.slug };
}
