import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { isDemoCompany } from '@/app/lib/demo/context';

/**
 * Whether the workspace may use customer-facing Smart Assistant configuration
 * such as library/component call names. The rollout flag remains the exposure
 * gate; custom billing additionally requires the purchased Assistant tool.
 */
export async function smartAssistantFeatureAvailable(
  client: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  const { data: exposed, error } = await client.rpc('smart_assistant_enabled', {
    p_company_id: companyId,
  });
  if (error || !exposed) return false;
  if (await isDemoCompany(companyId)) return true;

  try {
    const entitlements = await loadCompanyEntitlements(companyId);
    if (!entitlements.isActive) return false;
    if (entitlements.billingModel === 'custom_setup') {
      return entitlements.customAccessStatus === 'paid_period'
        && entitlements.customTools?.smartAssistant === true;
    }
    // Legacy billing has no standalone Smart Assistant feature field. Its
    // existing rollout flag is therefore the authoritative product gate.
    return true;
  } catch {
    // Do not unlock a paid feature when the billing snapshot cannot be read.
    return false;
  }
}
