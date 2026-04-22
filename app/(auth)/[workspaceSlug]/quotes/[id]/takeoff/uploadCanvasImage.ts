'use server';

import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';

/**
 * Upload canvas image to storage and return public URL
 * @param quoteId - The quote ID for file organization
 * @param dataUrl - Canvas exported as data URL (base64 PNG)
 * @returns Public URL of uploaded canvas image
 */
export async function uploadCanvasImage(quoteId: string, dataUrl: string, suffix: string = ''): Promise<string> {
  const profile = await requireCompanyContext();
  const supabase = await createSupabaseServerClient();

  console.log('[uploadCanvasImage] Starting upload for quote:', quoteId);

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

  console.log('[uploadCanvasImage] Uploading to:', filePath);

  // Upload to QUOTE-DOCUMENTS bucket
  const { data, error } = await supabase.storage
    .from('QUOTE-DOCUMENTS')
    .upload(filePath, blob, {
      contentType: 'image/png',
      upsert: false,
    });

  if (error) {
    console.error('[uploadCanvasImage] Upload failed:', error);
    throw new Error(`Failed to upload canvas image: ${error.message}`);
  }

  console.log('[uploadCanvasImage] Upload successful:', data.path);

  // Get public URL
  const { data: urlData } = supabase.storage
    .from('QUOTE-DOCUMENTS')
    .getPublicUrl(data.path);

  if (!urlData?.publicUrl) {
    throw new Error('Failed to get public URL for uploaded canvas');
  }

  console.log('[uploadCanvasImage] Public URL:', urlData.publicUrl);
  return urlData.publicUrl;
}
