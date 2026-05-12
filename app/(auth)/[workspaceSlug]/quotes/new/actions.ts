'use server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { seedQuoteTaxesOnCreate } from '@/app/lib/taxes/seed';
import { BUCKETS } from '@/app/lib/storage/buckets';

interface CreateQuoteParams {
  customerName: string;
  jobName: string | null;
  templateId: string | null;
  /**
   * Entry method for the quote:
   *   - `manual`: traditional quote builder (Areas → Components → Extras → Review).
   *   - `digital`: digital takeoff canvas first, then the builder.
   *   - `blank`: skip the builder entirely; the customer quote editor is the
   *     master/source of line items for this quote.
   * The DB CHECK constraint is the authoritative gate; this type is the
   * client surface.
   */
  entryMode: 'manual' | 'digital' | 'blank';
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

  // Whitelist entry mode the same way — unknown values fall back to manual.
  const safeEntryMode: 'manual' | 'digital' | 'blank' =
    params.entryMode === 'manual' || params.entryMode === 'digital' || params.entryMode === 'blank'
      ? params.entryMode
      : 'manual';

  // Templates only apply to manual / digital quotes. A blank quote starts
  // with zero areas / components by definition; piping a template through it
  // would silently break that promise. The new-quote form already disables
  // the template selector for digital and blank modes, but we belt-and-brace
  // it here on the server.
  if (params.templateId && safeEntryMode !== 'blank') {
    const { createQuoteFromTemplate } = await import('../actions');
    await createQuoteFromTemplate(
      params.templateId,
      params.customerName,
      params.jobName,
      safeEntryMode as 'manual' | 'digital',
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
      entry_mode: safeEntryMode,
    })
    .select('id')
    .single();

  if (error || !quote) {
    throw new Error(error?.message || 'Failed to create quote');
  }

  // Snapshot the company's tax library onto the new quote so totals work
  // immediately on summary/customer/accept pages. Best-effort: a failure
  // here is logged inside the helper and won't block quote creation.
  await seedQuoteTaxesOnCreate(quote.id, profile.company_id);

  return quote.id;
}

export async function uploadRoofPlanFile(quoteId: string, file: File): Promise<void> {
  const { company } = await loadCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Ownership check: the quote must belong to the caller's company before we
  // write into its storage prefix.
  const { data: ownedQuote } = await supabase
    .from('quotes')
    .select('id')
    .eq('id', quoteId)
    .eq('company_id', company.id)
    .maybeSingle();
  if (!ownedQuote) {
    throw new Error('Unauthorized');
  }

  const fileExt = file.name.split('.').pop();
  const fileName = `plan-${Date.now()}.${fileExt}`;
  const storagePath = `${company.id}/${quoteId}/${fileName}`;

  // Upload to Supabase Storage from the server. Bucket is private; the
  // service-role-backed server client handles auth.
  const { error: uploadError } = await supabase.storage
    .from(BUCKETS.QUOTE_DOCUMENTS)
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
