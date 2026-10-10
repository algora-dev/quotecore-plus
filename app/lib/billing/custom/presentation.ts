/** Keep the calculator's combined core row separate from Stripe's two line items. */
import { BillingContractError, insist } from './contracts';

export function calculatorCodesFromBilling(codes: unknown): string[] {
  insist(Array.isArray(codes) && codes.every(code => typeof code === 'string'), 'billing_codes_invalid');
  const input = codes as string[];
  insist(new Set(input).size === input.length && input.includes('core_access'), 'billing_codes_invalid');
  const capacity = input.filter(code => /^capacity_(low|medium|high)$/.test(code));
  insist(capacity.length === 1, 'billing_capacity_invalid');
  const remaining = input.filter(code => code !== 'core_access' && code !== capacity[0]);
  const family = (code: string) => code.split('_')[0];
  for (const code of remaining) {
    if (!/^(digital_takeoff|scan_(low|medium|high)|offcuts_(low|medium|high)|assistant_(light|regular|heavy))$/.test(code)) {
      throw new BillingContractError('billing_code_unknown');
    }
  }
  insist(new Set(remaining.map(family)).size === remaining.length, 'billing_family_duplicate');
  insist(!remaining.some(code => /^(scan|offcuts)_/.test(code)) || remaining.includes('digital_takeoff'), 'billing_prerequisite_missing');
  return [capacity[0].replace('capacity_', 'core_'), ...remaining];
}
