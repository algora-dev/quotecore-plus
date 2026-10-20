import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { StorageQuotaExceededError } from '@/app/lib/billing/errors';
import { customScope } from '../environment';
import { resolveBillingType } from '../../company-type';
import { callUsage, isCustomUsageCompany } from './store';
import { UsageError, safeCount } from './contracts';
export type StorageObject = { companyId: string; bucket: string; path: string };
/** The byte value is server-measured, and the RPC verifies Storage metadata again. */
/** Reservation scope via the single resolver (company-type.ts). Stripe-linked
 *  companies use the deployment env scope. Admin-granted setups have no
 *  deployment env before the custom billing live-switch, so their own
 *  registry row supplies the account/mode the reserve RPC verifies against.
 *  The DB hold contract (qcp_guard_file_metadata trigger, QCP07) applies to
 *  EVERY custom_setup company, so admin grants must still reserve: skipping
 *  the hold broke plan attach with QCP07 on main (2026-10-19 second incident).
 *  Quota stays enforced server-side against the granted snapshot limits either way. */
async function reserveScopeFor(companyId: string): Promise<{ accountId: string; mode: 'test' | 'live' }> {
  const type = await resolveBillingType(companyId);
  if (type.kind === 'custom_metered') {
    const env = customScope();
    return { accountId: env.accountId, mode: env.mode };
  }
  const accountId = type.registry?.stripe_account_id ?? '';
  const rawMode = type.registry?.stripe_mode;
  const mode = rawMode === 'live' ? 'live' : rawMode === 'test' ? 'test' : null;
  if (!/^acct_[A-Za-z0-9]+$/.test(accountId) || !mode) {
    throw new UsageError('custom_access_unavailable', 'This setup has no billing registry for storage reservation.');
  }
  return { accountId, mode };
}

/** The byte value is server-measured, and the RPC verifies Storage metadata again. */
export async function reservePurchasedStorage(input: StorageObject & { size: number; kind: 'logo' | 'document' }): Promise<boolean> {
  if (!(await isCustomUsageCompany(input.companyId))) return false;
  const scope = await reserveScopeFor(input.companyId);
  try {
    const result = await callUsage<{ kind: string }>('qcp_reserve_storage', {
      p_company_id: input.companyId, p_account_id: scope.accountId, p_mode: scope.mode,
      p_bucket: input.bucket, p_path: input.path, p_size: input.size, p_kind: input.kind,
    });
    if (result.kind !== 'custom') throw new UsageError('usage_scope_changed', 'Your billing setup changed. Please retry the upload.');
  } catch (error) {
    if (error instanceof UsageError && error.code === 'storage_quota_exceeded') {
      throw new StorageQuotaExceededError({ usedBytes: safeCount(error.details.usedBytes, 'Storage usage'),
        limitBytes: safeCount(error.details.limitBytes, 'Storage allowance'),
        attemptedBytes: safeCount(error.details.attemptedBytes, 'Upload size') });
    }
    throw error;
  }
  return true;
}
/** Never remove a referenced file on a retry. Claim a tombstone before API delete. */
export async function cleanupUnregisteredCustomObject(input: StorageObject): Promise<boolean> {
  const claimed = await callUsage<boolean>('qcp_claim_storage_cleanup', {
    p_company_id: input.companyId, p_bucket: input.bucket, p_path: input.path });
  if (!claimed) return false;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(input.bucket).remove([input.path]);
  if (error) throw new UsageError('storage_cleanup_pending', 'File cleanup is pending. Its storage remains accounted for.');
  return releaseRemovedCustomObject(input);
}
/** Call after API removal AND metadata deletion. Absence is verified in SQL. */
export async function releaseRemovedCustomObject(input: StorageObject): Promise<boolean> {
  return callUsage<boolean>('qcp_ack_storage_removed', {
    p_company_id: input.companyId, p_bucket: input.bucket, p_path: input.path });
}
