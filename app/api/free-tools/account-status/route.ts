import { NextRequest, NextResponse } from 'next/server';
import { resolveFreeToolsTier } from '@/app/lib/free-tools/resolveTier';
import { checkRateLimit, getClientIP } from '@/app/lib/security/rateLimit';

export const runtime = 'nodejs';

/**
 * GET /api/free-tools/account-status
 *
 * Returns the caller's free-tools tier + daily limits based on their
 * free-tools Supabase access token (Authorization: Bearer <jwt>).
 * Anonymous callers get tier 1.
 */
export async function GET(req: NextRequest) {
  // Light rate limit — this endpoint does a DB lookup per call
  const ip = getClientIP(req.headers);
  const allowed = await checkRateLimit(`free-tools-status:${ip}`, 60, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const resolved = await resolveFreeToolsTier(req.headers.get('authorization'));

  return NextResponse.json({
    tier: resolved.tier,
    hasAppAccount: resolved.hasAppAccount,
    limits: {
      imagePerDay: resolved.limits.imagePerDay,
      textPerDay: resolved.limits.textPerDay,
      label: resolved.limits.label,
    },
  });
}
