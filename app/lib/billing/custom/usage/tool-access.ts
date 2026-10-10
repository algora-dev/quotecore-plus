import 'server-only';
import { loadCompanyEntitlements } from '@/app/lib/billing/entitlements';
import { UsageError } from './contracts';
/** Add at server execution boundaries. Keep each caller's existing legacy gate. */
export async function requirePurchasedTool(companyId: string, tool: 'roofScan' | 'offcuts' | 'smartAssistant'): Promise<void> {
  const ent = await loadCompanyEntitlements(companyId);
  if (ent.billingModel === 'legacy') return;
  if (!ent.isActive || ent.customAccessStatus !== 'paid_period' || !ent.customTools?.[tool]) {
    throw new UsageError('tool_not_in_setup', 'This tool is not available in your current setup.', 403);
  }
}
