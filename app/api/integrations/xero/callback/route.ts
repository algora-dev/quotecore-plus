import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/app/lib/supabase/server';
import { exchangeCodeForTokens, fetchTenants } from '@/app/lib/integrations/xero/xero';
import type { Database } from '@/app/lib/supabase/server';

export const dynamic = 'force-dynamic';

function originFrom(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (!host) throw new Error('Unable to determine host');
  return `${proto}://${host}`;
}

function errorRedirect(req: NextRequest, returnTo: string, reason: string): NextResponse {
  const url = new URL(returnTo, originFrom(req));
  url.searchParams.set('xero', 'error');
  url.searchParams.set('reason', reason);
  return NextResponse.redirect(url);
}

/**
 * GET /api/integrations/xero/callback
 * Exchanges the OAuth code, stores tokens + tenant info for the company,
 * then bounces back to the integrations tab.
 */
export async function GET(req: NextRequest) {
  const returnTo = req.cookies.get('xero_return_to')?.value ?? '/account?tab=integrations';

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
    const state = req.nextUrl.searchParams.get('state');
    const expectedState = req.cookies.get('xero_oauth_state')?.value;
    if (!code || !state || !expectedState || state !== expectedState) {
      return errorRedirect(req, returnTo, 'invalid_state');
    }

    const redirectUri = `${originFrom(req)}/api/integrations/xero/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);
    const tenants = await fetchTenants(tokens.access_token);
    if (tenants.length === 0) {
      return errorRedirect(req, returnTo, 'no_tenant');
    }
    // If multiple tenants, use the first (most recently authorised).
    const tenant = tenants[0];

    const admin = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
    const { error: connError } = await admin.from('xero_connections').upsert(
      {
        company_id: companyId,
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        tenant_type: tenant.tenantType,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        access_expires_at: expiresAt,
        scopes: tokens.scope ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'company_id,tenant_id' }
    );
    if (connError) throw new Error(connError.message);

    // Remove stale connections for other tenants of this company.
    await admin
      .from('xero_connections')
      .delete()
      .eq('company_id', companyId)
      .neq('tenant_id', tenant.tenantId);

    // Keep the generic integrations table in sync for status display.
    const { data: existing } = await admin
      .from('integrations')
      .select('id')
      .eq('company_id', companyId)
      .eq('provider', 'xero')
      .maybeSingle();
    if (existing) {
      await admin
        .from('integrations')
        .update({
          connection_status: 'connected',
          enabled: true,
          last_validated_at: new Date().toISOString(),
          config: { tenant_name: tenant.tenantName, tenant_id: tenant.tenantId },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await admin.from('integrations').insert({
        company_id: companyId,
        provider: 'xero',
        connection_status: 'connected',
        enabled: true,
        last_validated_at: new Date().toISOString(),
        config: { tenant_name: tenant.tenantName, tenant_id: tenant.tenantId },
      });
    }

    const url = new URL(returnTo, originFrom(req));
    url.searchParams.set('xero', 'connected');
    const res = NextResponse.redirect(url);
    res.cookies.delete('xero_oauth_state');
    res.cookies.delete('xero_return_to');
    return res;
  } catch (err) {
    console.error('[xero/callback] error:', err);
    return errorRedirect(req, returnTo, 'callback_failed');
  }
}
