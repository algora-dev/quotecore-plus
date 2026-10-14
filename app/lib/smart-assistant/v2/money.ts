/** Owner 2026-10-12: every money figure the Smart Assistant shows must carry a
 * real currency symbol (£/$/€) - bare digits read as unpriced numbers. Shared
 * by the draft plan, component plan and structural-diff card builders. */
export function assistantMoney(currency: string | null | undefined, value: number): string {
  const amount = Number.isFinite(value) ? value : 0;
  if (!currency) return amount.toFixed(2);
  try {
    return new Intl.NumberFormat('en', { style: 'currency', currency }).format(amount);
  } catch {
    return amount.toFixed(2);
  }
}
