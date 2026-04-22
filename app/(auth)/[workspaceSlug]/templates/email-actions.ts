'use server';
import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export interface EmailTemplate {
  id: string;
  company_id: string;
  name: string;
  subject: string;
  body: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export async function loadEmailTemplates(): Promise<EmailTemplate[]> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('company_id', profile.company_id)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createEmailTemplate(input: {
  name: string;
  subject: string;
  body: string;
  is_default?: boolean;
}): Promise<EmailTemplate> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // If setting as default, unset existing default
  if (input.is_default) {
    await supabase
      .from('email_templates')
      .update({ is_default: false })
      .eq('company_id', profile.company_id)
      .eq('is_default', true);
  }

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      company_id: profile.company_id,
      name: input.name,
      subject: input.subject,
      body: input.body,
      is_default: input.is_default || false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/');
  return data;
}

export async function updateEmailTemplate(
  id: string,
  input: { name?: string; subject?: string; body?: string; is_default?: boolean }
): Promise<void> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // If setting as default, unset existing default
  if (input.is_default) {
    await supabase
      .from('email_templates')
      .update({ is_default: false })
      .eq('company_id', profile.company_id)
      .eq('is_default', true);
  }

  const { error } = await supabase
    .from('email_templates')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);

  revalidatePath('/');
}

export async function deleteEmailTemplate(id: string): Promise<void> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', id)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);

  revalidatePath('/');
}
