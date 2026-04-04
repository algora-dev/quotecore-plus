'use server';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';

interface CreateQuoteParams {
  customerName: string;
  jobName: string | null;
  templateId: string | null;
}

export async function createQuoteWithDetails(params: CreateQuoteParams): Promise<string> {
  const { profile, company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();

  // If template specified, use existing createQuoteFromTemplate
  if (params.templateId) {
    const { createQuoteFromTemplate } = await import('../actions');
    return createQuoteFromTemplate(params.templateId, params.customerName, params.jobName);
  }

  // Otherwise, create blank quote
  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      company_id: profile.company_id,
      customer_name: params.customerName,
      job_name: params.jobName,
      tax_rate: company.default_tax_rate ?? 0,
      measurement_system: company.default_measurement_system,
      created_by_user_id: profile.id,
    })
    .select('id')
    .single();

  if (error || !quote) {
    throw new Error(error?.message || 'Failed to create quote');
  }

  return quote.id;
}
