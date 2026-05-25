'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

interface CompanySettings {
  name: string;
  default_tax_rate: number;
  default_currency: string;
  /** Phase 8 (Generic Trades): optional. Only written when the generic-trades
   *  feature is active. */
  default_trade?: 'roofing' | 'generic' | null;
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

  // M-01 (Gerald Round 8): only write default_trade when the generic-trades
  // server flag is active. Matches the gate in settings/actions.ts.
  const genericTradesEnabled = process.env.GENERIC_TRADES_V1_ENABLED === 'true';

  const { error } = await supabase
    .from('companies')
    .update({
      name: settings.name,
      default_tax_rate: settings.default_tax_rate,
      default_currency: settings.default_currency,
      // Only write default_trade when the flag is on and a value is supplied.
      ...(genericTradesEnabled && settings.default_trade != null ? { default_trade: settings.default_trade } : {}),
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

export async function updateDefaultMeasurementSystem(system: 'metric' | 'imperial_ft' | 'imperial_rs') {
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

/* File-storage actions live in `@/app/lib/files/storage-actions`. The thin
 * compatibility shim that used to re-export them from this file was removed
 * once every call site updated to the new import path (Gerald audit pass 2).
 */
