/**
 * Server-side upload finalization.
 *
 * Legacy accounts keep the existing measured-size check and cleanup path.
 * Custom setups reserve server-verified bytes atomically, then quote_files
 * triggers transfer the hold into the existing storage counter. Concurrent
 * finalizers cannot each assume the same unused capacity is still available.
 *
 * This is a post-upload gate, not a complete pre-upload physical cost limit.
 * The host must audit bucket policies, immutable object paths, signed upload
 * admission and all non-document paths before enabling public custom checkout.
 * Failed cleanup stays accounted for until Storage API deletion is confirmed.
 */

import 'server-only';
import { reservePurchasedStorage, cleanupUnregisteredCustomObject } from '@/app/lib/billing/custom/usage/storage';
import { isCustomUsageCompany } from '@/app/lib/billing/custom/usage/store';

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
    if (!(await isCustomUsageCompany(input.companyId))) {
      await admin.storage.from(input.bucket).remove([input.storagePath]).catch(() => {});
    }
    throw new Error('finaliseUpload: storage object has no readable size');
  }

  // Custom: reserve under the company lock. The quote_files trigger commits
  // the hold atomically with its existing storage counter update.
  const custom = await isCustomUsageCompany(input.companyId);
  if (custom) {
    try {
      await reservePurchasedStorage({ companyId: input.companyId, bucket: input.bucket,
        path: input.storagePath, size: realSize, kind: 'document' });
    } catch (error) {
      // The cleanup claim refuses to remove anything already registered.
      await cleanupUnregisteredCustomObject({ companyId: input.companyId,
        bucket: input.bucket, path: input.storagePath }).catch((cleanupError) => {
          console.error('[upload-finaliser] custom cleanup pending:', cleanupError instanceof Error ? cleanupError.message : 'unavailable');
        });
      throw error;
    }
    return { size: realSize, mime: realMime };
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
