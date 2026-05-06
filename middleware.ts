import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/accept',       // Quote acceptance (public)
  '/auth/callback', // OAuth callback
  '/auth/reset-password', // Password reset
  '/onboarding',   // New user onboarding
];

// Paths reachable when the user has an AAL1 session but still needs to clear 2FA.
// /2fa is the challenge page itself; logout/signout shouldn't be blocked behind 2FA.
const AAL1_ALLOWED_PATHS = [
  '/2fa',
  '/auth/signout',
];

function isAal1Allowed(pathname: string): boolean {
  return AAL1_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname.startsWith(p));
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/favicon.png' ||
    pathname === '/logo.png' ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)$/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets and API routes
  if (isStaticAsset(pathname)) {
    return NextResponse.next();
  }

  // Skip public paths
  if (pathname === '/' || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Create Supabase client for middleware
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options });
          response = NextResponse.next({ request });
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // No user — redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  // 2FA gate. getAuthenticatorAssuranceLevel() is a local JWT decode, not a
  // network round-trip, so it's safe to run on every request.
  //   - currentLevel: where the session is now (aal1 or aal2)
  //   - nextLevel:    where the session needs to be once factors are considered
  // If they don't match, the user has a verified factor that hasn't been used
  // for this session yet — block routing until they pass the /2fa challenge.
  //
  // We also honour the user-controlled mfa_required flag on public.users so
  // someone who has a saved authenticator factor but has temporarily switched
  // 2FA off in settings doesn't get challenged. The DB read is one indexed PK
  // lookup; cheap and runs after we've already paid for getUser().
  if (!isAal1Allowed(pathname)) {
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const factorPending =
      aal.data?.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2';

    if (factorPending) {
      const { data: profile } = await supabase
        .from('users')
        .select('mfa_required')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.mfa_required) {
        const url = request.nextUrl.clone();
        url.pathname = '/2fa';
        // Preserve where they were trying to go so we can bounce them back.
        url.searchParams.set('redirect', pathname + (request.nextUrl.search || ''));
        return NextResponse.redirect(url);
      }
    }
  }

  // User exists (and 2FA, if applicable, has been satisfied). Page-level checks
  // continue to handle company context.
  return response;
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|logo\\.png).*)',
  ],
};
