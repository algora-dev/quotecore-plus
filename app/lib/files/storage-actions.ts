'use server';

/**
 * File-storage server actions.
 *
 * These are NOT settings — they are uploaded-file lifecycle helpers used by
 * the quote builder, supporting-files manager, plan uploader, and the summary
 * files panel. Historically they lived inside `app/(auth)/[slug]/account/actions.ts`
 * because the only "settings" page that uploaded a file (the company logo)
 * lived there. As the app grew, several non-settings code paths started
 * importing them from that location, which made the settings tree look like
 * the canonical home for file IO. It isn't. This module is the new home.
 *
 * Why a separate module:
 *   - `app/lib/` is reserved for cross-cutting domain helpers (no UI, no routes).
 *   - Storage operations are independent of any individual page; couple them
 *     to the route that happens to use them today and we'll be repeating this
 *     migration in six months.
 *   - Keeps the upcoming `/account` settings refactor surgical: only settings-
 *     specific actions move, file IO is already out of the blast radius.
 *
 * Public surface kept identical to the old call sites: `checkStorageQuota`
 * and `saveFileMetadata` have the SAME signatures and behaviour. The only
 * thing that changes for callers is the import path.
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { getSignedUrl } from '@/app/lib/storage/helpers';
import { BUCKETS } from '@/app/lib/storage/buckets';

/**
 * Returns true if a new upload of `fileSize` bytes will fit under the company's
 * storage quota; false if it would exceed it.
 *
 * The caller is responsible for surfacing a friendly error if this returns
 * false. We intentionally don't throw on an over-quota result because callers
 * often want to render an inline message rather than crash a multi-step form.
 */
export async function checkStorageQuota(companyId: string, fileSize: number): Promise<boolean> {
  const profile = await requireCompanyContext();

  if (profile.company_id !== companyId) {
    throw new Error('Unauthorized');
  }

  const supabase = await createSupabaseServerClient();

  const { data: company } = await supabase
    .from('companies')
    .select('storage_used_bytes, storage_limit_bytes')
    .eq('id', companyId)
    .single();

  if (!company) {
    throw new Error('Company not found');
  }

  return company.storage_used_bytes + fileSize <= company.storage_limit_bytes;
}

/**
 * Records a freshly-uploaded object in `quote_files`. The object itself must
 * already be in storage (Supabase Storage upload is done client-side via
 * signed URLs). This call writes the metadata row that the rest of the app
 * reads when listing or rendering files.
 *
 * Uses the admin client to bypass RLS so the upsert succeeds even when the
 * user's row-level role can't write to `quote_files` directly. Authorization
 * is enforced at the application layer instead: the caller's `companyId`
 * must match their authenticated `profile.company_id`.
 *
 * Idempotent on `storage_path` (PK conflict) so retrying after a transient
 * failure produces no duplicates.
 */
export async function saveFileMetadata(data: {
  companyId: string;
  fileType: 'logo' | 'plan' | 'supporting';
  fileName: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  quoteId?: string;
}): Promise<void> {
  const profile = await requireCompanyContext();

  if (profile.company_id !== data.companyId) {
    throw new Error('Unauthorized');
  }

  // Use admin client to bypass RLS — application-level authorization above
  // is the source of truth for this surface.
  const { createAdminClient } = await import('@/app/lib/supabase/admin');
  const supabaseAdmin = createAdminClient();

  const { error } = await supabaseAdmin
    .from('quote_files')
    .upsert(
      {
        company_id: data.companyId,
        quote_id: data.quoteId || null,
        file_type: data.fileType,
        file_name: data.fileName,
        file_size: data.fileSize,
        mime_type: data.mimeType,
        storage_path: data.storagePath,
        uploaded_by: profile.id,
      },
      { onConflict: 'storage_path' }
    );

  if (error) {
    console.error('[saveFileMetadata] Database error:', error);
    throw new Error(error.message);
  }

  // Bust the previously-named "/account" cache key for now. Once the new
  // /account settings refactor lands, the file pages will revalidate
  // explicitly via their own paths instead of relying on this stale key.
  revalidatePath('/account');
}

/**
 * Mint a signed URL for a quote file the caller already owns.
 *
 * Used by client components after they upload directly to private storage,
 * to obtain a viewable URL without exposing the service-role key. We verify
 * the storage path is prefixed with the caller's company id, which is how
 * every quote-file path is structured (`{companyId}/{quoteId}/...`).
 *
 * Default expiry is 1 hour, matching the read paths on server-rendered pages.
 */
export async function getQuoteFileSignedUrl(
  storagePath: string,
  expiresIn: number = 3600,
): Promise<string> {
  const profile = await requireCompanyContext();
  if (!storagePath.startsWith(`${profile.company_id}/`)) {
    throw new Error('Unauthorized');
  }
  return getSignedUrl(BUCKETS.QUOTE_DOCUMENTS, storagePath, expiresIn);
}
