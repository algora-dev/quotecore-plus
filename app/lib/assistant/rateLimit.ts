/**
 * AI Assistant - Rate Limiting (Phase 0A)
 * ========================================
 *
 * Thin, assistant-specific wrapper over the shared `checkRateLimit` helper.
 *
 * KEY DIFFERENCE FROM THE GENERIC HELPER: the assistant chat path ALWAYS
 * fails closed (Gerald review H-02). A transient DB blip must not let a
 * client hammer a paid LLM endpoint. We check three buckets per request:
 * per-user, per-company, per-IP. The first that trips denies the request.
 */

import { checkRateLimit } from '@/app/lib/security/rateLimit';
import { RATE_LIMITS } from './config';

export type RateLimitBucket = 'perUser' | 'perCompany' | 'perIp';

export interface AssistantRateInput {
  userId: string;
  companyId: string;
  ip: string;
}

export interface AssistantRateResult {
  allowed: boolean;
  /** Which bucket denied the request, if any. */
  deniedBy?: RateLimitBucket;
}

/**
 * Check all assistant rate-limit buckets. Fails CLOSED: any bucket that
 * cannot be confirmed as "within limit" denies the request.
 *
 * Buckets are checked in order; we short-circuit on the first denial so we
 * don't needlessly consume the remaining buckets' counters.
 */
export async function checkAssistantRateLimits(
  input: AssistantRateInput
): Promise<AssistantRateResult> {
  const checks: { bucket: RateLimitBucket; key: string }[] = [
    { bucket: 'perUser', key: `assistant-chat-user:${input.userId}` },
    { bucket: 'perCompany', key: `assistant-chat-company:${input.companyId}` },
    { bucket: 'perIp', key: `assistant-chat-ip:${input.ip}` },
  ];

  for (const { bucket, key } of checks) {
    const cfg = RATE_LIMITS[bucket];
    const allowed = await checkRateLimit(key, cfg.max, cfg.windowMs, {
      failClosed: true,
    });
    if (!allowed) {
      return { allowed: false, deniedBy: bucket };
    }
  }

  return { allowed: true };
}
