import 'server-only';
import { resolveBillingType } from '../company-type';
import { UsageError } from './usage/contracts';

/** The old one-item change code must never run on a custom or unknown billing
 *  model. Thin wrapper over the single resolver (app/lib/billing/company-type.ts). */
export async function isLegacyBillingCompany(companyId: string): Promise<boolean> {
  try {
    return (await resolveBillingType(companyId)).kind === 'legacy';
  } catch (error) {
    // Preserve this boundary's contract message (subscription-change flows).
    if (error instanceof UsageError) {
      throw new Error('Billing state could not be verified. No subscription was changed.');
    }
    throw error;
  }
}
