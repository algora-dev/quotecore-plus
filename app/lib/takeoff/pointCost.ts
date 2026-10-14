// AI Assist point costs - SINGLE SOURCE OF TRUTH for client and server code.
// Canonical scan policy: Simple roof = 2 points, Medium+ roof = 12 points.
// Per-scan billing (owner 2026-10-04): the area scan (scan1) charges its tier
// AND the component scan charges the tier chosen for it when it starts
// (scan2); scan3 is the tail of the component pass and never charges.
// NOTE: the SQL queue path (create_ai_scan_job / check_and_deduct_ai_points
// callers) cannot import this file - keep SQL values in sync manually and
// see tests + migration comments that tie them to this constant.
export const AI_SCAN_POINT_COST = {
  low: 2,
  high: 12,
} as const;

/** Spec 12.4 proposed launch policy: one point per completed user-visible search round.
 *  Lives here (client-safe) so UI and server share the constant; SQL paths keep
 *  values in sync manually as documented above. */
export const CALIBRATION_SEARCH_POINT_COST = 1;

export type AiScanQualityLevel = keyof typeof AI_SCAN_POINT_COST;

export function getAiScanPointCost(qualityLevel: string): number {
  return AI_SCAN_POINT_COST[qualityLevel as AiScanQualityLevel] ?? AI_SCAN_POINT_COST.low;
}
