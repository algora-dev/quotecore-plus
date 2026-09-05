import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { buildAuthorizeUrl, getXeroCredentials } from '@/app/lib/integrations/xero/xero';
import { randomBytes } from 'crypto';

export const dynamic = 'force-dynamic';

function originFrom(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) throw new Error('Unable to determine host');
  return `${proto}://${host}`;
}

/**
 * GET /api/integrations/xero/connect
 * Starts the OAuth flow: sets a CSRF state cookie, then redirects to Xero.
 * The redirect URI is derived from the request origin, so each environment
 * (prod / dev preview / localhost) works as long as its callback URI is
 * registered on the Xero app.
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

    const { clientId } = getXeroCredentials();
    const state = randomBytes(16).toString('hex');
    const workspaceSlug = req.nextUrl.searchParams.get('workspace') ?? '';
    const redirectUri = `${originFrom(req)}/api/integrations/xero/callback`;
    const authorizeUrl = buildAuthorizeUrl(clientId, redirectUri, state);

    const res = NextResponse.redirect(authorizeUrl);
    res.cookies.set('xero_oauth_state', state, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    // Remember where to send the user after the callback.
    res.cookies.set('xero_return_to', workspaceSlug ? `/${workspaceSlug}/account?tab=integrations` : '/account?tab=integrations', {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    });
    return res;
  } catch (err) {
    console.error('[xero/connect] error:', err);
    return NextResponse.json({ error: 'Failed to start Xero connect' }, { status: 500 });
  }
}
