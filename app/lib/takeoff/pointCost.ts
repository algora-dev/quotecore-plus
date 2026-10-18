// AI Assist point costs - SINGLE SOURCE OF TRUTH for client and server code.
// Canonical policy (owner 2026-10-18): TWO scan tiers only.
// Simple roof = 2, Medium+ roof = 10. (Supersedes the 2026-09-11 three-tier
// low=2/medium=6/high=12 policy; 'medium' is no longer offered - legacy
// requests charge as Medium+ so a customer is never undercharged.)
// Per-scan billing (owner 2026-10-04): the area scan (scan1) charges its tier
// AND the component scan charges the tier chosen for it when it starts
// (scan2); scan3 is the tail of the component pass and never charges.
// NOTE: the SQL queue path (check_and_deduct_ai_points callers) cannot import
// this file - the SQL function receives the cost as a parameter from callers
// that DO use this constant; keep any raw SQL call sites in sync.
export const AI_SCAN_POINT_COST = {
  low: 2,
  high: 10,
} as const;

/** Spec 12.4 proposed launch policy: one point per completed user-visible search round.
 *  Lives here (client-safe) so UI and server share the constant; SQL paths keep
 *  values in sync manually as documented above. */
export const CALIBRATION_SEARCH_POINT_COST = 1;

export type AiScanQualityLevel = keyof typeof AI_SCAN_POINT_COST;

export function getAiScanPointCost(qualityLevel: string): number {
  // Unknown/legacy levels (e.g. 'medium') charge as Medium+ (10) so nothing
  // is ever undercharged after the two-tier switch.
  return AI_SCAN_POINT_COST[qualityLevel as AiScanQualityLevel] ?? 10;
}
