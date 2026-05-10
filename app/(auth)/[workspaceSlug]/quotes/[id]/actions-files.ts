'use server';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { BUCKETS } from '@/app/lib/storage/buckets';
import { revalidatePath } from 'next/cache';

/**
 * Extract the storage object path from a Supabase storage URL.
 * Handles both shapes:
 *   - public:  /storage/v1/object/public/<bucket>/<path>
 *   - signed:  /storage/v1/object/sign/<bucket>/<path>?token=...
 * Returns null if the URL is empty or matches neither pattern.
 */
function storagePathFromPublicUrl(url: string, bucket: string): string | null {
  if (!url) return null;
  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/sign/${bucket}/`,
  ];
  for (const marker of markers) {
    const idx = url.indexOf(marker);
    if (idx === -1) continue;
    const tail = url.substring(idx + marker.length);
    // Strip query/hash if present (signed URLs always carry ?token=...).
    const clean = tail.split('?')[0].split('#')[0];
    if (clean) return decodeURIComponent(clean);
  }
  return null;
}

export async function deleteFile(fileId: string, storagePath: string): Promise<void> {
  const profile = await requireCompanyContext();
  
  const supabaseAdmin = createAdminClient();
  
  // Get file to verify ownership
  const { data: file } = await supabaseAdmin
    .from('quote_files')
    .select('company_id')
    .eq('id', fileId)
    .single();
  
  if (!file || file.company_id !== profile.company_id) {
    throw new Error('Unauthorized');
  }
  
  // Delete from storage
  const { error: storageError } = await supabaseAdmin.storage
    .from(BUCKETS.QUOTE_DOCUMENTS)
    .remove([storagePath]);
  
  if (storageError) {
    console.error('[deleteFile] Storage error:', storageError);
    throw new Error(`Failed to delete file from storage: ${storageError.message}`);
  }
  
  // Delete from database (triggers storage_used_bytes update)
  const { error: dbError } = await supabaseAdmin
    .from('quote_files')
    .delete()
    .eq('id', fileId);
  
  if (dbError) {
    console.error('[deleteFile] Database error:', dbError);
    throw new Error(`Failed to delete file metadata: ${dbError.message}`);
  }
  
  revalidatePath('/quotes');
}

/**
 * Delete a takeoff canvas snapshot stored on the quote row
 * (takeoff_canvas_url or takeoff_lines_url). Clears the column and removes
 * the underlying file from QUOTE-DOCUMENTS storage when its path can be derived.
 */
export async function deleteTakeoffCanvas(
  quoteId: string,
  kind: 'canvas' | 'lines'
): Promise<void> {
  const profile = await requireCompanyContext();
  const supabaseAdmin = createAdminClient();

  // Verify ownership and load the current URL.
  const { data: quote, error: loadError } = await supabaseAdmin
    .from('quotes')
    .select('id, company_id, takeoff_canvas_url, takeoff_lines_url')
    .eq('id', quoteId)
    .single();

  if (loadError || !quote) throw new Error('Quote not found');
  if (quote.company_id !== profile.company_id) throw new Error('Unauthorized');

  const column = kind === 'lines' ? 'takeoff_lines_url' : 'takeoff_canvas_url';
  const currentUrl: string | null = (quote as any)[column];

  // Best-effort storage cleanup. We don't fail the whole op if storage is already gone.
  if (currentUrl) {
    const path = storagePathFromPublicUrl(currentUrl, BUCKETS.QUOTE_DOCUMENTS);
    if (path) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(BUCKETS.QUOTE_DOCUMENTS)
        .remove([path]);
      if (storageError) {
        // Log but proceed — column still gets cleared so the user no longer sees the file.
        console.warn('[deleteTakeoffCanvas] Storage remove warning:', storageError.message);
      }
    } else {
      console.warn('[deleteTakeoffCanvas] Could not derive storage path from URL:', currentUrl);
    }
  }

  const { error: updateError } = await supabaseAdmin
    .from('quotes')
    .update({ [column]: null })
    .eq('id', quoteId);

  if (updateError) {
    console.error('[deleteTakeoffCanvas] Update error:', updateError);
    throw new Error(`Failed to clear takeoff canvas: ${updateError.message}`);
  }

  revalidatePath('/quotes');
}
