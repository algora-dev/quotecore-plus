import { NextRequest, NextResponse } from 'next/server';
import { resolveFreeToolsTier } from '@/app/lib/free-tools/resolveTier';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';
import { docRateLimitKey, RATE_LIMIT_WINDOW_MS, TIER_LIMITS } from '@/app/lib/free-tools/tiers';

export const runtime = 'nodejs';

/**
 * POST /api/free-tools/check-doc-limit
 *
 * Called by the "Generate" button on free quote/invoice/PO generators.
 * Atomically consumes one document-generation credit and returns whether
 * the caller is allowed to proceed.
 *
 * Body: { tool: 'quote' | 'invoice' | 'order' }
 * Response: { allowed: boolean, remaining: number | null, tier: number }
 */
export async function POST(req: NextRequest) {
  const resolved = await resolveFreeToolsTier(req.headers.get('authorization'));
  const ip = getClientIP(req.headers);

  // Tier 3 (app account) — unlimited, no rate limit check needed
  if (resolved.tier === 3 || resolved.limits.docPerDay === null) {
    return NextResponse.json({
      allowed: true,
      remaining: null, // unlimited
      tier: resolved.tier,
    });
  }

  const maxPerDay = resolved.limits.docPerDay;
  const key = docRateLimitKey(
    resolved.userId ? { userId: resolved.userId } : { ip }
  );

  // Atomically consume one credit
  const allowed = await checkRateLimit(key, maxPerDay, RATE_LIMIT_WINDOW_MS, {
    failClosed: true,
  });

  if (!allowed) {
    const upgradeHint =
      resolved.tier === 1
        ? 'Sign up free at the top of the page for higher daily limits.'
        : 'Start a free trial of QuoteCore+ for unlimited document generation.';
    return NextResponse.json(
      {
        allowed: false,
        remaining: 0,
        tier: resolved.tier,
        limit: maxPerDay,
        message: `You have reached your daily limit of ${maxPerDay} free documents. ${upgradeHint}`,
      },
      { status: 429 }
    );
  }

  // We don't know exact remaining without a separate count query,
  // but the client can decrement locally. Return the tier limit.
  return NextResponse.json({
    allowed: true,
    remaining: maxPerDay, // upper bound; client decrements
    tier: resolved.tier,
    limit: maxPerDay,
  });
}
