import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
import { customScope } from '../environment';
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
/** Resolve billing ownership before deciding which enforcement path to use. */
export async function isCustomUsageCompany(companyId: string): Promise<boolean> {
  const admin = createAdminClient();
  // Supabase type regeneration is part of host integration.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).from('companies').select('billing_model').eq('id', companyId).maybeSingle();
  if (error || !data) throw new UsageError('usage_unavailable', 'Billing ownership could not be verified.');
  const model = (data as unknown as { billing_model: unknown }).billing_model;
  if (model !== 'legacy' && model !== 'custom_setup') throw new UsageError('usage_unavailable', 'Billing ownership is not recognised.');
  return model === 'custom_setup';
}

/** True only for Stripe-linked custom companies. Admin-granted setups
 *  (stripe_customer_id = 'admin-granted') have no usage-registry linkage
 *  and must not depend on the custom billing environment, which is held
 *  off production until the Stripe live-switch (2026-10-17): they run
 *  unmetered against their granted allowance until then. */
export async function customUsageMeteringApplies(companyId: string): Promise<boolean> {
  if (!(await isCustomUsageCompany(companyId))) return false;
  const admin = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: snap } = await (admin as any).from('company_custom_billing').select('stripe_customer_id').eq('company_id', companyId).maybeSingle();
  return (snap as { stripe_customer_id?: string | null } | null)?.stripe_customer_id !== 'admin-granted';
}
