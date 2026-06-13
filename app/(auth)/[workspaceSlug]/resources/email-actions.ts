'use server';
import { revalidatePath } from 'next/cache';
import {
  createSupabaseServerClient,
  requireCompanyContext,
  type Tables,
} from '@/app/lib/supabase/server';

export type EmailTemplate = Tables<'email_templates'>;

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

export type MessageTemplateKind =
  | 'quote_send'
  | 'order_send'
  | 'followup'
  | 'decline_response'
  | 'custom';

export async function createEmailTemplate(input: {
  name: string;
  subject: string;
  body: string;
  is_default?: boolean;
  kind?: MessageTemplateKind;
  category?: string | null;
  // Optional company_attachments id baked into this template as a default
  // attachment. Ownership is enforced at send time by the resolver (Phase 6);
  // here we trust the picker, which only lists this company's attachments.
  attachment_id?: string | null;
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
      kind: input.kind ?? 'custom',
      category: input.category ?? null,
      attachment_id: input.attachment_id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath('/');
  return data;
}

export async function updateEmailTemplate(
  id: string,
  input: {
    name?: string;
    subject?: string;
    body?: string;
    is_default?: boolean;
    kind?: MessageTemplateKind;
    category?: string | null;
    attachment_id?: string | null;
  },
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

  if (error) {
    // 23503 = foreign_key_violation. Surface a friendly message instead of
    // the raw Postgres error so the UI doesn't show "Server Components render".
    const code = (error as { code?: string }).code;
    if (code === '23503') {
      throw new Error(
        'This template is still referenced by another record and cannot be deleted. If you keep seeing this, contact support.'
      );
    }
    throw new Error(error.message);
  }

  revalidatePath('/');
}
