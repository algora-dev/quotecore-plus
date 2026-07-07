'use server';

import { requireCompanyContext } from '@/app/lib/supabase/server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { BUCKETS } from '@/app/lib/storage/buckets';

type UploadResult = { ok: true; path: string } | { ok: false; error: string };

/**
 * Upload a canvas snapshot to QUOTE-DOCUMENTS and return its STORAGE PATH.
 *
 * Behaviour change (2026-05-10, Gerald audit pass 2):
 *   This used to return a 30-day signed URL that got persisted on the quote
 *   row. After 30 days every saved takeoff snapshot silently broke because
 *   the URL had expired. Render sites now sign on render with a short TTL
 *   (1 hour, matching every other private file in QUOTE-DOCUMENTS), so the
 *   path is the canonical storage reference and signed URLs are derived.
 *
 * Callers persist the returned path into `quotes.takeoff_canvas_path` /
 * `takeoff_lines_path` and call `getSignedUrl()` (or the helper that wraps
 * it) at render time.
 */
export async function uploadCanvasImage(
  quoteId: string,
  dataUrl: string,
  suffix: string = '',
): Promise<UploadResult> {
  const profile = await requireCompanyContext();
  // Gerald audit H-05: storage RLS denies direct authenticated INSERT on
  // QUOTE-DOCUMENTS. This server action already runs under server auth +
  // requireCompanyContext above; bypass storage RLS via the admin client.
  const admin = createAdminClient();

  // Convert data URL to blob
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) {
    return { ok: false, error: 'Invalid canvas data URL' };
  }

  const buffer = Buffer.from(base64Data, 'base64');
  const blob = new Blob([buffer], { type: 'image/png' });

  // Generate unique filename. Path prefix is `${companyId}/${quoteId}/...`
  // which is what the storage RLS policy keys on.
  const timestamp = Date.now();
  const filename = `canvas-${quoteId}${suffix ? '-' + suffix : ''}-${timestamp}.png`;
  const filePath = `${profile.company_id}/${quoteId}/${filename}`;

  const { data, error } = await admin.storage
    .from(BUCKETS.QUOTE_DOCUMENTS)
    .upload(filePath, blob, {
      contentType: 'image/png',
      upsert: false,
    });

  if (error) {
    console.error('[uploadCanvasImage] Upload failed:', error);
    return { ok: false, error: `Failed to upload canvas image: ${error.message}` };
  }

  // Return the storage path. Callers sign on render.
  return { ok: true, path: data.path };
}
