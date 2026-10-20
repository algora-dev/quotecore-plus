import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { customScope } from '../environment';
import { resolveBillingType } from '../../company-type';
import { parseUsageSnapshot, usageError, UsageError, type UsageSnapshot, type RpcClient } from './contracts';
export type { RpcClient } from './contracts';
/** One narrow cast until the integrating agent regenerates Supabase types. */
export function usageClient(): RpcClient { return createAdminClient() as unknown as RpcClient; }
export async function callUsage<T = unknown>(name: string, args: Record<string, unknown>, client: RpcClient = usageClient()): Promise<T> {
  let result: { data: unknown; error: unknown };
  try { result = await client.rpc(name, args); } catch (error) { throw usageError(error); }
  if (result.error) throw usageError(result.error);
  if (result.data === null || result.data === undefined) throw new UsageError('usage_unavailable', 'Usage returned no confirmed result.');
  return result.data as T;
}
export async function loadCustomUsage(companyId: string): Promise<UsageSnapshot> {
  const scope = customScope();
  const data = await callUsage('qcp_usage_snapshot', { p_company_id: companyId, p_account_id: scope.accountId, p_mode: scope.mode });
  const result = parseUsageSnapshot(data);
  if (result.accountId !== scope.accountId || result.mode !== scope.mode) throw new UsageError('usage_scope_mismatch', 'Billing environment could not be verified.');
  return result;
}
/** Resolve billing ownership before deciding which enforcement path to use.
 *  Thin wrapper over the single resolver (app/lib/billing/company-type.ts):
 *  true only for custom_setup companies (metered OR admin-granted). */
export async function isCustomUsageCompany(companyId: string): Promise<boolean> {
  return (await resolveBillingType(companyId)).kind !== 'legacy';
}

/** True only for Stripe-linked custom companies. Admin-granted setups
 *  (no Stripe linkage) have no usage-registry linkage and must not depend
 *  on the custom billing environment, which is held off production until
 *  the Stripe live-switch (2026-10-17): they run unmetered against their
 *  granted allowance until then. Thin wrapper over the single resolver. */
export async function customUsageMeteringApplies(companyId: string): Promise<boolean> {
  return (await resolveBillingType(companyId)).kind === 'custom_metered';
}
