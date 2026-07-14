/**
 * Free tools tier system.
 *
 * Tier 1 — anonymous (no login): IP-based limits
 * Tier 2 — free tools account (Google OAuth or confirmed email): user-based limits
 * Tier 3 — free tools account whose email also has a QuoteCore+ app account: highest limits
 *
 * Server-side source of truth for daily parse quotas. The client only ever
 * displays these numbers — enforcement happens in the parse-document route.
 */

export type FreeToolsTier = 1 | 2 | 3;

export interface TierLimits {
  /** AI image scans per day */
  imagePerDay: number;
  /** AI text parses per day */
  textPerDay: number;
  label: string;
}

export const TIER_LIMITS: Record<FreeToolsTier, TierLimits> = {
  1: { imagePerDay: 3, textPerDay: 5, label: 'Free' },
  2: { imagePerDay: 10, textPerDay: 20, label: 'Free account' },
  3: { imagePerDay: 25, textPerDay: 50, label: 'App account' },
};

export const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Bucket key for the daily parse rate limit. */
export function parseRateLimitKey(
  mode: 'image' | 'text',
  subject: { userId: string } | { ip: string }
): string {
  const modeKey = mode === 'image' ? 'img' : 'txt';
  if ('userId' in subject) return `free-tools-parse:${modeKey}:user:${subject.userId}`;
  return `free-tools-parse:${modeKey}:ip:${subject.ip}`;
}
