'use server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

interface CreateTemplateData {
  name: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  footerText: string;
  companyLogoUrl: string | null;
}

export async function createCustomerQuoteTemplate(data: CreateTemplateData) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  const { data: template, error } = await supabase
    .from('customer_quote_templates')
    .insert({
      company_id: profile.company_id,
      name: data.name,
      is_starter_template: false,
      company_name: data.companyName || null,
      company_address: data.companyAddress || null,
      company_phone: data.companyPhone || null,
      company_email: data.companyEmail || null,
      company_logo_url: data.companyLogoUrl || null,
      footer_text: data.footerText || null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);

  return template.id;
}
