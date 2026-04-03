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

export async function uploadCompanyLogo(companyId: string, file: File): Promise<string> {
  const profile = await requireCompanyContext();
  
  if (profile.company_id !== companyId) {
    throw new Error('Unauthorized');
  }

  const supabase = await createSupabaseServerClient();
  
  // Check storage quota
  const { data: company } = await supabase
    .from('companies')
    .select('storage_used_bytes, storage_limit_bytes')
    .eq('id', companyId)
    .single();
  
  if (company && (company.storage_used_bytes + file.size) > company.storage_limit_bytes) {
    throw new Error('Storage quota exceeded. Please upgrade your plan.');
  }

  // Upload to Supabase Storage
  const fileName = `logo.${file.name.split('.').pop()}`;
  const storagePath = `${companyId}/${fileName}`;
  
  const { error: uploadError } = await supabase.storage
    .from('company-logos')
    .upload(storagePath, file, { upsert: true });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('company-logos')
    .getPublicUrl(storagePath);

  const publicUrl = urlData.publicUrl;

  // Save to quote_files table
  const { error: dbError } = await supabase
    .from('quote_files')
    .upsert({
      company_id: companyId,
      file_type: 'logo',
      file_name: fileName,
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      uploaded_by: profile.id,
    }, { onConflict: 'storage_path' });

  if (dbError) {
    throw new Error(dbError.message);
  }

  revalidatePath('/account');
  return publicUrl;
}
