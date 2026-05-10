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
 *
 * Trust model (hardened 2026-05-10 in response to Gerald audit pass 2):
 *   - The browser supplies file metadata, but the server treats every supplied
 *     value as untrusted input. Storage path prefix, optional quote id, and
 *     actual object size + mime are all re-verified server-side before the
 *     `quote_files` row is written.
 *   - The admin client is used ONLY for `logo` uploads, which legitimately
 *     need to bypass the company-scoped RLS check at the moment a brand-new
 *     company is being onboarded. Plan + supporting uploads go through the
 *     RLS-bound user client, so a missing or wrong company_id on the row
 *     would be rejected by the database, not just the application layer.
 */

import { revalidatePath } from 'next/cache';
import { createSupabaseServerClient, requireCompanyContext } from '@/app/lib/supabase/server';
import { verifyQuoteOwnership } from '@/app/lib/auth/ownership';
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
  if (!Number.isFinite(fileSize) || fileSize < 0) {
    throw new Error('Invalid file size');
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
 * Records a freshly-uploaded object in `quote_files`. The object must already
 * exist in storage; this call writes the metadata row that the rest of the
 * app reads when listing or rendering files.
 *
 * The browser tells us the path, name, and (claimed) size and mime; we ignore
 * the claimed size and mime, look the object up in Supabase Storage, and use
 * the values the storage system reports. That defeats clients trying to:
 *   - inflate or deflate `companies.storage_used_bytes` (the storage trigger
 *     adds whatever value lands in `quote_files.file_size`),
 *   - register a metadata row pointing at a path they don't own,
 *   - attach a file to a quote owned by a different company.
 *
 * For `plan` and `supporting` uploads we use the RLS-bound user client so
 * the database itself rejects mismatched company ids. Logos still need the
 * admin client during onboarding, but their path prefix is also validated.
 *
 * Idempotent on `storage_path` (PK conflict) so retrying after a transient
 * failure produces no duplicates.
 */
export async function saveFileMetadata(data: {
  companyId: string;
  fileType: 'logo' | 'plan' | 'supporting';
  fileName: string;
  /** Ignored. Kept in signature for back-compat; real size is read from Storage. */
  fileSize?: number;
  /** Ignored. Kept in signature for back-compat; real mime is read from Storage. */
  mimeType?: string;
  storagePath: string;
  quoteId?: string;
}): Promise<void> {
  const profile = await requireCompanyContext();

  // 1. Caller's claimed company id must match their authenticated company.
  if (profile.company_id !== data.companyId) {
    throw new Error('Unauthorized');
  }

  // 2. Storage path must be prefixed with the caller's company id. Every path
  //    we generate looks like `${companyId}/...`; anything else is bogus.
  if (!data.storagePath || !data.storagePath.startsWith(`${profile.company_id}/`)) {
    throw new Error('Invalid storage path');
  }

  // 3. Storage path must NOT contain any traversal segments. Belt-and-braces
  //    after the prefix check.
  if (data.storagePath.includes('..') || data.storagePath.includes('//')) {
    throw new Error('Invalid storage path');
  }

  const supabase = await createSupabaseServerClient();

  // 4. If this metadata row is being attached to a quote, that quote must
  //    belong to the caller's company.
  if (data.quoteId) {
    await verifyQuoteOwnership(supabase, data.quoteId, profile.company_id);
  }

  // 5. Pick the bucket from the file type. Logos go in the public logos
  //    bucket; everything else goes in the private quote-documents bucket.
  const bucket =
    data.fileType === 'logo' ? BUCKETS.COMPANY_LOGOS : BUCKETS.QUOTE_DOCUMENTS;

  // 6. Read actual object metadata from Storage. This is the source of truth
  //    for size and mime — the browser doesn't get to lie about either.
  //    `list()` with the parent prefix and a `search` filter is the documented
  //    way to look up a single object's metadata.
  const lastSlash = data.storagePath.lastIndexOf('/');
  const prefix = lastSlash >= 0 ? data.storagePath.slice(0, lastSlash) : '';
  const objectName = lastSlash >= 0 ? data.storagePath.slice(lastSlash + 1) : data.storagePath;

  // The user's RLS-bound client can `list()` paths under their own company id
  // because the storage policies allow it. Falling back to the admin client
  // here would defeat the whole point.
  const { data: listResult, error: listErr } = await supabase.storage
    .from(bucket)
    .list(prefix, { search: objectName, limit: 1 });

  if (listErr) {
    console.error('[saveFileMetadata] storage list failed:', listErr);
    throw new Error('Failed to verify uploaded file');
  }

  const obj = listResult?.find((o) => o.name === objectName);
  if (!obj) {
    throw new Error('Uploaded file not found in storage');
  }

  const realSize = (obj.metadata as { size?: number } | null)?.size;
  const realMime = (obj.metadata as { mimetype?: string } | null)?.mimetype;
  if (typeof realSize !== 'number' || !Number.isFinite(realSize) || realSize < 0) {
    throw new Error('Storage object has no readable size');
  }

  const row = {
    company_id: data.companyId,
    quote_id: data.quoteId || null,
    file_type: data.fileType,
    file_name: data.fileName,
    file_size: realSize,
    mime_type: realMime || 'application/octet-stream',
    storage_path: data.storagePath,
    uploaded_by: profile.id,
  };

  // 7. Logos use the admin client because the very first logo upload during
  //    onboarding can race the company_id propagation. Plan/supporting uploads
  //    go through the user client so RLS double-checks the company match.
  if (data.fileType === 'logo') {
    const { createAdminClient } = await import('@/app/lib/supabase/admin');
    const supabaseAdmin = createAdminClient();
    const { error } = await supabaseAdmin
      .from('quote_files')
      .upsert(row, { onConflict: 'storage_path' });
    if (error) {
      console.error('[saveFileMetadata] logo upsert failed:', error);
      throw new Error(error.message);
    }
  } else {
    const { error } = await supabase
      .from('quote_files')
      .upsert(row, { onConflict: 'storage_path' });
    if (error) {
      console.error('[saveFileMetadata] upsert failed:', error);
      throw new Error(error.message);
    }
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
