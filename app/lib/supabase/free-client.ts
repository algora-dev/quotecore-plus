import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client for free tools pages.
 *
 * UNIFIED AUTH (2026-07-14): free tools now authenticate against the MAIN
 * app Supabase project (aaavvfttkesdzblttmby) — the separate free-tools
 * project (dhpfjjbiobrrbvzdqyur) is retired. One signup counts for both
 * free tools and the app:
 *   - Tier 1: anonymous
 *   - Tier 2: authed, but no app profile / company onboarding not completed
 *   - Tier 3: authed + company with onboarding_completed_at set
 *
 * Because this uses @supabase/ssr's createBrowserClient, sessions are
 * cookie-backed. On app.quote-core.com a free-tools login therefore ALSO
 * logs the user into the app shell (middleware reads the same cookies) —
 * that's intentional: users who onboard later continue seamlessly.
 *
 * Falls back to placeholder values during build/prerender when env vars
 * aren't injected yet, preventing build failures.
 */
export function createFreeToolsClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (typeof window !== 'undefined') {
      console.error(
        '[free-tools] Supabase env vars missing from build — free tools auth is disabled. ' +
        'Add NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY to the Vercel project and redeploy.'
      );
    }
    return createBrowserClient('https://placeholder.supabase.co', 'placeholder-anon-key');
  }
  return createBrowserClient(url, key);
}
