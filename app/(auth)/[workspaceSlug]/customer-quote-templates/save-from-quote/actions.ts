'use server';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

interface SaveTemplateData {
  quoteId: string;
  name: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  footerText: string;
}

export async function saveQuoteAsTemplate(data: SaveTemplateData) {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Create template (branding only - no line items)
  const { data: template, error: templateError } = await supabase
    .from('customer_quote_templates')
    .insert({
      company_id: profile.company_id,
      name: data.name,
      is_starter_template: false,
      company_name: data.companyName || null,
      company_address: data.companyAddress || null,
      company_phone: data.companyPhone || null,
      company_email: data.companyEmail || null,
      company_logo_url: null,
      footer_text: data.footerText || null,
    })
    .select('id')
    .single();

  if (templateError) throw new Error(templateError.message);

  return template.id;
}
