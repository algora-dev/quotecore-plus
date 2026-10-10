import 'server-only';
import { createAdminClient } from '@/app/lib/supabase/admin';
/** The old one-item change code must never run on a custom or unknown billing model. */
export async function isLegacyBillingCompany(companyId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (createAdminClient() as any).from('companies').select('billing_model').eq('id', companyId).maybeSingle();
  if (error || !data) throw new Error('Billing state could not be verified. No subscription was changed.');
  return data.billing_model === 'legacy';
}
