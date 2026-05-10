'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { getSignedUrl } from '@/app/lib/storage/helpers';
import { BUCKETS } from '@/app/lib/storage/buckets';

/**
 * Upload a canvas snapshot to QUOTE-DOCUMENTS and return a long-lived signed URL.
 *
 * Behaviour change (2026-05-10): the QUOTE-DOCUMENTS bucket is now PRIVATE.
 * We previously called `getPublicUrl()` here, which silently broke the moment
 * the bucket was made private. The returned value is now a signed URL with a
 * 30-day expiry, which is long enough to survive a normal quote review window
 * while still expiring stale links eventually.
 *
 * The storage object path is encoded in the signed URL and can be extracted
 * by the existing `storagePathFromPublicUrl()` style helper in
 * `app/(auth)/[workspaceSlug]/quotes/[id]/actions-files.ts`, which has been
 * updated to also recognise the `/storage/v1/object/sign/<bucket>/<path>` shape.
 *
 * Pages that render the canvas should ideally re-sign on each render to keep
 * URLs short-lived; that is a follow-up.
 */
export async function uploadCanvasImage(quoteId: string, dataUrl: string, suffix: string = ''): Promise<string> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  // Convert data URL to blob
  const base64Data = dataUrl.split(',')[1];
  if (!base64Data) {
    throw new Error('Invalid canvas data URL');
  }

  const buffer = Buffer.from(base64Data, 'base64');
  const blob = new Blob([buffer], { type: 'image/png' });

  // Generate unique filename
  const timestamp = Date.now();
  const filename = `canvas-${quoteId}${suffix ? '-' + suffix : ''}-${timestamp}.png`;
  const filePath = `${profile.company_id}/${quoteId}/${filename}`;

  // Upload to QUOTE-DOCUMENTS bucket (private).
  const { data, error } = await supabase.storage
    .from(BUCKETS.QUOTE_DOCUMENTS)
    .upload(filePath, blob, {
      contentType: 'image/png',
      upsert: false,
    });

  if (error) {
    console.error('[uploadCanvasImage] Upload failed:', error);
    throw new Error(`Failed to upload canvas image: ${error.message}`);
  }

  // 30-day signed URL — long enough to survive a quote review cycle, short
  // enough that a leaked URL eventually expires. 60 * 60 * 24 * 30 seconds.
  const signedUrl = await getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, data.path, 60 * 60 * 24 * 30);
  return signedUrl;
}
