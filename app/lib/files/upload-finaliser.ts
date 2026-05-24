/**
 * Upload finaliser.
 *
 * The Single Path for "an object has just been uploaded to storage; commit
 * its bytes to the company's quota or roll back".
 *
 * ----------------------------------------------------------------------------
 * Why this exists
 * ----------------------------------------------------------------------------
 * Gerald audit H-03: storage uploads bypass the quota gate. There are three
 * code paths that write to the QUOTE-DOCUMENTS bucket without ever calling
 * `checkStorageQuota`:
 *   1. POST /quotes/new/upload-plan/route.ts
 *   2. uploadRoofPlanFile() in /quotes/new/actions.ts
 *   3. SummaryFilesPanel.tsx -> saveFileMetadata (browser-direct uploads)
 * The fourth path (createFlashing in flashings/actions.ts) writes to the
 * PUBLIC company-logos bucket and is deferred to phase 2 (different bucket,
 * different quota concept).
 *
 * Even if each callsite added a pre-upload `checkStorageQuota(claimedSize)`
 * call, the browser controls `claimedSize`. Server-side post-upload re-read
 * is the only honest gate.
 *
 * ----------------------------------------------------------------------------
 * Contract
 * ----------------------------------------------------------------------------
 *   finaliseUpload({
 *     companyId,
 *     bucket: 'QUOTE-DOCUMENTS',          // phase 1 only supports this bucket
 *     storagePath: '<companyId>/<quoteId>/plan-...pdf',
 *     adminClient?: SupabaseClient,
 *   })
 *
 *   1. Look up the object in storage via `list({ search })`. Read the real
 *      `metadata.size` and `metadata.mimetype`.
 *   2. Call `assertCanUseStorage(companyId, realSize)`. This throws
 *      `StorageQuotaExceededError` if the upload pushes the company over
 *      its effective limit (plan + topup).
 *   3. On overage, delete the just-uploaded object from storage, then
 *      re-throw the StorageQuotaExceededError so the caller can return a
 *      typed error to the client.
 *   4. On success, return { size, mime } so the caller can insert the
 *      metadata row using the SERVER-MEASURED values (not browser claims).
 *
 * The `companies.storage_used_bytes` counter is maintained by a DB trigger
 * on `quote_files` (existing infra). The finaliser does NOT increment it
 * directly; the trigger fires when the caller inserts the row using the
 * returned size.
 *
 * ----------------------------------------------------------------------------
 * Why not enforce via RLS alone
 * ----------------------------------------------------------------------------
 * RLS gates on `quote_files` could refuse the metadata insert if the
 * storage trigger had pushed `storage_used_bytes` over the limit. But:
 *   - the object has already landed in storage and been billed against the
 *     Supabase storage SKU,
 *   - it leaves an orphan object behind (no metadata row, but bytes used),
 *   - it surfaces as raw `42501` to the user.
 * Inline check + delete on overage is cleaner: no orphans, typed error,
 * predictable UX.
 *
 * The `/api/cron/sweep-orphan-objects` cron (added with this commit) is the
 * belt-and-braces sweep for any leak that does occur (e.g. process crash
 * between upload and finaliser).
 */

import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { assertCanUseStorage } from '@/app/lib/billing/entitlements';
import { BUCKETS } from '@/app/lib/storage/buckets';
import type { Database } from '@/app/lib/supabase/database.types';

/**
 * Result of a successful finalisation. The caller uses these values when
 * inserting the metadata row instead of trusting browser-supplied size/mime.
 */
export interface FinalisedUpload {
  /** Server-measured byte count from storage.objects.metadata.size. */
  size: number;
  /** Server-measured MIME from storage.objects.metadata.mimetype. */
  mime: string;
}

/**
 * Input shape. `bucket` is restricted to BUCKETS.QUOTE_DOCUMENTS for phase 1.
 * If we ever finalise into company-logos we'll widen this, but each bucket
 * has its own privacy + quota story so widening should be deliberate.
 */
export interface FinaliseUploadInput {
  companyId: string;
  /**
   * The bucket the object was uploaded into. Phase 1 always
   * BUCKETS.QUOTE_DOCUMENTS; passing anything else throws.
   */
  bucket: typeof BUCKETS.QUOTE_DOCUMENTS;
  /**
   * Full storage path, MUST be prefixed with `${companyId}/`. The finaliser
   * verifies this - it stops a malicious caller from finalising into
   * another company's folder.
   */
  storagePath: string;
  /**
   * Optional pre-created admin client. The finaliser will create one if
   * not supplied. Useful for tests that want to inject a mock.
   */
  adminClient?: SupabaseClient<Database>;
}

/**
 * Finalise a just-uploaded object: verify size, charge quota, delete on
 * overage. Returns the server-measured size + mime on success.
 *
 * Throws:
 *   - `StorageQuotaExceededError` (from `assertCanUseStorage`) if the upload
 *     would push the company over its effective limit. The just-uploaded
 *     object is deleted before the throw, so the caller doesn't need to
 *     clean up.
 *   - `SubscriptionInactiveError` if the company is suspended/canceled.
 *   - `Error` for bad input (wrong bucket, prefix mismatch, missing object,
 *     storage list failure). These are programming errors or actual storage
 *     failures, not gated-by-billing outcomes.
 */
export async function finaliseUpload(
  input: FinaliseUploadInput,
): Promise<FinalisedUpload> {
  // ---- Input validation ----
  if (input.bucket !== BUCKETS.QUOTE_DOCUMENTS) {
    throw new Error(
      `finaliseUpload: unsupported bucket "${input.bucket}". Phase 1 supports only QUOTE-DOCUMENTS.`,
    );
  }
  if (!input.companyId) {
    throw new Error('finaliseUpload: companyId is required');
  }
  if (!input.storagePath) {
    throw new Error('finaliseUpload: storagePath is required');
  }
  if (!input.storagePath.startsWith(`${input.companyId}/`)) {
    throw new Error(
      'finaliseUpload: storagePath must be prefixed with the companyId. ' +
        'Refusing to finalise an object outside the caller\'s storage prefix.',
    );
  }
  if (input.storagePath.includes('..') || input.storagePath.includes('//')) {
    throw new Error('finaliseUpload: storagePath contains illegal traversal segments.');
  }

  const admin: SupabaseClient<Database> = input.adminClient ?? createAdminClient();

  // ---- 1. Re-read the object's real size + mime from storage ----
  const lastSlash = input.storagePath.lastIndexOf('/');
  const prefix = lastSlash >= 0 ? input.storagePath.slice(0, lastSlash) : '';
  const objectName = lastSlash >= 0 ? input.storagePath.slice(lastSlash + 1) : input.storagePath;

  const { data: listed, error: listErr } = await admin.storage
    .from(input.bucket)
    .list(prefix, { search: objectName, limit: 1 });

  if (listErr) {
    console.error('[upload-finaliser] storage list failed:', listErr);
    throw new Error(`finaliseUpload: failed to read object metadata: ${listErr.message}`);
  }
  const obj = listed?.find((o) => o.name === objectName);
  if (!obj) {
    throw new Error('finaliseUpload: uploaded object not found in storage');
  }

  const metadata = (obj.metadata ?? {}) as { size?: number; mimetype?: string };
  const realSize = metadata.size;
  const realMime = metadata.mimetype ?? 'application/octet-stream';

  if (typeof realSize !== 'number' || !Number.isFinite(realSize) || realSize < 0) {
    // Storage object exists but has no readable size - refuse to commit.
    // Delete the orphan so it doesn't sit there indefinitely.
    await admin.storage.from(input.bucket).remove([input.storagePath]).catch(() => {});
    throw new Error('finaliseUpload: storage object has no readable size');
  }

  // ---- 2. Assert quota ----
  try {
    await assertCanUseStorage(input.companyId, realSize);
  } catch (quotaErr) {
    // ---- 3. Overage path: delete the upload, re-throw the typed error ----
    const { error: rmErr } = await admin.storage.from(input.bucket).remove([input.storagePath]);
    if (rmErr) {
      // We logged it but can't recover; the orphan sweep will catch it.
      // We do NOT swallow the original billing error - the user must see it.
      console.error(
        '[upload-finaliser] failed to remove over-quota object; orphan sweep will reclaim:',
        rmErr.message,
      );
    }
    throw quotaErr;
  }

  // ---- 4. Success ----
  return { size: realSize, mime: realMime };
}
