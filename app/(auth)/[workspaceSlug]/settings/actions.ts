'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface CompanySettings {
  companyName: string;
  userName: string;
  currency: string;
  language: string;
  measurement: 'metric' | 'imperial_ft' | 'imperial_rs';
  materialMargin: number;
  laborMargin: number;
}

export async function updateCompanySettings(
  companyId: string,
  _userId: string, // Ignored — we use the authenticated user's ID instead
  settings: CompanySettings
) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify user owns this company (use server-side profile, not client params)
  if (profile.company_id !== companyId) {
    throw new Error('Unauthorized');
  }

  // Update company name
  const { error: companyError } = await supabase
    .from('companies')
    .update({
      name: settings.companyName,
      default_currency: settings.currency,
      default_language: settings.language,
      default_measurement_system: settings.measurement,
      default_material_margin_percent: settings.materialMargin,
      default_labor_margin_percent: settings.laborMargin,
    })
    .eq('id', companyId);

  if (companyError) {
    console.error('[Settings] Company update failed:', companyError);
    throw new Error('Failed to update company settings');
  }

  // Update user name (use authenticated user ID, not client-provided)
  const { error: userError } = await supabase
    .from('users')
    .update({
      full_name: settings.userName,
    })
    .eq('id', profile.id);

  if (userError) {
    console.error('[Settings] User update failed:', userError);
    throw new Error('Failed to update user settings');
  }



  // Revalidate any pages that depend on company settings
  revalidatePath('/');
}
