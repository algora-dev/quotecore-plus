'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';

// ─── Template CRUD ───────────────────────────────────

export async function createTemplate(formData: FormData) {
  const { profile, company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();

  const name = String(formData.get('name') || '').trim();
  const description = String(formData.get('description') || '').trim();
  const roofingProfile = String(formData.get('roofing_profile') || '').trim();

  if (!name) throw new Error('Template name is required.');

  const { data, error } = await supabase
    .from('templates')
    .insert({
      company_id: profile.company_id,
      name,
      description: description || null,
      roofing_profile: roofingProfile || null,
    })
    .select('id')
    .single();

  if (error || !data) throw new Error(error?.message || 'Failed to create template.');
  redirect(`/${company.slug}/templates/${data.id}`);
}

export async function updateTemplate(id: string, input: { name?: string; description?: string; roofing_profile?: string; is_active?: boolean }) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('templates')
    .update(input)
    .eq('id', id)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);
  revalidatePath('/templates');
}

// ─── Template Roof Areas ─────────────────────────────

export async function getTemplateRoofAreas(templateId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('template_roof_areas')
    .select('*')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function addTemplateRoofArea(templateId: string, label: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('template_roof_areas')
    .insert({ template_id: templateId, label })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/templates');
  return data;
}

export async function removeTemplateRoofArea(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('template_roof_areas').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/templates');
}

// ─── Template Components ─────────────────────────────

export async function getTemplateComponents(templateId: string) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('template_components')
    .select('*, component_library(*)')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function addTemplateComponent(templateId: string, input: {
  component_library_id: string;
  template_roof_area_id?: string;
  component_type: 'main' | 'extra';
}) {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('template_components')
    .insert({
      template_id: templateId,
      component_library_id: input.component_library_id,
      template_roof_area_id: input.template_roof_area_id ?? null,
      component_type: input.component_type,
    })
    .select('*, component_library(*)')
    .single();

  if (error) throw new Error(error.message);
  revalidatePath('/templates');
  return data;
}

export async function updateTemplateComponent(id: string, overrides: {
  override_material_rate?: number | null;
  override_labour_rate?: number | null;
  override_waste_type?: string | null;
  override_waste_percent?: number | null;
  override_waste_fixed?: number | null;
  override_pitch_applies?: boolean | null;
  template_roof_area_id?: string | null;
}) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('template_components')
    .update(overrides)
    .eq('id', id);

  if (error) throw new Error(error.message);
  revalidatePath('/templates');
}

export async function removeTemplateComponent(id: string) {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from('template_components').delete().eq('id', id);
  if (error) throw new Error(error.message);
  revalidatePath('/templates');
}
