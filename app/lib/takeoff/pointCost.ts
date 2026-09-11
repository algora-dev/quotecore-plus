// AI Assist point costs - SINGLE SOURCE OF TRUTH for client and server code.
// Canonical policy (locked by Shaun 2026-09-11): Astra tiers consume more of
// the customer's allowance. low=2, medium=6, high=12.
// NOTE: the SQL queue path (create_ai_scan_job / check_and_deduct_ai_points
// callers) cannot import this file - keep SQL values in sync manually and
// see tests + migration comments that tie them to this constant.
export const AI_SCAN_POINT_COST = {
  low: 2,
  medium: 6,
  high: 12,
} as const;

export type AiScanQualityLevel = keyof typeof AI_SCAN_POINT_COST;

export function getAiScanPointCost(qualityLevel: string): number {
  return AI_SCAN_POINT_COST[qualityLevel as AiScanQualityLevel] ?? 6;
}
