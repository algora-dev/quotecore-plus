import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { buildQboAuthorizeUrl, getQboCredentials } from '@/app/lib/integrations/quickbooks/qbo';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

function originFrom(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) throw new Error('Unable to determine host');
  return `${proto}://${host}`;
}

/**
 * GET /api/integrations/quickbooks/connect
 * Starts the Intuit OAuth flow (CSRF state cookie + redirect).
 */
export async function GET(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = getQboCredentials();
    const state = randomBytes(16).toString('hex');
    const workspaceSlug = req.nextUrl.searchParams.get('workspace') ?? '';
    const redirectUri = `${originFrom(req)}/api/integrations/quickbooks/callback`;
    const authorizeUrl = buildQboAuthorizeUrl(clientId, redirectUri, state);

    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set('qbo_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    res.cookies.set(
      'qbo_return_to',
      workspaceSlug ? `/${workspaceSlug}/account?tab=integrations` : '/account?tab=integrations',
      { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 }
    );
    return res;
  } catch (err) {
    console.error('[qbo/connect] error:', err);
    return NextResponse.json({ error: 'Failed to start QuickBooks connect' }, { status: 500 });
  }
}
