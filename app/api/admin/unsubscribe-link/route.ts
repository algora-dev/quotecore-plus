import { NextRequest, NextResponse } from 'next/server';
import { getClientIP } from '@/app/lib/security/rateLimit';
import { buildUnsubscribeToken } from '@/app/lib/marketing/unsubscribeToken';

export const runtime = 'nodejs';

/**
 * GET /api/admin/unsubscribe-link?email=<address>
 *
 * Companion to /api/admin/signups for the signup-alert agent. Returns a
 * signed, per-recipient unsubscribe URL for the footer of marketing emails
 * the agent sends. Stateless token: HMAC(ADMIN_SIGNUPS_API_KEY, email) -
 * works only for that one address, cannot be edited to target anyone else.
 *
 * Same bearer-key auth as the signups feed.
 */

export async function GET(req: NextRequest) {
  const expected = process.env.ADMIN_SIGNUPS_API_KEY;
  const provided = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!expected || provided.length !== expected.length || provided !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIP(req.headers);
  const { checkRateLimit } = await import('@/app/lib/security/rateLimit');
  const allowed = await checkRateLimit(`admin-unsub-link:${ip}`, 240, 60 * 60 * 1000);
  if (!allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const email = (req.nextUrl.searchParams.get('email') ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return NextResponse.json({ error: 'Valid email query param required' }, { status: 400 });
  }

  const token = buildUnsubscribeToken(email, expected);

  const base = process.env.NEXT_PUBLIC_SITE_URL
    ?? (req.nextUrl.hostname.includes('localhost') ? 'http://localhost:3000' : 'https://app.quote-core.com');

  return NextResponse.json({ email, unsubscribeUrl: `${base}/unsubscribe/${token}` });
}
