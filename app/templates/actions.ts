'use server';

import { redirect } from 'next/navigation';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export async function createTemplate(formData: FormData) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const mode = String(formData.get('mode') || 'hybrid').trim();
  const roofingProfile = String(formData.get('roofing_profile') || '').trim();

  if (!name) {
    throw new Error('Template name is required.');
  }

  if (!['simple', 'advanced', 'hybrid'].includes(mode)) {
    throw new Error('Invalid template mode.');
  }

  const { data, error } = await supabase
    .from('templates')
    .insert({
      company_id: profile.company_id,
      name,
      description: description || null,
      mode,
      roofing_profile: roofingProfile || null,
      is_active: true,
      material_margin_default_pct: null,
      labour_margin_default_pct: null,
      disclaimers_default: [],
      exclusions_default: [],
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Failed to create template.');
  }

  redirect(`/templates/${data.id}`);
}