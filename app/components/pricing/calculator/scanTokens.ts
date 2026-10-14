/** Existing app scan tariff. Product Scan Tokens, NOT underlying model tokens. */
export const SCAN_QUALITY = {
  low: { label: 'Simple roof', tokens: 2 }, high: { label: 'Medium+ roof', tokens: 12 },
} as const;
export type ScanQuality = keyof typeof SCAN_QUALITY;
export function fullPlanTokens(outline: ScanQuality, components: ScanQuality): number {
  return SCAN_QUALITY[outline].tokens + SCAN_QUALITY[components].tokens;
}
/** Capacity examples assume no retries or extra scans. Not an accuracy guarantee. */
export function fullPlanExamples(tokens: number): Record<ScanQuality, number> {
  if (!Number.isSafeInteger(tokens) || tokens < 0) throw new Error('Invalid Scan Tokens.');
  return { low: Math.floor(tokens / 4), high: Math.floor(tokens / 24) };
}
