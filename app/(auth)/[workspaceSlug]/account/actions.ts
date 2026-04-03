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

export async function checkStorageQuota(companyId: string, fileSize: number): Promise<boolean> {
  const profile = await requireCompanyContext();
  
  if (profile.company_id !== companyId) {
    throw new Error('Unauthorized');
  }

  const supabase = await createSupabaseServerClient();
  
  const { data: company } = await supabase
    .from('companies')
    .select('storage_used_bytes, storage_limit_bytes')
    .eq('id', companyId)
    .single();
  
  if (!company) {
    throw new Error('Company not found');
  }
  
  return (company.storage_used_bytes + fileSize) <= company.storage_limit_bytes;
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
  console.log('[saveFileMetadata] Starting with data:', data);
  
  const profile = await requireCompanyContext();
  console.log('[saveFileMetadata] Profile loaded:', profile.id, profile.company_id);
  
  if (profile.company_id !== data.companyId) {
    throw new Error('Unauthorized');
  }

  // Use admin client to bypass RLS
  const { createAdminClient } = await import('@/app/lib/supabase/admin');
  const supabaseAdmin = createAdminClient();
  
  console.log('[saveFileMetadata] Attempting upsert...');
  const { error } = await supabaseAdmin
    .from('quote_files')
    .upsert({
      company_id: data.companyId,
      quote_id: data.quoteId || null,
      file_type: data.fileType,
      file_name: data.fileName,
      file_size: data.fileSize,
      mime_type: data.mimeType,
      storage_path: data.storagePath,
      uploaded_by: profile.id,
    }, { onConflict: 'storage_path' });

  if (error) {
    console.error('[saveFileMetadata] Database error:', error);
    throw new Error(error.message);
  }

  console.log('[saveFileMetadata] Success! Revalidating...');
  revalidatePath('/account');
}
