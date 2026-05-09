'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import {
  checkStorageQuota as _checkStorageQuota,
  saveFileMetadata as _saveFileMetadata,
} from '@/app/lib/files/storage-actions';

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

/* -------------------------------------------------------------------------
 * Compatibility shim — file-storage actions used to live here.
 *
 * They moved to `app/lib/files/storage-actions.ts` because they are not
 * settings-specific. Direct re-export of an external `'use server'` symbol
 * is not allowed by Next 16's server-actions module rules, so we wrap each
 * one in a thin pass-through. The wrappers add no behaviour; they exist only
 * so legacy callers keep working until every import site is updated.
 *
 * NEW CODE: import from `@/app/lib/files/storage-actions` directly.
 * ------------------------------------------------------------------------- */

export async function checkStorageQuota(companyId: string, fileSize: number): Promise<boolean> {
  return _checkStorageQuota(companyId, fileSize);
}

export async function saveFileMetadata(data: {
  companyId: string;
  fileType: 'logo' | 'plan' | 'supporting';
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  quoteId?: string;
}): Promise<void> {
  return _saveFileMetadata(data);
}
