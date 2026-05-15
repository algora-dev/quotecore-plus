'use server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { loadCompanyContext } from '@/app/lib/data/company-context';
import { seedQuoteTaxesOnCreate } from '@/app/lib/taxes/seed';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { createQuoteAtomic } from '@/app/lib/billing/quote-creation';

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

  // Otherwise, create a fresh quote via the atomic RPC. The RPC handles
  // the monthly-quote-limit check + counter increment + insert in one
  // transaction under a per-company advisory lock (Gerald audit H-02).
  // Any monthly-limit / subscription-inactive error bubbles up here and
  // is caught by the server-action outer handler at the form layer.
  const quoteId = await createQuoteAtomic(profile.company_id, profile.id, {
    customerName: params.customerName,
    jobName: params.jobName,
    taxRate: company.default_tax_rate ?? 0,
    measurementSystem: safeMeasurementSystem,
    entryMode: safeEntryMode,
  });

  // Snapshot the company's tax library onto the new quote so totals work
  // immediately on summary/customer/accept pages. Best-effort: a failure
  // here is logged inside the helper and won't block quote creation.
  await seedQuoteTaxesOnCreate(quoteId, profile.company_id);

  return quoteId;
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
    companyId: company.id,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type || 'application/octet-stream',
    storagePath,
  });
}

async function saveRoofPlanMetadata(
  quoteId: string,
  metadata: {
    companyId: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    storagePath: string;
  }
): Promise<void> {
  const supabase = await createSupabaseServerClient();

  // company_id and mime_type are NOT NULL on quote_files; previous
  // versions of this insert were silently failing with a constraint
  // violation (typed Supabase pass on 2026-05-12 caught it).
  const { error } = await supabase.from('quote_files').insert({
    company_id: metadata.companyId,
    quote_id: quoteId,
    file_name: metadata.fileName,
    file_type: 'plan',
    file_size: metadata.fileSize,
    mime_type: metadata.mimeType,
    storage_path: metadata.storagePath,
  });

  if (error) {
    throw new Error(`Failed to save file metadata: ${error.message}`);
  }
}
