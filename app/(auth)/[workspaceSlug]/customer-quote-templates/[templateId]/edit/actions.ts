'use server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

export async function loadTemplateForEdit(templateId: string) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: template, error } = await supabase
    .from('customer_quote_templates')
    .select('*')
    .eq('id', templateId)
    .eq('company_id', profile.company_id)
    .single();

  if (error) throw new Error(error.message);
  return template;
}

export async function updateCustomerQuoteTemplate(
  templateId: string,
  data: {
    name: string;
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyEmail: string;
    footerText: string;
    companyLogoUrl: string | null;
  }
) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Check for duplicate name (excluding this template)
  const { data: existing } = await supabase
    .from('customer_quote_templates')
    .select('id')
    .eq('company_id', profile.company_id)
    .ilike('name', data.name.trim())
    .neq('id', templateId)
    .maybeSingle();

  if (existing) {
    throw new Error('A template with this name already exists');
  }

  const { error } = await supabase
    .from('customer_quote_templates')
    .update({
      name: data.name.trim(),
      company_name: data.companyName || null,
      company_address: data.companyAddress || null,
      company_phone: data.companyPhone || null,
      company_email: data.companyEmail || null,
      company_logo_url: data.companyLogoUrl || null,
      footer_text: data.footerText || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', templateId)
    .eq('company_id', profile.company_id);

  if (error) throw new Error(error.message);
}
