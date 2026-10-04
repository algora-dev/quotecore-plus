import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { Database } from '@/app/lib/supabase/database.types';
import { AUTH_COOKIE_NAME, authCookieOptionsForLocation } from '@/app/lib/supabase/cookie-config';
import { createAuthCookieBatch } from '@/app/lib/supabase/cookie-batch';
import { probeSessionDestination } from '@/app/lib/auth/session-probe.server';
import { safeReturnPath, type ResumeResult } from '@/app/lib/auth/resume-contract';
import { authCookieInventory, createSessionTrace, sessionNoStore } from '@/app/lib/auth/session-trace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Revalidate an EXISTING cookie session. No passwords, bearer/body tokens,
 * company IDs, admin client, signIn, refreshSession, or push credentials. */
export async function GET(request: NextRequest) {
  const trace = createSessionTrace(request, 'resume');
  const batch = createAuthCookieBatch();
  const finish = (result: ResumeResult, status = 200) => {
    const response = sessionNoStore(batch.apply(NextResponse.json(result, { status })));
    response.headers.set('Vary', 'Cookie');
    if (trace.enabled) response.headers.set('X-QCP-Session-Trace', trace.id);
    trace.finish(result.status, batch.summary(), 'destination' in result ? { destination: result.destination } : {});
    return response;
  };
  if (process.env.PWA_SESSION_RECOVERY_ENABLED !== 'true') return finish({ status: 'disabled' });
  const url = new URL(request.url);
  const origin = request.headers.get('origin');
  if ((origin && origin !== url.origin) || request.headers.get('sec-fetch-site') === 'cross-site') return finish({ status: 'disabled' }, 403);
  const options = authCookieOptionsForLocation(url.hostname, url.pathname, request.headers.get('x-qcp-auth-namespace'));
  if (options.name !== AUTH_COOKIE_NAME) return finish({ status: 'disabled' }, 403);
  if (url.search.length > 4096) return finish({ status: 'disabled' }, 400);
  const requested = safeReturnPath(url.searchParams.get('redirect')) ?? '/';
  // No cookie is not a reason to contact Auth, or to invent a new session.
  if (!authCookieInventory(request.headers.get('cookie') ?? '').normalCount) return finish({ status: 'anonymous', reason: 'missing' }, 401);
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return finish({ status: 'unavailable' }, 503);

  // Request-wide deadline includes Auth + membership/MFA reads. It does not
  // rotate a second refresh token; the existing SDK owns refresh. The browser
  // waits longer than this budget to receive any refreshed cookie batch.
  const deadline = AbortSignal.timeout(6500);
  const tracedFetch = trace.fetch(fetch);
  try {
    const client = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookieOptions: options,
        global: { fetch: (input, init) => tracedFetch(input, {
          ...init, cache: 'no-store', signal: AbortSignal.any([deadline, request.signal, ...(init?.signal ? [init.signal] : [])]),
        }) },
        cookies: {
          getAll: () => request.cookies.getAll(),
          setAll(changes, sdkHeaders?: Record<string, string>) {
            for (const { name, value } of changes) request.cookies.set(name, value);
            batch.record(changes, sdkHeaders);
          },
        },
      },
    );
    const result = await probeSessionDestination(client, requested, trace.observe);
    return finish(result, result.status === 'anonymous' ? 401 : result.status === 'unavailable' ? 503 : 200);
  } catch {
    // A network/profile/schema error does not prove the user signed out.
    return finish({ status: 'unavailable' }, 503);
  }
}
