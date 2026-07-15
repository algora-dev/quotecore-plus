/**
 * Shared Supabase auth cookie configuration (2026-07-15).
 *
 * WHY THIS EXISTS: the marketing site (quote-core.com) and the app
 * (app.quote-core.com) are different origins served by the same Next.js
 * deployment. Free-tools users sign in on the marketing domain; the
 * signup/onboarding/dashboard journey ends on the app domain. Host-only
 * cookies (the @supabase/ssr default) do NOT cross subdomains, which
 * caused the "logged out after completing signup" bug: the session
 * existed on quote-core.com but app.quote-core.com never received it.
 *
 * Fix: on production quote-core.com hosts, scope the auth cookies to
 * `.quote-core.com` so one session is valid on ALL subdomains. On any
 * other host (vercel.app previews, localhost) we leave the default
 * host-only behaviour — you cannot set cross-subdomain cookies there.
 *
 * We also use a NEW cookie name (storage key). The legacy default name
 * (`sb-<project-ref>-auth-token`) exists as host-only cookies in current
 * users' browsers; writing a domain-scoped cookie under the SAME name
 * would create ambiguous duplicate cookies and nondeterministic session
 * reads. A new name side-steps that entirely (existing sessions get
 * logged out once — accepted trade-off). Middleware expires the legacy
 * cookies when it sees them.
 *
 * EVERY Supabase client in this codebase (browser + server + middleware)
 * MUST use these options. createBrowserClient is a singleton — the first
 * creation wins — so a single call site without these options can poison
 * the session for the whole page. Always create browser clients through
 * `createClient()` (app) or `createFreeToolsClient()` (free tools).
 */

/** New auth cookie name / storage key. Keep the `sb-` prefix — parts of
 *  the codebase (middleware refresh fallback) detect auth cookies by it. */
export const AUTH_COOKIE_NAME = 'sb-qcp-auth';

/**
 * Cookie Domain attribute for the given hostname.
 * Returns `.quote-core.com` on production quote-core.com hosts so the
 * session crosses subdomains; undefined (host-only) everywhere else.
 * Note: .co.nz hosts intentionally return undefined — a `.quote-core.com`
 * domain attribute is invalid there. Free tools redirect off .co.nz.
 */
export function authCookieDomain(hostname: string | null | undefined): string | undefined {
  if (!hostname) return undefined;
  const h = hostname.toLowerCase().split(':')[0];
  if (h === 'quote-core.com' || h.endsWith('.quote-core.com')) return '.quote-core.com';
  return undefined;
}

/** cookieOptions object for @supabase/ssr create*Client calls. */
export function authCookieOptions(hostname: string | null | undefined): {
  name: string;
  domain?: string;
} {
  const domain = authCookieDomain(hostname);
  return { name: AUTH_COOKIE_NAME, ...(domain ? { domain } : {}) };
}

/**
 * Legacy default cookie name prefix (`sb-<project-ref>-auth-token`).
 * Used by middleware to expire stale pre-migration cookies.
 */
export function legacyAuthCookiePrefix(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return null;
  try {
    const ref = new URL(url).hostname.split('.')[0];
    return `sb-${ref}-auth-token`;
  } catch {
    return null;
  }
}
