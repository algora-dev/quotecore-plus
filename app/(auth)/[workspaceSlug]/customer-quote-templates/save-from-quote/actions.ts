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

  // 1. Create template
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

  // 2. Copy customer quote lines to template lines
  const { data: quoteLines, error: loadError } = await supabase
    .from('customer_quote_lines')
    .select('*')
    .eq('quote_id', data.quoteId)
    .order('sort_order');

  if (loadError) throw new Error(loadError.message);

  if (quoteLines && quoteLines.length > 0) {
    const templateLines = quoteLines.map(line => ({
      template_id: template.id,
      line_type: line.line_type,
      component_library_id: null, // TODO: Map quote_component_id to component_library_id when component library exists
      custom_text: line.custom_text,
      custom_amount: line.custom_amount,
      show_price: line.show_price,
      sort_order: line.sort_order,
      is_visible: line.is_visible,
    }));

    const { error: insertError } = await supabase
      .from('customer_quote_template_lines')
      .insert(templateLines);

    if (insertError) throw new Error(insertError.message);
  }

  return template.id;
}
