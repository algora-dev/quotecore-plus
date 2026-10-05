/** Existing app scan tariff. Product Scan Tokens, NOT underlying model tokens. */
export const SCAN_QUALITY = {
  low: { label: 'Low', tokens: 2 }, medium: { label: 'Medium', tokens: 6 }, high: { label: 'High', tokens: 12 },
} as const;
export type ScanQuality = keyof typeof SCAN_QUALITY;
export function fullPlanTokens(outline: ScanQuality, components: ScanQuality): number {
  return SCAN_QUALITY[outline].tokens + SCAN_QUALITY[components].tokens;
}
/** Capacity examples assume no retries or extra scans. Not an accuracy guarantee. */
export function fullPlanExamples(tokens: number): Record<ScanQuality, number> {
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error('Invalid Scan Tokens.');
  return { low: Math.floor(tokens / 4), medium: Math.floor(tokens / 12), high: Math.floor(tokens / 24) };
}
