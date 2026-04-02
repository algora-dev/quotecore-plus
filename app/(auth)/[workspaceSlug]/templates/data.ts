import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import type { TemplateRow } from '@/app/lib/types';

export async function loadTemplates(): Promise<TemplateRow[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('templates')
    .select('id, name, description, roofing_profile, is_active, company_id, created_at, updated_at')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as TemplateRow[];
}

export async function loadTemplate(id: string): Promise<TemplateRow> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .eq('id', id)
    .eq('company_id', profile.company_id)
    .single();

  if (error || !data) throw new Error(error?.message || 'Template not found');
  return data as TemplateRow;
}
