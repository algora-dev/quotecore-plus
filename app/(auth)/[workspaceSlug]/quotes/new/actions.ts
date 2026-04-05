'use server';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';

interface CreateQuoteParams {
  customerName: string;
  jobName: string | null;
  templateId: string | null;
  entryMode: 'manual' | 'digital';
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
      entry_mode: params.entryMode,
    })
    .select('id')
    .single();

  if (error || !quote) {
    throw new Error(error?.message || 'Failed to create quote');
  }

  return quote.id;
}

export async function uploadRoofPlanFile(quoteId: string, file: File): Promise<void> {
  const { company } = await loadCompanyContext();
  const { createClient } = await import('@/app/lib/supabase/client');
  const supabase = createClient();

  const fileExt = file.name.split('.').pop();
  const fileName = `plan-${Date.now()}.${fileExt}`;
  const storagePath = `${company.id}/${quoteId}/${fileName}`;

  // Upload to Supabase Storage (client-side)
  const { error: uploadError } = await supabase.storage
    .from('QUOTE-DOCUMENTS')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload roof plan: ${uploadError.message}`);
  }

  // Save file metadata via server action
  const serverSupabase = await createSupabaseServerClient();
  await serverSupabase.from('quote_files').insert({
    quote_id: quoteId,
    file_name: file.name,
    file_type: 'plan',
    file_size: file.size,
    storage_path: storagePath,
  });
}
