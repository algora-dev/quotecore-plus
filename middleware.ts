import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import {
  AUTH_COOKIE_NAME,
  authCookieOptions,
  legacyAuthCookiePrefix,
} from '@/app/lib/supabase/cookie-config';
import {
  isProductionMarketingHost,
  isPreviewHost,
} from '@/lib/app-url';

// Canonical host for the public marketing site + free tools. Matches the
// existing sitemap/robots canonical (apex, not www) so we don't churn
// Google's index. www + .co.nz + app free-tool URLs 308 here.
const CANONICAL_PUBLIC_ORIGIN = 'https://quote-core.com';

/**
 * Expire legacy default-named Supabase cookies (sb-<ref>-auth-token*).
 * We migrated to a new cookie name + `.quote-core.com` domain (see
 * cookie-config.ts); stale host-only cookies under the old name would
 * otherwise linger for 400 days.
 */
function expireLegacyAuthCookies(request: NextRequest, response: NextResponse) {
  const legacyPrefix = legacyAuthCookiePrefix();
  if (!legacyPrefix) return response;
  for (const cookie of request.cookies.getAll()) {
    if (cookie.name.startsWith(legacyPrefix)) {
      response.cookies.set({ name: cookie.name, value: '', path: '/', maxAge: 0 });
    }
  }
  return response;
}

/**
 * Stable Vercel production aliases that should redirect to quote-core.com.
 *
 * These are the permanent per-project URLs Vercel assigns (not the
 * random per-deployment preview URLs). Google has indexed some of them,
 * so we 308-redirect to the canonical production domain.
 *
 * IMPORTANT: This list is EXACTT-hostname only. Preview deployment URLs
 * (e.g. quotecore-plus-dev-abc123.vercel.app) are NOT matched and remain
 * usable for internal testing.
 */
const STABLE_VERCEL_ALIASES = new Set([
  'quotecore-plus.vercel.app',
  'quotecore-plus-dev.vercel.app',
  'quotecore-plus-main.vercel.app',
  'quotecore-git-main-algora-devs-projects.vercel.app',
]);

// Public paths that don't require authentication
const PUBLIC_PATHS = [
  '/login',
  '/signup',
  '/accept',       // Quote acceptance (public)
  '/auth/callback', // OAuth callback
  '/auth/verify',   // Magic-link verification (impersonation flow)
  '/auth/reset-password', // Password reset
  '/onboarding',   // New user onboarding
  '/privacy',      // Privacy Policy (legally required to be public)
  '/cookies',      // Cookie Policy (legally required to be public)
  '/cookie-policy', // Cookie policy (marketing variant)
  '/terms',        // Terms of Service (legally required to be public)
  '/docs',         // Public help library
  '/about',        // Marketing pages
  '/services',
  '/contact',
  '/suppliers',
  '/suppliers-info',
  '/affiliate-program', // Partner & Affiliate Program (public landing page)
  '/affiliate-program-terms', // Partner Program Terms (public)
  '/supplier-partnership', // Hidden supplier partnership page (email outreach, not in nav)
  '/blog',
  '/resources',     // Resource hub pages (blog category hubs)
  '/pricing',
  '/trust',
  '/customer-stories',
  '/company',
  '/coffee-terms',
  '/tutorials',
  '/features',     // Feature pages (marketing)
  '/takeoff-demo', // Interactive public takeoff demo (client-only, no auth)
  '/measurement-to-quote-tool', // Free measurement-to-pricing tool (renamed from /free-quote-builder)
  '/done-for-you-setup',
  '/free-trial',
  '/construction-quoting-software',
  '/roofing-quoting-software',
  '/roofing-estimating-software',
  '/roofing-takeoff-software',
  '/roofsnap-alternative',        // Competitor comparison pages (marketing)
  '/eagleview-alternative',
  '/planswift-alternative',
  '/roofr-alternative',
  '/stack-alternative-for-roofing',
  '/hover-alternative',
  '/bluebeam-alternative-for-roofing',
  '/roof-measurement-cost-comparison', // Cost-per-quote comparison page (marketing)
  '/free-construction-calculator', // Free public calculator (no auth)
  '/free-roofing-calculator',     // Free roofing calculator (no auth)
  '/free-quote-generator',        // Free AI quote generator (future)
  '/free-purchase-order-generator', // Free AI order generator (future)
  '/free-invoice-generator',       // Free AI invoice generator (future)
  '/free-tools',                   // Free tools auth callback (future)
  '/mcp',                          // Public roof takeoff MCP endpoint
  '/llms.txt',                     // Public machine-discovery document
  '/admin/login',  // Admin sign-in (the rest of /admin/* is gated by
                   //  the requireAdmin() helper at the page boundary).
  '/m',            // Public recipient reply pages (Messages pipeline).
                   //  HMAC-signed token in the URL is the access gate.
  '/unsubscribe',  // Public marketing unsubscribe confirm page. HMAC-signed
                   //  per-recipient token in the URL is the access gate.
  '/orders',       // Public supplier order pages. Random UUID token in
                   //  the URL is the access gate.
  '/invoice',      // Public customer invoice pages. Random UUID public_token
                   //  in the URL is the access gate.
  '/file',         // Hosted attachment downloads (token-gated). Already
                   //  HMAC-verified at the route level.
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
  // All /free-* paths are public (calculators, generators, hub page).
  // This covers all current and future free tool routes without needing
  // to update PUBLIC_PATHS each time we add a calculator or generator.
  if (pathname.startsWith('/free-')) return true;

  // Match on segment boundary: either exact match or the path continues
  // with a '/'. This prevents '/m' from matching '/meadow-roofing/...' etc.
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'));
}

function isStaticAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/favicon.png' ||
    pathname === '/logo.png' ||
    // Gerald audit M-04: SEO/discovery metadata routes must be reachable
    // without auth. Without this, middleware redirects them to /login and
    // breaks crawlers + sitemap generators.
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml' ||
    pathname === '/video-sitemap.xml' ||
    // IndexNow key verification file
    pathname.startsWith('/22ffbce37a69481c9841bddef9028097.txt') ||
    /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|vtt|mp4|webm|ogg|mp3|wav|pdf|txt)$/.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.nextUrl.hostname;

  // ── Stable Vercel alias redirect ───────────────────────────
  // Known stable production aliases (e.g. quotecore-plus-dev.vercel.app)
  // 308-redirect to the canonical production domain so Google consolidates
  // indexing signals on quote-core.com. This runs FIRST, before any auth
  // logic, so Googlebot (which won't have auth cookies) gets redirected
  // cleanly. Preview deployment URLs (with random hashes) are NOT matched.
  if (STABLE_VERCEL_ALIASES.has(hostname)) {
    const url = new URL(pathname + (request.nextUrl.search || ''), CANONICAL_PUBLIC_ORIGIN);
    return NextResponse.redirect(url, 308);
  }

  // ── Free-tools host canonicalisation (2026-07-15) ──────
  // Free tools live ONLY on quote-core.com (the canonical marketing host,
  // matching sitemap/robots). Duplicate copies on www, .co.nz and
  // app.quote-core.com are permanently redirected there — consolidates
  // SEO signals onto one host and gives the save-to-app flow a single,
  // predictable handoff path. vercel.app previews / localhost are exempt
  // so dev testing keeps working single-host.
  if (hostname === 'www.quote-core.com' && !pathname.startsWith('/api')) {
    const url = new URL(pathname + (request.nextUrl.search || ''), CANONICAL_PUBLIC_ORIGIN);
    return NextResponse.redirect(url, 308);
  }
  // app.quote-core.com still redirects /free-* to the canonical public origin.
  // .co.nz NO LONGER redirects - free tools render on both domains for SEO.
  if (
    hostname === 'app.quote-core.com' &&
    pathname.startsWith('/free-')
  ) {
    const url = new URL(pathname + (request.nextUrl.search || ''), CANONICAL_PUBLIC_ORIGIN);
    return NextResponse.redirect(url, 308);
  }

  // -- Domain-based routing ------------------------------
  // Production:
  //   quote-core.com / www / .co.nz / www.co.nz = public-facing marketing site.
  //   Free tools render on ALL marketing domains (no redirect) for SEO.
  //   app.quote-core.com = full application only.
  //   When on a marketing domain, only public routes are allowed;
  //   everything else redirects to app.quote-core.com.
  //
  // Preview/dev (*.vercel.app, localhost):
  //   Single host serves both marketing and app. No cross-domain
  //   redirects - everything stays on the same origin so dev/staging
  //   is fully self-contained.
  const isPreview = isPreviewHost(hostname);
  const isPublicDomain = isProductionMarketingHost(hostname);

  if (isPreview) {
    // On preview hosts, skip all cross-domain redirects. The homepage
    // renders marketing (via shouldRenderMarketing in app/page.tsx) and
    // auth paths stay on the same origin.
    if (isStaticAsset(pathname)) {
      return NextResponse.next();
    }
    // Public paths and root are allowed without auth
    if (pathname === '/' || isPublicPath(pathname)) {
      return NextResponse.next();
    }
    // Fall through to auth check below (same as app domain)
  } else if (isPublicDomain) {
    // Allow static assets, API routes, and public paths on the public domain
    if (isStaticAsset(pathname)) {
      return NextResponse.next();
    }
    // Auth journey paths ALWAYS run on the app domain (2026-07-15).
    // Previously /login, /signup, /onboarding and /auth/* rendered on the
    // marketing domain too (they're in PUBLIC_PATHS), so a free-tools user
    // could complete the ENTIRE signup + onboarding on quote-core.com and
    // only hit app.quote-core.com at the final dashboard hop — where their
    // host-only session cookies didn't follow. Forcing these paths onto
    // the app domain keeps the whole auth journey on one origin.
    const AUTH_JOURNEY_PATHS = ['/login', '/signup', '/onboarding', '/2fa', '/auth'];
    if (AUTH_JOURNEY_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      const appUrl = new URL(pathname, `https://app.quote-core.com`);
      appUrl.search = request.nextUrl.search;
      return NextResponse.redirect(appUrl, 308);
    }
    if (pathname === '/' || isPublicPath(pathname)) {
      return NextResponse.next();
    }
    // Redirect everything else to the app domain
    const appUrl = new URL(pathname, `https://app.quote-core.com`);
    appUrl.search = request.nextUrl.search;
    return NextResponse.redirect(appUrl, 308);
  }

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
      // Cross-subdomain auth cookies (see cookie-config.ts): sessions
      // refreshed here must stay valid on all quote-core.com subdomains.
      cookieOptions: authCookieOptions(hostname),
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

  let { data: { user } } = await supabase.auth.getUser();

  // If getUser() returned null but auth cookies exist, the JWT likely
  // expired while the user was on a page without a client-side Supabase
  // client (e.g. /onboarding after Google OAuth from free tools). The
  // server client has autoRefreshToken: false, so it won't auto-refresh.
  // Try an explicit refreshSession() — if the refresh token is still
  // valid, this mintes a new access token and updates the cookies on the
  // response. Only redirect to login if the refresh also fails.
  if (!user) {
    const hasAuthCookies = request.cookies
      .getAll()
      .some(c => c.name.startsWith(AUTH_COOKIE_NAME));
    if (hasAuthCookies) {
      const { data: refreshData } = await supabase.auth.refreshSession();
      user = refreshData.user ?? null;
    }
  }

  // No user (and refresh failed) — redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirect', pathname);
    return expireLegacyAuthCookies(request, NextResponse.redirect(url));
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
  return expireLegacyAuthCookies(request, response);
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon\\.ico|favicon\\.png|logo\\.png).*)',
  ],
};
