import { NextRequest, NextResponse } from 'next/server';
import { buildUnsubscribeToken } from '@/app/lib/marketing/unsubscribeToken';

export const runtime = 'nodejs';

/**
 * TEMPORARY one-off: generate a signed unsubscribe token for a given email
 * using the live deployed ADMIN_SIGNUPS_API_KEY. Delete after use.
 */
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email') ?? '';
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const secret = process.env.ADMIN_SIGNUPS_API_KEY;
  if (!secret) return NextResponse.json({ error: 'ADMIN_SIGNUPS_API_KEY not set' }, { status: 503 });

  const token = buildUnsubscribeToken(email, secret);
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://app.quote-core.com';

  return NextResponse.json({
    email,
    unsubscribeUrl: `${base}/unsubscribe/${token}`,
    token,
  });
}
