import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { isDemoCompany } from '@/app/lib/demo/context';

/**
 * Whether this workspace may use the Smart Assistant (owner 2026-10-17):
 * access follows the subscription. Custom plans include the Assistant when
 * the purchased task allowance is above zero and the company is in a paid
 * period. Legacy plans do NOT include the Smart Assistant - they carry only
 * the features that existed when those plans were sold. Demo companies
 * always have it (the guided demo depends on it).
 *
 * An explicit admin override (admin/smart-assistant) wins in both
 * directions: force_on (internal testing) or force_off (emergency kill
 * switch), regardless of billing.
 */
export async function smartAssistantFeatureAvailable(
  client: SupabaseClient,
  companyId: string,
): Promise<boolean> {
  try {
    const { data: override } = await client.rpc('smart_assistant_override_state', {
      p_company_id: companyId,
    });
    if (override === 'force_off') return false;
    if (override === 'force_on') return true;
  } catch {
    // Override lookup failed - fall through to the subscription check
    // rather than locking everyone out on a transient error.
  }
  if (await isDemoCompany(companyId)) return true;
  try {
    const entitlements = await loadCompanyEntitlements(companyId);
    if (!entitlements.isActive) return false;
    if (entitlements.billingModel !== 'custom_setup') return false;
    return entitlements.customAccessStatus === 'paid_period'
      && entitlements.customTools?.smartAssistant === true;
  } catch {
    // Fail closed: never unlock a paid feature when the billing snapshot
    // cannot be read.
    return false;
  }
}
