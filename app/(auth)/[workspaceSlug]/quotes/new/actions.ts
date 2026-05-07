'use server';
import { requireCompanyContext, createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';

interface CreateQuoteParams {
  customerName: string;
  jobName: string | null;
  templateId: string | null;
  entryMode: 'manual' | 'digital';
  /**
   * The measurement system locked into this quote at creation. Required —
   * the new-quote form forces the user to confirm the choice if it differs
   * from their company default. After this insert it can never be changed.
   */
  measurementSystem: 'metric' | 'imperial_ft' | 'imperial_rs';
}

export async function createQuoteWithDetails(params: CreateQuoteParams): Promise<string | void> {
  const { profile, company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Whitelist defensively — client could send anything.
  const safeMeasurementSystem =
    params.measurementSystem === 'metric' ||
    params.measurementSystem === 'imperial_ft' ||
    params.measurementSystem === 'imperial_rs'
      ? params.measurementSystem
      : 'metric';

  // If template specified, use existing createQuoteFromTemplate
  if (params.templateId) {
    const { createQuoteFromTemplate } = await import('../actions');
    await createQuoteFromTemplate(
      params.templateId,
      params.customerName,
      params.jobName,
      params.entryMode,
      safeMeasurementSystem
    );
    return; // redirect() is called inside createQuoteFromTemplate
  }

  // Otherwise, create blank quote
  const { data: quote, error } = await supabase
    .from('quotes')
    .insert({
      company_id: profile.company_id,
      customer_name: params.customerName,
      job_name: params.jobName,
      tax_rate: company.default_tax_rate ?? 0,
      measurement_system: safeMeasurementSystem,
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

  // Upload to Supabase Storage (client-side, public bucket)
  const { error: uploadError } = await supabase.storage
    .from('QUOTE-DOCUMENTS')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Failed to upload roof plan: ${uploadError.message}`);
  }

  // Save metadata via server action (bypasses RLS)
  await saveRoofPlanMetadata(quoteId, {
    fileName: file.name,
    fileSize: file.size,
    storagePath,
  });
}

async function saveRoofPlanMetadata(
  quoteId: string,
  metadata: { fileName: string; fileSize: number; storagePath: string }
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  
  const { error } = await supabase.from('quote_files').insert({
    quote_id: quoteId,
    file_name: metadata.fileName,
    file_type: 'plan',
    file_size: metadata.fileSize,
    storage_path: metadata.storagePath,
  });

  if (error) {
    throw new Error(`Failed to save file metadata: ${error.message}`);
  }
}
