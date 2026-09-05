import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient, type Database } from '@/app/lib/supabase/server';
import { exchangeQboCodeForTokens } from '@/app/lib/integrations/quickbooks/qbo';

export const dynamic = 'force-dynamic';

function originFrom(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) throw new Error('Unable to determine host');
  return `${proto}://${host}`;
}

function errorRedirect(req: NextRequest, returnTo: string, reason: string): NextResponse {
  const url = new URL(returnTo, originFrom(req));
  url.searchParams.set('qbo', 'error');
  url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

/**
 * GET /api/integrations/quickbooks/callback?code=...&realmId=...&state=...
 * Exchanges the code, stores tokens + realm for the company.
 */
export async function GET(req: NextRequest) {
  const returnTo = req.cookies.get('qbo_return_to')?.value ?? '/account?tab=integrations';

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return errorRedirect(req, returnTo, 'not_signed_in');
    }

    const { data: profile } = await supabase
      .from('users')
      .select('company_id')
      .eq('id', user.id)
      .maybeSingle();
    const companyId = profile?.company_id as string | undefined;
    if (!companyId) {
      return errorRedirect(req, returnTo, 'no_company');
    }

    const code = req.nextUrl.searchParams.get('code');
    const realmId = req.nextUrl.searchParams.get('realmId');
    const state = req.nextUrl.searchParams.get('state');
    const expectedState = req.cookies.get('qbo_oauth_state')?.value;
    if (!code || !realmId || !state || !expectedState || state !== expectedState) {
      return errorRedirect(req, returnTo, 'invalid_state');
    }

    const redirectUri = `${originFrom(req)}/api/integrations/quickbooks/callback`;
    const tokens = await exchangeQboCodeForTokens(code, redirectUri);

    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const environment = process.env.QBO_ENV === 'production' ? 'production' : 'sandbox';
    const { error: connError } = await admin.from('qbo_connections').upsert(
      {
        company_id: companyId,
        realm_id: realmId,
        environment,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        access_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
        refresh_expires_at: tokens.x_refresh_token_expires_in
          ? new Date(tokens.x_refresh_token_expires_in * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,realm_id' }
    );
    if (connError) throw new Error(connError.message);

    // One active QBO connection per company: drop other realms.
    await admin
      .from('qbo_connections')
      .delete()
      .eq('company_id', companyId)
      .neq('realm_id', realmId);

    // Keep the generic integrations table in sync for status display.
    const { data: existing } = await admin
      .from('integrations')
      .select('id')
      .eq('company_id', companyId)
      .eq('provider', 'quickbooks')
      .maybeSingle();
    if (existing) {
      await admin
        .from('integrations')
        .update({
          connection_status: 'connected',
          enabled: true,
          last_validated_at: new Date().toISOString(),
          config: { realm_id: realmId, environment },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await admin.from('integrations').insert({
        company_id: companyId,
        provider: 'quickbooks',
        connection_status: 'connected',
        enabled: true,
        last_validated_at: new Date().toISOString(),
        config: { realm_id: realmId, environment },
      });
    }

    const url = new URL(returnTo, originFrom(req));
    url.searchParams.set('qbo', 'connected');
    const res = NextResponse.redirect(url);
    res.cookies.delete('qbo_oauth_state');
    res.cookies.delete('qbo_return_to');
    return res;
  } catch (err) {
    console.error('[qbo/callback] error:', err);
    return errorRedirect(req, returnTo, 'callback_failed');
  }
}
