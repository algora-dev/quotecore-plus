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
  /** AI parses per day (combined image + text) */
  aiPerDay: number;
  /** Manual document generations per day (combined quote + invoice + PO) */
  docPerDay: number | null; // null = unlimited
  /** Legacy fields kept for backwards compat with account-status route */
  imagePerDay: number;
  textPerDay: number;
  label: string;
}

export const TIER_LIMITS: Record<FreeToolsTier, TierLimits> = {
  1: { aiPerDay: 1, docPerDay: 3, imagePerDay: 1, textPerDay: 1, label: 'Free' },
  2: { aiPerDay: 3, docPerDay: 10, imagePerDay: 3, textPerDay: 3, label: 'Free account' },
  3: { aiPerDay: 10, docPerDay: null, imagePerDay: 10, textPerDay: 10, label: 'App account' },
};

export const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Bucket key for the daily AI parse rate limit (combined image + text). */
export function parseRateLimitKey(
  subject: { userId: string } | { ip: string }
): string {
  if ('userId' in subject) return `free-tools-parse:user:${subject.userId}`;
  return `free-tools-parse:ip:${subject.ip}`;
}

/** Bucket key for the daily document generation rate limit (combined quote + invoice + PO). */
export function docRateLimitKey(
  subject: { userId: string } | { ip: string }
): string {
  if ('userId' in subject) return `free-tools-doc:user:${subject.userId}`;
  return `free-tools-doc:ip:${subject.ip}`;
}
