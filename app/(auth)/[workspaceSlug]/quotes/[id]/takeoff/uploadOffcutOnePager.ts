'use server';
// Offcuts Phase 1 (2026-10-07): upload the browser-generated A4 one-pager PDF
// to QUOTE-DOCUMENTS and register it in quote_files (type 'offcuts') so it
// appears in the job's Files & Documents. Mirrors uploadCanvasImage's auth +
// storage pattern: requireCompanyContext, then the admin client for the
// storage write (path prefixed with the owning company id, which the storage
// policy keys on); the metadata row is written through the audited
// saveGeneratedQuoteFileMetadata path.
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { saveGeneratedQuoteFileMetadata } from '@/app/lib/files/storage-actions';

export async function uploadOffcutOnePagerFile(
  quoteId: string,
  dataUrl: string,
  jobLabel: string,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const base64 = dataUrl.split(',')[1];
  if (!dataUrl.startsWith('data:application/pdf') || !base64) {
    return { ok: false, message: 'The one-pager PDF could not be read.' };
  }
  const profile = await requireCompanyContext();
  const buffer = Buffer.from(base64, 'base64');
  const blob = new Blob([buffer], { type: 'application/pdf' });
  const filePath = `${profile.company_id}/${quoteId}/offcut-plan-${quoteId}-${Date.now()}.pdf`;
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKETS.QUOTE_DOCUMENTS)
    .upload(filePath, blob, { contentType: 'application/pdf', upsert: false });
  if (error || !data?.path) {
    console.error('[uploadOffcutOnePagerFile] upload failed:', error);
    return { ok: false, message: 'The one-pager could not be uploaded. Try again; your review is saved.' };
  }
  const safeLabel = (jobLabel || 'Quote').replace(/[^\w\s-]/g, '').trim().slice(0, 60) || 'Quote';
  return saveGeneratedQuoteFileMetadata({
    companyId: profile.company_id,
    fileType: 'offcuts',
    fileName: `Offcut plan — ${safeLabel}.pdf`,
    storagePath: data.path,
    quoteId,
  });
}
