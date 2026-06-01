'use server';

/**
 * Signed-upload-URL minting for QUOTE-DOCUMENTS.
 *
 * Gerald audit H-05 closure: the previous flow let any authenticated user
 * upload directly to `QUOTE-DOCUMENTS/{companyId}/...` via Supabase Storage
 * RLS. Quota enforcement only happened AFTER the bytes had landed (via the
 * upload finaliser). That's fine for honest paths but is a cost/abuse
 * vector: a malicious user could blast objects with no metadata insert,
 * eating storage cost until the daily orphan sweep cleared them.
 *
 * The fix:
 *   1. Storage RLS revokes INSERT on QUOTE-DOCUMENTS from authenticated.
 *      Only the signed-upload-URL path works for direct user uploads.
 *   2. This module is the ONLY place that mints those URLs. It runs a
 *      pre-flight quota check against the user's effective storage limit
 *      BEFORE handing out the URL.
 *   3. The post-upload finaliser remains in place as a belt-and-braces
 *      check (browser-supplied claimedSize is not authoritative).
 *
 * Phase-1 scope: QUOTE-DOCUMENTS only. company-logos (public bucket) is
 * deferred to phase 2 along with the rest of the company-logos quota.
 */

import { randomUUID } from 'node:crypto';

import { createAdminClient } from '@/app/lib/supabase/admin';
import { requireCompanyContext } from '@/app/lib/supabase/server';
import { assertCanUseStorage } from '@/app/lib/billing/entitlements';
import { isBillingError } from '@/app/lib/billing/errors';
import { BUCKETS } from '@/app/lib/storage/buckets';
import type { MintUploadInput, MintUploadResult } from './signed-upload-types';

/**
 * Hard cap on a single file's bytes regardless of remaining quota. Browser
 * cancellation lag + non-trivial chunked uploads mean a "5GB roof plan
 * upload" is never legit; this prevents a single object from blowing the
 * quota check window. Tune later if real plans push the limit.
 */
const MAX_SINGLE_FILE_BYTES = 50 * 1024 * 1024; // 50 MB

/** Allowed MIME prefixes for QUOTE-DOCUMENTS. Mirrors UI accept attrs. */
const ALLOWED_MIME_PREFIXES = ['image/', 'application/pdf', 'application/zip'];

function safeExt(filename: string): string {
  const dot = filename.lastIndexOf('.');
  if (dot < 0 || dot === filename.length - 1) return '';
  const ext = filename.slice(dot + 1).toLowerCase();
  // Keep alnum only \u2014 protects against `..%2F` shenanigans.
  return /^[a-z0-9]{1,8}$/.test(ext) ? `.${ext}` : '';
}

/**
 * Mint a signed-upload-URL for the caller's company. Server-side gates:
 *   1. Auth + company context.
 *   2. MIME + size sanity.
 *   3. assertCanUseStorage against effective plan + topup + current usage.
 *   4. Build a path inside the caller's company folder. The signed URL
 *      Supabase mints is bound to that exact path.
 */
export async function mintQuoteDocumentUploadUrl(
  input: MintUploadInput,
): Promise<MintUploadResult> {
  // 1) Auth + company context
  let profile;
  try {
    profile = await requireCompanyContext();
  } catch {
    return { ok: false, code: 'unauthenticated', message: 'Please sign in to upload files.' };
  }
  const companyId = profile.company_id;

  // 2) Input validation
  if (!input.filename || typeof input.filename !== 'string') {
    return { ok: false, code: 'invalid_input', message: 'Filename is required.' };
  }
  if (!input.contentType || typeof input.contentType !== 'string') {
    return { ok: false, code: 'invalid_input', message: 'Content type is required.' };
  }
  if (typeof input.claimedSize !== 'number' || !Number.isFinite(input.claimedSize) || input.claimedSize < 0) {
    return { ok: false, code: 'invalid_input', message: 'Invalid file size.' };
  }
  if (input.claimedSize > MAX_SINGLE_FILE_BYTES) {
    return {
      ok: false,
      code: 'too_large',
      message: `Files larger than ${Math.round(MAX_SINGLE_FILE_BYTES / 1024 / 1024)}MB are not supported.`,
    };
  }
  if (!ALLOWED_MIME_PREFIXES.some((p) => input.contentType.startsWith(p))) {
    return {
      ok: false,
      code: 'unsupported_type',
      message: 'File type not supported. Use PDF, image, or ZIP.',
    };
  }

  if (input.scope.kind === 'quote') {
    if (
      typeof input.scope.quoteId !== 'string' ||
      !/^[0-9a-f-]{36}$/.test(input.scope.quoteId)
    ) {
      return { ok: false, code: 'invalid_input', message: 'Invalid quote id.' };
    }
  }

  // 3) Pre-flight quota + subscription-active check
  try {
    await assertCanUseStorage(companyId, input.claimedSize);
  } catch (err) {
    if (isBillingError(err)) {
      if (err.code === 'storage_quota_exceeded') {
        return { ok: false, code: 'storage_quota_exceeded', message: err.message };
      }
      if (err.code === 'subscription_inactive') {
        return { ok: false, code: 'subscription_inactive', message: err.message };
      }
    }
    const msg = err instanceof Error ? err.message : 'quota_check_failed';
    return { ok: false, code: 'mint_failed', message: msg };
  }

  // 4) Build the path under the caller's company folder. We always own
  // the storage prefix here; the client cannot inject one.
  const ext = safeExt(input.filename);
  const objectName = `${randomUUID()}${ext}`;
  const folder =
    input.scope.kind === 'pending'
      ? `${companyId}/_pending`
      : input.scope.kind === 'library'
        ? `${companyId}/library`
        : `${companyId}/${input.scope.quoteId}`;
  const storagePath = `${folder}/${objectName}`;

  // 5) Mint via service-role admin client. The Supabase Storage signed
  // upload URL is bound to (bucket, exact path). Token TTL defaults to
  // 2 hours (Supabase native).
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(BUCKETS.QUOTE_DOCUMENTS)
    .createSignedUploadUrl(storagePath);

  if (error || !data?.signedUrl || !data?.token) {
    console.error('[signed-upload] mint failed:', error);
    return {
      ok: false,
      code: 'mint_failed',
      message: error?.message ?? 'Could not mint upload URL.',
    };
  }

  return {
    ok: true,
    bucket: BUCKETS.QUOTE_DOCUMENTS,
    storagePath: data.path ?? storagePath,
    signedUrl: data.signedUrl,
    token: data.token,
  };
}
