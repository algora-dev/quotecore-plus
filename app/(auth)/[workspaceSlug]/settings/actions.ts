'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { revalidatePath } from 'next/cache';

interface CompanySettings {
  currency: string;
  language: string;
  measurement: 'metric' | 'imperial';
  materialMargin: number;
  laborMargin: number;
}

export async function updateCompanySettings(
  companyId: string,
  settings: CompanySettings
) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Verify user owns this company
  if (profile.company_id !== companyId) {
    throw new Error('Unauthorized');
  }

  // Update company settings
  const { error } = await supabase
    .from('companies')
    .update({
      default_currency: settings.currency,
      default_language: settings.language,
      default_measurement_system: settings.measurement,
      default_material_margin_percent: settings.materialMargin,
      default_labor_margin_percent: settings.laborMargin,
    })
    .eq('id', companyId);

  if (error) {
    console.error('[Settings] Update failed:', error);
    throw new Error('Failed to update settings');
  }

  console.log('[Settings] Company settings updated:', {
    companyId,
    materialMargin: settings.materialMargin,
    laborMargin: settings.laborMargin,
  });

  // Revalidate any pages that depend on company settings
  revalidatePath('/');
}
